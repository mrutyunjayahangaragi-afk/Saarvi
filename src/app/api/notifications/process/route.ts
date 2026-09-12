import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { notificationServerStore } from '@/lib/notifications/server-store';
import { processDueReminderJobs } from '@/lib/notifications/scheduler-engine';
import { providerFactory } from '@/lib/notifications/providers/provider-factory';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';

export const dynamic = 'force-dynamic';

function isAuthorizedCronRequest(request: Request, userRole?: string): boolean {
  // 1. Admin users are always authorized
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return true;
  }

  // 2. Check CRON_SECRET if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization') || '';
    const cronHeader = request.headers.get('x-cron-secret') || '';

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : cronHeader.trim();
    if (!token) return false;

    const expectedBuf = Buffer.from(cronSecret, 'utf8');
    const actualBuf = Buffer.from(token, 'utf8');

    if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return true;
    }
    return false;
  }

  // 3. Development / Test fallback (if no secret set and not in production)
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedNotificationUser(request);
    const authorized = isAuthorizedCronRequest(request, user?.role);

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid administrative session or CRON_SECRET required.' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const rawNow = url.searchParams.get('now');
    let nowMs = Date.now();

    // Sanitize timestamp input: must be reasonable number within 24 hours of current time
    if (rawNow) {
      const parsed = parseInt(rawNow, 10);
      if (!isNaN(parsed) && Math.abs(parsed - Date.now()) <= 24 * 60 * 60 * 1000) {
        nowMs = parsed;
      }
    }

    // Use Phase 24 Atomic Worker Leasing (prevents duplicate worker processing)
    const workerId = `cron_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const dueJobs = notificationServerStore.claimDueJobs(nowMs, workerId, 60000, 50);

    const result = await processDueReminderJobs(
      dueJobs,
      nowMs,
      providerFactory.getEmailProvider(),
      providerFactory.getWhatsAppProvider()
    );

    // Persist status updates back into server queue
    notificationServerStore.saveJobs(result.updatedJobs);

    return NextResponse.json({
      success: true,
      workerId,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      timestamp: new Date(nowMs).toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Error processing notification queue.',
      },
      { status: 500 }
    );
  }
}

/**
 * Vercel Cron jobs invoke scheduled paths via HTTP GET with Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  return POST(request);
}

