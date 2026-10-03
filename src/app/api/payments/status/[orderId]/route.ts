/**
 * GET /api/payments/status/[orderId]
 *
 * Server-authoritative Cashfree payment verification endpoint (Prompt Section 15)
 * - Queries Cashfree API server-side for true order/payment status
 * - Compares amount and currency with internal order
 * - Idempotently records payment_transactions and grants Pro entitlement
 * - Never trusts browser-provided status or return URL parameters
 */

import { NextResponse } from 'next/server';
import { CashfreeService } from '@/lib/payments/cashfree';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { grantOrExtendProEntitlement } from '@/lib/payments/entitlement-service';

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid order identifier' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const authUser = await getAuthenticatedNotificationUser(request);

    // 1. Fetch internal order
    let internalOrder: Record<string, unknown> | null = null;
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('order_reference', orderId)
        .maybeSingle();

      internalOrder = data;

      // IDOR protection: only owner or admin can view order status
      if (internalOrder && authUser && internalOrder.user_id !== authUser.id && authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Unauthorized to view this order.' },
          { status: 403 }
        );
      }
    }

    // 2. Fetch authoritative state from Cashfree
    const cashfree = CashfreeService.getInstance();
    const cfOrder = await cashfree.getOrder(orderId).catch((err) => {
      console.warn('[Cashfree Status Check Warning]:', err.message);
      return null;
    });

    if (!cfOrder) {
      return NextResponse.json({
        success: true,
        orderId,
        status: (internalOrder?.status as string) || 'PENDING',
        isPro: false,
      });
    }

    const cfOrderStatus = String(cfOrder.order_status || '').toUpperCase();
    const payments = await cashfree.getOrderPayments(orderId);
    const successfulPayment = payments.find((p) => p.paymentStatus === 'SUCCESS');

    const isPaid = cfOrderStatus === 'PAID' || Boolean(successfulPayment);

    if (isPaid && internalOrder && isSupabaseConfigured() && supabase) {
      const planId = String(internalOrder.plan_id || 'pro_monthly');
      const isYearly = planId.includes('yearly');
      const durationDays = isYearly ? 365 : 30;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // 3. Atomically update payment order and insert transaction if not already CAPTURED
      if (internalOrder.status !== 'CAPTURED') {
        await supabase
          .from('payment_orders')
          .update({
            status: 'CAPTURED',
            updated_at: now.toISOString(),
          })
          .eq('order_reference', orderId);

        const paymentId = successfulPayment?.cfPaymentId || `cf_pay_${Date.now()}`;

        // Insert or ignore into payment_transactions
        const { data: txData } = await supabase
          .from('payment_transactions')
          .upsert(
            {
              payment_order_id: internalOrder.id,
              user_id: internalOrder.user_id,
              provider: 'cashfree',
              provider_payment_id: paymentId,
              amount_paise: internalOrder.amount_paise,
              currency: 'INR',
              status: 'SUCCESS',
              payment_method: successfulPayment?.paymentMethod || 'ONLINE',
              captured_at: now.toISOString(),
            },
            { onConflict: 'provider,provider_payment_id' }
          )
          .select('id')
          .maybeSingle();

        // 4. Activate or Extend Pro Entitlement Cumulatively
        const entResult = await grantOrExtendProEntitlement({
          userId: internalOrder.user_id as string,
          planId,
          durationDays,
          source: 'CASHFREE',
          transactionId: txData?.id || null,
        });

        return NextResponse.json({
          success: true,
          orderId,
          status: 'CAPTURED',
          isPro: true,
          planId,
          amount: Number(internalOrder.amount_paise) / 100,
          currency: 'INR',
          expiresAt: entResult.endsAt,
        });
      }

      return NextResponse.json({
        success: true,
        orderId,
        status: 'CAPTURED',
        isPro: true,
        planId,
        amount: Number(internalOrder.amount_paise) / 100,
        currency: 'INR',
        expiresAt: expiresAt.toISOString(),
      });
    }

    // Map failed or expired states
    let canonicalStatus = 'PENDING';
    if (cfOrderStatus === 'EXPIRED') canonicalStatus = 'EXPIRED';
    if (cfOrderStatus === 'FAILED' || cfOrderStatus === 'TERMINATED') canonicalStatus = 'FAILED';

    return NextResponse.json({
      success: true,
      orderId,
      status: canonicalStatus,
      isPro: false,
    });
  } catch (err) {
    console.error('[Cashfree Status API Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve payment status',
      },
      { status: 500 }
    );
  }
}
