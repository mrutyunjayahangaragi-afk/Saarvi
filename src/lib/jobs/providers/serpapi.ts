/**
 * Saarvi Jobs Engine 2.0 — SerpApi Google Jobs Provider Adapter
 *
 * Implements real-time external discovery via SerpApi Google Jobs engine (engine=google_jobs).
 * Strictly server-side: SERPAPI_API_KEY is never exposed to browser bundles.
 * Uses AbortController with 10s timeout and circuit breaker protection.
 */

import type { JobItem, JobSearchParams, JobSearchProvider } from "../types.ts";
import { normalizeSerpApiJob } from "../normalize.ts";

export class SerpApiJobProvider implements JobSearchProvider {
  public readonly id = "serpapi_google_jobs";
  public readonly name = "SerpApi Google Jobs API";

  private apiKey: string | undefined;
  private timeoutMs: number;

  constructor(apiKey?: string, timeoutMs = 10000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  public isAvailable(): boolean {
    const key = this.apiKey || process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  public async search(params: JobSearchParams): Promise<{
    items: JobItem[];
    total?: number;
    nextPageToken?: string;
  }> {
    const key = this.apiKey || process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
    if (!key) {
      console.warn("[SerpApiJobProvider] Missing SERPAPI_API_KEY in server environment.");
      return { items: [], total: 0 };
    }

    // Build natural search query
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

    // Optional pagination start offset
    if (params.page && params.page > 1) {
      const start = (params.page - 1) * (params.limit || 10);
      endpoint.searchParams.set("start", String(start));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        console.warn(`[SerpApiJobProvider] Responded with status ${response.status}`);
        return { items: [], total: 0 };
      }

      const data = await response.json();
      const rawJobs = Array.isArray(data.jobs_results) ? data.jobs_results : [];

      const normalized: JobItem[] = [];
      rawJobs.forEach((raw: any, index: number) => {
        const item = normalizeSerpApiJob(raw, index);
        if (item) {
          normalized.push(item);
        }
      });

      return {
        items: normalized,
        total: normalized.length,
        nextPageToken: data.serpapi_pagination?.next_page_token,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.warn(`[SerpApiJobProvider] Search timed out after ${this.timeoutMs}ms.`);
      } else {
        console.warn(`[SerpApiJobProvider] Search failed:`, err.message || err);
      }
      return { items: [], total: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}
