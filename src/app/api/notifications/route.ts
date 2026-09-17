import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    let userNotifications: any[] = [];
    let unreadCount = 0;

    // 1. Try Supabase when configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          // Fetch recipient records for this user
          const { data: recData, error: recError } = await supabase
            .from('notification_recipients')
            .select(`
              id,
              notification_id,
              delivery_status,
              read_at,
              clicked_at,
              notifications (
                id,
                title,
                subtitle,
                body,
                category,
                type,
                priority,
                logo_url,
                image_url,
                cta_text,
                cta_url,
                created_at,
                sent_at,
                status
              )
            `)
            .eq('user_id', user.id);

          if (!recError && recData) {
            const seenNotifIds = new Set<string>();

            for (const rec of recData) {
              const notif = rec.notifications as any;
              if (!notif || notif.status === 'DRAFT' || notif.status === 'CANCELLED') continue;

              seenNotifIds.add(notif.id);
              const isRead = Boolean(rec.read_at);

              userNotifications.push({
                id: notif.id,
                recipientRecordId: rec.id,
                title: notif.title,
                subtitle: notif.subtitle,
                body: notif.body,
                category: notif.category,
                type: notif.type,
                priority: notif.priority,
                logo_url: notif.logo_url,
                image_url: notif.image_url,
                cta_text: notif.cta_text,
                cta_url: notif.cta_url,
                created_at: notif.created_at,
                sent_at: notif.sent_at,
                read: isRead,
                read_at: rec.read_at,
                clicked: Boolean(rec.clicked_at),
              });
            }

            // Also check for broadcast notifications that were sent to ALL_USERS
            const { data: broadcasts } = await supabase
              .from('notifications')
              .select('*')
              .eq('audience_type', 'ALL_USERS')
              .eq('status', 'SENT')
              .order('created_at', { ascending: false })
              .limit(30);

            if (broadcasts) {
              for (const b of broadcasts) {
                if (!seenNotifIds.has(b.id)) {
                  userNotifications.push({
                    id: b.id,
                    recipientRecordId: `broadcast_${b.id}`,
                    title: b.title,
                    subtitle: b.subtitle,
                    body: b.body,
                    category: b.category,
                    type: b.type,
                    priority: b.priority,
                    logo_url: b.logo_url,
                    image_url: b.image_url,
                    cta_text: b.cta_text,
                    cta_url: b.cta_url,
                    created_at: b.created_at,
                    sent_at: b.sent_at,
                    read: false,
                    read_at: null,
                    clicked: false,
                  });
                }
              }
            }
          }
        } catch (dbErr) {
          console.warn('[Supabase Notification Fetch Error]:', dbErr);
        }
      }
    }

    // 2. Fallback to MockStorageProvider if Supabase returned nothing or is offline
    if (userNotifications.length === 0) {
      const allRecipientRecords = MockStorageProvider.getNotificationRecipients(undefined, user.id);
      const allNotifications = MockStorageProvider.getNotifications();
      const notifMap = new Map(allNotifications.map((n) => [n.id, n]));

      userNotifications = allRecipientRecords
        .map((rec) => {
          const notif = notifMap.get(rec.notification_id);
          if (!notif || notif.status === 'DRAFT' || notif.status === 'CANCELLED') return null;

          return {
            id: notif.id,
            recipientRecordId: rec.id,
            title: notif.title,
            subtitle: notif.subtitle,
            body: notif.body,
            category: notif.category,
            type: notif.type,
            priority: notif.priority,
            logo_url: notif.logo_url,
            image_url: notif.image_url,
            cta_text: notif.cta_text,
            cta_url: notif.cta_url,
            created_at: notif.created_at,
            sent_at: notif.sent_at,
            read: Boolean(rec.read_at),
            read_at: rec.read_at,
            clicked: Boolean(rec.clicked_at),
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null);
    }

    // Filter by category
    if (category && category !== 'ALL') {
      userNotifications = userNotifications.filter(
        (n) => n.category.toUpperCase() === category.toUpperCase()
      );
    }

    // Filter unread only
    if (unreadOnly) {
      userNotifications = userNotifications.filter((n) => !n.read);
    }

    // Sort: Unread first, then by created_at DESC
    userNotifications.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    unreadCount = userNotifications.filter((n) => !n.read).length;
    const paginated = userNotifications.slice(0, limit);

    return NextResponse.json({
      success: true,
      unreadCount,
      total: userNotifications.length,
      notifications: paginated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch user notifications.' },
      { status: 500 }
    );
  }
}
