/**
 * Saarvi Jobs & Internships Engine 6.0 — Production Search Orchestrator
 *
 * UNIFIED CAREER DISCOVERY ARCHITECTURE:
 * 1. Mode 1 (Default /jobs view):
 *    Returns Tier A: Saarvi Verified Opportunities immediately from the canonical database.
 *    No search query required. Fast and reliable.
 * 2. Mode 2 (Active User Search):
 *    - Database search first: returns matching verified and stored source records.
 *    - Live Source Discovery: if external discovery is enabled and authorized providers are configured,
 *      queries external source (SerpApi Google Jobs) with in-flight request coalescing.
 *    - Normalizes, validates, deduplicates O(n), and PERSISTS discovered records into the database.
 *    - Explicitly marks discovered records as:
 *      verification_tier = 'SOURCE_DISCOVERY'
 *      review_state = 'DISCOVERED'
 *      publication_state = 'NOT_PUBLISHED'
 *    - Returns both tiers separated and clearly labeled to the user.
 * 3. Zero Automatic Deletion:
 *    Records remain in the database unless Admin explicitly deletes or archives them.
 */

import type { JobItem, JobSearchParams, JobSearchResponse } from "./types.ts";
import { deduplicateJobs } from "./dedupe.ts";
import { sortJobs } from "./ranking.ts";
import { sanitizeSearchQuery, sanitizePagination } from "./security.ts";
import { opportunityStore, registerJobsCacheInvalidator } from "../opportunities/opportunity-store.ts";
import { isSupabaseConfigured } from "../supabase/config.ts";
import { jobRepository, rowToJobItem } from "./repository.ts";
import { SerpApiGoogleJobsProvider } from "./providers/serpapi.ts";

import { buildCareerSearchIntent } from "../career/career-search-intent.ts";
import { CareerRelevanceEngine } from "../career/career-relevance-engine.ts";

interface CacheEntry {
  response: JobSearchResponse;
  timestamp: number;
}

export class JobSearchService {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs = 60 * 1000; // 60s TTL so admin actions appear quickly
  private serpApiProvider = new SerpApiGoogleJobsProvider();

  public clearCache(): void {
    this.cache.clear();
  }

  private getCacheKey(params: JobSearchParams): string {
    const q = (params.q || "").toLowerCase().trim();
    const role = (params.role || "").toLowerCase().trim();
    const branch = (params.branch || "").toLowerCase().trim();
    const domain = (params.domain || "").toLowerCase().trim();
    const loc = (params.location || "").toLowerCase().trim();
    const exp = (params.experience || "").toLowerCase().trim();
    const emp = (params.employmentType || "").toLowerCase().trim();
    const rem = (params.remote || "").toLowerCase().trim();
    const tier = params.tier || "all";
    const page = params.page || 1;
    return `job_cache_v7:${q}:${role}:${branch}:${domain}:${loc}:${exp}:${emp}:${rem}:${tier}:${page}`;
  }

