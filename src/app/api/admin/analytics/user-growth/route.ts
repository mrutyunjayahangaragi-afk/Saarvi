import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { adminDbAggregates } from '@/lib/services/admin-db-aggregates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/user-growth?period=30d
 * P1 Endpoint: Returns pre-aggregated daily/weekly user growth time series and status distribution.
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

    const data = await adminDbAggregates.getUserGrowth(period);

    return NextResponse.json({
      success: true,
      period,
      series: data.series,
      accountStatusDist: data.accountStatusDist,
    });
  } catch (error: any) {
    console.error('[Admin User Growth API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch user growth analytics' }, { status: 500 });
  }
}
