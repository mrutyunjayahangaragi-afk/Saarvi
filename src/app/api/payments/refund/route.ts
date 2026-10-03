/**
 * POST /api/payments/refund
 *
 * Admin-Authorized Cashfree Refund Processing (Prompt Section 26)
 * - Verifies requester has ADMIN or SUPER_ADMIN role
 * - Calls Cashfree PG Refund API
 * - Records refund status in database
 * - Revokes or adjusts entitlement accordingly
 */

import { NextResponse } from 'next/server';
import { CashfreeService } from '@/lib/payments/cashfree';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
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

    const supabase = getSupabaseAdminClient();
    let internalOrder: Record<string, unknown> | null = null;
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('order_reference', orderId)
        .maybeSingle();

      internalOrder = data;
    }

    const refundAmountRupees = amount
      ? Number(amount)
      : internalOrder
      ? Number(internalOrder.amount_paise) / 100
      : 99;

    const cashfree = CashfreeService.getInstance();
    const refundResult = await cashfree.createRefund(orderId, refundAmountRupees, reason);

    if (isSupabaseConfigured() && supabase && internalOrder) {
      // Mark order refunded
      await supabase
        .from('payment_orders')
        .update({ status: 'REFUNDED', updated_at: new Date().toISOString() })
        .eq('id', internalOrder.id);

      // Revoke active entitlement
      await supabase
        .from('entitlements')
        .update({ status: 'REVOKED', updated_at: new Date().toISOString() })
        .eq('user_id', internalOrder.user_id)
        .eq('status', 'ACTIVE');
    }

    return NextResponse.json({
      success: true,
      orderId,
      refundAmount: refundAmountRupees,
      refundResult,
    });
  } catch (err) {
    console.error('[Cashfree Refund Error]:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Refund failed' },
      { status: 500 }
    );
  }
}
