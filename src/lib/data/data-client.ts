/**
 * Saarvi Production-Grade Async Data Client
 *
 * Implements:
 * 1. Request Deduplication (coalescing identical in-flight requests)
 * 2. Account-Scoped Stale-While-Revalidate (SWR) Cache
 * 3. Automatic AbortController & Timeout Protection (no infinite pending requests)
 * 4. Race-Condition Safety (latest-request-wins)
 * 5. Component Unmount & Cancellation Safety
 * 6. Account Switching / Cache Invalidation
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  userId: string;
}

export interface FetchOptions<T> {
  userId?: string | null;
  scope?: string;
  ttlMs?: number;
  timeoutMs?: number;
  forceRefresh?: boolean;
  signal?: AbortSignal;
  onBackgroundUpdate?: (data: T) => void;
}

export interface FetchResult<T> {
  data: T;
  isStale: boolean;
  source: "cache" | "network" | "swr";
}

class DataClient {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlightRequests = new Map<string, Promise<unknown>>();
  private requestSequence = new Map<string, number>();

  /** Default Cache TTL: 60 seconds */
  private defaultTtlMs = 60_000;
  /** Default Network Timeout: 8 seconds */
  private defaultTimeoutMs = 8_000;

  /**
   * Generates a strictly account-scoped cache key to prevent cross-user data leakage.
   */
  public getCacheKey(endpoint: string, userId?: string | null, scope: string = "default"): string {
    const safeUser = userId ? userId.trim() : "guest";
    return `${scope}:${safeUser}:${endpoint}`;
  }

  /**
   * Fetches data with deduplication, SWR caching, timeout safety, and race protection.
   */
  public async fetch<T>(
    endpoint: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
    options: FetchOptions<T> = {}
  ): Promise<FetchResult<T>> {
    const {
      userId = "guest",
      scope = "default",
      ttlMs = this.defaultTtlMs,
      timeoutMs = this.defaultTimeoutMs,
      forceRefresh = false,
      signal: callerSignal,
      onBackgroundUpdate,
    } = options;

    const cacheKey = this.getCacheKey(endpoint, userId, scope);
    const now = Date.now();

    // Increment request sequence to enforce latest-request-wins
    const seq = (this.requestSequence.get(cacheKey) || 0) + 1;
    this.requestSequence.set(cacheKey, seq);

    // 1. Check existing cache
    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    const isCacheValid = cached && cached.userId === (userId || "guest") && now < cached.expiresAt;

    if (!forceRefresh && cached && cached.userId === (userId || "guest")) {
      if (isCacheValid) {
        // Return fresh cached data immediately
        return {
          data: cached.data,
          isStale: false,
          source: "cache",
        };
      } else {
        // Stale-While-Revalidate: Return stale data immediately and trigger background refresh
        this.revalidateInBackground(endpoint, fetcher, cacheKey, userId || "guest", ttlMs, timeoutMs, seq, onBackgroundUpdate);
        return {
          data: cached.data,
          isStale: true,
          source: "swr",
        };
      }
    }

    // 2. Check for identical in-flight request to deduplicate
    const existingPromise = this.inFlightRequests.get(cacheKey) as Promise<T> | undefined;
    if (existingPromise) {
      const data = await existingPromise;
      return {
        data,
        isStale: false,
        source: "network",
      };
    }

    // 3. Initiate network request with timeout
    const networkPromise = this.executeNetworkRequest(
      fetcher,
      timeoutMs,
      callerSignal
    ).then((data) => {
      // Only commit if this request is still the latest sequence
      if (this.requestSequence.get(cacheKey) === seq) {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + ttlMs,
          userId: userId || "guest",
        });
      }
      return data;
    }).finally(() => {
      this.inFlightRequests.delete(cacheKey);
    });

    this.inFlightRequests.set(cacheKey, networkPromise);
    const data = await networkPromise;

    return {
      data,
      isStale: false,
      source: "network",
    };
  }

  /**
   * Executes a network request with AbortController and timeout protection.
   */
  private async executeNetworkRequest<T>(
    fetcher: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    callerSignal?: AbortSignal
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Network request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    // Link caller signal if provided
    const abortHandler = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) {
        clearTimeout(timeoutId);
        throw new Error("Request was aborted before execution.");
      }
      callerSignal.addEventListener("abort", abortHandler);
    }

    try {
      const result = await fetcher(controller.signal);
      return result;
    } finally {
      clearTimeout(timeoutId);
      if (callerSignal) {
        callerSignal.removeEventListener("abort", abortHandler);
      }
    }
  }

  /**
   * Background revalidation for SWR.
   */
  private revalidateInBackground<T>(
    endpoint: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
    cacheKey: string,
    userId: string,
    ttlMs: number,
    timeoutMs: number,
    seq: number,
    onBackgroundUpdate?: (data: T) => void
  ): void {
    if (this.inFlightRequests.has(cacheKey)) return;

    const promise = this.executeNetworkRequest(fetcher, timeoutMs)
      .then((freshData) => {
        if (this.requestSequence.get(cacheKey) === seq) {
          this.cache.set(cacheKey, {
            data: freshData,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttlMs,
            userId,
          });
          if (onBackgroundUpdate) {
            onBackgroundUpdate(freshData);
          }
        }
        return freshData;
      })
      .catch((err) => {
        console.warn(`[DataClient SWR] Background revalidation failed for ${endpoint}:`, err?.message || err);
      })
      .finally(() => {
        this.inFlightRequests.delete(cacheKey);
      });

    this.inFlightRequests.set(cacheKey, promise);
  }

  /**
   * Mutates cache entry immediately (e.g. for optimistic updates).
   */
  public mutate<T>(
    endpoint: string,
    updater: T | ((prev: T | undefined) => T),
    userId: string = "guest",
    scope: string = "default"
  ): void {
    const cacheKey = this.getCacheKey(endpoint, userId, scope);
    const existing = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    const newData = typeof updater === "function" ? (updater as (prev: T | undefined) => T)(existing?.data) : updater;

    this.cache.set(cacheKey, {
      data: newData,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.defaultTtlMs,
      userId,
    });
  }

  /**
   * Invalidates cached data for a specific user or scope.
   */
  public invalidate(endpointOrPattern?: string, userId?: string): void {
    if (!endpointOrPattern && !userId) {
      this.cache.clear();
      this.inFlightRequests.clear();
      return;
    }

    for (const [key, entry] of this.cache.entries()) {
      const matchesUser = !userId || entry.userId === userId;
      const matchesPattern = !endpointOrPattern || key.includes(endpointOrPattern);
      if (matchesUser && matchesPattern) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Resets all private cache when switching accounts or signing out.
   */
  public clearUserSession(userId?: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (!userId || entry.userId === userId || entry.userId !== "guest") {
        this.cache.delete(key);
      }
    }
  }
}

export const dataClient = new DataClient();
