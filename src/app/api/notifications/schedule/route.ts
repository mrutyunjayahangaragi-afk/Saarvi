import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { notificationServerStore } from '@/lib/notifications/server-store';
import { createReminderJobsForEvent } from '@/lib/notifications/scheduler-engine';
import { ReminderScheduleRequest } from '@/types/notifications';
import { checkRateLimit } from '@/lib/billing/rateLimit';

export const dynamic = 'force-dynamic';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: Request) {
  try {
    // 1. Authenticate user (server-authoritative)
    const user = await getAuthenticatedNotificationUser(request);

    // If user is guest, do NOT block local planning; inform about registration requirement
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_REQUIRED',
          message:
            'Create a free Saarvi account to receive email reminders. WhatsApp reminders are optional.',
        },
        { status: 401 }
      );
    }

    // 2. Server-side Rate Limiting (max 30 requests per minute per authenticated user)
    const rateCheck = checkRateLimit(`notify_schedule:${user.id}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many notification scheduling requests. Please wait a moment.',
        },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as ReminderScheduleRequest;

    // 3. Strict Input Validation & Bounds
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }

    const { eventId, eventTitle, scheduledDate, scheduledTime, eventType, reminderTiming } = body;

    if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0 || eventId.length > 100) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'Invalid or missing eventId (must be 1-100 characters).' },
        { status: 400 }
      );
    }

    if (!eventTitle || typeof eventTitle !== 'string' || eventTitle.trim().length === 0 || eventTitle.length > 200) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'Invalid or missing eventTitle (must be 1-200 characters).' },
        { status: 400 }
      );
    }

    if (!scheduledDate || typeof scheduledDate !== 'string' || !DATE_REGEX.test(scheduledDate)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'scheduledDate must follow YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    if (scheduledTime && (typeof scheduledTime !== 'string' || !TIME_REGEX.test(scheduledTime))) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'scheduledTime must follow HH:mm 24-hour format.' },
        { status: 400 }
      );
    }

    const validTimings = ['same_day', '1_day_before', '2_hours_before', '1_hour_before', 'custom'];
    if (reminderTiming && !validTimings.includes(reminderTiming)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'Invalid reminderTiming option specified.' },
        { status: 400 }
      );
    }

    // 4. Get user notification preferences
    const preferences = notificationServerStore.getPreferences(user.id);

    // 5. Create independent jobs for enabled channels (Email free & default; WhatsApp optional)
    const jobs = createReminderJobsForEvent(body, preferences, user);

    // 6. Persist jobs in server-side queue
    notificationServerStore.saveJobs(jobs);

    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Error scheduling notification.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // 1. Authenticate caller (Must be signed in to cancel their own notifications)
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required to delete reminders.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId || typeof eventId !== 'string' || eventId.length > 100) {
      return NextResponse.json(
        { success: false, message: 'Missing or invalid eventId query parameter.' },
        { status: 400 }
      );
    }

    // 2. Cancel jobs strictly scoped to the authenticated caller
    const cancelledCount = notificationServerStore.cancelJobsForEvent(eventId, user.id);

    return NextResponse.json({
      success: true,
      cancelledCount,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Error cancelling notification.',
      },
      { status: 500 }
    );
  }
}
