import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { notificationServerStore } from '@/lib/notifications/server-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      return NextResponse.json({ history: [] });
    }

    const history = notificationServerStore.getHistoryByUserId(user.id);
    return NextResponse.json({ history });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error fetching notification history.' },
      { status: 500 }
    );
  }
}
