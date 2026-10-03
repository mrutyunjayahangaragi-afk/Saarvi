/**
 * GET /api/payments/current-entitlement
 *
 * Returns the authenticated user's active Pro entitlement status,
 * validity dates, and days remaining.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { getActiveProEntitlement } from '@/lib/payments/entitlement-service';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthenticatedNotificationUser(request);

    if (!authUser) {
      return NextResponse.json({
        success: true,
        isPro: false,
        entitlement: null,
      });
    }

    const result = await getActiveProEntitlement(authUser.id);

    return NextResponse.json({
      success: true,
      isPro: result.isPro,
      entitlement: result.entitlement,
    });
  } catch (err) {
    console.error('[Current Entitlement Fetch Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ENTITLEMENT_FETCH_FAILED',
          message: err instanceof Error ? err.message : 'Failed to query entitlement.',
        },
      },
      { status: 500 }
    );
  }
}
