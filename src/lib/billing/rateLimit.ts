// DocEase Phase 14 & 15: Rate Limiter Abstraction for Billing APIs
// Protects checkout, webhook, and subscription management endpoints from abuse and brute-force attacks.
//
// OPERATIONAL ARCHITECTURE NOTE (Phase 15 Section 20):
// In-memory sliding-window rate limiting functions deterministically on single-instance
// servers and container runtimes. In multi-region serverless function deployments (e.g. Vercel),
// in-memory counters are local to the function execution context.
// For distributed multi-instance enforcement, configure a shared Redis / Upstash backend
// via registerDistributedRateLimiter().

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  checkLimit(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> | RateLimitResult;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const getStore = (): Map<string, RateLimitRecord> => {
  const g = globalThis as unknown as { __rateLimitStore?: Map<string, RateLimitRecord> };
  if (!g.__rateLimitStore) {
    g.__rateLimitStore = new Map<string, RateLimitRecord>();
  }
  return g.__rateLimitStore;
};

export class InMemoryRateLimiter implements RateLimiter {
  checkLimit(identifier: string, limit: number = 10, windowMs: number = 60000): RateLimitResult {
    const store = getStore();
    const now = Date.now();

    // Periodic cleanup of expired keys if map grows large
    if (store.size > 2000) {
      for (const [key, record] of store.entries()) {
        if (now > record.resetAt) {
          store.delete(key);
        }
      }
    }

    const existing = store.get(identifier);

    if (!existing || now > existing.resetAt) {
      const newRecord: RateLimitRecord = {
        count: 1,
        resetAt: now + windowMs,
      };
      store.set(identifier, newRecord);
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: newRecord.resetAt,
      };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
      };
    }

    existing.count += 1;
    store.set(identifier, existing);

    return {
      allowed: true,
      remaining: limit - existing.count,
      resetAt: existing.resetAt,
    };
  }
}

let activeRateLimiter: RateLimiter = new InMemoryRateLimiter();

export function registerDistributedRateLimiter(limiter: RateLimiter): void {
  activeRateLimiter = limiter;
}

/**
 * Checks if an action by an identifier (e.g. userId or IP) is within the rate limit.
 *
 * @param identifier Unique key (e.g. `checkout:user_123` or `subscription:ip_1.2.3.4`)
 * @param limit Maximum allowed requests within window
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000
): RateLimitResult {
  return activeRateLimiter.checkLimit(identifier, limit, windowMs) as RateLimitResult;
}
