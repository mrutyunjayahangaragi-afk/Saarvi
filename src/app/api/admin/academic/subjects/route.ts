import { NextRequest, NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedAdmin(request, 'ADMIN');
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const universityId = searchParams.get('universityId') || undefined;
    const schemeId = searchParams.get('schemeId') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const semStr = searchParams.get('semester');
    const semester = semStr ? parseInt(semStr, 10) : undefined;
    const status = (searchParams.get('status') as any) || undefined;

    const subjects = academicServerStore.getSubjects({
      universityId,
      schemeId,
      branchId,
      semester,
      status,
    });

    return NextResponse.json({ success: true, subjects });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAdmin(request, 'SUPER_ADMIN');
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const created = academicServerStore.createSubject(
      {
        universityId: body.universityId,
        schemeId: body.schemeId,
        branchId: body.branchId,
        semester: parseInt(body.semester, 10),
        subjectCode: body.subjectCode,
        subjectName: body.subjectName,
        credits: Number(body.credits),
        courseType: body.courseType,
        seeApplicable: body.seeApplicable,
        status: body.status || 'PUBLISHED',
        category: body.category,
      },
      auth.user.email
    );

    return NextResponse.json({ success: true, subject: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedAdmin(request, 'SUPER_ADMIN');
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Subject id is required.' }, { status: 400 });
    }

    const updated = academicServerStore.updateSubject(
      body.id,
      {
        subjectName: body.subjectName,
        subjectCode: body.subjectCode,
        credits: body.credits !== undefined ? Number(body.credits) : undefined,
        courseType: body.courseType,
        seeApplicable: body.seeApplicable,
        status: body.status,
      },
      auth.user.email
    );

    return NextResponse.json({ success: true, subject: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedAdmin(request, 'SUPER_ADMIN');
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Subject id parameter is required.' }, { status: 400 });
    }

    const deleted = academicServerStore.deleteSubject(id, auth.user.email);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Subject not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

