/**
 * Saarvi Jobs Engine 3.0 — Production Search Orchestrator
 *
 * Architecture:
 * 1. PRIMARY source: Supabase database (authoritative, real-time).
 *    Only admin-published records with CORRECT lifecycle states are returned to users.
 * 2. FALLBACK: In-memory opportunityStore (populated by admin actions).
 * 3. TTL cache (60s) — short TTL so publish/approve is reflected within 1 minute.
 * 4. Absolute User-Facing Rule:
 *    publication_state = 'PUBLISHED'
 *    AND record_state = 'ACTIVE'
 *    AND review_state = 'APPROVED'
 *    AND data_origin IN ('PROVIDER', 'ADMIN')
 *    AND (deadline IS NULL OR deadline > NOW())
 *
 * Users NEVER see seed, test, unknown, pending, rejected, archived, or expired records.
 */

import type { JobItem, JobSearchParams, JobSearchResponse } from "./types.ts";
import { deduplicateJobs } from "./dedupe.ts";
import { sortJobs } from "./ranking.ts";
import { sanitizeSearchQuery, sanitizePagination } from "./security.ts";
import { opportunityStore, registerJobsCacheInvalidator } from "../opportunities/opportunity-store.ts";
import { isSupabaseConfigured } from "../supabase/config.ts";
import { isJobRowLiveForUsers } from "./live-predicate.ts";

interface CacheEntry {
  items: JobItem[];
  timestamp: number;
}

/** Convert a Supabase job_opportunities row to JobItem for the user feed */
function rowToJobItem(row: any): JobItem {
  const isInternship = row.type === "INTERNSHIP" || row.employment_type === "internship";
  const salary =
    row.salary_min != null || row.salary_max != null
      ? `${row.salary_currency || "₹"} ${row.salary_min ?? ""} - ${row.salary_max ?? ""}`
      : row.salary_text || "Salary not disclosed";

  return {
    id: row.id,
    title: row.title,
    companyName: row.company_name,
    companyLogo: row.company_logo_url || undefined,
    location: row.location || "India",
    remoteType: row.remote_type || "onsite",
    employmentType: row.employment_type || (isInternship ? "internship" : "full-time"),
    experienceLevel: row.experience_level || "fresher",
    salary,
    description: row.description || "",
    skills: Array.isArray(row.skills) ? row.skills : [],
    datePosted: row.posted_at || row.created_at || new Date().toISOString(),
    applicationDeadline: row.deadline || "Deadline not provided",
    sourceName: row.source_verified ? "Verified by Saarvi" : (row.source_name || "Saarvi"),
    sourceUrl: row.source_url || "",
    applyUrl: row.apply_url || row.source_url || "",
    sourceJobId: row.source_job_id || row.id,
    fetchedAt: row.fetched_at || row.discovered_at || new Date().toISOString(),
    verifiedStatus: row.source_verified ? "verified" : "source_checked",
    isInternship,
    confidenceScore: 98,
  };
}

