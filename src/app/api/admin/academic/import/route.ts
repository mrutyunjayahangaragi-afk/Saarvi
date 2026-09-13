import { NextRequest, NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAdmin(request, 'SUPER_ADMIN');
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { format, data, universityId, schemeId, branchId, semester } = body;

    if (!format || !data || !universityId || !schemeId || !branchId || semester === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields (format, data, universityId, schemeId, branchId, semester).' },
        { status: 400 }
      );
    }

    const result = academicServerStore.importCurriculum(
      {
        format,
        data,
        universityId,
        schemeId,
        branchId,
        semester: parseInt(semester, 10),
      },
      auth.user.email
    );

    return NextResponse.json({
      success: true,
      importedCount: result.importedCount,
      errors: result.errors,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
