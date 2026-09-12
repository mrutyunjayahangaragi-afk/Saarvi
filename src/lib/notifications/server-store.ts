import {
  ScheduledReminderJob,
  NotificationPreferences,
  NotificationHistoryEntry,
} from '@/types/notifications';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true, // Email is free & enabled by default
  whatsappEnabled: false, // WhatsApp is optional & disabled by default
  whatsappVerified: false,
  defaultReminderTiming: 'same_day',
  timezone: 'Asia/Kolkata',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
};

// In-Memory store across Node.js server lifecycle
class NotificationServerStore {
  private preferencesMap = new Map<string, NotificationPreferences>();
  private jobsMap = new Map<string, ScheduledReminderJob>();
  private idempotencyKeyMap = new Map<string, string>(); // idempotencyKey -> jobId

  public getPreferences(userId: string): NotificationPreferences {
    const existing = this.preferencesMap.get(userId);
    if (!existing) {
      return { ...DEFAULT_PREFERENCES };
    }
    return { ...existing };
  }

  public savePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): NotificationPreferences {
    const current = this.getPreferences(userId);
    const updated: NotificationPreferences = {
      ...current,
      ...updates,
      quietHours: {
        ...current.quietHours,
        ...(updates.quietHours || {}),
      },
    };
    this.preferencesMap.set(userId, updated);
    return updated;
  }

  public saveJobs(jobs: ScheduledReminderJob[]): void {
    for (const job of jobs) {
      // Idempotency: O(1) lookup via idempotencyKeyMap
      const existingJobId = this.idempotencyKeyMap.get(job.idempotencyKey);

      if (existingJobId) {
        // If existing is already sent or processing, do not overwrite
        const existing = this.jobsMap.get(existingJobId);
        if (existing && (existing.status === 'SENT' || existing.status === 'PROCESSING')) {
          continue;
        }
        this.jobsMap.set(existingJobId, { ...job, id: existingJobId });
      } else {
        this.jobsMap.set(job.id, job);
        this.idempotencyKeyMap.set(job.idempotencyKey, job.id);
      }
    }
  }

  public getJobsByUserId(userId: string): ScheduledReminderJob[] {
    const result: ScheduledReminderJob[] = [];
    for (const job of this.jobsMap.values()) {
      if (job.userId === userId) {
        result.push({ ...job });
      }
    }
    return result.sort((a, b) => b.targetExecutionTimestamp - a.targetExecutionTimestamp);
  }

  public getPendingJobs(): ScheduledReminderJob[] {
    const result: ScheduledReminderJob[] = [];
    for (const job of this.jobsMap.values()) {
      if (job.status === 'SCHEDULED' || (job.status === 'FAILED' && job.retryCount < job.maxRetries)) {
        result.push({ ...job });
      }
    }
    return result;
  }

  /**
   * Concurrency-safe atomic job claim with worker leasing and stuck-job recovery.
   * Prevents multiple workers from claiming the same job simultaneously.
   */
  public claimDueJobs(
    nowMs: number = Date.now(),
    workerId: string = `worker_${Math.random().toString(36).slice(2, 8)}`,
    leaseTimeoutMs: number = 60000,
    limit: number = 50
  ): ScheduledReminderJob[] {
    // 1. Recover expired leases
    this.recoverStuckJobs(nowMs);

    const claimed: ScheduledReminderJob[] = [];

    for (const [id, job] of this.jobsMap.entries()) {
      if (claimed.length >= limit) break;

      const isDue = job.targetExecutionTimestamp <= nowMs;
      const canClaim =
        job.status === 'SCHEDULED' ||
        (job.status === 'FAILED' && job.retryCount < job.maxRetries);

      if (isDue && canClaim) {
        const leaseExpiry = nowMs + leaseTimeoutMs;
        const updatedJob: ScheduledReminderJob = {
          ...job,
          status: 'PROCESSING',
          lockedBy: workerId,
          lockExpiresAt: leaseExpiry,
          updatedAt: new Date().toISOString(),
        };

        this.jobsMap.set(id, updatedJob);
        claimed.push({ ...updatedJob });
      }
    }

    return claimed;
  }

  /**
   * Recovers jobs stuck in 'PROCESSING' whose lease has expired.
   */
  public recoverStuckJobs(nowMs: number = Date.now()): number {
    let recovered = 0;
    for (const [id, job] of this.jobsMap.entries()) {
      if (job.status === 'PROCESSING') {
        // If expired or missing expiry timestamp (older than 2 minutes)
        const isExpired = job.lockExpiresAt ? job.lockExpiresAt <= nowMs : true;
        if (isExpired) {
          this.jobsMap.set(id, {
            ...job,
            status: job.retryCount < job.maxRetries ? 'SCHEDULED' : 'FAILED',
            lockedBy: undefined,
            lockExpiresAt: undefined,
            lastError: 'Worker lease expired; recovered for redelivery.',
            updatedAt: new Date().toISOString(),
          });
          recovered++;
        }
      }
    }
    return recovered;
  }

  public updateJob(job: ScheduledReminderJob): void {
    const isTerminal =
      job.status === 'SENT' ||
      job.status === 'CANCELLED' ||
      job.status === 'NOT_CONFIGURED' ||
      (job.status === 'FAILED' && job.retryCount >= job.maxRetries);

    this.jobsMap.set(job.id, {
      ...job,
      lockedBy: isTerminal ? undefined : job.lockedBy,
      lockExpiresAt: isTerminal ? undefined : job.lockExpiresAt,
      updatedAt: new Date().toISOString(),
    });
  }

  public cancelJobsForEvent(eventId: string, userId?: string): number {
    let cancelledCount = 0;
    for (const [id, job] of this.jobsMap.entries()) {
      const matchesEvent = job.eventId === eventId;
      const matchesUser = userId ? job.userId === userId : true;
      if (matchesEvent && matchesUser && (job.status === 'SCHEDULED' || job.status === 'PROCESSING')) {
        this.jobsMap.set(id, {
          ...job,
          status: 'CANCELLED',
          lockedBy: undefined,
          lockExpiresAt: undefined,
          updatedAt: new Date().toISOString(),
        });
        cancelledCount++;
      }
    }
    return cancelledCount;
  }

  public getHistoryByUserId(userId: string): NotificationHistoryEntry[] {
    const jobs = this.getJobsByUserId(userId);
    return jobs.map((j) => ({
      id: j.id,
      eventId: j.eventId,
      eventTitle: j.eventTitle,
      eventType: j.eventType,
      channel: j.channel,
      scheduledDate: j.scheduledDate,
      scheduledTime: j.scheduledTime,
      targetExecutionTimestamp: j.targetExecutionTimestamp,
      status: j.status,
      updatedAt: j.updatedAt,
      lastError: j.lastError,
    }));
  }

  public getAdminAggregateMetrics() {
    let totalScheduled = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let emailSent = 0;
    let whatsAppSent = 0;
    const failures: Array<{ id: string; channel: string; error: string; time: string }> = [];

    for (const job of this.jobsMap.values()) {
      totalScheduled++;
      if (job.status === 'SENT') {
        totalSent++;
        if (job.channel === 'email') emailSent++;
        if (job.channel === 'whatsapp') whatsAppSent++;
      } else if (job.status === 'FAILED') {
        totalFailed++;
        failures.push({
          id: job.id,
          channel: job.channel,
          error: job.lastError || 'Delivery failure',
          time: job.updatedAt,
        });
      } else if (job.status === 'SCHEDULED' || job.status === 'PROCESSING') {
        totalPending++;
      }
    }

    return {
      totalScheduled,
      totalSent,
      totalFailed,
      totalPending,
      emailSent,
      whatsAppSent,
      failures: failures.slice(0, 50),
    };
  }

  public clear(): void {
    this.preferencesMap.clear();
    this.jobsMap.clear();
    this.idempotencyKeyMap.clear();
  }
}

export const notificationServerStore = new NotificationServerStore();