class JobSearchService {
  // Short TTL (60s) so admin publishes are visible within 1 minute
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs = 60 * 1000; // 60 seconds

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
   * Query Supabase directly for live, admin-published jobs.
   * Returns { items, liveCount } where liveCount = total live before text/location filters.
   */
  private async querySupabaseLiveJobs(params: JobSearchParams): Promise<{ items: JobItem[]; liveCount: number }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSupabaseAdminClient } = require("../supabase/admin");
      const supabase = getSupabaseAdminClient();
      if (!supabase) return { items: [], liveCount: 0 };

      // Build query with absolute user-facing security filter
      // Uses multi-dimensional state columns (fixed by migration 029)
      let query = supabase
        .from("job_opportunities")
        .select("*")
        // === CANONICAL LIVE PREDICATE (mirrors is_job_live_for_users SQL function) ===
        .eq("publication_state", "PUBLISHED")
        .eq("record_state", "ACTIVE")
        .eq("review_state", "APPROVED")
        .eq("visibility", "public")
        .in("data_origin", ["PROVIDER", "ADMIN"])
        .order("posted_at", { ascending: false })
        .limit(500);

      // Apply type filters at DB level
      if (params.employmentType && params.employmentType !== "all") {
        if (params.employmentType === "internship") {
          query = query.eq("type", "INTERNSHIP");
        } else if (params.employmentType === "full-time" || params.employmentType === "job") {
          query = query.eq("type", "JOB");
        }
      }

      if (params.remote && params.remote !== "all") {
        query = query.eq("remote_type", params.remote);
      }

      if (params.experience && params.experience !== "all") {
        query = query.eq("experience_level", params.experience);
      }

      const { data, error } = await query;

      if (error) {
        console.warn("[JobSearchService] Supabase query error:", error.message);
        return { items: [], liveCount: 0 };
      }

      if (!data || data.length === 0) return { items: [], liveCount: 0 };

      // Apply deadline filter — use isJobRowLiveForUsers canonical predicate
      // This also applies to rows that may have slipped through with old status column
      const liveRows = data.filter((row: any) => isJobRowLiveForUsers(row));

      // liveCount = count before text/location filters (for empty-state UX)
      const liveCount = liveRows.length;

      const safeQ = (params.q || "").trim().toLowerCase();
      const safeLoc = (params.location || "").trim().toLowerCase();

      let results = liveRows;

      // Text search (title, company, description, skills)
      if (safeQ) {
        results = results.filter((row: any) => {
          const title = (row.title || "").toLowerCase();
          const company = (row.company_name || "").toLowerCase();
          const desc = (row.description || "").toLowerCase();
          const skills = Array.isArray(row.skills)
            ? row.skills.join(" ").toLowerCase()
            : "";
          return (
            title.includes(safeQ) ||
            company.includes(safeQ) ||
            desc.includes(safeQ) ||
            skills.includes(safeQ)
          );
        });
      }

      // Location search
      if (safeLoc) {
        results = results.filter((row: any) => {
          const loc = (row.location || "").toLowerCase();
          return loc.includes(safeLoc);
        });
      }

      return { items: results.map(rowToJobItem), liveCount };
    } catch (err) {
      console.warn("[JobSearchService] Supabase query failed:", err);
      return { items: [], liveCount: 0 };
    }
  }

  /**
   * Fallback: query in-memory opportunityStore (for non-Supabase or fallback).
   */
  private queryInMemoryStore(params: JobSearchParams): JobItem[] {
    try {
      const safeQ = sanitizeSearchQuery(params.q);
      const safeLoc = sanitizeSearchQuery(params.location);

      const isInternshipQuery =
        params.employmentType === "internship" ||
        (safeQ && safeQ.toLowerCase().includes("internship"));

      const isJobOnlyQuery =
        params.employmentType === "full-time" || params.employmentType === "job";

      const categoryFilter = isInternshipQuery
        ? "internship"
        : isJobOnlyQuery
        ? "job"
        : undefined;

      const experienceFilter =
        params.experience && params.experience !== "all"
          ? (params.experience as any)
          : undefined;

      const { items: approvedOpps } = opportunityStore.getApprovedOpportunities({
        search: safeQ,
        location: safeLoc,
        category: categoryFilter,
        remoteOnly: params.remote === "remote",
        experienceLevel: experienceFilter,
        skills: params.skills,
      });

      return approvedOpps.map((opp) => ({
        id: opp.id,
        title: opp.title,
        companyName: opp.companyName,
        companyLogo: opp.companyLogo,
        location: opp.location,
        remoteType: opp.remoteType,
        employmentType: opp.employmentType,
        experienceLevel: opp.experienceLevel,
        salary: opp.salary
          ? `${opp.salary.currency || "₹"} ${opp.salary.min} - ${opp.salary.max}`
          : "Salary not disclosed",
        description: opp.description,
        skills: opp.skills,
        datePosted: opp.postedAt,
        applicationDeadline: opp.applicationDeadline || "Deadline not provided",
        sourceName: opp.verifiedByAdmin ? "Verified by Saarvi" : opp.source,
        sourceUrl: opp.sourceUrl,
        applyUrl: opp.applyUrl,
        sourceJobId: opp.sourceId || opp.id,
        fetchedAt: (opp as any).fetchedAt || opp.discoveredAt,
        verifiedStatus: opp.verifiedByAdmin ? "verified" : "source_checked",
        isInternship: opp.isInternship,
        confidenceScore: opp.confidenceScore || 98,
      }));
    } catch (err) {
      console.error("[JobSearchService] In-memory store query error:", err);
      return [];
    }
  }

  /**
   * Search jobs & internships.
   * PRIMARY: Supabase (real-time, authoritative).
   * FALLBACK: In-memory store.
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

    // 1. Fresh Cache Hit (short 60s TTL to stay current after admin publishes)
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
          filtersApplied:
            (params.remote ? 1 : 0) +
            (params.experience ? 1 : 0) +
            (params.employmentType ? 1 : 0),
        },
      };
    }

    // 2. Primary: Query Supabase directly (authoritative database)
    let rawItems: JobItem[] = [];
    let liveCount = 0;
    let usedSupabase = false;

    if (isSupabaseConfigured()) {
      const supabaseResult = await this.querySupabaseLiveJobs(normalizedParams);
      rawItems = supabaseResult.items;
      liveCount = supabaseResult.liveCount;
      usedSupabase = true;
    }

    // 3. Fallback: In-memory store (when Supabase is unavailable or returned 0)
    if (!usedSupabase || rawItems.length === 0) {
      const inMemoryItems = this.queryInMemoryStore(normalizedParams);
      // liveCount from in-memory: count all live items (no text/location filter)
      if (liveCount === 0) {
        const allLive = this.queryInMemoryStore({ ...normalizedParams, q: undefined, location: undefined });
        liveCount = allLive.length;
      }
      // Merge: add any in-memory approved items not in Supabase results
      const supabaseIds = new Set(rawItems.map((j) => j.id));
      for (const item of inMemoryItems) {
        if (!supabaseIds.has(item.id)) {
          rawItems.push(item);
        }
      }
    }

    // 4. Deduplicate
    const { uniqueJobs } = deduplicateJobs(rawItems);
    const filteredCount = uniqueJobs.length;

    // 5. Update Cache
    this.cache.set(cacheKey, {
      items: uniqueJobs,
      timestamp: now,
    });

    // 6. Sort & Paginate
    const sorted = sortJobs(uniqueJobs, params.sortBy, normalizedParams);
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      total: uniqueJobs.length,
      liveCount,
      filteredCount,
      page,
      pageSize: limit,
      cached: false,
      cacheTimestamp: new Date().toISOString(),
      staleFallback: !usedSupabase,
      querySummary: {
        q: safeQ,
        location: safeLoc,
        filtersApplied:
          (params.remote ? 1 : 0) +
          (params.experience ? 1 : 0) +
          (params.employmentType ? 1 : 0),
      },
    };
  }

  /**
   * Fetches single job by canonical ID.
   * Queries Supabase first, then falls back to in-memory store.
   */
  public async getJobById(id: string): Promise<JobItem | null> {
    if (!id) return null;

    // 1. Query Supabase directly for authoritative record
    if (isSupabaseConfigured()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getSupabaseAdminClient } = require("../supabase/admin");
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("job_opportunities")
            .select("*")
            .eq("id", id)
            .eq("publication_state", "PUBLISHED")
            .eq("record_state", "ACTIVE")
            .in("data_origin", ["PROVIDER", "ADMIN"])
            .maybeSingle();

          if (!error && data) {
            return rowToJobItem(data);
          }

          // Try by source_job_id (legacy provider ID redirect)
          const { data: data2, error: err2 } = await supabase
            .from("job_opportunities")
            .select("*")
            .eq("source_job_id", id)
            .eq("publication_state", "PUBLISHED")
            .eq("record_state", "ACTIVE")
            .in("data_origin", ["PROVIDER", "ADMIN"])
            .maybeSingle();

          if (!err2 && data2) {
            return rowToJobItem(data2);
          }
        }
      } catch (err) {
        console.warn("[JobSearchService] Supabase getJobById error:", err);
      }
    }

    // 2. Fallback: In-memory store
    const opp = opportunityStore.getOpportunityById(id);
    if (opp) {
      const isPubliclyAvailable =
        (opp.status === "APPROVED" || opp.status === "PUBLISHED") &&
        opp.dataOrigin !== "SEED" &&
        opp.dataOrigin !== "TEST" &&
        !opp.id.startsWith("opp_seed_");

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
          salary: opp.salary
            ? `${opp.salary.currency || "₹"} ${opp.salary.min} - ${opp.salary.max}`
            : "Salary not disclosed",
          description: opp.description,
          skills: opp.skills,
          datePosted: opp.postedAt,
          applicationDeadline: opp.applicationDeadline || "Deadline not provided",
          sourceName: opp.verifiedByAdmin ? "Verified by Saarvi" : opp.source,
          sourceUrl: opp.sourceUrl,
          applyUrl: opp.applyUrl,
          sourceJobId: opp.sourceId || opp.id,
          fetchedAt: (opp as any).fetchedAt || opp.discoveredAt,
          verifiedStatus: opp.verifiedByAdmin ? "verified" : "source_checked",
          isInternship: opp.isInternship,
          confidenceScore: opp.confidenceScore || 98,
        };
      }
    }

    // 3. Search in cache entries
    for (const entry of this.cache.values()) {
      const match = entry.items.find((j) => j.id === id || j.sourceJobId === id);
      if (match) return match;
    }

    return null;
  }
}

export const jobSearchService = new JobSearchService();

// Register with cache invalidation system so bulk publish/approve immediately clears search cache
registerJobsCacheInvalidator(() => jobSearchService.clearCache());