  /**
   * Search and discovery entry point.
   */
  public async searchJobs(params: JobSearchParams): Promise<JobSearchResponse> {
    const safeQ = sanitizeSearchQuery(params.q);
    const safeRole = sanitizeSearchQuery(params.role);
    const safeBranch = sanitizeSearchQuery(params.branch);
    const safeDomain = sanitizeSearchQuery(params.domain);
    const safeLoc = sanitizeSearchQuery(params.location);
    const { page, limit } = sanitizePagination(params.page, params.limit, 30);

    const effectiveQ = safeQ || safeRole || safeDomain || undefined;

    const normalizedParams: JobSearchParams = {
      ...params,
      q: effectiveQ,
      role: safeRole,
      branch: safeBranch,
      domain: safeDomain,
      location: safeLoc,
      page,
      limit,
    };

    const cacheKey = this.getCacheKey(normalizedParams);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // 1. Cache hit
    if (cached && now - cached.timestamp < this.defaultTtlMs) {
      return {
        ...cached.response,
        cached: true,
        cacheTimestamp: new Date(cached.timestamp).toISOString(),
      };
    }

    const isSearchActive = Boolean(
      effectiveQ ||
      safeLoc ||
      safeBranch ||
      (params.employmentType && params.employmentType !== "all" && params.employmentType !== "any") ||
      (params.remote && params.remote !== "all") ||
      (params.skills && params.skills.length > 0)
    );

    // 2. Database-First Query for Tier A: Saarvi Verified Opportunities
    const verifiedResult = await jobRepository.getLiveVerifiedOpportunities(normalizedParams);
    let verifiedItems = verifiedResult.items;
    const globalLiveCount = verifiedResult.liveCount;

    // Fallback: If DB returned 0, check in-memory store
    if (verifiedItems.length === 0) {
      const memoryOpps = opportunityStore.getApprovedOpportunities({
        search: safeQ,
        location: safeLoc,
        remoteOnly: params.remote === "remote",
      });
      verifiedItems = memoryOpps.items.map((o) => ({
        id: o.id,
        title: o.title,
        companyName: o.companyName,
        companyLogo: o.companyLogo,
        location: o.location,
        remoteType: o.remoteType,
        employmentType: o.employmentType,
        experienceLevel: o.experienceLevel,
        salary: o.salary ? `${o.salary.currency || "₹"} ${o.salary.min} - ${o.salary.max}` : "Salary not disclosed",
        description: o.description,
        skills: o.skills,
        datePosted: o.postedAt,
        applicationDeadline: o.applicationDeadline || "Deadline not provided",
        sourceName: "Verified by Saarvi",
        sourceUrl: o.sourceUrl,
        applyUrl: o.applyUrl,
        sourceJobId: o.sourceId || o.id,
        fetchedAt: (o as any).fetchedAt || o.discoveredAt,
        verifiedStatus: "verified",
        verificationTier: "SAARVI_VERIFIED",
        isInternship: o.isInternship,
        confidenceScore: 100,
      }));
    }

    let sourceItems: JobItem[] = [];
    let providerStatus: JobSearchResponse["providerStatus"] = {
      searched: false,
    };

    // 3. If User Searched: Retrieve Stored Source Discoveries + Live External Discovery
    if (isSearchActive) {
      // 3A. Stored source discoveries from DB
      sourceItems = await jobRepository.getStoredSourceDiscoveries(normalizedParams);

      // 3B. Live external source discovery via configured authorized provider (SerpApi)
      if (this.serpApiProvider.isAvailable() && params.enableLiveDiscovery !== false) {
        try {
          providerStatus.searched = true;
          providerStatus.provider = this.serpApiProvider.name;

          const providerResult = await this.serpApiProvider.search({
            q: effectiveQ || "Software Engineer",
            location: safeLoc,
            remote: params.remote,
            experience: params.experience,
            employmentType: params.employmentType,
          });

          if (providerResult.items.length > 0) {
            // Persist newly discovered jobs into database as SOURCE_DISCOVERY
            const persistRes = await jobRepository.bulkUpsertOpportunities(providerResult.items, {
              query: effectiveQ || "Software Engineer",
              location: safeLoc,
              provider: "serpapi_google_jobs",
              tier: "SOURCE_DISCOVERY",
            });

            providerStatus.newDiscovered = persistRes.newCount;

            // Merge newly fetched items into sourceItems with O(n) deduplication
            const existingIds = new Set(sourceItems.map((s) => s.id));
            for (const item of providerResult.items) {
              if (!existingIds.has(item.id)) {
                sourceItems.push(item);
                existingIds.add(item.id);
              }
            }
          }
        } catch (providerErr: any) {
          console.warn("[JobSearchService] Live external discovery error:", providerErr.message);
          providerStatus.error = providerErr.message || "Provider temporarily unavailable";
        }
      }
    }

    // 4. Deduplicate verified and source items
    const { uniqueJobs: cleanVerified } = deduplicateJobs(verifiedItems);
    const { uniqueJobs: cleanSource } = deduplicateJobs(sourceItems);

    // Filter by tier if user clicked a specific tab
    let combinedItems: JobItem[] = [];
    if (params.tier === "verified") {
      combinedItems = cleanVerified;
    } else if (params.tier === "source") {
      combinedItems = cleanSource;
    } else {
      // Combined: Verified items first, then source discoveries
      combinedItems = [...cleanVerified, ...cleanSource];
    }

    // 5. Transparent DSA Relevance Ranking
    const sorted = sortJobs(combinedItems, params.sortBy, normalizedParams);
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    // 6. Compute explainable match reasons using CareerRelevanceEngine
    const searchIntent = buildCareerSearchIntent({
      q: safeQ,
      role: safeRole,
      branch: safeBranch,
      domain: safeDomain,
      location: safeLoc,
      opportunityType: params.employmentType,
      experience: params.experience,
      workMode: params.remote,
      skills: params.skills,
    });

    const matchReasonsMap: Record<string, string[]> = {};
    for (const item of paginated) {
      const canonicalRecord: any = {
        ...item,
        company: item.companyName,
        remote: item.remoteType === "remote",
        opportunityType: item.isInternship ? "INTERNSHIP" : "JOB",
        verificationState: item.verificationTier === "SAARVI_VERIFIED" ? "VERIFIED" : "NOT_VERIFIED",
      };
      const scored = CareerRelevanceEngine.scoreJob(canonicalRecord, searchIntent);
      if (scored.matchReasons.length > 0) {
        matchReasonsMap[item.id] = scored.matchReasons;
      }
    }

    const response: JobSearchResponse = {
      items: paginated,
      verifiedItems: cleanVerified.slice((page - 1) * limit, page * limit),
      sourceItems: cleanSource.slice((page - 1) * limit, page * limit),
      total: combinedItems.length,
      page,
      pageSize: limit,
      cached: false,
      cacheTimestamp: new Date().toISOString(),
      liveCount: globalLiveCount > 0 ? globalLiveCount : cleanVerified.length,
      filteredCount: combinedItems.length,
      verifiedCount: cleanVerified.length,
      sourceDiscoveryCount: cleanSource.length,
      matchReasonsMap,
      providerStatus,
      querySummary: {
        q: effectiveQ || "",
        location: safeLoc,
        filtersApplied:
          (params.remote ? 1 : 0) +
          (params.experience ? 1 : 0) +
          (params.employmentType ? 1 : 0) +
          (params.tier && params.tier !== "all" ? 1 : 0),
      },
    };

    // Store in cache
    this.cache.set(cacheKey, {
      response,
      timestamp: now,
    });

    return response;
  }

