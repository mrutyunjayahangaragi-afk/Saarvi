// DocEase Phase 14: User Subscription Management API
// Secure endpoints to fetch user subscription state, invoice history, and request period-end cancellation.
// Includes rate limiting and structured responses.

import { NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/billing/subscriptionService';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { checkRateLimit } from '@/lib/billing/rateLimit';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');

    // Authenticated session check
    const authUser = await getAuthenticatedNotificationUser(request);
    let targetUserId = queryUserId;

    if (authUser) {
      // Invariant: Standard users can only view their own subscription
      if (queryUserId && queryUserId !== authUser.id && authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN_USER_MISMATCH',
              message: 'Forbidden: You cannot access subscription records of another user.',
            },
          },
          { status: 403 }
        );
      }
      targetUserId = authUser.id;
    } else if (isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required to view subscription details.',
          },
        },
        { status: 401 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_ID_REQUIRED',
            message: 'User ID is required to query billing status.',
          },
        },
        { status: 400 }
      );
    }

    // Rate limit status checks per user (max 30 per minute)
    const rateCheck = checkRateLimit(`sub_get:${targetUserId}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many status check requests. Please slow down.',
          },
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const subscription = await subscriptionService.getUserSubscriptionRecord(targetUserId);
    const invoices = MockStorageProvider.getInvoices(targetUserId);

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        invoices,
      },
      subscription, // Backward compatibility
      invoices,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve subscription';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_SUBSCRIPTION_FAILED',
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    // Authenticated session check
    const authUser = await getAuthenticatedNotificationUser(request, body);
    let targetUserId = userId;

    if (authUser) {
      // Invariant: Standard users can only cancel their own subscription
      if (userId && userId !== authUser.id && authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN_USER_MISMATCH',
              message: 'Forbidden: You cannot cancel subscriptions belonging to another user.',
            },
          },
          { status: 403 }
        );
      }
      targetUserId = authUser.id;
    } else if (isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required to cancel subscription.',
          },
        },
        { status: 401 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required to cancel subscription.',
          },
        },
        { status: 401 }
      );
    }

    // Rate limit cancellation attempts (max 5 per minute)
    const rateCheck = checkRateLimit(`sub_cancel:${targetUserId}`, 5, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many cancellation requests. Please try again in a minute.',
          },
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const result = await subscriptionService.cancelSubscription(userId);
    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CANCELLATION_FAILED',
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Support POST /api/billing/subscription for action=cancel
  return DELETE(request);
}
