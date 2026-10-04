/**
 * POST /api/payments/create-order
 *
 * Canonical Server-Authoritative Razorpay Order Creation API
 * - Authenticates user identity
 * - Reads plan and interval from authoritative server catalog (PRO_PRICING / CANONICAL_PLANS)
 * - Strictly detects and rejects any client-submitted pricing, amounts, or currency overrides
 * - Generates unique receipt
 * - Creates server Razorpay Order via official SDK
 * - Returns safe client checkout payload (orderId, amount, currency, keyId, etc.)
 * - Never leaks provider secrets to the browser
 */

import { NextResponse } from 'next/server';
import { razorpayPaymentService } from '@/lib/billing/razorpay-service';
import { checkRateLimit } from '@/lib/billing/rateLimit';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { BillingInterval } from '@/types/plan';

export async function POST(request: Request) {
  try {
    // 1. IP Rate Limiting (20 order creations per minute per IP)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
    const rateCheck = checkRateLimit(`rzp_order:${ip}`, 20, 60000);
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

    // 2. Security Invariant: Detect and reject client tampering with price/amount/currency
    if (body.price || body.amount || body.currency || body.amount_paise || body.discount) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SECURITY_VIOLATION',
            message: 'Security violation: Client cannot specify pricing or currency parameters.',
          },
        },
        { status: 400 }
      );
    }

    // 3. User Authentication & IDOR Protection
    const authUser = await getAuthenticatedNotificationUser(request, body);
    const { userId, userEmail, userName } = body;

    let effectiveUserId = authUser?.id || userId;
    let effectiveUserEmail = authUser?.email || userEmail;
    let effectiveUserName = (authUser as any)?.name || userName || (effectiveUserEmail ? effectiveUserEmail.split('@')[0] : 'Saarvi User');

    if (authUser && userId && userId !== authUser.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN_USER_MISMATCH',
            message: 'Forbidden: You cannot initiate an order for another account.',
          },
        },
        { status: 403 }
      );
    }

    if (!effectiveUserId || !effectiveUserEmail) {
      if (isSupabaseConfigured()) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required. Please sign in to upgrade to Pro.',
            },
          },
          { status: 401 }
        );
      }
      effectiveUserId = 'usr_guest_' + Date.now();
      effectiveUserEmail = 'student@saarvi.app';
    }

    // 4. Resolve Interval & Plan
    const rawPlan = String(body.plan_id || body.planId || body.plan || '').toLowerCase();
    const isYearly = rawPlan.includes('year') || body.interval === 'yearly' || body.billingInterval === 'yearly';
    const interval: BillingInterval = isYearly ? 'yearly' : 'monthly';

    // 5. Create Server-Authoritative Razorpay Order
    const orderData = await razorpayPaymentService.createPaymentOrder({
      userId: effectiveUserId,
      userEmail: effectiveUserEmail,
      userName: effectiveUserName,
      interval,
      planId: isYearly ? 'pro_yearly' : 'pro_30_days',
    });

    return NextResponse.json({
      success: true,
      orderId: orderData.orderId,
      amount: orderData.amount,
      amountDisplay: `₹${orderData.amount / 100}`,
      currency: orderData.currency,
      keyId: orderData.keyId,
      plan: orderData.plan,
      interval: orderData.interval,
      planId: orderData.planId,
      receipt: orderData.receipt,
      prefill: orderData.prefill,
      data: orderData,
      order: orderData,
    });
  } catch (err) {
    console.error('[Razorpay Create Order Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ORDER_CREATION_FAILED',
          message: err instanceof Error ? err.message : 'Failed to create payment order.',
        },
      },
      { status: 500 }
    );
  }
}
