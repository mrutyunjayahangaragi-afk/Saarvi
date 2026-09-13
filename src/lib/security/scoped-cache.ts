/**
 * Saarvi Security: Scoped In-Memory LRU & TTL Caching (OS Concepts / Memory Management)
 *
 * Guarantees:
 * - Strictly isolated composite cache keys (e.g. `academic:${universityId}:${schemeId}:${branchId}:${semester}`).
 * - Prevents cross-tenant and cross-university cache contamination.
 * - Memory-bounded LRU eviction preventing heap exhaustion.
 * - Deterministic cache invalidation by scope prefix upon administrative mutations.
 * - Never stores private student workspace data on the server.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ScopedCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries = 1000, defaultTtlMs = 10 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU order by deleting and re-inserting
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = Date.now() + ttl;

    // LRU eviction if capacity exceeded
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, { value, expiresAt });
  }

  /**
   * Invalidates all cache entries matching a specific prefix.
   * e.g. `invalidatePrefix('academic:univ-vtu')` or `invalidatePrefix('feature:')`
   */
  invalidatePrefix(prefix: string): number {
    let evicted = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const GLOBAL_SCOPED_CACHE = new ScopedCache();

/**
 * Generates an isolated composite key for curriculum cache lookup.
 */
export function buildCurriculumCacheKey(
  universityId: string,
  schemeId: string,
  branchId: string,
  semester: number
): string {
  return `academic:${universityId}:${schemeId}:${branchId}:${semester}`;
}

/**
 * Generates an isolated key for feature flag lookup.
 */
export function buildFeatureFlagCacheKey(flagKey: string): string {
  return `feature:${flagKey}`;
}
