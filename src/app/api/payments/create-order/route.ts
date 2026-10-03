/**
 * POST /api/payments/create-order
 *
 * Server-Authoritative Cashfree Order Creation (Prompt Section 8 & 13)
 * - Authenticates Saarvi user
 * - Derives price and duration server-side from canonical PRO_PRICING
 * - Rejects any client-submitted price, amount, or currency
 * - Creates internal record in payment_orders
 * - Invokes Cashfree Orders API
 * - Returns ONLY safe checkout session data to browser (never returns secret keys)
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { CashfreeService } from '@/lib/payments/cashfree';
import { PRO_PRICING } from '@/config/pricing';
import { BillingInterval } from '@/types/plan';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { checkRateLimit } from '@/lib/billing/rateLimit';

export async function POST(request: Request) {
  try {
    // 1. IP Rate Limiting (20 order creations per minute per IP)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
    const rateCheck = checkRateLimit(`cf_order:${ip}`, 20, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many order attempts. Please wait a moment before trying again.',
          },
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await request.json().catch(() => ({}));

    // 2. Reject any client-submitted price or amount (Section 8)
    if (body.amount || body.price || body.currency || body.amount_paise) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SECURITY_VIOLATION',
            message: 'Client cannot supply pricing or currency parameters.',
          },
        },
        { status: 400 }
      );
    }

    // 3. User Authentication
    const authUser = await getAuthenticatedNotificationUser(request, body);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You must be signed in to upgrade your plan.',
          },
        },
        { status: 401 }
      );
    }

    // 4. Resolve Canonical Plan & Price Server-Side
    let interval: BillingInterval = 'monthly';
    const rawPlanId = String(body.planId || body.plan || '').toLowerCase();
    if (rawPlanId.includes('year') || body.interval === 'yearly') {
      interval = 'yearly';
    }

    const planConfig = PRO_PRICING[interval];
    if (!planConfig) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PLAN',
            message: 'Requested plan configuration not found.',
          },
        },
        { status: 400 }
      );
    }

    const canonicalPlanId = `pro_${interval}`;
    const amountPaise = planConfig.amountCents; // e.g. 9900 paise = ₹99
    const currency = 'INR';

    // 5. Generate deterministic, collision-resistant order references
    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    const orderReference = `saarvi_ord_${Date.now()}_${uniqueSuffix}`;
    const orderExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes TTL

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://saarvi.app';
    const returnUrl = `${origin}/payment/success?order_id=${orderReference}`;

    // 6. Record order in Supabase payment_orders
    const supabase = getSupabaseAdminClient();
    if (isSupabaseConfigured() && supabase) {
      const { error: dbError } = await supabase.from('payment_orders').insert({
        user_id: authUser.id,
        plan_id: canonicalPlanId,
        provider: 'cashfree',
        provider_order_id: orderReference,
        order_reference: orderReference,
        amount_paise: amountPaise,
        currency,
        status: 'CREATED',
        environment: process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
        expires_at: orderExpiresAt.toISOString(),
        metadata: {
          user_email: authUser.email,
          user_name: (authUser as any).name || authUser.email?.split('@')[0] || 'Saarvi Student',
          interval,
        },
      });

      if (dbError) {
        console.error('[Cashfree DB Insert Error]:', dbError);
        // Continue if table doesn't block local dev
      }
    }

    // 7. Invoke Cashfree PG Orders API
    const cashfreeService = CashfreeService.getInstance();
    const cfResult = await cashfreeService.createOrder({
      orderId: orderReference,
      amountPaise,
      currency,
      customer: {
        customerId: authUser.id,
        customerEmail: authUser.email || 'student@saarvi.app',
        customerName: (authUser as any).name || authUser.email?.split('@')[0] || 'Saarvi Student',
      },
      returnUrl,
      orderNote: `Saarvi Pro (${interval})`,
    });

    // 8. Update DB with payment session id
    if (isSupabaseConfigured() && supabase) {
      await supabase
        .from('payment_orders')
        .update({
          payment_session_id: cfResult.paymentSessionId,
          status: 'PENDING',
        })
        .eq('order_reference', orderReference);
    }

    // 9. Return ONLY safe checkout information
    return NextResponse.json({
      success: true,
      orderId: orderReference,
      paymentSessionId: cfResult.paymentSessionId,
      amountDisplay: planConfig.amountDisplay,
      currency: 'INR',
      planId: canonicalPlanId,
      interval,
    });
  } catch (err) {
    console.error('[Cashfree Create Order Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ORDER_CREATION_FAILED',
          message: err instanceof Error ? err.message : 'Unable to create payment order.',
        },
      },
      { status: 500 }
    );
  }
}
