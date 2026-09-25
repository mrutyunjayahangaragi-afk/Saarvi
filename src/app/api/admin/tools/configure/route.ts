import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { toolAccessService } from '@/lib/tools/tool-access-service';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const {
      toolKey,
      status,
      accessMode,
      betaFreeLimit,
      maintenanceMessage,
      rolloutPercentage,
      maxP95DurationMs,
      maxErrorRatePct,
    } = body;

    if (!toolKey || typeof toolKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid parameter: toolKey' },
        { status: 400 }
      );
    }

    const updated = await toolAccessService.saveToolConfig(
      {
        toolKey: toolKey.trim(),
        status,
        accessMode,
        betaFreeLimit: typeof betaFreeLimit === 'number' ? betaFreeLimit : undefined,
        maintenanceMessage,
        rolloutPercentage,
        maxP95DurationMs,
        maxErrorRatePct,
      },
      {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role,
      }
    );

    return NextResponse.json({
      success: true,
      config: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update tool configuration';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
