/**
 * GET /api/payments/my-orders
 *
 * User payment history endpoint (Prompt Section 48)
 * - Returns the authenticated user's payment orders and transactions
 * - Never leaks provider secrets or other users' data
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthenticatedNotificationUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({
        success: true,
        orders: [],
      });
    }

    const { data: orders, error } = await supabase
      .from('payment_orders')
      .select('id, plan_id, order_reference, amount_paise, currency, status, created_at, updated_at')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[My Orders Fetch Error]:', error);
      return NextResponse.json({ success: true, orders: [] });
    }

    const formatted = (orders || []).map((o) => ({
      id: o.id,
      orderReference: o.order_reference,
      planId: o.plan_id,
      amount: o.amount_paise / 100,
      currency: o.currency,
      status: o.status,
      createdAt: o.created_at,
    }));

    return NextResponse.json({
      success: true,
      orders: formatted,
    });
  } catch (err) {
    console.error('[My Orders API Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve orders' },
      { status: 500 }
    );
  }
}
