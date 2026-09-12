import crypto from "crypto";

export interface AIAuditRecord {
  requestId: string;
  feature: string;
  provider: string;
  model?: string;
  timestamp: string;
  durationMs: number;
  status: "success" | "error";
  errorCode?: string;
}

// In-memory ring buffer for safe aggregate audit metrics (max 500 entries)
const MAX_AUDIT_LOGS = 500;
const auditLogs: AIAuditRecord[] = [];

// Idempotency cache: stores hash -> { result, timestamp } (TTL: 2 minutes)
const idempotencyCache = new Map<string, { result: unknown; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 120_000;

/**
 * Computes a deterministic SHA-256 hash of an operation input.
 * Scoped by user/profile ID to prevent cross-user cached context leakage.
 * Never stores or exposes raw document text.
 */
export function computeInputHash(feature: string, content: string, scope: string = "anon"): string {
  return crypto
    .createHash("sha256")
    .update(`${feature}:${scope}:${content.trim()}`)
    .digest("hex");
}

export function checkIdempotency<T>(key: string): T | null {
  const cached = idempotencyCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(key);
    return null;
  }
  return cached.result as T;
}

export function saveIdempotency<T>(key: string, result: T): void {
  // Prune expired entries if map gets large
  if (idempotencyCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache.entries()) {
      if (now - v.timestamp > IDEMPOTENCY_TTL_MS) {
        idempotencyCache.delete(k);
      }
    }
  }
  idempotencyCache.set(key, { result, timestamp: Date.now() });
}

/**
 * Logs safe operational metrics only.
 * Full document text, resume content, and prompts are STRICTLY FORBIDDEN.
 */
export function recordAuditLog(record: AIAuditRecord): void {
  if (auditLogs.length >= MAX_AUDIT_LOGS) {
    auditLogs.shift();
  }
  auditLogs.push(record);
}

export function getAuditMetrics(): {
  totalRequests: number;
  successRate: number;
  averageDurationMs: number;
  features: Record<string, number>;
  providers: Record<string, number>;
} {
  const total = auditLogs.length;
  if (total === 0) {
    return {
      totalRequests: 0,
      successRate: 1,
      averageDurationMs: 0,
      features: {},
      providers: {},
    };
  }

  let successes = 0;
  let totalDuration = 0;
  const features: Record<string, number> = {};
  const providers: Record<string, number> = {};

  for (const log of auditLogs) {
    if (log.status === "success") successes++;
    totalDuration += log.durationMs;
    features[log.feature] = (features[log.feature] || 0) + 1;
    providers[log.provider] = (providers[log.provider] || 0) + 1;
  }

  return {
    totalRequests: total,
    successRate: Number((successes / total).toFixed(2)),
    averageDurationMs: Math.round(totalDuration / total),
    features,
    providers,
  };
}
