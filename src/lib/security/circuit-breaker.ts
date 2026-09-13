/**
 * Saarvi Resilient Circuit Breaker (OS Concepts / Fault Isolation)
 *
 * Implements:
 * 1. Three-state finite state machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED.
 * 2. Rapid fail-fast behavior when upstream external dependencies fail (Gmail, AI, OCR, Razorpay).
 * 3. Prevents cascading failures and retry storms.
 * 4. Graceful degradation: returns safe fallback responses during outages.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Failures before opening circuit (default: 5)
  cooldownMs?: number;       // Time to wait before testing half-open recovery (default: 30,000ms)
  successThreshold?: number; // Consecutive successes in half-open before closing (default: 2)
  timeoutMs?: number;        // Individual call timeout (default: 10,000ms)
}

export class CircuitBreakerOpenError extends Error {
  readonly status = 503;
  constructor(serviceName: string, cooldownRemainingMs: number) {
    super(`Service "${serviceName}" is temporarily degraded (circuit OPEN). Retry after ${Math.ceil(cooldownRemainingMs / 1000)}s.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  readonly serviceName: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptAt = 0;
  private lastError: string | null = null;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;
  private readonly timeoutMs: number;

  constructor(serviceName: string, options: CircuitBreakerOptions = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30000;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptAt) {
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }
    return this.state;
  }

  getMetrics() {
    return {
      service: this.serviceName,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastError: this.lastError,
      cooldownRemainingMs: Math.max(0, this.nextAttemptAt - Date.now()),
    };
  }

  async execute<T>(fn: (signal: AbortSignal) => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      if (fallback) {
        return await fallback();
      }
      throw new CircuitBreakerOpenError(this.serviceName, this.nextAttemptAt - Date.now());
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const result = await fn(controller.signal);
      this.onSuccess();
      return result;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.onFailure(errMsg);

      if (fallback) {
        return await fallback();
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastError = null;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(error: string): void {
    this.lastError = error;
    this.failureCount++;

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + this.cooldownMs;
      this.successCount = 0;
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptAt = 0;
    this.lastError = null;
  }
}

// Pre-configured platform circuit breakers
export const GMAIL_CIRCUIT_BREAKER = new CircuitBreaker('Gmail-SMTP', { failureThreshold: 3, cooldownMs: 30000 });
export const AI_CIRCUIT_BREAKER = new CircuitBreaker('AI-Provider', { failureThreshold: 5, cooldownMs: 20000 });
export const OCR_CIRCUIT_BREAKER = new CircuitBreaker('OCR-Provider', { failureThreshold: 4, cooldownMs: 25000 });
export const PAYMENT_CIRCUIT_BREAKER = new CircuitBreaker('Payment-Gateway', { failureThreshold: 4, cooldownMs: 30000 });
