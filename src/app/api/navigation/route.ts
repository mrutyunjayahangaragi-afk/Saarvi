import { NextResponse } from 'next/server';
import { navigationStore } from '@/lib/navigation/navigation-store';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/navigation
 * Public cached endpoint returning effective runtime navigation state.
 * Combines Canonical Tool Registry + Supabase navigation_configs + Feature Flags.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const effective = await navigationStore.getEffectiveNavigation();
    return NextResponse.json({
      success: true,
      categories: effective.categories,
    });
  } catch (error: any) {
    console.error('[Public Navigation API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch navigation' },
      { status: 500 }
    );
  }
}
