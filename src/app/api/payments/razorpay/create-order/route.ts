/**
 * POST /api/payments/razorpay/create-order
 *
 * Server-authoritative Razorpay Order Creation API (PART 7.4)
 * - Authenticates user identity
 * - Reads plan from authoritative plan configuration (PRO_PRICING)
 * - Rejects any client-submitted prices or amounts
 * - Generates unique receipt
 * - Creates server Razorpay Order
 * - Returns safe client checkout payload
 */

import { NextResponse } from 'next/server';
import { razorpayPaymentService } from '@/lib/billing/razorpay-service';
import { checkRateLimit } from '@/lib/billing/rateLimit';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { BillingInterval } from '@/types/plan';

export async function POST(request: Request) {
  try {
    // 1. IP Rate Limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
    const rateCheck = checkRateLimit(`rzp_order:${ip}`, 20, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many order creation attempts. Please wait a moment before trying again.',
          },
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await request.json();
    const plan = body.plan_id || body.plan || 'pro';
    const interval = body.interval || body.billingInterval || (body.planDuration ? body.planDuration.toLowerCase() : 'monthly');
    const { userId, userEmail, userName } = body;

    // 2. Security Invariant: Detect and reject client tampering with price/amount/currency (PART 7.4)
    if (body.price || body.amount || body.currency || body.discount) {
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
    let effectiveUserId = userId;
    let effectiveUserEmail = userEmail;

    if (authUser) {
      if (userId && userId !== authUser.id) {
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
      effectiveUserId = authUser.id;
      effectiveUserEmail = authUser.email;
    } else if (isSupabaseConfigured()) {
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

    if (!effectiveUserId || !effectiveUserEmail) {
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

    // 4. Validate plan parameter
    if (plan && plan !== 'pro') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PLAN',
            message: 'Invalid plan selected. Only the Pro plan is currently supported.',
          },
        },
        { status: 400 }
      );
    }

    const validInterval: BillingInterval = interval === 'yearly' ? 'yearly' : 'monthly';

    // 5. Create Server-Authoritative Razorpay Order
    const orderData = await razorpayPaymentService.createPaymentOrder({
      userId: effectiveUserId,
      userEmail: effectiveUserEmail,
      userName,
      interval: validInterval,
    });

    return NextResponse.json({
      success: true,
      data: orderData,
      order: orderData, // Convenient backwards compatibility
    });
  } catch (err) {
    console.error('[Razorpay Create Order Error]:', err);
    const message = err instanceof Error ? err.message : 'Failed to create payment order';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ORDER_CREATION_FAILED',
          message,
        },
      },
      { status: 500 }
    );
  }
}
