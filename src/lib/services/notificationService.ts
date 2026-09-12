import {
  NotificationPreferences,
  NotificationHistoryEntry,
  ReminderScheduleRequest,
  ScheduledReminderJob,
} from '@/types/notifications';

const LOCAL_PREFS_KEY = 'saarvi_notification_prefs_v1';
const LEGACY_LOCAL_PREFS_KEY = 'docease_notification_prefs_v1';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  whatsappEnabled: false,
  whatsappVerified: false,
  defaultReminderTiming: 'same_day',
  timezone: 'Asia/Kolkata',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
};

export const notificationService = {
  /**
   * Retrieves user notification preferences with resilient local fallback.
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const res = await fetch('/api/notifications/preferences', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(data.preferences));
          }
          return data.preferences;
        }
      }
    } catch {
      // Fall through to local storage
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LOCAL_PREFS_KEY) ?? localStorage.getItem(LEGACY_LOCAL_PREFS_KEY);
        if (stored) return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      } catch {
        // Fall through
      }
    }

    return { ...DEFAULT_PREFERENCES };
  },

  /**
   * Updates notification preferences.
   */
  async savePreferences(updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getPreferences();
    const merged: NotificationPreferences = {
      ...current,
      ...updates,
      quietHours: {
        ...current.quietHours,
        ...(updates.quietHours || {}),
      },
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(merged));
    }

    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: merged }),
        credentials: 'include',
      });
    } catch {
      // Offline / resilient local fallback
    }

    return merged;
  },

  /**
   * Schedules a reminder for a planning event.
   */
  async scheduleReminder(
    request: ReminderScheduleRequest
  ): Promise<{ success: boolean; jobs?: ScheduledReminderJob[]; error?: string; code?: string }> {
    try {
      const res = await fetch('/api/notifications/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          code: data?.code || (res.status === 401 ? 'AUTH_REQUIRED' : 'SCHEDULE_FAILED'),
          error:
            data?.message ||
            'Create a free Saarvi account to receive email reminders. WhatsApp reminders are optional.',
        };
      }

      return {
        success: true,
        jobs: data?.jobs || [],
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Network error scheduling reminder.',
      };
    }
  },

  /**
   * Cancels scheduled reminders for an event when deleted.
   */
  async cancelReminder(eventId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/notifications/schedule?eventId=${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fetches notification history.
   */
  async getHistory(): Promise<NotificationHistoryEntry[]> {
    try {
      const res = await fetch('/api/notifications/history', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return data.history || [];
      }
    } catch {
      // Ignore
    }
    return [];
  },
};
