import { NextRequest, NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const universityId = searchParams.get('universityId') || undefined;
    const schemeId = searchParams.get('schemeId') || undefined;
    const branchId = searchParams.get('branchId') || undefined;

    const semesters = academicServerStore.getSemesters(universityId, schemeId, branchId);
    return NextResponse.json({
      success: true,
      semesters,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
