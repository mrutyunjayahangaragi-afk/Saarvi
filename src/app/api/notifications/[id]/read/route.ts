import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { id } = await params;
    const now = new Date().toISOString();

    // 1. Supabase update if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data: updated } = await supabase
            .from('notification_recipients')
            .update({
              delivery_status: 'READ',
              read_at: now,
            })
            .match({ notification_id: id, user_id: user.id });

          // If no recipient row existed (e.g. broadcast), create one marked as read
          const { count } = await supabase
            .from('notification_recipients')
            .select('*', { count: 'exact', head: true })
            .match({ notification_id: id, user_id: user.id });

          if (count === 0) {
            await supabase.from('notification_recipients').insert({
              notification_id: id,
              user_id: user.id,
              channel: 'in_app',
              delivery_status: 'READ',
              read_at: now,
              delivered_at: now,
              idempotency_key: `read_${id}_${user.id}`,
            });
          }
        } catch (dbErr) {
          console.warn('[Supabase read error]:', dbErr);
        }
      }
    }

    // 2. MockStorageProvider update
    const recipients = MockStorageProvider.getNotificationRecipients(id, user.id);
    for (const rec of recipients) {
      if (!rec.read_at) {
        MockStorageProvider.updateNotificationRecipient(rec.id, {
          read_at: now,
          delivery_status: rec.delivery_status === 'CLICKED' ? 'CLICKED' : 'READ',
        });
      }
    }

    return NextResponse.json({ success: true, read_at: now });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to mark notification as read.' },
      { status: 500 }
    );
  }
}
