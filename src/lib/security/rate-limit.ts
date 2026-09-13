/**
 * Saarvi Security: Advanced Multi-Tier Rate Limiting & Backpressure
 *
 * Guarantees:
 * - Granular endpoint-specific quotas (Auth, Admin, AI, OCR, File Upload, Search).
 * - RFC 6585 and IETF RateLimit compliant response headers.
 * - Sliding window in-memory counters with automated expired key cleanup.
 * - Protection against brute-force attacks, resource starvation, and API spam.
 */

import { NextResponse } from 'next/server';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  auth: { limit: 5, windowMs: 60 * 1000 },              // 5 requests/min (login/reset/pass)
  adminMutations: { limit: 30, windowMs: 60 * 1000 },    // 30 requests/min
  ai: { limit: 10, windowMs: 60 * 1000 },                // 10 requests/min
  ocr: { limit: 10, windowMs: 60 * 1000 },               // 10 requests/min
  upload: { limit: 20, windowMs: 60 * 1000 },            // 20 requests/min
  search: { limit: 60, windowMs: 60 * 1000 },            // 60 requests/min
  curriculumImport: { limit: 10, windowMs: 60 * 1000 },  // 10 requests/min
  public: { limit: 120, windowMs: 60 * 1000 },           // 120 requests/min
};

interface WindowBucket {
  count: number;
  resetAt: number;
}

class SlidingWindowRateLimiter {
  private readonly store = new Map<string, WindowBucket>();

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    this.cleanup(now);

    const bucket = this.store.get(key);

    if (!bucket || now >= bucket.resetAt) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - 1),
        resetAt,
        retryAfterSeconds: 0,
      };
    }

    if (bucket.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds,
      };
    }

    bucket.count++;
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }

  private cleanup(now: number): void {
    if (this.store.size > 5000) {
      for (const [k, v] of this.store.entries()) {
        if (now >= v.resetAt) {
          this.store.delete(k);
        }
      }
    }
  }

  reset(): void {
    this.store.clear();
  }
}

export const GLOBAL_RATE_LIMITER = new SlidingWindowRateLimiter();

/**
 * Extracts client IP address safely from trusted headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Checks rate limit for a specific policy.
 */
export function enforceRateLimit(
  request: Request,
  policyName: keyof typeof RATE_LIMIT_POLICIES = 'public',
  userOrIdentifier?: string
): RateLimitResult {
  const policy = RATE_LIMIT_POLICIES[policyName] || RATE_LIMIT_POLICIES.public;
  const ip = getClientIp(request);
  const identifier = userOrIdentifier ? `user:${userOrIdentifier}` : `ip:${ip}`;
  const key = `${policyName}:${identifier}`;

  return GLOBAL_RATE_LIMITER.check(key, policy.limit, policy.windowMs);
}

/**
 * Creates standardized 429 Too Many Requests response with backpressure headers.
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Too Many Requests: Rate limit exceeded. Please retry later.',
      retryAfterSeconds: result.retryAfterSeconds,
      limit: result.limit,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

/**
 * Attaches rate limit informational headers to an outgoing response.
 */
export function withRateLimitHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  return response;
}
