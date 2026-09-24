import { NextRequest, NextResponse } from 'next/server';
import { JobsFeatureControl, JobsFeatureSettings } from '@/lib/jobs/feature-control';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/career/feature-control
 * Retrieves complete authoritative Jobs & Internships settings for Admin UI.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedAdmin(req, 'ADMIN');
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const settings = JobsFeatureControl.getSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Unable to retrieve Jobs & Internships settings.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/career/feature-control
 * Updates Jobs & Internships settings with server-side validation and audit logging.
 */
export async function PUT(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedAdmin(req, 'ADMIN');
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await req.json();
    const {
      visible,
      enabled,
      mode,
      access_tier,
      navbar_visible,
      search_visible,
      beta_allowlist_enabled,
      beta_user_ids,
      beta_email_allowlist,
      maintenance_message,
    } = body;

    // Validate mode
    if (mode && !['DISABLED', 'BETA', 'ENABLED'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Must be DISABLED, BETA, or ENABLED.' },
        { status: 400 }
      );
    }

    // Validate access tier
    if (access_tier && !['FREE', 'PRO'].includes(access_tier)) {
      return NextResponse.json(
        { success: false, error: 'Invalid access tier. Must be FREE or PRO.' },
        { status: 400 }
      );
    }

    const updates: Partial<JobsFeatureSettings> = {};
    if (visible !== undefined) updates.visible = Boolean(visible);
    if (enabled !== undefined) updates.enabled = Boolean(enabled);
    if (mode) updates.mode = mode;
    if (access_tier) updates.access_tier = access_tier;
    if (navbar_visible !== undefined) updates.navbar_visible = Boolean(navbar_visible);
    if (search_visible !== undefined) updates.search_visible = Boolean(search_visible);
    if (beta_allowlist_enabled !== undefined) updates.beta_allowlist_enabled = Boolean(beta_allowlist_enabled);
    if (Array.isArray(beta_user_ids)) updates.beta_user_ids = beta_user_ids.map(String).filter(Boolean);
    if (Array.isArray(beta_email_allowlist)) {
      updates.beta_email_allowlist = beta_email_allowlist.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
    }
    if (maintenance_message !== undefined) updates.maintenance_message = String(maintenance_message).trim();

    const updated = await JobsFeatureControl.updateSettings(updates, {
      id: authResult.user.id,
      email: authResult.user.email,
      role: authResult.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Jobs & Internships settings updated successfully.',
      settings: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Unable to update Jobs & Internships settings.' },
      { status: 500 }
    );
  }
}
