import { NextResponse } from 'next/server';
import { getAuthenticatedNotificationUser } from '@/lib/notifications/auth-helper';
import { notificationServerStore } from '@/lib/notifications/server-store';
import { NotificationPreferences } from '@/types/notifications';
import { checkRateLimit } from '@/lib/billing/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      // Return default preferences for guest
      return NextResponse.json({
        preferences: notificationServerStore.getPreferences('guest'),
      });
    }

    const preferences = notificationServerStore.getPreferences(user.id);
    return NextResponse.json({ preferences });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error fetching preferences.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // 1. Authenticate user from session context only
    const user = await getAuthenticatedNotificationUser(request);
    if (!user) {
      return NextResponse.json(
        {
          code: 'AUTH_REQUIRED',
          message: 'Sign in to save cross-device notification preferences.',
        },
        { status: 401 }
      );
    }

    // 2. Server-side Rate Limiting (20 updates per minute per user)
    const rateCheck = checkRateLimit(`notify_prefs:${user.id}`, 20, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many preference updates. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      preferences?: Partial<NotificationPreferences>;
    };

    if (!body || typeof body !== 'object' || !body.preferences || typeof body.preferences !== 'object') {
      return NextResponse.json(
        { error: 'Invalid preferences payload.' },
        { status: 400 }
      );
    }

    const rawPrefs = body.preferences;
    const sanitizedPrefs: Partial<NotificationPreferences> = {};

    if (typeof rawPrefs.emailEnabled === 'boolean') {
      sanitizedPrefs.emailEnabled = rawPrefs.emailEnabled;
    }
    if (typeof rawPrefs.whatsappEnabled === 'boolean') {
      sanitizedPrefs.whatsappEnabled = rawPrefs.whatsappEnabled;
    }
    if (typeof rawPrefs.whatsappPhoneNumber === 'string') {
      const cleanPhone = rawPrefs.whatsappPhoneNumber.trim();
      if (cleanPhone.length > 0 && cleanPhone.length <= 20) {
        sanitizedPrefs.whatsappPhoneNumber = cleanPhone;
      }
    }
    if (typeof rawPrefs.timezone === 'string' && rawPrefs.timezone.length <= 50) {
      sanitizedPrefs.timezone = rawPrefs.timezone.trim();
    }
    if (rawPrefs.quietHours && typeof rawPrefs.quietHours === 'object') {
      sanitizedPrefs.quietHours = {
        enabled: Boolean(rawPrefs.quietHours.enabled),
        start: typeof rawPrefs.quietHours.start === 'string' ? rawPrefs.quietHours.start.slice(0, 5) : '22:00',
        end: typeof rawPrefs.quietHours.end === 'string' ? rawPrefs.quietHours.end.slice(0, 5) : '07:00',
      };
    }

    const updated = notificationServerStore.savePreferences(user.id, sanitizedPrefs);

    return NextResponse.json({
      success: true,
      preferences: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error updating preferences.' },
      { status: 500 }
    );
  }
}
