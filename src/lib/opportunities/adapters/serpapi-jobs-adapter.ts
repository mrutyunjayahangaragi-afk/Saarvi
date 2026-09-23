/**
 * Saarvi SerpApi Google Jobs Source Adapter
 *
 * Implements server-side discovery via SerpApi Google Jobs engine (engine=google_jobs).
 * Strictly server-side: SERPAPI_KEY is never exposed to the client.
 */

import type {
  Opportunity,
  OpportunitySourceAdapter,
  SearchQuery,
  SourceHealth,
} from "../types.ts";
import { OpportunityCircuitBreaker } from "../circuit-breaker.ts";
import {
  validateSafeExternalUrl,
  extractOpportunitySkills,
  generateOpportunityContentHash,
  inferRemoteType,
  inferOpportunityCategory,
} from "../normalizer.ts";

export class SerpApiGoogleJobsAdapter implements OpportunitySourceAdapter {
  public readonly id = "serpapi_google_jobs";
  public readonly name = "SerpApi Google Jobs Engine";

  private apiKey: string | undefined;
  private circuitBreaker = new OpportunityCircuitBreaker();
  private healthStats: SourceHealth = {
    sourceId: "serpapi_google_jobs",
    name: "SerpApi Google Jobs Engine",
    status: "HEALTHY",
    circuitState: "CLOSED",
    recordsDiscoveredTotal: 0,
    recordsApprovedTotal: 0,
    rateLimit429Count: 0,
    lastCheckTimestamp: new Date().toISOString(),
  };

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SERPAPI_KEY;
  }

  public async search(query: SearchQuery): Promise<{ results: Opportunity[]; nextPageToken?: string }> {
    const effectiveKey = this.apiKey || process.env.SERPAPI_KEY;

    if (!effectiveKey) {
      this.healthStats.status = "DEGRADED";
      this.healthStats.lastError = "SERPAPI_KEY is not configured in server environment.";
      return { results: [] };
    }

    if (!this.circuitBreaker.canExecute()) {
      this.healthStats.status = "DOWN";
      this.healthStats.circuitState = this.circuitBreaker.getState();
      this.healthStats.lastError = "Circuit breaker is OPEN due to recent errors or rate limits.";
      return { results: [] };
    }

    const startTime = Date.now();

    // Construct search query
    const roleTerm = query.role || (query.isInternship ? "Software Engineer Intern" : "Software Engineer");
    const locTerm = query.location || "India";
    const qString = `${roleTerm} ${locTerm}`;

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_jobs");
    url.searchParams.set("q", qString);
    url.searchParams.set("api_key", effectiveKey);
    url.searchParams.set("hl", "en");

    if (query.nextPageToken) {
      url.searchParams.set("next_page_token", query.nextPageToken);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      const responseTimeMs = Date.now() - startTime;
      this.healthStats.responseTimeMs = responseTimeMs;
      this.healthStats.lastCheckTimestamp = new Date().toISOString();

      if (response.status === 429) {
        this.healthStats.rateLimit429Count++;
        this.healthStats.status = "DEGRADED";
        this.circuitBreaker.recordFailure(true);
        this.healthStats.circuitState = this.circuitBreaker.getState();
        return { results: [] };
      }

      if (!response.ok) {
        this.circuitBreaker.recordFailure();
        this.healthStats.status = "DEGRADED";
        this.healthStats.lastError = `SerpApi responded with HTTP ${response.status}`;
        this.healthStats.circuitState = this.circuitBreaker.getState();
        return { results: [] };
      }

      const data = await response.json();
      this.circuitBreaker.recordSuccess();
      this.healthStats.status = "HEALTHY";
      this.healthStats.circuitState = "CLOSED";
      this.healthStats.lastSuccessfulFetch = new Date().toISOString();

      const jobsResults = Array.isArray(data.jobs_results) ? data.jobs_results : [];
      const discovered: Opportunity[] = [];

      for (const item of jobsResults) {
        const title = (item.title || "").trim();
        const companyName = (item.company_name || "").trim();
        const location = (item.location || locTerm).trim();
        const description = (item.description || "").trim();

        if (!title || !companyName) continue;

        // Extract apply URL
        let applyUrl = "";
        let directApplyUrl: string | undefined;

        if (Array.isArray(item.apply_options) && item.apply_options.length > 0) {
          applyUrl = item.apply_options[0].link || "";
          directApplyUrl = item.apply_options[0].link;
        }

        const safeApplyUrl = validateSafeExternalUrl(applyUrl) || "https://google.com/search?q=" + encodeURIComponent(`${companyName} ${title} careers`);
        const safeDirectApplyUrl = directApplyUrl ? validateSafeExternalUrl(directApplyUrl) || undefined : undefined;

        const skills = extractOpportunitySkills(title, description);
        const remoteType = inferRemoteType(location, description);
        const { category, employmentType, experienceLevel, isInternship, isJob } = inferOpportunityCategory(title, description);

        const contentHash = generateOpportunityContentHash({
          title,
          company: companyName,
          location,
          applyUrl: safeApplyUrl,
          skills,
        });

        const oppId = `opp_serp_${item.job_id || contentHash}`;

        discovered.push({
          id: oppId,
          source: "serpapi_google_jobs",
          sourceId: item.job_id || oppId,
          sourceUrl: item.share_link || safeApplyUrl,
          applyUrl: safeApplyUrl,
          originalSourceUrl: item.share_link || safeApplyUrl,
          directApplyUrl: safeDirectApplyUrl,
          title,
          companyName,
          companyLogo: item.thumbnail || undefined,
          description,
          location,
          remoteType,
          employmentType,
          experienceLevel,
          skills,
          salary: null, // Never fabricate
          postedAt: new Date().toISOString(),
          applicationDeadline: null,
          sourceLastUpdatedAt: new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
          verifiedAt: null,
          verifiedByAdmin: false,
          status: "PENDING_REVIEW", // Mandatory admin approval pipeline
          category,
          isInternship,
          isJob,
          isScholarship: false,
          isHackathon: false,
          contentHash,
          confidenceScore: 90,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      this.healthStats.recordsDiscoveredTotal += discovered.length;

      const nextPageToken = data.serpapi_pagination?.next_page_token;
      return { results: discovered, nextPageToken };
    } catch (err: any) {
      this.circuitBreaker.recordFailure();
      this.healthStats.status = "DOWN";
      this.healthStats.lastError = err.message;
      this.healthStats.circuitState = this.circuitBreaker.getState();
      return { results: [] };
    }
  }

  public async healthCheck(): Promise<SourceHealth> {
    return {
      ...this.healthStats,
      circuitState: this.circuitBreaker.getState(),
      lastCheckTimestamp: new Date().toISOString(),
    };
  }
}
