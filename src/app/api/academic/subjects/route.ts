import { NextRequest, NextResponse } from 'next/server';
import { subjectAuthorityService } from '@/lib/academic/services/subject-authority-service';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimit = enforceRateLimit(request, 'public');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  try {
    const { searchParams } = new URL(request.url);
    const universityId = searchParams.get('universityId') || 'vtu';
    const schemeId = searchParams.get('schemeId');
    const branchId = searchParams.get('branchId');
    const semParam = searchParams.get('semester');
    const academicYear = searchParams.get('academicYear') || undefined;
    const query = searchParams.get('q') || undefined;

    if (!schemeId || !branchId || !semParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required scope parameters: schemeId, branchId, semester',
        },
        { status: 400 }
      );
    }

    const semester = parseInt(semParam, 10);
    if (isNaN(semester) || semester < 1 || semester > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid semester number (1-12).' },
        { status: 400 }
      );
    }

    const scope = {
      universityId: universityId.toLowerCase(),
      schemeId,
      branchId,
      semester,
      academicYear,
    };

    const subjects = await subjectAuthorityService.searchSubjects(scope, query);

    return NextResponse.json({
      success: true,
      scope,
      count: subjects.length,
      subjects,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to search academic subjects';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
