import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // 1. Update Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase
            .from('notification_recipients')
            .update({
              delivery_status: 'READ',
              read_at: now,
            })
            .eq('user_id', user.id)
            .is('read_at', null);
        } catch (dbErr) {
          console.warn('[Supabase read-all error]:', dbErr);
        }
      }
    }

    // 2. Update MockStorageProvider
    const allRecipients = MockStorageProvider.getNotificationRecipients(undefined, user.id);
    for (const rec of allRecipients) {
      if (!rec.read_at) {
        MockStorageProvider.updateNotificationRecipient(rec.id, {
          delivery_status: rec.delivery_status === 'CLICKED' ? 'CLICKED' : 'READ',
          read_at: now,
        });
      }
    }

    return NextResponse.json({
      success: true,
      read_at: now,
      message: 'All notifications marked as read',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to mark all notifications as read.' },
      { status: 500 }
    );
  }
}
