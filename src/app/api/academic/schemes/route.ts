import { NextRequest, NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const universityId = searchParams.get('universityId') || undefined;

    const all = academicServerStore.getSchemes(universityId);
    const enabled = all.filter((s) => s.status === 'ENABLED');

    return NextResponse.json({
      success: true,
      schemes: enabled,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
