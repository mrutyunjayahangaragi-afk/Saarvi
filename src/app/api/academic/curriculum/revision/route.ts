import { NextRequest, NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';
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
          error: 'Scope parameters (universityId, schemeId, branchId, semester) are required.',
        },
        { status: 400 }
      );
    }

    const semester = parseInt(semStr, 10);
    if (isNaN(semester) || semester < 1 || semester > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid semester number (1-12).' },
        { status: 400 }
      );
    }

    const activeRev = await academicServerStore.getActiveRevisionAsync({
      universityId,
      schemeId,
      branchId,
      semester,
    });

    return NextResponse.json(
      {
        success: true,
        revision: activeRev.revisionNumber,
        publishedAt: activeRev.publishedAt,
        coursesCount: activeRev.coursesCount,
        scope: { universityId, schemeId, branchId, semester },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve curriculum revision';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
