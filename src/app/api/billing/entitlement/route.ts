/**
 * GET /api/billing/entitlement
 *
 * Server-authoritative endpoint to retrieve the current user's entitlement.
 * Evaluates active subscriptions, period expiration, and DB state.
 * Never trusts localStorage or client-side claims.
 */

import { NextResponse } from 'next/server';
import { getUserEntitlement } from '@/lib/billing/entitlements';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthenticatedNotificationUser(request);
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');

    let effectiveUserId = authUser?.id || requestedUserId || '';

    // IDOR protection: standard users can only check their own entitlement
    if (authUser && requestedUserId && requestedUserId !== authUser.id && authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN') {
      effectiveUserId = authUser.id;
    }

    if (!effectiveUserId) {
      return NextResponse.json({
        success: true,
        entitlement: {
          userId: '',
          isPro: false,
          tier: 'FREE' as const,
          status: 'NONE' as const,
        },
      });
    }

    const entitlement = await getUserEntitlement(effectiveUserId);

    return NextResponse.json({
      success: true,
      entitlement,
    });
  } catch (err) {
    console.error('[API Entitlement Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ENTITLEMENT_CHECK_ERROR',
          message: err instanceof Error ? err.message : 'Failed to query entitlement',
        },
      },
      { status: 500 }
    );
  }
}
