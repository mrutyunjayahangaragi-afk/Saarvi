import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

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

    // Fetch user-specific recipient records
    const allRecipientRecords = MockStorageProvider.getNotificationRecipients(undefined, user.id);
    const allNotifications = MockStorageProvider.getNotifications();

    const notifMap = new Map(allNotifications.map((n) => [n.id, n]));

    // Join recipient delivery records with parent notifications
    let userNotifications = allRecipientRecords
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

    const unreadCount = allRecipientRecords.filter((r) => !r.read_at).length;
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
