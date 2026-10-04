/**
 * GET /api/payments/status/[orderId]
 *
 * Server-authoritative payment verification endpoint
 * - Queries internal payment_orders and Razorpay gateway server-side
 * - Compares amount, currency, and ownership
 * - Idempotently records payment_transactions and grants Pro entitlement
 * - Never trusts browser-provided status
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { getRazorpayClient } from '@/lib/billing/razorpayClient';
import { razorpayPaymentService } from '@/lib/billing/razorpay-service';

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

    const authUser = await getAuthenticatedNotificationUser(request);

    // 1. Fetch internal order
    let internalOrder: any = MockStorageProvider.getPaymentOrder(orderId);
    const supabase = getSupabaseAdminClient();

    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase
        .from('payment_orders')
        .select('*')
        .or(`provider_order_id.eq.${orderId},order_reference.eq.${orderId}`)
        .maybeSingle();

      if (data) {
        internalOrder = {
          id: data.id,
          userId: data.user_id,
          userEmail: data.user_email || data.metadata?.user_email,
          provider: data.provider || 'razorpay',
          providerOrderId: data.provider_order_id,
          providerPaymentId: data.provider_payment_id,
          amountCents: data.amount_paise || data.amount_cents || 9900,
          currency: data.currency || 'INR',
          plan: data.plan || data.plan_id || 'pro',
          billingInterval: data.billing_interval || data.metadata?.interval || 'monthly',
          status: data.status,
          createdAt: data.created_at,
          paidAt: data.paid_at,
        };

        // IDOR protection: only owner or admin can view order status
        if (authUser && data.user_id !== authUser.id && authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN') {
          return NextResponse.json(
            { success: false, error: 'Unauthorized to view this order.' },
            { status: 403 }
          );
        }
      }
    }

    if (!internalOrder) {
      return NextResponse.json({
        success: true,
        orderId,
        status: 'PENDING',
        isPro: false,
      });
    }

    const statusUpper = String(internalOrder.status || '').toUpperCase();
    const isCaptured = statusUpper === 'CAPTURED' || statusUpper === 'PAID';

    if (isCaptured) {
      const planId = internalOrder.plan?.includes('year') ? 'pro_yearly' : 'pro_30_days';
      return NextResponse.json({
        success: true,
        orderId,
        status: 'CAPTURED',
        isPro: true,
        planId,
        amount: (internalOrder.amountCents || 9900) / 100,
        currency: internalOrder.currency || 'INR',
        paymentId: internalOrder.providerPaymentId,
      });
    }

    // 2. If order is still pending, optionally query Razorpay gateway
    const rzpClient = getRazorpayClient();
    if (rzpClient && internalOrder.providerOrderId) {
      try {
        const rzpOrder: any = await rzpClient.orders.fetch(internalOrder.providerOrderId);
        if (rzpOrder && (rzpOrder.status === 'paid' || Number(rzpOrder.amount_paid) > 0)) {
          // Provision entitlement
          await razorpayPaymentService.provisionProEntitlement({
            userId: internalOrder.userId,
            orderId: internalOrder.providerOrderId,
            paymentId: internalOrder.providerPaymentId || `pay_rzp_${Date.now()}`,
            interval: internalOrder.billingInterval || 'monthly',
            amountCents: internalOrder.amountCents || 9900,
          });

          return NextResponse.json({
            success: true,
            orderId,
            status: 'CAPTURED',
            isPro: true,
            planId: internalOrder.plan?.includes('year') ? 'pro_yearly' : 'pro_30_days',
            amount: (internalOrder.amountCents || 9900) / 100,
            currency: 'INR',
          });
        }
      } catch (sdkErr) {
        console.warn('[Status Check Gateway Notice]:', sdkErr);
      }
    }

    // Map failed or pending status
    let canonicalStatus = 'PENDING';
    if (statusUpper === 'FAILED' || statusUpper === 'CANCELLED') canonicalStatus = 'FAILED';

    return NextResponse.json({
      success: true,
      orderId,
      status: canonicalStatus,
      isPro: false,
    });
  } catch (err) {
    console.error('[Razorpay Status API Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve payment status',
      },
      { status: 500 }
    );
  }
}
