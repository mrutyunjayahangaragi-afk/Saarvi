import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { toolAccessService } from '@/lib/tools/tool-access-service';
import { CANONICAL_TOOL_CATEGORIES } from '@/lib/tools/tool-registry';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'VIEW');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period') || '30d';

    let periodDays = 30;
    if (periodParam === 'today' || periodParam === '1d') periodDays = 1;
    else if (periodParam === '7d') periodDays = 7;
    else if (periodParam === '30d') periodDays = 30;
    else if (periodParam === '90d') periodDays = 90;
    else if (periodParam === 'year' || periodParam === '365d') periodDays = 365;
    else if (periodParam === 'all') periodDays = 0;

    const metrics = await toolAccessService.getAggregatedTelemetry(periodDays);

    return NextResponse.json({
      success: true,
      period: periodParam,
      periodDays,
      metrics,
      categories: CANONICAL_TOOL_CATEGORIES,
      totalTools: metrics.length,
      activeTools: metrics.filter((m) => m.status === 'AVAILABLE' || m.status === 'BETA').length,
      betaTools: metrics.filter((m) => m.status === 'BETA').length,
      disabledTools: metrics.filter((m) => m.status === 'DISABLED').length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve tool overview telemetry';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
