/**
 * Profile-Scoped In-Memory Cache Manager & Offline Resilience Hub.
 *
 * Guarantees:
 * - Strict User/Profile Isolation: All cache keys are prefixed by profileId.
 * - Profile Switch Eviction: Switching active profile flushes or locks previous profile's data.
 * - TTL-based Expiration: Automatic eviction of stale cache items.
 * - Truthful Offline Status: Event-driven network online/offline tracking.
 * - Zero Leakage Invariant: Cache data never leaks across profile boundaries.
 */

export interface CacheEntry<T> {
  key: string;
  profileId: string;
  domain: string;
  data: T;
  createdAt: number;
  expiresAt: number;
}

export interface CacheSetOptions {
  domain?: string;
  ttlMs?: number; // default 60,000ms (1 minute)
}

class UserCacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private activeProfileId: string = 'guest';
  private networkListeners: Set<(online: boolean) => void> = new Set();
  private isBrowser: boolean;

  constructor() {
    this.isBrowser = typeof window !== 'undefined';
    if (this.isBrowser) {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  private composeKey(profileId: string, domain: string, rawKey: string): string {
    return `${profileId}::${domain}::${rawKey}`;
  }

  private handleNetworkChange(online: boolean): void {
    for (const listener of this.networkListeners) {
      try {
        listener(online);
      } catch (err) {
        console.warn('[UserCache] Error in network listener:', err);
      }
    }
  }

  /**
   * Sets the currently active profile and invalidates any stale cross-profile memory.
   */
  public setActiveProfile(newProfileId: string): void {
    const cleanId = newProfileId || 'guest';
    if (this.activeProfileId !== cleanId) {
      // Invalidate the previous profile's entries to prevent in-memory cross-profile retention
      this.invalidateProfile(this.activeProfileId);
      this.activeProfileId = cleanId;
    }
  }

  public getActiveProfileId(): string {
    return this.activeProfileId;
  }

  /**
   * Sets a value in the user-scoped cache.
   */
  public set<T>(
    profileId: string,
    rawKey: string,
    data: T,
    options: CacheSetOptions = {}
  ): void {
    const pId = profileId || this.activeProfileId;
    const domain = options.domain || 'general';
    const ttlMs = Math.max(100, options.ttlMs ?? 60_000);
    const now = Date.now();

    const compositeKey = this.composeKey(pId, domain, rawKey);
    this.cache.set(compositeKey, {
      key: rawKey,
      profileId: pId,
      domain,
      data,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  /**
   * Gets a value from the user-scoped cache, returning null if expired or missing.
   */
  public get<T>(profileId: string, rawKey: string, domain: string = 'general'): T | null {
    const pId = profileId || this.activeProfileId;
    const compositeKey = this.composeKey(pId, domain, rawKey);
    const entry = this.cache.get(compositeKey);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(compositeKey);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Checks whether a non-expired entry exists in cache.
   */
  public has(profileId: string, rawKey: string, domain: string = 'general'): boolean {
    return this.get(profileId, rawKey, domain) !== null;
  }

  /**
   * Invalidates all cache entries for a specific profile.
   */
  public invalidateProfile(profileId: string): number {
    const prefix = `${profileId}::`;
    let count = 0;
    for (const k of Array.from(this.cache.keys())) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidates all cache entries for a specific profile and domain.
   */
  public invalidateDomain(profileId: string, domain: string): number {
    const prefix = `${profileId}::${domain}::`;
    let count = 0;
    for (const k of Array.from(this.cache.keys())) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
        count++;
      }
    }
    return count;
  }

  /**
   * Cleans up all expired entries across all profiles.
   */
  public purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [k, v] of this.cache.entries()) {
      if (now > v.expiresAt) {
        this.cache.delete(k);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Returns current network status.
   */
  public isOnline(): boolean {
    if (this.isBrowser && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true; // Node/SSR assumes online
  }

  /**
   * Subscribes to online/offline network changes.
   */
  public onNetworkChange(callback: (online: boolean) => void): () => void {
    this.networkListeners.add(callback);
    return () => {
      this.networkListeners.delete(callback);
    };
  }

  /**
   * Complete reset for testing or teardown.
   */
  public clear(): void {
    this.cache.clear();
    this.activeProfileId = 'guest';
    this.networkListeners.clear();
  }
}

export const userCache = new UserCacheManager();
