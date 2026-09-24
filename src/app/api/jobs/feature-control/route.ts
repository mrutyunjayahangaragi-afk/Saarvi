import { NextResponse } from 'next/server';
import { JobsFeatureControl } from '@/lib/jobs/feature-control';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs/feature-control
 * Public status endpoint for client navbar, search, and page guards.
 */
export async function GET() {
  try {
    const status = JobsFeatureControl.getPublicStatus();
    return NextResponse.json({
      success: true,
      ...status,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      visible: true,
      enabled: true,
      mode: 'ENABLED',
      access_tier: 'FREE',
      navbar_visible: true,
      search_visible: true,
      isBeta: false,
      isProRequired: false,
      maintenance_message: '',
    });
  }
}
