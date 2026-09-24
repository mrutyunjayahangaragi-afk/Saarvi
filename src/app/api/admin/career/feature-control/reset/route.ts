import { NextRequest, NextResponse } from 'next/server';
import { JobsFeatureControl } from '@/lib/jobs/feature-control';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/career/feature-control/reset
 * Resets Jobs & Internships settings to defaults.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedAdmin(req, 'ADMIN');
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const resetSettings = await JobsFeatureControl.resetToDefaults({
      id: authResult.user.id,
      email: authResult.user.email,
      role: authResult.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Jobs & Internships settings reset to defaults.',
      settings: resetSettings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Unable to reset Jobs & Internships settings.' },
      { status: 500 }
    );
  }
}
