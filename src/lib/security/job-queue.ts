/**
 * Saarvi Asynchronous Job Queue & Dead-Letter Queue (OS Concepts Implementation)
 *
 * Implements:
 * 1. Priority-based CPU/Worker Scheduling (CRITICAL > HIGH > NORMAL > LOW with FIFO within bands).
 * 2. Resource Fairness: Per-user queue limits preventing single-user denial of service.
 * 3. Lifecycle States: PENDING -> RUNNING -> SUCCEEDED / RETRYING -> FAILED / DEAD_LETTER.
 * 4. Bounded Exponential Backoff: Transient failure retry protection without retry storms.
 * 5. Dead-Letter Queue (DLQ): Safe operational telemetry on permanently failed jobs.
 * 6. Execution Timeout Protection: Reclaims stalled jobs.
 */

export type JobPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type JobState =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'RETRYING'
  | 'FAILED'
  | 'DEAD_LETTER';

export interface JobOptions {
  priority?: JobPriority;
  maxRetries?: number;
  timeoutMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface JobRecord<T = unknown, R = unknown> {
  id: string;
  type: string;
  userId: string;
  priority: JobPriority;
  state: JobState;
  data: T;
  result?: R;
  error?: string;
  attempts: number;
  maxRetries: number;
  timeoutMs: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  nextRunAt: number;
}

export class JobQueue {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly maxQueuePerUser: number;
  private readonly maxGlobalQueue: number;

  private static readonly PRIORITY_WEIGHTS: Record<JobPriority, number> = {
    CRITICAL: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
  };

  constructor(maxQueuePerUser = 10, maxGlobalQueue = 1000) {
    this.maxQueuePerUser = maxQueuePerUser;
    this.maxGlobalQueue = maxGlobalQueue;
  }

  /**
   * Submits a new job to the queue, validating global and per-user fairness quotas.
   */
  submit<T>(
    type: string,
    userId: string,
    data: T,
    options: JobOptions = {}
  ): JobRecord<T> {
    if (this.jobs.size >= this.maxGlobalQueue) {
      throw new Error(`Global job queue capacity reached (${this.maxGlobalQueue}). Please retry shortly.`);
    }

    // Resource Fairness: enforce per-user queue quota
    let userActiveCount = 0;
    for (const j of this.jobs.values()) {
      if (j.userId === userId && (j.state === 'PENDING' || j.state === 'RUNNING' || j.state === 'RETRYING')) {
        userActiveCount++;
      }
    }

    if (userActiveCount >= this.maxQueuePerUser) {
      throw new Error(`User active job quota reached (${this.maxQueuePerUser}). Wait for previous tasks to complete.`);
    }

    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    const record: JobRecord<T> = {
      id,
      type,
      userId,
      priority: options.priority || 'NORMAL',
      state: 'PENDING',
      data,
      attempts: 0,
      maxRetries: options.maxRetries ?? 3,
      timeoutMs: options.timeoutMs ?? 30000,
      initialBackoffMs: options.initialBackoffMs ?? 1000,
      maxBackoffMs: options.maxBackoffMs ?? 16000,
      createdAt: now,
      updatedAt: now,
      nextRunAt: now,
    };

    this.jobs.set(id, record as JobRecord);
    return record;
  }

  /**
   * Retrieves the next eligible job following Priority + FIFO scheduling.
   */
  getNextJob(): JobRecord | null {
    const now = Date.now();
    const eligible: JobRecord[] = [];

    // Reclaim hung running jobs
    for (const job of this.jobs.values()) {
      if (job.state === 'RUNNING' && job.startedAt && now - job.startedAt > job.timeoutMs) {
        this.handleFailure(job.id, `Execution timed out after ${job.timeoutMs}ms.`);
      }

      if ((job.state === 'PENDING' || job.state === 'RETRYING') && now >= job.nextRunAt) {
        eligible.push(job);
      }
    }

    if (eligible.length === 0) return null;

    // Sort by priority (CRITICAL=0, HIGH=1, NORMAL=2, LOW=3), then by createdAt (FIFO)
    eligible.sort((a, b) => {
      const weightDiff = JobQueue.PRIORITY_WEIGHTS[a.priority] - JobQueue.PRIORITY_WEIGHTS[b.priority];
      if (weightDiff !== 0) return weightDiff;
      return a.createdAt - b.createdAt;
    });

    const job = eligible[0];
    job.state = 'RUNNING';
    job.attempts++;
    job.startedAt = now;
    job.updatedAt = now;
    return job;
  }

  complete<R>(jobId: string, result?: R): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.state = 'SUCCEEDED';
    job.result = result;
    job.completedAt = Date.now();
    job.updatedAt = Date.now();
  }

  handleFailure(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.error = error;
    job.updatedAt = Date.now();

    if (job.attempts <= job.maxRetries) {
      job.state = 'RETRYING';
      // Bounded exponential backoff: base * 2^(attempts-1) + jitter
      const jitter = Math.floor(Math.random() * 200);
      const backoff = Math.min(
        job.maxBackoffMs,
        job.initialBackoffMs * Math.pow(2, job.attempts - 1) + jitter
      );
      job.nextRunAt = Date.now() + backoff;
    } else {
      // Exceeded max retries -> Move to Dead-Letter Queue
      job.state = 'DEAD_LETTER';
      job.completedAt = Date.now();
    }
  }

  getJob(jobId: string): JobRecord | null {
    return this.jobs.get(jobId) || null;
  }

  getJobsByState(state: JobState): JobRecord[] {
    return Array.from(this.jobs.values()).filter((j) => j.state === state);
  }

  getDeadLetterJobs(): JobRecord[] {
    return this.getJobsByState('DEAD_LETTER');
  }

  getMetrics() {
    let pending = 0;
    let running = 0;
    let succeeded = 0;
    let retrying = 0;
    let deadLetter = 0;

    for (const j of this.jobs.values()) {
      if (j.state === 'PENDING') pending++;
      else if (j.state === 'RUNNING') running++;
      else if (j.state === 'SUCCEEDED') succeeded++;
      else if (j.state === 'RETRYING') retrying++;
      else if (j.state === 'DEAD_LETTER') deadLetter++;
    }

    return {
      total: this.jobs.size,
      pending,
      running,
      succeeded,
      retrying,
      deadLetter,
    };
  }

  clear(): void {
    this.jobs.clear();
  }
}

export const GLOBAL_JOB_QUEUE = new JobQueue();
