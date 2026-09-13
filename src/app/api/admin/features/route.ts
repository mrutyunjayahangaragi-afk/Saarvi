import { NextResponse } from 'next/server';
import { featureServerStore } from '@/lib/features/feature-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { FeatureFlagStatus, FeatureAccessMode } from '@/types/admin';

import { GLOBAL_LOCK } from '@/lib/security/concurrency';
import { GLOBAL_SCOPED_CACHE } from '@/lib/security/scoped-cache';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Admin Feature Flags Control Endpoint
 * - GET: Returns all features with audit metrics (Requires ADMIN / SUPER_ADMIN)
 * - PATCH: Updates feature status or access mode (Requires ADMIN / SUPER_ADMIN)
 */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const authResult = await getAuthenticatedAdmin(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const features = featureServerStore.getAllFeatures();
    const metrics = featureServerStore.getAggregateMetrics();

    return NextResponse.json({
      success: true,
      features,
      metrics,
    });
  } catch (err: any) {
    console.error('[Admin Features API GET] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error while loading admin feature flags.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const rateLimit = enforceRateLimit(request, 'adminMutations');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, status, accessMode, visibility } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request: "id" is required and must be a valid string.' },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses: FeatureFlagStatus[] = ['ENABLED', 'DISABLED', 'BETA', 'MAINTENANCE'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status: must be one of ${validStatuses.join(', ')}.` },
        { status: 400 }
      );
    }

    // Validate accessMode if provided
    const validAccessModes: FeatureAccessMode[] = ['FREE', 'SUBSCRIPTION'];
    if (accessMode !== undefined && !validAccessModes.includes(accessMode)) {
      return NextResponse.json(
        { error: `Invalid accessMode: must be one of ${validAccessModes.join(', ')}.` },
        { status: 400 }
      );
    }

    // Validate visibility if provided
    if (visibility !== undefined && visibility !== 'visible' && visibility !== 'hidden') {
      return NextResponse.json(
        { error: 'Invalid visibility: must be "visible" or "hidden".' },
        { status: 400 }
      );
    }

    const updated = await GLOBAL_LOCK.withLock(`feature:${id}`, async () => {
      const res = featureServerStore.updateFeature(
        id,
        {
          ...(status !== undefined && { status }),
          ...(accessMode !== undefined && { accessMode }),
          ...(visibility !== undefined && { visibility }),
        },
        authResult.user
      );

      GLOBAL_SCOPED_CACHE.invalidatePrefix('feature:');
      return res;
    });

    return NextResponse.json({
      success: true,
      feature: updated,
      message: `Feature "${updated.name}" updated successfully.`,
    });
  } catch (err: any) {
    console.error('[Admin Features API PATCH] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error while updating feature flag.' },
      { status: 500 }
    );
  }
}
