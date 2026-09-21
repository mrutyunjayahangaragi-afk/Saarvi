import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { adminDbAggregates } from '@/lib/services/admin-db-aggregates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/activity?period=30d&category=all
 * P1 Endpoint: Returns adaptive grouped platform activity, success vs error metrics, and top tools.
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
    const period = searchParams.get('period') || '30d';
    const category = searchParams.get('category') || 'all';

    const data = await adminDbAggregates.getPlatformActivity(period, category);

    return NextResponse.json({
      success: true,
      period,
      category,
      grouping: data.grouping,
      totalEvents: data.totalEvents,
      successfulOperations: data.successfulOperations,
      failedOperations: data.failedOperations,
      successRate: data.successRate,
      timeSeries: data.timeSeries,
      topTools: data.topTools,
    });
  } catch (error: any) {
    console.error('[Admin Activity API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch platform activity analytics' }, { status: 500 });
  }
}
