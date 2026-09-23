/**
 * Saarvi Opportunity Discovery — Circuit Breaker & Rate Defense
 *
 * Implements a strict 3-state circuit breaker (CLOSED, OPEN, HALF_OPEN)
 * to protect external search providers (SerpApi) and prevent continuous retries on 429.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of consecutive failures to open circuit
  cooldownPeriodMs?: number; // How long to remain OPEN before testing HALF_OPEN
  maxHalfOpenAttempts?: number;
}

export class OpportunityCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  private failureThreshold: number;
  private cooldownPeriodMs: number;
  private maxHalfOpenAttempts: number;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.cooldownPeriodMs = options?.cooldownPeriodMs ?? 60_000; // 60 seconds
    this.maxHalfOpenAttempts = options?.maxHalfOpenAttempts ?? 1;
  }

  public getState(): CircuitState {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.cooldownPeriodMs) {
        this.state = "HALF_OPEN";
        this.halfOpenAttempts = 0;
      }
    }
    return this.state;
  }

  public canExecute(): boolean {
    const currentState = this.getState();
    if (currentState === "CLOSED") return true;
    if (currentState === "HALF_OPEN") {
      return this.halfOpenAttempts < this.maxHalfOpenAttempts;
    }
    return false;
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
    this.halfOpenAttempts = 0;
  }

  public recordFailure(isRateLimit = false): void {
    this.lastFailureTime = Date.now();
    this.consecutiveFailures++;

    if (isRateLimit || this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
      // Double cooldown if rate-limited
      if (isRateLimit) {
        this.lastFailureTime = Date.now() + 30_000; // Extra 30s penalty
      }
    } else if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
    }
  }

  public reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }
}
