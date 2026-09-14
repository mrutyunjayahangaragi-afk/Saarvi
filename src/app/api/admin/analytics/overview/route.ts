import { NextResponse } from 'next/server';
import { analyticsStore, AnalyticsPeriod } from '@/lib/analytics/analytics-store';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/overview?period=30d
 * Returns aggregated platform metrics, top tools, DAU/WAU/MAU, adoption rates, and unused tools.
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'publicRead');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as AnalyticsPeriod) || '30d';

    const overview = await analyticsStore.getOverview(period);
    return NextResponse.json({ success: true, overview });
  } catch (error: any) {
    console.error('[Admin Analytics Overview API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate overview' }, { status: 500 });
  }
}
