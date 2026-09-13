import { NextRequest, NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';

import { GLOBAL_LOCK } from '@/lib/security/concurrency';
import { GLOBAL_SCOPED_CACHE } from '@/lib/security/scoped-cache';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit(request, 'curriculumImport');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  const auth = await getAuthenticatedAdmin(request, 'PUBLISH');
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { universityId, schemeId, branchId, semester, targetStatus } = body;

    if (!universityId || !schemeId || !branchId || semester === undefined) {
      return NextResponse.json(
        { success: false, error: 'Scope parameters (universityId, schemeId, branchId, semester) are required.' },
        { status: 400 }
      );
    }

    const lockKey = `publish:${universityId}:${schemeId}:${branchId}:${semester}`;

    const result = await GLOBAL_LOCK.withLock(lockKey, async () => {
      const pubResult = academicServerStore.publishCurriculum(
        {
          universityId,
          schemeId,
          branchId,
          semester: parseInt(semester, 10),
        },
        targetStatus || 'PUBLISHED',
        auth.user.email
      );

      // Invalidate cached curriculum for this scope
      GLOBAL_SCOPED_CACHE.invalidatePrefix(`academic:${universityId}`);

      return pubResult;
    });

    return NextResponse.json({ success: true, affectedCount: result.affectedCount });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
