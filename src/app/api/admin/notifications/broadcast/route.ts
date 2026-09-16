import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { NotificationCenterService } from '@/lib/services/notification-center-service';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';
import type { CreateBroadcastPayload } from '@/types/notifications-v2';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'VIEW');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const notifications = MockStorageProvider.getNotifications();
    const recipients = MockStorageProvider.getNotificationRecipients();
    const analytics = NotificationCenterService.getAnalyticsSummary();

    // Attach per-notification metrics
    const enriched = notifications.map((n) => {
      const notifRecipients = recipients.filter((r) => r.notification_id === n.id);
      const delivered = notifRecipients.filter((r) => r.delivery_status !== 'FAILED' && r.delivery_status !== 'PENDING').length;
      const read = notifRecipients.filter((r) => r.delivery_status === 'READ' || r.delivery_status === 'CLICKED').length;
      const clicked = notifRecipients.filter((r) => r.delivery_status === 'CLICKED').length;
      const failed = notifRecipients.filter((r) => r.delivery_status === 'FAILED').length;

      return {
        ...n,
        metrics: {
          delivered,
          read,
          clicked,
          failed,
        },
      };
    });

    return NextResponse.json({
      success: true,
      notifications: enriched,
      analytics,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch broadcasts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const body = (await request.json()) as CreateBroadcastPayload;

    if (!body.title || !body.body || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: title, body, and category are required.' },
        { status: 400 }
      );
    }

    const result = await NotificationCenterService.createBroadcast(body, {
      id: authResult.user.id,
      email: authResult.user.email,
      role: authResult.user.role,
    });

    return NextResponse.json({
      success: true,
      notification: result.notification,
      recipientCount: result.recipientCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to create broadcast.' },
      { status: 400 }
    );
  }
}
