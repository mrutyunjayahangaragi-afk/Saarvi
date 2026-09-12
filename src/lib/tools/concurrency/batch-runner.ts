/**
 * Bounded Concurrency Batch Runner.
 *
 * Provides controlled parallel processing for compute- and memory-intensive
 * document/image operations in the browser.
 *
 * Guarantees:
 * - Bounded concurrency (2 to 4 workers adaptively) to prevent heap exhaustion.
 * - Immediate per-item buffer/object cleanup hook.
 * - Granular per-item error isolation (one item failure does not crash the batch).
 * - Full cancellation / abort signal support.
 * - Zero external dependencies.
 */

export type BatchItemStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface BatchItem<T> {
  id: string;
  data: T;
  status: BatchItemStatus;
  progress?: number;
  error?: string;
}

export interface BatchProgress<T> {
  completed: number;
  failed: number;
  total: number;
  percentage: number;
  currentItem?: BatchItem<T>;
}

export interface BatchRunnerOptions<T, R> {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: BatchProgress<T>) => void;
  cleanupItem?: (item: T, result?: R) => void | Promise<void>;
}

export interface BatchItemResult<R> {
  id: string;
  status: BatchItemStatus;
  result?: R;
  error?: string;
  durationMs: number;
}

export interface BatchExecutionResult<R> {
  results: BatchItemResult<R>[];
  total: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  totalDurationMs: number;
}

/**
 * Determines adaptive worker concurrency based on device hardware and memory limits.
 * Safe default: 2 (min 1, max 4).
 */
export function getAdaptiveConcurrency(): number {
  if (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number') {
    const cores = navigator.hardwareConcurrency;
    if (cores <= 2) return 1;
    if (cores <= 4) return 2;
    return 3; // Cap at 3-4 for browser memory safety
  }
  return 2;
}

/**
 * Executes a batch of items with bounded concurrency, adaptive worker limits,
 * progress tracking, and immediate resource release.
 */
export async function runBatchWithBoundedConcurrency<T, R>(
  items: Array<{ id: string; data: T }>,
  processor: (data: T, index: number, signal?: AbortSignal) => Promise<R>,
  options: BatchRunnerOptions<T, R> = {}
): Promise<BatchExecutionResult<R>> {
  const startTime = Date.now();
  const concurrency = Math.max(1, Math.min(options.concurrency ?? getAdaptiveConcurrency(), 4));
  const { signal, onProgress, cleanupItem } = options;

  const batchItems: BatchItem<T>[] = items.map((item) => ({
    id: item.id,
    data: item.data,
    status: 'queued',
  }));

  const results: BatchItemResult<R>[] = [];
  let nextIndex = 0;
  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;

  const notifyProgress = (currentItem?: BatchItem<T>) => {
    if (onProgress) {
      const completed = succeeded + failed + cancelled;
      const total = items.length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 100;
      onProgress({
        completed,
        failed,
        total,
        percentage,
        currentItem,
      });
    }
  };

  async function worker(workerId: number): Promise<void> {
    while (nextIndex < batchItems.length) {
      if (signal?.aborted) {
        // Mark all remaining unstarted items as cancelled
        while (nextIndex < batchItems.length) {
          const item = batchItems[nextIndex++];
          item.status = 'cancelled';
          cancelled++;
          results.push({
            id: item.id,
            status: 'cancelled',
            error: 'Operation aborted by user.',
            durationMs: 0,
          });
          notifyProgress(item);
        }
        break;
      }

      const currentIndex = nextIndex++;
      const item = batchItems[currentIndex];
      item.status = 'processing';
      notifyProgress(item);

      const itemStartTime = Date.now();
      let itemResult: R | undefined;
      let itemError: string | undefined;

      try {
        if (signal?.aborted) {
          throw new Error('Operation aborted by user.');
        }

        itemResult = await processor(item.data, currentIndex, signal);
        item.status = 'completed';
        succeeded++;

        results.push({
          id: item.id,
          status: 'completed',
          result: itemResult,
          durationMs: Date.now() - itemStartTime,
        });
      } catch (err) {
        const isAbort = signal?.aborted || (err instanceof Error && err.name === 'AbortError');
        item.status = isAbort ? 'cancelled' : 'failed';
        itemError = err instanceof Error ? err.message : 'Item processing failed';
        item.error = itemError;

        if (isAbort) {
          cancelled++;
        } else {
          failed++;
        }

        results.push({
          id: item.id,
          status: item.status,
          error: itemError,
          durationMs: Date.now() - itemStartTime,
        });
      } finally {
        // Resource cleanup hook: free bitmaps, revoked blob URLs, and array buffers immediately
        if (cleanupItem) {
          try {
            await cleanupItem(item.data, itemResult);
          } catch (cleanupErr) {
            console.warn(`[BatchRunner] Cleanup error for item ${item.id}:`, cleanupErr);
          }
        }
        notifyProgress(item);
      }
    }
  }

  // Spawn pool of adaptive workers
  const workerPromises: Promise<void>[] = [];
  const workerCount = Math.min(concurrency, items.length);

  for (let i = 0; i < workerCount; i++) {
    workerPromises.push(worker(i));
  }

  await Promise.all(workerPromises);

  return {
    results,
    total: items.length,
    succeeded,
    failed,
    cancelled,
    totalDurationMs: Date.now() - startTime,
  };
}
