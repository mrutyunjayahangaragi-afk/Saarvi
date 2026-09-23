/**
 * Saarvi Jobs Engine 2.0 — Central Search Orchestrator
 *
 * Coordinates:
 * 1. In-memory / server-side TTL caching (15 mins)
 * 2. Pluggable JobSearchProvider (SerpApi Google Jobs)
 * 3. Verified Saarvi approved opportunities merge
 * 4. Deterministic deduplication & relevance ranking
 * 5. Stale cache fallback when provider temporarily fails
 */

import type { JobItem, JobSearchParams, JobSearchResponse } from "./types.ts";
import { SerpApiJobProvider } from "./providers/serpapi.ts";
import { deduplicateJobs } from "./dedupe.ts";
import { sortJobs } from "./ranking.ts";
import { sanitizeSearchQuery, sanitizePagination } from "./security.ts";
import { opportunityStore } from "../opportunities/opportunity-store.ts";

interface CacheEntry {
  items: JobItem[];
  timestamp: number;
}

class JobSearchService {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs = 15 * 60 * 1000; // 15 minutes
  private primaryProvider = new SerpApiJobProvider();

  private getCacheKey(params: JobSearchParams): string {
    const q = (params.q || "").toLowerCase().trim();
    const loc = (params.location || "").toLowerCase().trim();
    const exp = (params.experience || "").toLowerCase().trim();
    const emp = (params.employmentType || "").toLowerCase().trim();
    const rem = (params.remote || "").toLowerCase().trim();
    const page = params.page || 1;
    return `job_cache:${q}:${loc}:${exp}:${emp}:${rem}:${page}`;
  }

  /**
   * Search jobs & internships across external provider and verified Saarvi store.
   */
  public async searchJobs(params: JobSearchParams): Promise<JobSearchResponse> {
    const safeQ = sanitizeSearchQuery(params.q);
    const safeLoc = sanitizeSearchQuery(params.location);
    const { page, limit } = sanitizePagination(params.page, params.limit, 40);

    const normalizedParams: JobSearchParams = {
      ...params,
      q: safeQ,
      location: safeLoc,
      page,
      limit,
    };

    const cacheKey = this.getCacheKey(normalizedParams);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // 1. Fresh Cache Hit
    if (cached && now - cached.timestamp < this.defaultTtlMs) {
      const sorted = sortJobs(cached.items, params.sortBy, normalizedParams);
      const paginated = sorted.slice((page - 1) * limit, page * limit);

      return {
        items: paginated,
        total: cached.items.length,
        page,
        pageSize: limit,
        cached: true,
        cacheTimestamp: new Date(cached.timestamp).toISOString(),
        querySummary: {
          q: safeQ,
          location: safeLoc,
          filtersApplied: (params.remote ? 1 : 0) + (params.experience ? 1 : 0) + (params.employmentType ? 1 : 0),
        },
      };
    }

    // 2. Query Verified Saarvi Approved Opportunities Only
    // STRICT PRODUCTION RULE: Public users never trigger external SerpApi searches.
    // Opportunities must be vetted and published by Saarvi Administrators.
    let rawItems: JobItem[] = [];
    let isStaleFallback = false;

    try {
      const isInternshipQuery =
        normalizedParams.employmentType === "internship" ||
        (safeQ && safeQ.toLowerCase().includes("internship"));

      const { items: approvedOpps } = opportunityStore.getApprovedOpportunities({
        search: safeQ,
        location: safeLoc,
        category: isInternshipQuery ? "internship" : undefined,
        remoteOnly: normalizedParams.remote === "remote",
        experienceLevel: (normalizedParams.experience as any) || undefined,
        skills: normalizedParams.skills,
      });

      rawItems = approvedOpps.map((opp) => ({
        id: `opp_${opp.id}`,
        title: opp.title,
        companyName: opp.companyName,
        companyLogo: opp.companyLogo,
        location: opp.location,
        remoteType: opp.remoteType,
        employmentType: opp.employmentType,
        experienceLevel: opp.experienceLevel,
        salary: opp.salary ? `${opp.salary.currency || "₹"} ${opp.salary.min} - ${opp.salary.max}` : "Salary not disclosed",
        description: opp.description,
        skills: opp.skills,
        datePosted: opp.postedAt,
        applicationDeadline: opp.applicationDeadline || "Deadline not provided",
        sourceName: "Verified by Saarvi",
        sourceUrl: opp.sourceUrl,
        applyUrl: opp.applyUrl,
        sourceJobId: opp.id,
        fetchedAt: opp.discoveredAt,
        verifiedStatus: "verified",
        isInternship: opp.isInternship,
        confidenceScore: 98,
      }));
    } catch (err) {
      console.error("[JobSearchService] Error querying approved catalog:", err);
      if (cached) {
        rawItems = cached.items;
      }
    }

    // Deduplicate
    const { uniqueJobs } = deduplicateJobs(rawItems);

    // Update Cache
    if (uniqueJobs.length > 0) {
      this.cache.set(cacheKey, {
        items: uniqueJobs,
        timestamp: now,
      });
    }

    // Sort & Paginate
    const sorted = sortJobs(uniqueJobs, params.sortBy, normalizedParams);
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      total: uniqueJobs.length,
      page,
      pageSize: limit,
      cached: false,
      cacheTimestamp: new Date().toISOString(),
      staleFallback: isStaleFallback,
      querySummary: {
        q: safeQ,
        location: safeLoc,
        filtersApplied: (params.remote ? 1 : 0) + (params.experience ? 1 : 0) + (params.employmentType ? 1 : 0),
      },
    };
  }

  /**
   * Fetches single job by ID.
   */
  public async getJobById(id: string): Promise<JobItem | null> {
    // Search in cache entries
    for (const entry of this.cache.values()) {
      const match = entry.items.find((j) => j.id === id);
      if (match) return match;
    }

    // If ID references a verified Saarvi opportunity
    if (id.startsWith("opp_")) {
      const cleanId = id.replace("opp_", "");
      const opp = opportunityStore.getOpportunityById(cleanId);
      if (opp && opp.status === "APPROVED") {
        return {
          id,
          title: opp.title,
          companyName: opp.companyName,
          companyLogo: opp.companyLogo,
          location: opp.location,
          remoteType: opp.remoteType,
          employmentType: opp.employmentType,
          experienceLevel: opp.experienceLevel,
          salary: opp.salary ? `${opp.salary.currency || "₹"} ${opp.salary.min} - ${opp.salary.max}` : "Salary not disclosed",
          description: opp.description,
          skills: opp.skills,
          datePosted: opp.postedAt,
          applicationDeadline: opp.applicationDeadline || "Deadline not provided",
          sourceName: "Verified by Saarvi",
          sourceUrl: opp.sourceUrl,
          applyUrl: opp.applyUrl,
          sourceJobId: opp.id,
          fetchedAt: opp.discoveredAt,
          verifiedStatus: "verified",
          isInternship: opp.isInternship,
          confidenceScore: 98,
        };
      }
    }

    return null;
  }
}

export const jobSearchService = new JobSearchService();
