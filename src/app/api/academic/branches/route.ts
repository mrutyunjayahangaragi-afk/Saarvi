import { NextRequest, NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const universityId = searchParams.get('universityId') || undefined;
    const schemeId = searchParams.get('schemeId') || undefined;

    const all = academicServerStore.getBranches(universityId, schemeId);
    const enabled = all.filter((b) => b.status === 'ENABLED');

    return NextResponse.json({
      success: true,
      branches: enabled,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
