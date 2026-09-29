import { NextResponse } from 'next/server';
import { navigationStore } from '@/lib/navigation/navigation-store';
import { toolDiscoveryService } from '@/lib/navigation/tool-discovery-service';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/navigation
 * Public high-performance cached endpoint returning data-driven smart tool navigation.
 * Integrates Canonical Tool Registry + Real Completion Telemetry + Admin Controls + Fast Snapshot Cache.
 * Zero database aggregation on hover.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const { searchParams } = new URL(request.url);
    const windowParam = searchParams.get('window');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Verify navigation store effective navigation state
    await navigationStore.getEffectiveNavigation();

    const { days, period } = toolDiscoveryService.parseWindowPeriod(windowParam);
    const snapshot = await toolDiscoveryService.getNavigationSnapshot({
      windowDays: days,
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      essentialTools: snapshot.essentialTools,
      essentialSlots: snapshot.essentialSlots,
      categories: snapshot.categories,
      globalTools: snapshot.globalTools,
      windowDays: snapshot.windowDays,
      windowPeriod: snapshot.windowPeriod,
      timestamp: snapshot.timestamp,
    });
  } catch (error: any) {
    console.error('[Public Navigation API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch navigation' },
      { status: 500 }
    );
  }
}