  /**
   * Fetches single canonical opportunity by ID.
   */
  public async getJobById(id: string): Promise<JobItem | null> {
    if (!id) return null;
    const cleanId = decodeURIComponent(id).trim();

    // 1. Direct query to Supabase repository
    if (isSupabaseConfigured()) {
      const dbJob = await jobRepository.getJobById(cleanId);
      if (dbJob) return dbJob;
    }

    // 2. Fallback: in-memory opportunityStore
    const opp = opportunityStore.getOpportunityById(cleanId);
    if (opp) {
      const isPublic = opp.recordState !== "DELETED" && opp.status !== "DELETED" && (opp.status === "PUBLISHED" || opp.status === "ACTIVE" || opp.status === "APPROVED");
      if (isPublic) {
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
          fetchedAt: (opp as any).fetchedAt || opp.discoveredAt,
          verifiedStatus: opp.verifiedByAdmin ? "verified" : "source_checked",
          verificationTier: opp.verifiedByAdmin ? "SAARVI_VERIFIED" : "SOURCE_DISCOVERY",
          isInternship: opp.isInternship,
          confidenceScore: 100,
        };
      }
    }

    // 3. Search in cache entries
    const strippedJob = cleanId.replace(/^job_/, "");
    for (const entry of this.cache.values()) {
      const match = entry.response.items.find(
        (j) =>
          j.id === cleanId ||
          j.sourceJobId === cleanId ||
          j.id === strippedJob ||
          j.sourceJobId === strippedJob ||
          `job_${j.sourceJobId}` === cleanId
      );
      if (match) return match;
    }

    // 4. Fallback: decode base64 self-contained SerpApi job ID if it starts with `eyJ`
    if (strippedJob.startsWith("eyJ")) {
      try {
        const decodedJson = Buffer.from(strippedJob, "base64").toString("utf8");
        const parsed = JSON.parse(decodedJson);
        if (parsed.job_title || parsed.title) {
          const title = parsed.job_title || parsed.title;
          const companyName = parsed.company_name || parsed.company || "External Company";
          const location = parsed.location || "India";
          const synthesizedJob: JobItem = {
            id: cleanId,
            title,
            companyName,
            location,
            remoteType: location.toLowerCase().includes("remote") ? "remote" : "onsite",
            employmentType: title.toLowerCase().includes("intern") ? "internship" : "full-time",
            experienceLevel: "fresher",
            salary: "Salary not disclosed",
            description:
              parsed.description ||
              `${title} at ${companyName}. Discover verified student opportunities on Saarvi.`,
            skills: ["Communication", "Problem Solving", "Technical Aptitude"],
            datePosted: new Date().toISOString(),
            applicationDeadline: "Deadline not provided",
            sourceName: parsed.via || "External Source",
            sourceUrl:
              parsed.link ||
              parsed.apply_link ||
              `https://google.com/search?q=${encodeURIComponent(title + " " + companyName)}`,
            applyUrl:
              parsed.link ||
              parsed.apply_link ||
              `https://google.com/search?q=${encodeURIComponent(title + " " + companyName)}`,
            sourceJobId: strippedJob,
            fetchedAt: new Date().toISOString(),
            verifiedStatus: "source_checked",
            verificationTier: "SOURCE_DISCOVERY",
            isInternship: title.toLowerCase().includes("intern"),
            confidenceScore: 85,
          };
          return synthesizedJob;
        }
      } catch {
        // Base64 decode failed, proceed
      }
    }

    return null;
  }
}

export const jobSearchService = new JobSearchService();

// Register with cache invalidation
registerJobsCacheInvalidator(() => jobSearchService.clearCache());
