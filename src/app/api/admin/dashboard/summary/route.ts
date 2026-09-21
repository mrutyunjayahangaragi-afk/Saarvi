import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { adminDbAggregates } from '@/lib/services/admin-db-aggregates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard/summary?period=30d
 * P0 Endpoint: Returns authoritative platform KPIs in <50ms with zero raw-row transfer.
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

    const kpis = await adminDbAggregates.getDashboardSummary(period);

    return NextResponse.json({
      success: true,
      period,
      kpis,
    });
  } catch (error: any) {
    console.error('[Admin Dashboard Summary API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard summary' }, { status: 500 });
  }
}
