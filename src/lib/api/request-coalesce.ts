/**
 * Saarvi Request Deduplication, SWR In-Memory Caching, and Exponential Backoff
 *
 * Prevents cascading re-renders from triggering duplicate network requests,
 * deduplicates in-flight promises, provides SWR (stale-while-revalidate) caching,
 * and handles rate limiting (HTTP 429) with exponential backoff and jitter.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const inFlightMap = new Map<string, Promise<any>>();
const memoryCache = new Map<string, CacheEntry<any>>();

export interface SwrOptions {
  ttlMs?: number;               // Time in ms before entry is considered stale (default: 30,000ms)
  staleWhileRevalidate?: boolean;// Return stale data while refetching in background (default: true)
  force?: boolean;              // Force fresh fetch bypassing cache (default: false)
}

export interface BackoffOptions {
  maxRetries?: number;          // Maximum retry attempts (default: 3)
  initialDelayMs?: number;      // Base delay in ms (default: 800ms)
  maxDelayMs?: number;          // Max delay ceiling (default: 8,000ms)
  onRetry?: (attempt: number, delayMs: number, error: any) => void;
}

/**
 * Coalesces multiple identical concurrent calls into a single in-flight Promise.
 */
export async function coalesceRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightMap.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = (async () => {
    try {
      return await fn();
    } finally {
      inFlightMap.delete(key);
    }
  })();

  inFlightMap.set(key, promise);
  return promise;
}

/**
 * In-memory Stale-While-Revalidate caching combined with in-flight deduplication.
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SwrOptions = {}
): Promise<T> {
  const {
    ttlMs = 30_000,
    staleWhileRevalidate = true,
    force = false,
  } = options;

  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  // 1. Fresh cache hit
  if (!force && cached && now - cached.timestamp < ttlMs) {
    return cached.data;
  }

  // 2. Stale cache hit with background revalidation
  if (!force && cached && staleWhileRevalidate) {
    // Fire revalidation in background without blocking
    coalesceRequest(`swr-bg:${key}`, async () => {
      try {
        const fresh = await fetcher();
        memoryCache.set(key, { data: fresh, timestamp: Date.now() });
      } catch (err) {
        console.warn(`[SWR] Background revalidation failed for ${key}:`, err);
      }
    }).catch(() => {});

    return cached.data;
  }

  // 3. Cache miss or forced refresh: coalesce and await
  return coalesceRequest(key, async () => {
    const data = await fetcher();
    memoryCache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

/**
 * Executes a network call with exponential backoff and jitter, honoring 429 Retry-After.
 */
export async function fetchWithBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 800,
    maxDelayMs = 8000,
    onRetry,
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }

      // Check if it's a 429 Rate Limit error
      let delayMs = 0;
      const status = err?.status || err?.response?.status;
      const retryAfterSec = err?.retryAfterSeconds || err?.retryAfter;

      if (status === 429 || (err?.message && String(err.message).includes('429'))) {
        if (typeof retryAfterSec === 'number' && retryAfterSec > 0) {
          delayMs = retryAfterSec * 1000;
        } else {
          // Standard exponential backoff
          delayMs = Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt - 1));
        }
      } else {
        // For other network/5xx transient errors
        delayMs = Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt - 1));
      }

      // Add full jitter (0 to 250ms) to avoid thundering herds
      const jitter = Math.floor(Math.random() * 250);
      delayMs += jitter;

      if (onRetry) {
        onRetry(attempt, delayMs, err);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Invalidates cached items matching a key or prefix.
 */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Diagnostic dump of cache status.
 */
export function getCacheDiagnostics(): {
  cachedKeys: string[];
  inFlightKeys: string[];
  totalCached: number;
} {
  return {
    cachedKeys: Array.from(memoryCache.keys()),
    inFlightKeys: Array.from(inFlightMap.keys()),
    totalCached: memoryCache.size,
  };
}
