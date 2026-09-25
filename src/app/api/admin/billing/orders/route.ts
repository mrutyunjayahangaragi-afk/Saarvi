/**
 * GET /api/admin/billing/orders
 *
 * Admin & Superadmin Payment & Billing Control Center API
 * Retrieves all Razorpay payment orders, revenue metrics, and entitlement statistics.
 * Strictly gated to ADMIN and SUPER_ADMIN roles.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthenticatedNotificationUser(request);
    const isAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'SUPER_ADMIN';

    if (!isAdmin && isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: Admin access required to view billing orders.',
          },
        },
        { status: 403 }
      );
    }

    let orders = MockStorageProvider.getAllPaymentOrders();

    // If Supabase is configured, also fetch from live database
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('payment_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

          if (!error && data && data.length > 0) {
            const mappedOrders = data.map((d: any) => ({
              id: d.id,
              userId: d.user_id,
              userEmail: d.user_email,
              userName: d.user_name,
              provider: d.provider,
              providerOrderId: d.provider_order_id,
              providerPaymentId: d.provider_payment_id,
              amountCents: d.amount_cents,
              currency: d.currency,
              plan: d.plan,
              billingInterval: d.billing_interval,
              status: d.status,
              receipt: d.receipt,
              errorMessage: d.error_message,
              metadata: d.metadata,
              createdAt: d.created_at,
              updatedAt: d.updated_at,
              paidAt: d.paid_at,
            }));

            // Merge avoiding duplicates by providerOrderId
            const existingOrderIds = new Set(orders.map((o) => o.providerOrderId));
            for (const mo of mappedOrders) {
              if (!existingOrderIds.has(mo.providerOrderId)) {
                orders.push(mo);
              }
            }
          }
        } catch (dbErr) {
          console.warn('[Admin Billing Orders DB Fetch Warning]:', dbErr);
        }
      }
    }

    // Sort by createdAt descending
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Compute metrics
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let totalRevenuePaise = 0;
    let todayRevenuePaise = 0;
    let paidOrders = 0;
    let failedOrders = 0;
    let createdOrders = 0;
    let todayOrdersCount = 0;

    for (const ord of orders) {
      const ordTime = new Date(ord.createdAt).getTime();
      const isToday = ordTime >= oneDayAgo;

      if (isToday) todayOrdersCount++;

      if (ord.status === 'paid') {
        paidOrders++;
        totalRevenuePaise += ord.amountCents || 0;
        if (isToday) todayRevenuePaise += ord.amountCents || 0;
      } else if (ord.status === 'failed') {
        failedOrders++;
      } else {
        createdOrders++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orders,
        metrics: {
          totalOrders: orders.length,
          paidOrders,
          failedOrders,
          createdOrders,
          todayOrdersCount,
          totalRevenuePaise,
          todayRevenuePaise,
          totalRevenueRupees: Math.round(totalRevenuePaise / 100),
          todayRevenueRupees: Math.round(todayRevenuePaise / 100),
        },
      },
    });
  } catch (err) {
    console.error('[Admin Orders Fetch Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ORDERS_FAILED',
          message: err instanceof Error ? err.message : 'Failed to retrieve billing orders',
        },
      },
      { status: 500 }
    );
  }
}
