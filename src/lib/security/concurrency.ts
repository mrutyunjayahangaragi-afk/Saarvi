/**
 * Saarvi Security & Concurrency Engine (OS Concepts Implementation)
 *
 * Implements:
 * 1. AsyncSemaphore: Bounded concurrency control for scarce external resources (AI, OCR, SMTP).
 * 2. boundedParallel: Memory-safe worker pool preventing unbounded Promise.all exhaustion.
 * 3. AsyncLock: Key-scoped mutual exclusion lock preventing race conditions on shared state.
 * 4. IdempotencyManager: Request deduplication and replay protection with bounded TTL.
 */

export class BackpressureError extends Error {
  readonly status = 429;
  constructor(message = 'Server is currently experiencing high load. Please retry shortly.') {
    super(message);
    this.name = 'BackpressureError';
  }
}

export class LockTimeoutError extends Error {
  readonly status = 503;
  constructor(message = 'Operation lock acquisition timed out.') {
    super(message);
    this.name = 'LockTimeoutError';
  }
}

// ============================================================================
// 1. ASYNC SEMAPHORE (OS Concept: Counting Semaphore / Resource Bounding)
// ============================================================================
export class AsyncSemaphore {
  private currentPermits: number;
  private readonly maxPermits: number;
  private readonly maxQueueLength: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxPermits: number, maxQueueLength: number = 100) {
    if (maxPermits <= 0) throw new Error('Semaphore permits must be > 0');
    this.maxPermits = maxPermits;
    this.currentPermits = maxPermits;
    this.maxQueueLength = maxQueueLength;
  }

  get availablePermits(): number {
    return this.currentPermits;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  async acquire(timeoutMs?: number): Promise<() => void> {
    if (this.currentPermits > 0) {
      this.currentPermits--;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    if (this.queue.length >= this.maxQueueLength) {
      throw new BackpressureError(`Concurrency queue full (${this.queue.length}/${this.maxQueueLength}). Request rejected.`);
    }

    return new Promise<() => void>((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;

      const grant = () => {
        if (timer) clearTimeout(timer);
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      };

      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          const index = this.queue.indexOf(grant);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(new LockTimeoutError(`Timed out waiting for semaphore permit after ${timeoutMs}ms.`));
          }
        }, timeoutMs);
      }

      this.queue.push(grant);
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const nextGrant = this.queue.shift();
      if (nextGrant) nextGrant();
    } else {
      if (this.currentPermits < this.maxPermits) {
        this.currentPermits++;
      }
    }
  }

  async withPermit<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const release = await this.acquire(timeoutMs);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

// Global semaphores for platform scarce resources
export const AI_SEMAPHORE = new AsyncSemaphore(5, 50);       // Max 5 concurrent AI requests
export const OCR_SEMAPHORE = new AsyncSemaphore(5, 50);      // Max 5 concurrent OCR requests
export const SMTP_SEMAPHORE = new AsyncSemaphore(3, 30);     // Max 3 concurrent SMTP sends
export const BATCH_SEMAPHORE = new AsyncSemaphore(2, 20);    // Max 2 concurrent bulk imports

// ============================================================================
// 2. BOUNDED PARALLEL EXECUTOR (OS Concept: Worker Pool / Controlled Concurrency)
// ============================================================================
/**
 * Executes an array of asynchronous tasks with strict bounded concurrency,
 * preventing heap exhaustion from unbounded Promise.all over user collections.
 */
export async function boundedParallel<T, R>(
  items: T[],
  workerFn: (item: T, index: number) => Promise<R>,
  concurrencyLimit: number = 4
): Promise<R[]> {
  if (!items || items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrencyLimit, 16));
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await workerFn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

// ============================================================================
// 3. KEY-SCOPED ASYNC LOCK (OS Concept: Mutual Exclusion / Mutex)
// ============================================================================
/**
 * Fine-grained mutual exclusion lock keyed by resource identifier.
 * Eliminates race conditions (e.g. duplicate webhook processing, simultaneous
 * curriculum publishing, double payment validation) without locking unrelated resources.
 */
export class AsyncLock {
  private readonly locks = new Map<string, Promise<void>>();

  async acquire(key: string, timeoutMs: number = 15000): Promise<() => void> {
    const currentPromise = this.locks.get(key) || Promise.resolve();

    let releaseLock!: () => void;
    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(key, newLock);

    const acquirePromise = currentPromise.then(() => {
      let released = false;
      return () => {
        if (!released) {
          released = true;
          if (this.locks.get(key) === newLock) {
            this.locks.delete(key);
          }
          releaseLock();
        }
      };
    });

    if (timeoutMs > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new LockTimeoutError(`Lock acquisition for key "${key}" timed out after ${timeoutMs}ms.`)), timeoutMs);
      });
      return Promise.race([acquirePromise, timeoutPromise]);
    }

    return acquirePromise;
  }

  async withLock<T>(key: string, fn: () => Promise<T>, timeoutMs: number = 15000): Promise<T> {
    const release = await this.acquire(key, timeoutMs);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }
}

export const GLOBAL_LOCK = new AsyncLock();

// ============================================================================
// 4. IDEMPOTENCY MANAGER (OS Concept: Operation Deduplication & Replay Safety)
// ============================================================================
export interface IdempotencyRecord<T = unknown> {
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response?: T;
  error?: string;
  createdAt: number;
  expiresAt: number;
}

export class IdempotencyManager {
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Evaluates or registers an idempotency key.
   * Returns:
   * - { isDuplicate: false } if the key is new and registered for processing.
   * - { isDuplicate: true, status: 'IN_PROGRESS' } if currently being processed.
   * - { isDuplicate: true, status: 'COMPLETED', response } if already processed (replay).
   */
  start<T = unknown>(key: string, ttlMs?: number): {
    isDuplicate: boolean;
    status?: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    response?: T;
    error?: string;
  } {
    this.cleanup();
    const existing = this.records.get(key);

    if (existing) {
      if (Date.now() <= existing.expiresAt) {
        return {
          isDuplicate: true,
          status: existing.status,
          response: existing.response as T,
          error: existing.error,
        };
      }
      this.records.delete(key);
    }

    const ttl = ttlMs || this.defaultTtlMs;
    this.records.set(key, {
      status: 'IN_PROGRESS',
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    });

    return { isDuplicate: false };
  }

  complete<T = unknown>(key: string, response: T): void {
    const record = this.records.get(key);
    if (record) {
      record.status = 'COMPLETED';
      record.response = response;
    }
  }

  fail(key: string, error: string): void {
    const record = this.records.get(key);
    if (record) {
      record.status = 'FAILED';
      record.error = error;
    }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.expiresAt) {
        this.records.delete(key);
      }
    }
  }

  clear(): void {
    this.records.clear();
  }
}

export const GLOBAL_IDEMPOTENCY = new IdempotencyManager();
