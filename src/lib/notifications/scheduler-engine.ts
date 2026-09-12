import {
  ScheduledReminderJob,
  NotificationPreferences,
  ReminderScheduleRequest,
  ReminderTiming,
  NotificationStatus,
} from '@/types/notifications';
import { NotificationEmailProvider } from './providers/email-provider';
import { NotificationWhatsAppProvider } from './providers/whatsapp-provider';

/**
 * Calculates the UTC target execution timestamp for a given event, time, timezone, and reminder offset.
 */
export function calculateReminderTargetTimestamp(
  scheduledDate: string,
  scheduledTime: string | undefined,
  timezone: string,
  reminderTiming: ReminderTiming,
  customOffsetMinutes?: number
): number {
  const timeStr = scheduledTime && scheduledTime.trim() ? scheduledTime.trim() : '09:00';
  const isoDateTimeStr = `${scheduledDate}T${timeStr.padStart(5, '0')}:00`;

  // Parse time with timezone consideration
  let eventTimestamp: number;
  try {
    // Try building date with timezone
    const dateObj = new Date(isoDateTimeStr);
    eventTimestamp = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
  } catch {
    eventTimestamp = Date.now();
  }

  let offsetMinutes = 0;
  switch (reminderTiming) {
    case 'same_day':
      offsetMinutes = 0;
      break;
    case '1_day_before':
      offsetMinutes = 24 * 60;
      break;
    case '2_hours_before':
      offsetMinutes = 120;
      break;
    case '1_hour_before':
      offsetMinutes = 60;
      break;
    case 'custom':
      offsetMinutes = customOffsetMinutes && customOffsetMinutes > 0 ? customOffsetMinutes : 0;
      break;
  }

  return eventTimestamp - offsetMinutes * 60 * 1000;
}

/**
 * Checks if a specific timestamp falls inside user quiet hours in their timezone.
 */
export function isWithinQuietHours(
  timestampMs: number,
  timezone: string,
  quietHours: { enabled: boolean; start: string; end: string }
): boolean {
  if (!quietHours.enabled) return false;

  const date = new Date(timestampMs);
  let localHours = date.getUTCHours();
  let localMinutes = date.getUTCMinutes();

  // Try formatting with user's timezone if supported
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(date);

    for (const part of parts) {
      if (part.type === 'hour') localHours = parseInt(part.value, 10);
      if (part.type === 'minute') localMinutes = parseInt(part.value, 10);
    }
  } catch {
    // Fallback to UTC if timezone is invalid
  }

  const currentMinutesFromMidnight = localHours * 60 + localMinutes;

  const [startH, startM] = quietHours.start.split(':').map(Number);
  const [endH, endM] = quietHours.end.split(':').map(Number);

  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  // Overnight quiet hours (e.g. 22:00 to 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutesFromMidnight >= startMinutes || currentMinutesFromMidnight < endMinutes;
  }

  // Same-day quiet hours (e.g. 13:00 to 15:00)
  return currentMinutesFromMidnight >= startMinutes && currentMinutesFromMidnight < endMinutes;
}

/**
 * Calculates next allowed execution time if timestamp falls inside quiet hours.
 */
export function getNextAllowedExecutionTime(
  timestampMs: number,
  timezone: string,
  quietHours: { enabled: boolean; start: string; end: string }
): number {
  if (!isWithinQuietHours(timestampMs, timezone, quietHours)) {
    return timestampMs;
  }

  const [endH, endM] = quietHours.end.split(':').map(Number);
  const date = new Date(timestampMs);

  // Advance to end of quiet hours (usually next morning)
  date.setUTCHours(endH, endM, 0, 0);
  if (date.getTime() <= timestampMs) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date.getTime();
}

/**
 * Generates an idempotent deduplication key for a notification occurrence.
 */
export function generateIdempotencyKey(
  eventId: string,
  channel: 'email' | 'whatsapp',
  targetTimestamp: number
): string {
  return `${eventId}_${channel}_${targetTimestamp}`;
}

/**
 * Creates scheduled reminder jobs for an event and user preferences.
 */
