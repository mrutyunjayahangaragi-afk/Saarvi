import { NextResponse } from 'next/server';
import { academicServerStore } from '@/lib/academic/academic-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const all = academicServerStore.getUniversities();
    const enabled = all.filter((u) => u.status === 'ENABLED');
    return NextResponse.json({
      success: true,
      universities: enabled,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
