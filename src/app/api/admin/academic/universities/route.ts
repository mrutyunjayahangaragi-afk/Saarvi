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
    const universities = academicServerStore.getUniversities();
    return NextResponse.json({ success: true, universities });
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
    const created = academicServerStore.createUniversity(
      {
        name: body.name,
        code: body.code,
        status: body.status,
      },
      auth.user.email
    );

    return NextResponse.json({ success: true, university: created }, { status: 201 });
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
      return NextResponse.json({ success: false, error: 'University id is required.' }, { status: 400 });
    }

    const updated = academicServerStore.updateUniversity(
      body.id,
      {
        name: body.name,
        code: body.code,
        status: body.status,
      },
      auth.user.email
    );

    return NextResponse.json({ success: true, university: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
