import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { MockStorageProvider } from '@/lib/supabase/mock-storage';

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
    const recipients = MockStorageProvider.getNotificationRecipients(id, user.id);

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Notification recipient record not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    for (const rec of recipients) {
      MockStorageProvider.updateNotificationRecipient(rec.id, {
        clicked_at: now,
        delivery_status: 'CLICKED',
        read_at: rec.read_at || now,
      });
    }

    return NextResponse.json({ success: true, clicked_at: now });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to track notification click.' },
      { status: 500 }
    );
  }
}