export function createReminderJobsForEvent(
  request: ReminderScheduleRequest,
  preferences: NotificationPreferences,
  user: { id: string; email?: string; phone?: string } | null
): ScheduledReminderJob[] {
  // If unauthenticated / guest, external reminders cannot be scheduled
  if (!user || !user.id) {
    return [];
  }

  const timing = request.reminderTiming || preferences.defaultReminderTiming || 'same_day';
  const rawTargetTime = calculateReminderTargetTimestamp(
    request.scheduledDate,
    request.scheduledTime,
    preferences.timezone,
    timing,
    request.customOffsetMinutes || preferences.customOffsetMinutes
  );

  const finalTargetTime = getNextAllowedExecutionTime(
    rawTargetTime,
    preferences.timezone,
    preferences.quietHours
  );

  const jobs: ScheduledReminderJob[] = [];
  const nowStr = new Date().toISOString();

  // Channel 1: Email (Free, default channel)
  const shouldSendEmail =
    request.channels?.email !== undefined ? request.channels.email : preferences.emailEnabled;

  if (shouldSendEmail && user.email) {
    const idempotencyKey = generateIdempotencyKey(request.eventId, 'email', finalTargetTime);
    jobs.push({
      id: `job_em_${request.eventId}_${Date.now()}`,
      eventId: request.eventId,
      userId: user.id,
      eventType: request.eventType,
      eventTitle: request.eventTitle,
      scheduledDate: request.scheduledDate,
      scheduledTime: request.scheduledTime,
      timezone: preferences.timezone,
      reminderTiming: timing,
      targetExecutionTimestamp: finalTargetTime,
      channel: 'email',
      recipient: user.email,
      status: 'SCHEDULED',
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
  }

  // Channel 2: WhatsApp (Optional, independent channel)
  const shouldSendWhatsApp =
    request.channels?.whatsapp !== undefined
      ? request.channels.whatsapp
      : preferences.whatsappEnabled;

  const recipientPhone =
    request.phoneOverride || preferences.whatsappPhoneNumber || user.phone;

  if (shouldSendWhatsApp && recipientPhone) {
    const idempotencyKey = generateIdempotencyKey(request.eventId, 'whatsapp', finalTargetTime);
    jobs.push({
      id: `job_wa_${request.eventId}_${Date.now()}`,
      eventId: request.eventId,
      userId: user.id,
      eventType: request.eventType,
      eventTitle: request.eventTitle,
      scheduledDate: request.scheduledDate,
      scheduledTime: request.scheduledTime,
      timezone: preferences.timezone,
      reminderTiming: timing,
      targetExecutionTimestamp: finalTargetTime,
      channel: 'whatsapp',
      recipient: recipientPhone,
      status: 'SCHEDULED',
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
  }

  return jobs;
}

/**
 * Checks if a delivery error is permanent (non-retryable).
 */
export function isPermanentFailure(error?: string): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('invalid email') ||
    lower.includes('invalid recipient') ||
    lower.includes('invalid phone') ||
    lower.includes('not configured') ||
    lower.includes('unregistered') ||
    lower.includes('malformed') ||
    lower.includes('bad request') ||
    lower.includes('400')
  );
}

/**
 * Processes due reminder jobs independently.
 */
export async function processDueReminderJobs(
  jobs: ScheduledReminderJob[],
  nowMs: number,
  emailProvider: NotificationEmailProvider,
  whatsAppProvider: NotificationWhatsAppProvider
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  updatedJobs: ScheduledReminderJob[];
}> {
  let succeeded = 0;
  let failed = 0;
  const updatedJobs: ScheduledReminderJob[] = [];

  for (const job of jobs) {
    // Filter out jobs that are not due or already in terminal state
    const isDue = job.targetExecutionTimestamp <= nowMs;
    const canProcess =
      job.status === 'SCHEDULED' ||
      job.status === 'PROCESSING' ||
      (job.status === 'FAILED' && job.retryCount < job.maxRetries);

    if (!isDue || !canProcess) {
      updatedJobs.push(job);
      continue;
    }

    const jobCopy = { ...job, updatedAt: new Date().toISOString() };
    jobCopy.status = 'PROCESSING';

    if (job.channel === 'email') {
      try {
        const result = await emailProvider.sendReminder({
          idempotencyKey: job.idempotencyKey,
          toEmail: job.recipient,
          subject: `Saarvi reminder: ${job.eventTitle}`,
          bodyText: `Your ${job.eventType.replace(/_/g, ' ')} "${job.eventTitle}" is scheduled for ${
            job.scheduledDate
          }${job.scheduledTime ? ` at ${job.scheduledTime}` : ''} (${job.timezone}).`,
          eventTitle: job.eventTitle,
          eventType: job.eventType,
          scheduledDate: job.scheduledDate,
          scheduledTime: job.scheduledTime,
          timezone: job.timezone,
        });

        if (result.success && result.status === 'SENT') {
          jobCopy.status = 'SENT';
          jobCopy.deliveredAt = result.timestamp;
          jobCopy.lockedBy = undefined;
          jobCopy.lockExpiresAt = undefined;
          succeeded++;
        } else {
          jobCopy.lastError = result.error || 'Email delivery failed.';
          const permanent = isPermanentFailure(result.error);
          if (permanent || result.status === 'NOT_CONFIGURED') {
            jobCopy.status = result.status === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'FAILED';
            jobCopy.retryCount = jobCopy.maxRetries;
          } else {
            jobCopy.retryCount += 1;
            jobCopy.status = jobCopy.retryCount >= jobCopy.maxRetries ? 'FAILED' : 'SCHEDULED';
            // Exponential backoff for next retry (5 min * retryCount)
            jobCopy.targetExecutionTimestamp = nowMs + jobCopy.retryCount * 5 * 60 * 1000;
          }
          jobCopy.lockedBy = undefined;
          jobCopy.lockExpiresAt = undefined;
          failed++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown email error.';
        jobCopy.lastError = errorMsg;
        if (isPermanentFailure(errorMsg)) {
          jobCopy.status = 'FAILED';
          jobCopy.retryCount = jobCopy.maxRetries;
        } else {
          jobCopy.retryCount += 1;
          jobCopy.status = jobCopy.retryCount >= jobCopy.maxRetries ? 'FAILED' : 'SCHEDULED';
          jobCopy.targetExecutionTimestamp = nowMs + jobCopy.retryCount * 5 * 60 * 1000;
        }
        jobCopy.lockedBy = undefined;
        jobCopy.lockExpiresAt = undefined;
        failed++;
      }
    } else if (job.channel === 'whatsapp') {
      try {
        const result = await whatsAppProvider.sendTemplateMessage({
          idempotencyKey: job.idempotencyKey,
          toPhone: job.recipient,
          templateName: 'saarvi_event_reminder',
          parameters: {
            eventType: job.eventType,
            eventTitle: job.eventTitle,
            scheduledTime: `${job.scheduledDate} ${job.scheduledTime || ''}`.trim(),
          },
        });

        if (result.success && result.status === 'SENT') {
          jobCopy.status = 'SENT';
          jobCopy.deliveredAt = result.timestamp;
          jobCopy.lockedBy = undefined;
          jobCopy.lockExpiresAt = undefined;
          succeeded++;
        } else {
          jobCopy.lastError = result.error || 'WhatsApp delivery failed.';
          const permanent = isPermanentFailure(result.error);
          if (permanent || result.status === 'NOT_CONFIGURED') {
            jobCopy.status = result.status === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'FAILED';
            jobCopy.retryCount = jobCopy.maxRetries;
          } else {
            jobCopy.retryCount += 1;
            jobCopy.status = jobCopy.retryCount >= jobCopy.maxRetries ? 'FAILED' : 'SCHEDULED';
            jobCopy.targetExecutionTimestamp = nowMs + jobCopy.retryCount * 5 * 60 * 1000;
          }
          jobCopy.lockedBy = undefined;
          jobCopy.lockExpiresAt = undefined;
          failed++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown WhatsApp error.';
        jobCopy.lastError = errorMsg;
        if (isPermanentFailure(errorMsg)) {
          jobCopy.status = 'FAILED';
          jobCopy.retryCount = jobCopy.maxRetries;
        } else {
          jobCopy.retryCount += 1;
          jobCopy.status = jobCopy.retryCount >= jobCopy.maxRetries ? 'FAILED' : 'SCHEDULED';
          jobCopy.targetExecutionTimestamp = nowMs + jobCopy.retryCount * 5 * 60 * 1000;
        }
        jobCopy.lockedBy = undefined;
        jobCopy.lockExpiresAt = undefined;
        failed++;
      }
    }

    updatedJobs.push(jobCopy);
  }

  return {
    processed: succeeded + failed,
    succeeded,
    failed,
    updatedJobs,
  };
}
