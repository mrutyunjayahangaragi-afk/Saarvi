import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { adminDbAggregates } from '@/lib/services/admin-db-aggregates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/errors?period=30d
 * P2 Endpoint: Returns error trends, severity distribution, and top error codes.
 * CRITICAL PRIVACY RULE: Never exposes sensitive stack traces, tokens, or private contents.
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

    const data = await adminDbAggregates.getErrorAnalytics(period);

    return NextResponse.json({
      success: true,
      period,
      totalErrors: data.totalErrors,
      unresolved: data.unresolved,
      timeSeries: data.timeSeries,
      severityDistribution: data.severityDistribution,
      topErrors: data.topErrors,
    });
  } catch (error: any) {
    console.error('[Admin Errors API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch error analytics' }, { status: 500 });
  }
}
