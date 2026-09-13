import { NextRequest, NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';

import { buildCurriculumCacheKey, GLOBAL_SCOPED_CACHE } from '@/lib/security/scoped-cache';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimit = enforceRateLimit(request, 'public');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const { searchParams } = new URL(request.url);
    const universityId = searchParams.get('universityId');
    const schemeId = searchParams.get('schemeId');
    const branchId = searchParams.get('branchId');
    const semStr = searchParams.get('semester');

    if (!universityId || !schemeId || !branchId || !semStr) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          courses: [],
          message: 'Missing required curriculum resolution parameters (universityId, schemeId, branchId, semester).',
        },
        { status: 400 }
      );
    }

    const semester = parseInt(semStr, 10);
    if (isNaN(semester) || semester < 1) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          courses: [],
          message: 'Invalid semester number.',
        },
        { status: 400 }
      );
    }

    // Check scoped cache
    const cacheKey = buildCurriculumCacheKey(universityId, schemeId, branchId, semester);
    const cached = GLOBAL_SCOPED_CACHE.get<{ available: boolean; courses: any[]; message: string }>(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        available: cached.available,
        courses: cached.courses,
        message: cached.message,
        cached: true,
      });
    }

    // Resolve exact 4-tuple without silent fallbacks
    const resolved = academicServerStore.resolveCurriculum(universityId, schemeId, branchId, semester);
    GLOBAL_SCOPED_CACHE.set(cacheKey, resolved);

    return NextResponse.json({
      success: true,
      available: resolved.available,
      courses: resolved.courses,
      message: resolved.message,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        available: false,
        courses: [],
        error: err.message,
      },
      { status: 500 }
    );
  }
}
