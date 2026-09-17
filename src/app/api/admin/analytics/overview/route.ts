import { NextResponse } from 'next/server';
import { AnalyticsPeriod } from '@/lib/analytics/analytics-store';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { PlatformAnalyticsService } from '@/lib/services/platform-analytics-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/overview?period=30d
 * Returns authoritative real user metrics, tool adoption, conversion history aggregates,
 * mock interview stats, and discovery channels.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  // Authorize server-authoritative admin session
  const authResult = await getAuthenticatedAdmin(request, 'VIEW');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as AnalyticsPeriod) || '30d';

    const metrics = await PlatformAnalyticsService.getComprehensiveAnalytics(period);

    return NextResponse.json({
      success: true,
      period,
      metrics,
      // Backward compatibility mapping for existing admin cards
      userMetrics: {
        totalUsers: metrics.totalUsers,
        newUsers: metrics.newUsers,
        previousNewUsers: metrics.previousNewUsers,
        trend: {
          percentage: metrics.userGrowthPercent,
          direction: metrics.userGrowthPercent >= 0 ? 'up' : 'down',
          periodLabel: period,
        },
        activeUsers: metrics.activeUsers,
        freeUsers: metrics.freeUsers,
        proUsers: metrics.proUsers,
        suspendedUsers: metrics.suspendedUsers,
      },
      overview: {
        period,
        dau: metrics.dau,
        wau: metrics.wau,
        mau: metrics.mau,
        totalEvents: metrics.totalConversions,
        totalToolRuns: metrics.totalConversions,
        toolAdoptionRate: metrics.totalUsers > 0 ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100) : 0,
        activeToolsCount: metrics.topTools.length,
        totalCanonicalTools: 68,
        topTools: metrics.topTools,
        unusedTools: [],
        discoveryChannels: metrics.discoveryChannels,
        eventTypeDistribution: {},
      },
    });
  } catch (error: any) {
    console.error('[Admin Analytics Overview API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate overview' }, { status: 500 });
  }
}
