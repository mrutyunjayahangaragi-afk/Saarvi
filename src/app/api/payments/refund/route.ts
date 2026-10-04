/**
 * POST /api/payments/refund
 *
 * Admin-Authorized Razorpay Refund Processing
 * - Strictly verifies requester has ADMIN or SUPER_ADMIN role
 * - Calls official Razorpay Payments Refund API via SDK
 * - Synchronizes refund status in payment_orders & payment_transactions
 * - Revokes Pro entitlement immediately
 * - Writes safe audit log entry
 */

import { NextResponse } from 'next/server';
import { razorpayPaymentService } from '@/lib/billing/razorpay-service';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';

export async function POST(request: Request) {
  try {
    const authUser = await getAuthenticatedNotificationUser(request);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin role required for refund processing.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { orderId, amount, reason } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Missing required orderId parameter' },
        { status: 400 }
      );
    }

    const refundResult = await razorpayPaymentService.createRefund({
      orderId,
      amount: amount ? Number(amount) : undefined,
      reason: reason || 'Admin issued refund',
    });

    return NextResponse.json({
      success: true,
      orderId,
      refundAmount: refundResult.amount,
      refundId: refundResult.refundId,
      message: 'Refund processed successfully via Razorpay.',
    });
  } catch (err) {
    console.error('[Razorpay Refund Error]:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Refund failed' },
      { status: 500 }
    );
  }
}
