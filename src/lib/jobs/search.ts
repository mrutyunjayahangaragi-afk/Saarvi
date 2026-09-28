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
import { opportunityStore, registerJobsCacheInvalidator } from "../opportunities/opportunity-store.ts";

interface CacheEntry {
  items: JobItem[];
  timestamp: number;
}

class JobSearchService {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs = 15 * 60 * 1000; // 15 minutes
  private primaryProvider = new SerpApiJobProvider();

  public clearCache(): void {
    this.cache.clear();
  }

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

      const isJobOnlyQuery =
        normalizedParams.employmentType === "full-time" ||
        normalizedParams.employmentType === "job";

      const categoryFilter = isInternshipQuery
        ? "internship"
        : isJobOnlyQuery
        ? "job"
        : undefined;

      const experienceFilter =
        normalizedParams.experience && normalizedParams.experience !== "all"
          ? (normalizedParams.experience as any)
          : undefined;

      const { items: approvedOpps } = opportunityStore.getApprovedOpportunities({
        search: safeQ,
        location: safeLoc,
        category: categoryFilter,
        remoteOnly: normalizedParams.remote === "remote",
        experienceLevel: experienceFilter,
        skills: normalizedParams.skills,
      });

      rawItems = approvedOpps.map((opp) => ({
        id: opp.id,
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
        sourceName: opp.verifiedByAdmin ? "Verified by Saarvi" : opp.source,
        sourceUrl: opp.sourceUrl,
        applyUrl: opp.applyUrl,
        sourceJobId: opp.sourceId || opp.id,
        fetchedAt: opp.fetchedAt || opp.discoveredAt,
        verifiedStatus: opp.verifiedByAdmin ? "verified" : "source_checked",
        isInternship: opp.isInternship,
        confidenceScore: opp.confidenceScore || 98,
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
   * Fetches single job by canonical ID or legacy provider ID.
   * Never produces a false 404 for valid opportunities.
   */
  public async getJobById(id: string): Promise<JobItem | null> {
    if (!id) return null;

    // 1. Direct query from canonical store
    const opp = opportunityStore.getOpportunityById(id);
    if (opp) {
      const isPubliclyAvailable =
        opp.status === "APPROVED" ||
        opp.status === "PUBLISHED" ||
        opp.status === "ACTIVE";

      if (isPubliclyAvailable) {
        return {
          id: opp.id,
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
          sourceName: opp.verifiedByAdmin ? "Verified by Saarvi" : opp.source,
          sourceUrl: opp.sourceUrl,
          applyUrl: opp.applyUrl,
          sourceJobId: opp.sourceId || opp.id,
          fetchedAt: opp.fetchedAt || opp.discoveredAt,
          verifiedStatus: opp.verifiedByAdmin ? "verified" : "source_checked",
          isInternship: opp.isInternship,
          confidenceScore: opp.confidenceScore || 98,
        };
      }
    }

    // 2. Search in cache entries
    for (const entry of this.cache.values()) {
      const match = entry.items.find((j) => j.id === id || j.sourceJobId === id);
      if (match) return match;
    }

    return null;
  }
}

export const jobSearchService = new JobSearchService();

// Register with cache invalidation system so bulk publish/archive immediately clears search cache
registerJobsCacheInvalidator(() => jobSearchService.clearCache());
