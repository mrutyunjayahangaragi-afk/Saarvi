/**
/**
 * Saarvi Jobs Engine 2.0 — SerpApi Google Jobs Provider Adapter
 *
 * Implements real external discovery via SerpApi Google Jobs engine (engine=google_jobs).
 * Strictly server-side: SERPAPI_API_KEY is never exposed to browser bundles.
 * Features:
 * 1. Interface JobDiscoveryProvider
 * 2. In-flight Request Coalescing (collapses identical concurrent requests into one)
 * 3. Circuit Breaker with Exponential Backoff + Jitter
 * 4. Bounded pagination via next_page_token
 * 5. Provider health check diagnostics
 */

import type { JobItem, JobSearchParams } from "../types.ts";
import { normalizeSerpApiJob } from "../normalize.ts";

export interface JobDiscoveryProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  search(params: JobSearchParams & { nextPageToken?: string; maxPages?: number }): Promise<{
    items: JobItem[];
    total?: number;
    nextPageToken?: string;
    fromCache?: boolean;
    coalesced?: boolean;
  }>;
  normalize(raw: any, index?: number): JobItem | null;
  healthCheck(): Promise<{
    status: "HEALTHY" | "DEGRADED" | "DOWN";
    latencyMs: number;
    error?: string;
    lastChecked: string;
  }>;
}

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class SerpApiGoogleJobsProvider implements JobDiscoveryProvider {
  public readonly id = "serpapi_google_jobs";
  public readonly name = "SerpApi Google Jobs API";

  private apiKey: string | undefined;
  private timeoutMs: number;

  // Circuit breaker state
  private static circuitState: CircuitBreakerState = "CLOSED";
  private static failureCount = 0;
  private static lastFailureTimestamp = 0;
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly RESET_TIMEOUT_MS = 60_000; // 1 minute cooldown

  // Request coalescing map: queryKey -> in-flight search promise
  private static inFlightRequests = new Map<
    string,
    Promise<{ items: JobItem[]; total?: number; nextPageToken?: string }>
  >();

  constructor(apiKey?: string, timeoutMs = 12000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  public isAvailable(): boolean {
    const key = this.apiKey || process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  public getCircuitStatus(): {
    state: CircuitBreakerState;
    failures: number;
    lastFailure: string | null;
  } {
    this.checkCircuitReset();
    return {
      state: SerpApiGoogleJobsProvider.circuitState,
      failures: SerpApiGoogleJobsProvider.failureCount,
      lastFailure: SerpApiGoogleJobsProvider.lastFailureTimestamp
        ? new Date(SerpApiGoogleJobsProvider.lastFailureTimestamp).toISOString()
        : null,
    };
  }

  private checkCircuitReset(): void {
    if (SerpApiGoogleJobsProvider.circuitState === "OPEN") {
      const elapsed = Date.now() - SerpApiGoogleJobsProvider.lastFailureTimestamp;
      if (elapsed > SerpApiGoogleJobsProvider.RESET_TIMEOUT_MS) {
        SerpApiGoogleJobsProvider.circuitState = "HALF_OPEN";
      }
    }
  }

  private recordSuccess(): void {
    SerpApiGoogleJobsProvider.failureCount = 0;
    SerpApiGoogleJobsProvider.circuitState = "CLOSED";
  }

  private recordFailure(): void {
    SerpApiGoogleJobsProvider.failureCount++;
    SerpApiGoogleJobsProvider.lastFailureTimestamp = Date.now();
    if (SerpApiGoogleJobsProvider.failureCount >= SerpApiGoogleJobsProvider.FAILURE_THRESHOLD) {
      SerpApiGoogleJobsProvider.circuitState = "OPEN";
      console.warn(
        `[SerpApiGoogleJobsProvider] Circuit Breaker tripped to OPEN after ${SerpApiGoogleJobsProvider.failureCount} consecutive failures.`
      );
    }
  }

  public normalize(raw: any, index = 0): JobItem | null {
    return normalizeSerpApiJob(raw, index);
  }

  /**
   * Search external jobs via SerpApi Google Jobs engine.
   * Uses request coalescing to share in-flight promises across concurrent identical searches.
   */
  public async search(params: JobSearchParams & { nextPageToken?: string; maxPages?: number }): Promise<{
    items: JobItem[];
    total?: number;
    nextPageToken?: string;
    fromCache?: boolean;
    coalesced?: boolean;
  }> {
    this.checkCircuitReset();
    if (SerpApiGoogleJobsProvider.circuitState === "OPEN") {
      console.warn("[SerpApiGoogleJobsProvider] Circuit breaker is OPEN. Fast-failing discovery request.");
      return { items: [], total: 0 };
    }

    const key = this.apiKey || process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
    if (!key) {
      console.warn("[SerpApiGoogleJobsProvider] Missing SERPAPI_API_KEY in server environment.");
      return { items: [], total: 0 };
    }

    // Build deterministic request coalescing cache key
    const coalesceKey = [
      (params.q || "").toLowerCase().trim(),
      (params.location || "").toLowerCase().trim(),
      params.remote || "",
      params.experience || "",
      params.employmentType || "",
      params.nextPageToken || "",
      params.page || 1,
    ].join("::");

    // If an identical discovery query is already in flight, coalesce and return that promise!
    const inFlight = SerpApiGoogleJobsProvider.inFlightRequests.get(coalesceKey);
    if (inFlight) {
      const result = await inFlight;
      return { ...result, coalesced: true };
    }

    // Otherwise, create the execution promise
    const executionPromise = this.executeDiscoveryRequest(key, params);
    SerpApiGoogleJobsProvider.inFlightRequests.set(coalesceKey, executionPromise);

    try {
      const result = await executionPromise;
      return result;
    } finally {
      SerpApiGoogleJobsProvider.inFlightRequests.delete(coalesceKey);
    }
  }

  private async executeDiscoveryRequest(
    key: string,
    params: JobSearchParams & { nextPageToken?: string }
  ): Promise<{ items: JobItem[]; total?: number; nextPageToken?: string }> {
    // Build search query terms
    const terms: string[] = [];
    if (params.q && params.q.trim()) {
      terms.push(params.q.trim());
    } else {
      terms.push("Software Engineer");
    }

    if (params.experience === "fresher" && !params.q?.toLowerCase().includes("fresher")) {
      terms.push("fresher");
    } else if (params.employmentType === "internship" && !params.q?.toLowerCase().includes("intern")) {
      terms.push("internship");
    }

    const queryStr = terms.join(" ");
    const locationStr = params.location || (params.remote === "remote" ? "Remote" : "India");

    const endpoint = new URL("https://serpapi.com/search.json");
    endpoint.searchParams.set("engine", "google_jobs");
    endpoint.searchParams.set("q", `${queryStr} ${locationStr}`);
    endpoint.searchParams.set("api_key", key);
    endpoint.searchParams.set("hl", "en");

    // Pagination via official next_page_token
    if (params.nextPageToken) {
      endpoint.searchParams.set("next_page_token", params.nextPageToken);
    } else if (params.page && params.page > 1) {
      const start = (params.page - 1) * Math.min(params.limit || 10, 20);
      endpoint.searchParams.set("start", String(start));
    }

    // Exponential backoff retry loop (max 2 retries)
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(endpoint.toString(), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        clearTimeout(timer);

        if (response.status === 429) {
          this.recordFailure();
          console.warn(`[SerpApiGoogleJobsProvider] Rate limited (429) on attempt ${attempt}`);
          if (attempt <= maxRetries) {
            const jitter = Math.random() * 200;
            const backoffMs = Math.pow(2, attempt) * 500 + jitter;
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
          return { items: [], total: 0 };
        }

        if (!response.ok) {
          this.recordFailure();
          console.warn(`[SerpApiGoogleJobsProvider] Responded with status ${response.status}`);
          return { items: [], total: 0 };
        }

        const data = await response.json();
        const rawJobs = Array.isArray(data.jobs_results) ? data.jobs_results : [];

        const normalized: JobItem[] = [];
        rawJobs.forEach((raw: any, index: number) => {
          const item = this.normalize(raw, index);
          if (item) {
            normalized.push(item);
          }
        });

        this.recordSuccess();

        return {
          items: normalized,
          total: normalized.length,
          nextPageToken: data.serpapi_pagination?.next_page_token,
        };
      } catch (err: any) {
        clearTimeout(timer);
        this.recordFailure();

        if (err.name === "AbortError") {
          console.warn(`[SerpApiGoogleJobsProvider] Request timed out after ${this.timeoutMs}ms (attempt ${attempt})`);
        } else {
          console.warn(`[SerpApiGoogleJobsProvider] Request error (attempt ${attempt}):`, err.message || err);
        }

        if (attempt <= maxRetries) {
          const jitter = Math.random() * 200;
          const backoffMs = Math.pow(2, attempt) * 500 + jitter;
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        return { items: [], total: 0 };
      }
    }

    return { items: [], total: 0 };
  }

  /**
   * Diagnostic health check for Admin monitoring dashboard.
   */
  public async healthCheck(): Promise<{
    status: "HEALTHY" | "DEGRADED" | "DOWN";
    latencyMs: number;
    error?: string;
    lastChecked: string;
  }> {
    const key = this.apiKey || process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
    if (!key) {
      return {
        status: "DOWN",
        latencyMs: 0,
        error: "Missing SERPAPI_API_KEY in server environment.",
        lastChecked: new Date().toISOString(),
      };
    }

    const start = Date.now();
    try {
      const endpoint = new URL("https://serpapi.com/account.json");
      endpoint.searchParams.set("api_key", key);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(endpoint.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          status: "DEGRADED",
          latencyMs,
          error: `HTTP ${res.status}: ${res.statusText}`,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: "HEALTHY",
        latencyMs,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        status: "DOWN",
        latencyMs,
        error: err.message || "Connection failed",
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

// Backward compatibility alias
export const SerpApiJobProvider = SerpApiGoogleJobsProvider;
