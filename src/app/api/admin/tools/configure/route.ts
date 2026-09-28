import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { toolAccessService } from '@/lib/tools/tool-access-service';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'authenticatedAdmin');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const authResult = await getAuthenticatedAdmin(request, 'VIEW');
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const toolKey = searchParams.get('toolKey');

  if (toolKey) {
    const history = toolAccessService.getAuditHistory(toolKey);
    const config = await toolAccessService.getToolConfig(toolKey);
    return NextResponse.json({
      success: true,
      toolKey,
      config,
      history,
    });
  }

  const allHistory = toolAccessService.getAuditHistory();
  return NextResponse.json({
    success: true,
    history: allHistory,
  });
}

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
      action,
      toolKey,
      targetVersion,
      version,
      reason,
      status,
      accessMode,
      betaFreeLimit,
      guestAllowed,
      freeAllowed,
      proAllowed,
      featured,
      navVisible,
      searchVisible,
      sortOrder,
      feedbackPromptEnabled,
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

    const cleanToolKey = toolKey.trim();

    // 1. Audit History query
    if (action === 'audit_history') {
      const history = toolAccessService.getAuditHistory(cleanToolKey);
      return NextResponse.json({
        success: true,
        toolKey: cleanToolKey,
        history,
      });
    }

    // 2. Rollback to historical version snapshot
    if (action === 'rollback') {
      if (typeof targetVersion !== 'number' || targetVersion < 1) {
        return NextResponse.json(
          { success: false, error: 'Invalid or missing targetVersion for rollback' },
          { status: 400 }
        );
      }
      const restored = await toolAccessService.rollbackToolConfig(
        cleanToolKey,
        targetVersion,
        {
          id: authResult.user.id,
          email: authResult.user.email,
          role: authResult.user.role,
        }
      );
      if (!restored) {
        return NextResponse.json(
          { success: false, error: `Historical version snapshot ${targetVersion} not found for tool ${cleanToolKey}` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Successfully rolled back ${cleanToolKey} to version ${targetVersion}`,
        config: restored,
      });
    }

    // 3. Impact Preview Calculation without saving
    if (action === 'impact_preview') {
      const impact = toolAccessService.calculateImpactSummary(cleanToolKey, {
        status,
        accessMode,
        betaFreeLimit,
        guestAllowed,
        freeAllowed,
        proAllowed,
        featured,
        navVisible,
        searchVisible,
        maintenanceMessage,
      });
      return NextResponse.json({
        success: true,
        impact,
      });
    }

    // 4. Default: Persist Tool Configuration Update
    const updated = await toolAccessService.saveToolConfig(
      {
        toolKey: cleanToolKey,
        version: typeof version === 'number' ? version : undefined,
        reason: typeof reason === 'string' ? reason : undefined,
        status,
        accessMode,
        betaFreeLimit: typeof betaFreeLimit === 'number' ? betaFreeLimit : undefined,
        guestAllowed: typeof guestAllowed === 'boolean' ? guestAllowed : undefined,
        freeAllowed: typeof freeAllowed === 'boolean' ? freeAllowed : undefined,
        proAllowed: typeof proAllowed === 'boolean' ? proAllowed : undefined,
        featured: typeof featured === 'boolean' ? featured : undefined,
        navVisible: typeof navVisible === 'boolean' ? navVisible : undefined,
        searchVisible: typeof searchVisible === 'boolean' ? searchVisible : undefined,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
        feedbackPromptEnabled: typeof feedbackPromptEnabled === 'boolean' ? feedbackPromptEnabled : undefined,
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

    const impact = toolAccessService.calculateImpactSummary(cleanToolKey, updated);

    return NextResponse.json({
      success: true,
      config: updated,
      impact,
    });
  } catch (err: unknown) {
    const errorObj = err as { message?: string; code?: string };
    const msg = errorObj.message || 'Failed to update tool configuration';
    const isConflict = errorObj.code === 'CONCURRENCY_CONFLICT' || msg.includes('ConcurrencyConflict');

    return NextResponse.json(
      {
        success: false,
        error: msg,
        code: isConflict ? 'CONCURRENCY_CONFLICT' : 'INTERNAL_ERROR',
      },
      { status: isConflict ? 409 : 500 }
    );
  }
}
