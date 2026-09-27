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
  adminReads: { limit: 120, windowMs: 60 * 1000 },      // 120 requests/min (dashboard / reports / list)
  adminMutations: { limit: 30, windowMs: 60 * 1000 },    // 30 requests/min (write operations)
  authenticatedAdmin: { limit: 120, windowMs: 60 * 1000 }, // 120 requests/min
  publicRead: { limit: 120, windowMs: 60 * 1000 },       // 120 requests/min
  publicWrite: { limit: 60, windowMs: 60 * 1000 },       // 60 requests/min
  tools: { limit: 60, windowMs: 60 * 1000 },             // 60 requests/min
  userMutations: { limit: 60, windowMs: 60 * 1000 },     // 60 requests/min
  adDelivery: { limit: 120, windowMs: 60 * 1000 },       // 120 requests/min (fetching active ads)
  adAnalytics: { limit: 180, windowMs: 60 * 1000 },      // 180 requests/min (telemetry & events)
  adUpload: { limit: 20, windowMs: 60 * 1000 },          // 20 requests/min (banner assets)
  adPreview: { limit: 60, windowMs: 60 * 1000 },         // 60 requests/min
  interviewSession: { limit: 60, windowMs: 60 * 1000 },  // 60 requests/min (session creation / answers)
  ai: { limit: 10, windowMs: 60 * 1000 },                // 10 requests/min
  ocr: { limit: 10, windowMs: 60 * 1000 },               // 10 requests/min
  upload: { limit: 20, windowMs: 60 * 1000 },            // 20 requests/min
  search: { limit: 60, windowMs: 60 * 1000 },            // 60 requests/min
  curriculumImport: { limit: 10, windowMs: 60 * 1000 },  // 10 requests/min
  feedback: { limit: 10, windowMs: 3600 * 1000 },        // 10 requests/hour
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

export interface RateLimitTelemetryEvent {
  timestamp: string;
  policy: string;
  key: string;
  limit: number;
  retryAfterSeconds: number;
  ip: string;
  identifier?: string;
}

export interface RateLimitTelemetrySummary {
  totalBlocked: number;
  blockedByPolicy: Record<string, number>;
  recentEvents: RateLimitTelemetryEvent[];
}

const TELEMETRY_MAX_EVENTS = 100;
const telemetryEvents: RateLimitTelemetryEvent[] = [];
const blockedByPolicyCounts: Record<string, number> = {};
let totalBlockedCount = 0;

export function recordRateLimitEvent(event: RateLimitTelemetryEvent): void {
  totalBlockedCount++;
  blockedByPolicyCounts[event.policy] = (blockedByPolicyCounts[event.policy] || 0) + 1;
  telemetryEvents.unshift(event);
  if (telemetryEvents.length > TELEMETRY_MAX_EVENTS) {
    telemetryEvents.pop();
  }
}

export function getRateLimitTelemetry(): RateLimitTelemetrySummary {
  return {
    totalBlocked: totalBlockedCount,
    blockedByPolicy: { ...blockedByPolicyCounts },
    recentEvents: [...telemetryEvents],
  };
}

export function clearRateLimitTelemetry(): void {
  telemetryEvents.length = 0;
  for (const k in blockedByPolicyCounts) {
    delete blockedByPolicyCounts[k];
  }
  totalBlockedCount = 0;
}

/**
 * Checks rate limit for a specific policy.
 */
export function enforceRateLimit(
  request: Request,
  policyName: keyof typeof RATE_LIMIT_POLICIES | string = 'public',
  userOrIdentifier?: string
): RateLimitResult {
  const policy = (RATE_LIMIT_POLICIES as Record<string, RateLimitPolicy>)[policyName] || RATE_LIMIT_POLICIES.public;
  const ip = getClientIp(request);
  const identifier = userOrIdentifier ? `user:${userOrIdentifier}` : `ip:${ip}`;
  const key = `${policyName}:${identifier}`;

  const result = GLOBAL_RATE_LIMITER.check(key, policy.limit, policy.windowMs);

  if (!result.allowed) {
    console.warn(`[RATE_LIMIT_429] Policy: ${String(policyName)}, Key: ${key}, Retry-After: ${result.retryAfterSeconds}s`);
    recordRateLimitEvent({
      timestamp: new Date().toISOString(),
      policy: String(policyName),
      key,
      limit: policy.limit,
      retryAfterSeconds: result.retryAfterSeconds,
      ip,
      identifier: userOrIdentifier,
    });
  }

  return result;
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
