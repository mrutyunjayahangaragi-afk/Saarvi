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
    const schemes = academicServerStore.getSchemes(universityId);
    return NextResponse.json({ success: true, schemes });
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
    const created = academicServerStore.createScheme(
      {
        universityId: body.universityId,
        name: body.name,
        year: body.year,
        version: body.version,
        status: body.status,
      },
      auth.user.email
    );

    return NextResponse.json({ success: true, scheme: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
