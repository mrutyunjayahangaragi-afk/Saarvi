import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const settings = MockStorageProvider.getNotificationSystemSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch settings.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // Only SUPER_ADMIN can alter global notification controls
    const authResult = await getAuthenticatedAdmin(request, 'SUPER_ADMIN');
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Forbidden: Only SUPER_ADMIN can alter global notification settings.' },
        { status: 403 }
      );
    }

    const updates = await request.json();
    const updated = MockStorageProvider.updateNotificationSystemSettings(updates, authResult.user.email);

    MockStorageProvider.addNotificationAuditLog({
      id: `audit_${Date.now()}`,
      actor_user_id: authResult.user.id,
      action: 'NOTIFICATION_SETTINGS_CHANGED',
      metadata: updates,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update settings.' }, { status: 500 });
  }
}
