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
    let orders: any[] = [...MockStorageProvider.getAllPaymentOrders()];

    let webhookEvents: any[] = [];

    // If Supabase is configured, also fetch from live database
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const [ordersRes, webhooksRes] = await Promise.all([
            supabase
              .from('payment_orders')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(200),
            supabase
              .from('payment_webhook_events')
              .select('*')
              .order('received_at', { ascending: false })
              .limit(100),
          ]);

          if (!ordersRes.error && ordersRes.data && ordersRes.data.length > 0) {
            const mappedOrders = ordersRes.data.map((d: any) => ({
              id: d.id,
              userId: d.user_id,
              user_id: d.user_id,
              userEmail: d.user_email || d.metadata?.user_email,
              user_email: d.user_email || d.metadata?.user_email,
              userName: d.user_name || d.metadata?.user_name,
              provider: d.provider || 'cashfree',
              providerOrderId: d.provider_order_id,
              provider_order_id: d.provider_order_id,
              order_reference: d.order_reference || d.provider_order_id,
              orderReference: d.order_reference || d.provider_order_id,
              providerPaymentId: d.provider_payment_id,
              amountCents: d.amount_paise || d.amount_cents || 0,
              amount_paise: d.amount_paise || d.amount_cents || 0,
              currency: d.currency || 'INR',
              plan: d.plan || d.plan_id,
              plan_id: d.plan_id || d.plan,
              billingInterval: d.billing_interval || d.metadata?.interval || 'monthly',
              status: d.status,
              environment: d.environment || 'PRODUCTION',
              metadata: d.metadata,
              createdAt: d.created_at,
              created_at: d.created_at,
              updatedAt: d.updated_at,
              updated_at: d.updated_at,
              paidAt: d.paid_at,
            }));

            // Merge avoiding duplicates by providerOrderId / orderReference
            const existingOrderIds = new Set(orders.map((o) => o.providerOrderId || o.orderReference));
            for (const mo of mappedOrders) {
              if (!existingOrderIds.has(mo.providerOrderId || mo.orderReference)) {
                orders.push(mo);
              }
            }
          }

          if (!webhooksRes.error && webhooksRes.data) {
            webhookEvents = webhooksRes.data;
          }
        } catch (dbErr) {
          console.warn('[Admin Billing Orders DB Fetch Warning]:', dbErr);
        }
      }
    }

    // Sort by createdAt descending
    orders.sort((a, b) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime());

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
      const ordTime = new Date(ord.createdAt || ord.created_at).getTime();
      const isToday = ordTime >= oneDayAgo;

      if (isToday) todayOrdersCount++;

      const isPaid = ord.status === 'CAPTURED' || ord.status === 'paid';
      const isFailed = ord.status === 'FAILED' || ord.status === 'failed';

      if (isPaid) {
        paidOrders++;
        const amt = ord.amount_paise || ord.amountCents || 0;
        totalRevenuePaise += amt;
        if (isToday) todayRevenuePaise += amt;
      } else if (isFailed) {
        failedOrders++;
      } else {
        createdOrders++;
      }
    }

    return NextResponse.json({
      success: true,
      orders,
      webhooks: webhookEvents,
      webhookEvents,
      data: {
        orders,
        webhooks: webhookEvents,
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
