import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/security/admin-auth';
import { NotificationCenterService } from '@/lib/services/notification-center-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, 'MANAGE');
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const notificationId = body.notificationId;

    const result = await NotificationCenterService.retryFailedDeliveries(notificationId);

    return NextResponse.json({
      success: true,
      retriedCount: result.retriedCount,
      message: `Retried ${result.retriedCount} delivery jobs successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retry deliveries.' }, { status: 500 });
  }
}
