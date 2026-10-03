/**
 * POST /api/payments/webhook/cashfree
 *
 * Production Cashfree Webhook Handler (Prompt Sections 16, 17, 18, 19, 20)
 * - Cryptographic HMAC-SHA256 signature verification
 * - Strict webhook idempotency via payment_webhook_events
 * - Amount and currency verification against internal payment_orders
 * - User identity derived strictly from internal order record
 * - Atomic Pro entitlement activation
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { CashfreeService } from '@/lib/payments/cashfree';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { grantOrExtendProEntitlement } from '@/lib/payments/entitlement-service';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature') || '';
    const timestamp = request.headers.get('x-webhook-timestamp') || '';

    // 1. Cryptographic Signature Verification (Section 16.3)
    const cashfreeService = CashfreeService.getInstance();
    const isSignatureValid = cashfreeService.verifyWebhookSignature(rawBody, signature, timestamp);

    if (!isSignatureValid) {
      console.error('[Cashfree Webhook] Invalid signature rejected.');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventType = String(payload.type || payload.event || 'UNKNOWN');
    const eventId = String(payload.event_id || payload.data?.payment?.cf_payment_id || `evt_${Date.now()}`);

    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

    const supabase = getSupabaseAdminClient();

    // 2. Webhook Idempotency Check (Section 17)
    if (isSupabaseConfigured() && supabase) {
      // Check if event already logged
      const { data: existingEvent } = await supabase
        .from('payment_webhook_events')
        .select('id, processed')
        .eq('provider', 'cashfree')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingEvent) {
        // Event was already received; return HTTP 200 immediately
        return NextResponse.json({ success: true, duplicate: true });
      }

      // Record incoming webhook event
      await supabase.from('payment_webhook_events').insert({
        provider: 'cashfree',
        event_id: eventId,
        event_type: eventType,
        signature_verified: true,
        processed: false,
        payload_hash: payloadHash,
      });
    }

    // 3. Extract Order and Payment Details
    const orderData = payload.data?.order || {};
    const paymentData = payload.data?.payment || {};

    const orderId = String(orderData.order_id || payload.order_id || '');
    if (!orderId) {
      return NextResponse.json({ success: true, note: 'No order_id present' });
    }

    // 4. Resolve Internal Order Record (Section 19: User identity from internal order only)
    let internalOrder: Record<string, unknown> | null = null;
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('order_reference', orderId)
        .maybeSingle();

      internalOrder = data;
    }

    if (!internalOrder) {
      console.warn(`[Cashfree Webhook] Order reference ${orderId} not found in database.`);
      return NextResponse.json({ success: true, note: 'Order not found in database' });
    }

    // 5. Amount & Currency Verification (Section 18)
    const paidAmount = Number(paymentData.payment_amount || orderData.order_amount || 0);
    const expectedAmount = Number(internalOrder.amount_paise) / 100;
    const paidCurrency = String(paymentData.payment_currency || orderData.order_currency || 'INR');

    if (Math.abs(paidAmount - expectedAmount) > 0.01 || paidCurrency !== 'INR') {
      console.error('[Cashfree Webhook Security Alert] Amount mismatch:', {
        expectedAmount,
        paidAmount,
        paidCurrency,
        orderId,
      });

      if (isSupabaseConfigured() && supabase) {
        await supabase
          .from('payment_webhook_events')
          .update({
            error_message: `Amount mismatch: expected ${expectedAmount}, received ${paidAmount} ${paidCurrency}`,
          })
          .eq('event_id', eventId);
      }

      return NextResponse.json({ error: 'Payment amount or currency mismatch' }, { status: 400 });
    }

    // 6. Handle Payment Success
    const paymentStatus = String(paymentData.payment_status || '').toUpperCase();
    const isSuccessEvent =
      eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
      eventType === 'ORDER_PAID_WEBHOOK' ||
      paymentStatus === 'SUCCESS';

    if (isSuccessEvent && isSupabaseConfigured() && supabase) {
      const userId = internalOrder.user_id as string;
      const planId = String(internalOrder.plan_id || 'pro_monthly');
      const isYearly = planId.includes('yearly');
      const durationDays = isYearly ? 365 : 30;

      const now = new Date();
      const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Update Order Status
      await supabase
        .from('payment_orders')
        .update({
          status: 'CAPTURED',
          updated_at: now.toISOString(),
        })
        .eq('id', internalOrder.id);

      // Record in Financial Ledger
      const cfPaymentId = String(paymentData.cf_payment_id || `pay_${Date.now()}`);
      const { data: tx } = await supabase
        .from('payment_transactions')
        .upsert(
          {
            payment_order_id: internalOrder.id,
            user_id: userId,
            provider: 'cashfree',
            provider_payment_id: cfPaymentId,
            amount_paise: internalOrder.amount_paise,
            currency: 'INR',
            status: 'SUCCESS',
            payment_method: String(paymentData.payment_group || 'ONLINE'),
            gateway_response_reference: payload,
            captured_at: now.toISOString(),
          },
          { onConflict: 'provider,provider_payment_id' }
        )
        .select('id')
        .maybeSingle();

      // Grant or Extend Pro Entitlement (Section 20 & 22)
      await grantOrExtendProEntitlement({
        userId,
        planId,
        durationDays,
        source: 'CASHFREE',
        transactionId: tx?.id || null,
      });

      // Mark webhook processed
      await supabase
        .from('payment_webhook_events')
        .update({
          processed: true,
          processed_at: now.toISOString(),
        })
        .eq('event_id', eventId);
    }

    return NextResponse.json({ success: true, processed: true });
  } catch (err) {
    console.error('[Cashfree Webhook Handler Error]:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal webhook processing error' },
      { status: 500 }
    );
  }
}
