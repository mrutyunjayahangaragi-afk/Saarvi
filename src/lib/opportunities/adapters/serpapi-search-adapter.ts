/**
 * Saarvi SerpApi Google Search Discovery Adapter
 *
 * Discovers internships, graduate trainee programs, and early career opportunities
 * via controlled Google Search queries through SerpApi (engine=google).
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

export class SerpApiGoogleSearchAdapter implements OpportunitySourceAdapter {
  public readonly id = "serpapi_google_search";
  public readonly name = "SerpApi Google Search Discovery";

  private apiKey: string | undefined;
  private circuitBreaker = new OpportunityCircuitBreaker();
  private healthStats: SourceHealth = {
    sourceId: "serpapi_google_search",
    name: "SerpApi Google Search Discovery",
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
      this.healthStats.lastError = "SERPAPI_KEY is not configured.";
      return { results: [] };
    }

    if (!this.circuitBreaker.canExecute()) {
      this.healthStats.status = "DOWN";
      this.healthStats.circuitState = this.circuitBreaker.getState();
      this.healthStats.lastError = "Circuit breaker is OPEN.";
      return { results: [] };
    }

    const startTime = Date.now();

    // Query formulation: Target real careers & internships
    const roleTerm = query.role || "software engineering internship";
    const locTerm = query.location || "India";
    const qString = `"${roleTerm}" ${locTerm} site:careers.* OR site:*.lever.co OR site:*.greenhouse.io OR site:wellfound.com/jobs`;

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", qString);
    url.searchParams.set("api_key", effectiveKey);
    url.searchParams.set("num", "10");
    url.searchParams.set("hl", "en");

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
        this.healthStats.lastError = `SerpApi Google Search HTTP ${response.status}`;
        this.healthStats.circuitState = this.circuitBreaker.getState();
        return { results: [] };
      }

      const data = await response.json();
      this.circuitBreaker.recordSuccess();
      this.healthStats.status = "HEALTHY";
      this.healthStats.circuitState = "CLOSED";
      this.healthStats.lastSuccessfulFetch = new Date().toISOString();

      const organicResults = Array.isArray(data.organic_results) ? data.organic_results : [];
      const discovered: Opportunity[] = [];

      for (const item of organicResults) {
        const rawTitle = (item.title || "").trim();
        const snippet = (item.snippet || "").trim();
        const link = (item.link || "").trim();

        const safeApplyUrl = validateSafeExternalUrl(link);
        if (!safeApplyUrl || !rawTitle) continue;

        // Try extracting company from domain or title (e.g. "Google - Software Engineer" or "via Lever")
        let companyName = (item.source || "").replace(/\.com$|\.co$|\.io$/i, "").trim();
        let title = rawTitle;

        if (rawTitle.includes(" - ")) {
          const parts = rawTitle.split(" - ");
          companyName = parts[0].trim();
          title = parts.slice(1).join(" - ").trim();
        } else if (rawTitle.includes(" | ")) {
          const parts = rawTitle.split(" | ");
          title = parts[0].trim();
          companyName = parts[1].trim();
        }

        if (!companyName) {
          try {
            const host = new URL(safeApplyUrl).hostname;
            companyName = host.replace(/^www\./, "").split(".")[0];
            companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
          } catch {
            companyName = "Verified Company";
          }
        }

        const skills = extractOpportunitySkills(title, snippet);
        const remoteType = inferRemoteType(locTerm, snippet);
        const { category, employmentType, experienceLevel, isInternship, isJob } = inferOpportunityCategory(title, snippet);

        const contentHash = generateOpportunityContentHash({
          title,
          company: companyName,
          location: locTerm,
          applyUrl: safeApplyUrl,
          skills,
        });

        const oppId = `opp_search_${contentHash}`;

        discovered.push({
          id: oppId,
          source: "serpapi_google_search",
          sourceId: oppId,
          sourceUrl: safeApplyUrl,
          applyUrl: safeApplyUrl,
          originalSourceUrl: safeApplyUrl,
          directApplyUrl: safeApplyUrl,
          title,
          companyName,
          description: snippet,
          location: locTerm,
          remoteType,
          employmentType,
          experienceLevel,
          skills,
          salary: null,
          postedAt: new Date().toISOString(),
          applicationDeadline: null,
          sourceLastUpdatedAt: new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
          verifiedAt: null,
          verifiedByAdmin: false,
          status: "PENDING_REVIEW",
          category,
          isInternship,
          isJob,
          isScholarship: false,
          isHackathon: false,
          contentHash,
          confidenceScore: 80,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      this.healthStats.recordsDiscoveredTotal += discovered.length;
      return { results: discovered };
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
