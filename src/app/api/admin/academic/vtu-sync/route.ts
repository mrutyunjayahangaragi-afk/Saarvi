import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { enforceRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { VtuCurriculumService } from '@/lib/services/vtu-curriculum-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedAdmin(req, 'VIEW');
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const schemeId = searchParams.get('schemeId') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const semesterParam = searchParams.get('semester');
    const semester = semesterParam ? Number(semesterParam) : undefined;

    const versions = await VtuCurriculumService.listVersions({
      schemeId,
      branchId,
      semester,
    });

    return NextResponse.json({ success: true, versions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = enforceRateLimit(req, 'curriculumImport');
  if (!rateLimit.allowed) return createRateLimitResponse(rateLimit);

  const auth = await getAuthenticatedAdmin(req, 'MANAGE');
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { action, url, schemeId, branchId, semester, versionId, targetStatus } = body;

    if (action === 'SYNC_VTU') {
      if (!url || !schemeId || !branchId || semester === undefined) {
        return NextResponse.json(
          { error: 'Missing required parameters: url, schemeId, branchId, semester' },
          { status: 400 }
        );
      }

      const syncResult = await VtuCurriculumService.syncVtuSyllabus({
        url,
        schemeId,
        branchId,
        semester: Number(semester),
        actorEmail: auth.user.email,
      });

      if (!syncResult.success) {
        return NextResponse.json({ error: syncResult.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        version: syncResult.version,
        message: 'VTU curriculum synchronized successfully',
      });
    }

    if (action === 'TRANSITION_STATUS') {
      if (!versionId || !targetStatus) {
        return NextResponse.json(
          { error: 'Missing versionId or targetStatus' },
          { status: 400 }
        );
      }

      const transResult = await VtuCurriculumService.transitionStatus({
        versionId,
        newStatus: targetStatus,
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
      });

      if (!transResult.success) {
        return NextResponse.json({ error: transResult.error }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        message: `Curriculum status updated to ${targetStatus}`,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
