// DocEase Phase 14: Server-Authoritative Razorpay Checkout Session API
// Accepts user and interval only. Strictly rejects client-submitted prices or amounts.
// Enforces rate limiting, authentication, duplicate subscription protection, and structured responses.

import { NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/billing/subscriptionService';
import { checkRateLimit } from '@/lib/billing/rateLimit';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { BillingInterval } from '@/types/plan';

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting Check
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
    const rateCheck = checkRateLimit(`checkout:${ip}`, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many checkout attempts. Please wait a moment before trying again.',
          },
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await request.json();
    const { plan, interval, userId, userEmail, userName } = body;

    // 2. Derive trusted identity from authenticated session
    const authUser = await getAuthenticatedNotificationUser(request, body);
    let effectiveUserId = userId;
    let effectiveUserEmail = userEmail;

    if (authUser) {
      // Invariant: Reject IDOR attempt if client supplies a mismatched userId
      if (userId && userId !== authUser.id) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN_USER_MISMATCH',
              message: 'Forbidden: You cannot initiate checkout for another user account.',
            },
          },
          { status: 403 }
        );
      }
      effectiveUserId = authUser.id;
      effectiveUserEmail = authUser.email;
    } else if (isSupabaseConfigured()) {
      // Supabase is configured: strictly require verified session
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

    // Validate required authenticated user fields
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

    // 3. User-level rate limiting
    const userRateCheck = checkRateLimit(`checkout_user:${effectiveUserId}`, 10, 60000);
    if (!userRateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many checkout attempts for this account. Please wait a minute.',
          },
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // 4. Validate plan parameter
    if (plan && plan !== 'pro') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PLAN',
            message: 'Invalid plan selected. Only the Pro plan is currently available for upgrade.',
          },
        },
        { status: 400 }
      );
    }

    // 5. Validate billing interval
    const validInterval: BillingInterval = interval === 'yearly' ? 'yearly' : 'monthly';

    // 6. Security Invariant: Detect and reject client tampering with price/currency/discount
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

    // 7. Check for existing active subscription to prevent accidental duplicate purchases
    const existingActive = await subscriptionService.getActiveSubscription(effectiveUserId);
    if (existingActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACTIVE_SUBSCRIPTION_EXISTS',
            message: 'You already have an active Pro subscription.',
          },
        },
        { status: 409 }
      );
    }

    // 8. Delegate to subscription service for server-authoritative checkout creation
    const session = await subscriptionService.createCheckout({
      userId: effectiveUserId,
      userEmail: effectiveUserEmail,
      userName,
      interval: validInterval,
    });

    return NextResponse.json({
      success: true,
      data: {
        session,
      },
      session, // Backward-compatible convenience property
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    const isConflict = message.includes('already have an active');
    const isNotConfigured =
      (err as unknown as { code?: string })?.code === 'BILLING_NOT_CONFIGURED' ||
      message.includes('not configured');

    let errorCode = 'CHECKOUT_CREATION_FAILED';
    let status = 500;

    if (isConflict) {
      errorCode = 'ACTIVE_SUBSCRIPTION_EXISTS';
      status = 409;
    } else if (isNotConfigured) {
      errorCode = 'BILLING_NOT_CONFIGURED';
      status = 503;
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message,
        },
      },
      { status }
    );
  }
}
