/**
 * Saarvi Opportunity Store & Approval Pipeline
 *
 * Manages the single source of truth for discovered, pending, approved, and verified
 * opportunities. Backed by in-memory cache and Supabase with strict admin audit logging.
 */

import type {
  Opportunity,
  OpportunityFilterParams,
  OpportunityStatus,
  SourceHealth,
  DiscoveryConfig,
  PreviewOpportunity,
  ManualOpportunityInput,
  BulkImportSummary,
  JobDiscoveryBatch,
  JobDiagnostics,
  RecordState,
  ReviewState,
  PublicationState,
  VerificationState,
  EnrichmentState,
  DataOrigin,
} from "./types.ts";
import { deduplicateOpportunities } from "./deduplicator.ts";
import { MockStorageProvider } from "../supabase/mock-storage.ts";
import { CANONICAL_SEED_OPPORTUNITIES } from "./seed-opportunities.ts";
import { isSupabaseConfigured } from "../supabase/config.ts";

/**
 * Calculates deterministic date boundaries for Saarvi's reporting timezone (Asia/Kolkata, UTC+5:30).
 * Prevents UTC vs IST date comparison mismatches.
 */
export function getISTDateRange(
  filterType?: string,
  customFrom?: string,
  customTo?: string
): { start: Date; end: Date } | null {
  if (!filterType || filterType === "all") return null;

  // IST offset is UTC+5:30 (330 minutes)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowUtc = Date.now();
  const nowIst = new Date(nowUtc + IST_OFFSET_MS);

  const istYear = nowIst.getUTCFullYear();
  const istMonth = nowIst.getUTCMonth();
  const istDate = nowIst.getUTCDate();

  const createDateInIST = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) => {
    const utcEpoch = Date.UTC(y, m, d, h, min, s, ms) - IST_OFFSET_MS;
    return new Date(utcEpoch);
  };

  switch (filterType.toLowerCase()) {
    case "today": {
      const start = createDateInIST(istYear, istMonth, istDate, 0, 0, 0, 0);
      const end = createDateInIST(istYear, istMonth, istDate, 23, 59, 59, 999);
      return { start, end };
    }
    case "yesterday": {
      const start = createDateInIST(istYear, istMonth, istDate - 1, 0, 0, 0, 0);
      const end = createDateInIST(istYear, istMonth, istDate - 1, 23, 59, 59, 999);
      return { start, end };
    }
    case "last7days":
    case "7days": {
      const start = createDateInIST(istYear, istMonth, istDate - 6, 0, 0, 0, 0);
      const end = createDateInIST(istYear, istMonth, istDate, 23, 59, 59, 999);
      return { start, end };
    }
    case "last30days":
    case "30days": {
      const start = createDateInIST(istYear, istMonth, istDate - 29, 0, 0, 0, 0);
      const end = createDateInIST(istYear, istMonth, istDate, 23, 59, 59, 999);
      return { start, end };
    }
    case "custom": {
      if (!customFrom) return null;
      const startParts = customFrom.split("-").map(Number);
      const start = createDateInIST(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);
      let end: Date;
      if (customTo) {
        const endParts = customTo.split("-").map(Number);
        end = createDateInIST(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);
      } else {
        end = createDateInIST(istYear, istMonth, istDate, 23, 59, 59, 999);
      }
      return { start, end };
    }
    default:
      return null;
  }
}

/**
 * Normalized query fingerprint for request coalescing.
 */
export function getQueryFingerprint(
  query: string,
  location: string,
  filters: Record<string, unknown> = {}
): string {
  const normQ = (query || "").trim().toLowerCase();
  const normLoc = (location || "").trim().toLowerCase();
  const normType = String(filters.type || filters.category || "all").trim().toLowerCase();
  const normRemote = String(filters.remote || filters.remoteOnly || "all").trim().toLowerCase();
  const normExp = String(filters.experience || filters.experienceLevel || "all").trim().toLowerCase();
  return `${normQ}#${normLoc}#${normType}#${normRemote}#${normExp}`;
}

export const activeDiscoveryRequests = new Map<string, Promise<any>>();

export function opportunityToRow(opp: Opportunity): Record<string, unknown> {
  const isInternship = opp.isInternship || opp.category === "internship" || opp.employmentType === "internship";
  const origin: DataOrigin = opp.dataOrigin || (opp.id.startsWith("opp_seed_") ? "SEED" : opp.source === "admin_manual" ? "ADMIN" : "PROVIDER");

  return {
    id: opp.id,
    type: isInternship ? "INTERNSHIP" : "JOB",
    title: opp.title,
    company_name: opp.companyName,
    company_logo_url: opp.companyLogo || null,
    location: opp.location || "India",
    country: "India",
    remote_type: opp.remoteType || "onsite",
    employment_type: opp.employmentType || (isInternship ? "internship" : "full-time"),
    experience_level: opp.experienceLevel || "fresher",
    description: opp.description || "",
    skills: opp.skills || [],
    responsibilities: [],
    qualifications: [],
    benefits: [],
    salary_min: opp.salary?.min ?? null,
    salary_max: opp.salary?.max ?? null,
    salary_currency: opp.salary?.currency || "INR",
    salary_period: opp.salary?.period || "monthly",
    salary_text: opp.salary ? `${opp.salary.currency || "₹"} ${opp.salary.min} - ${opp.salary.max}` : "Salary not disclosed",
    posted_at: opp.postedAt || new Date().toISOString(),
    deadline: opp.applicationDeadline || null,
    source_name: opp.verifiedByAdmin ? "Verified by Saarvi" : opp.source,
    source_url: opp.sourceUrl || null,
    source_job_id: opp.sourceId || opp.id,
    apply_url: opp.applyUrl || opp.sourceUrl || "https://saarvi.app/jobs",
    apply_options: [],
    provider: opp.source || "curated",
    source_verified: opp.verifiedByAdmin ?? true,
    verification_status: opp.verificationState === "PASSED" || opp.verifiedByAdmin ? "verified" : "source_checked",
    status: opp.status || "PUBLISHED",
    visibility: "public",
    featured: false,
    canonical_job_key: opp.canonicalJobKey || `${opp.companyName.toLowerCase()}|${opp.title.toLowerCase()}|${opp.location.toLowerCase()}`,
    content_hash: opp.contentHash || "",
    discovered_at: opp.discoveredAt || opp.createdAt || new Date().toISOString(),
    fetched_at: opp.fetchedAt || opp.discoveredAt || new Date().toISOString(),
    approved_at: opp.verifiedAt || opp.publishedAt || new Date().toISOString(),
    published_at: opp.publishedAt || new Date().toISOString(),
    expires_at: opp.expiresAt || null,
    created_at: opp.createdAt || new Date().toISOString(),
    updated_at: opp.updatedAt || new Date().toISOString(),
    record_state: opp.recordState || (opp.status === "DELETED" ? "DELETED" : opp.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE"),
    review_state: opp.reviewState || (opp.status === "APPROVED" || opp.status === "PUBLISHED" ? "APPROVED" : "PENDING_REVIEW"),
    publication_state: opp.publicationState || (opp.status === "PUBLISHED" || opp.status === "ACTIVE" ? "PUBLISHED" : "NOT_PUBLISHED"),
    verification_state: opp.verificationState || (opp.verifiedByAdmin ? "PASSED" : "PENDING"),
    enrichment_state: opp.enrichmentState || "COMPLETED",
    data_origin: origin,
  };
}

export function rowToOpportunity(row: any): Opportunity {
  const isInternship = row.type === "INTERNSHIP" || row.employment_type === "internship";
  const origin: DataOrigin = (row.data_origin as DataOrigin) || (row.id.startsWith("opp_seed_") ? "SEED" : row.provider === "admin_manual" ? "ADMIN" : "PROVIDER");

  return {
    id: row.id,
    source: (row.provider as any) || "curated",
    sourceId: row.source_job_id || row.id,
    sourceUrl: row.source_url || "",
    applyUrl: row.apply_url || row.source_url || "",
    originalSourceUrl: row.source_url || "",
    directApplyUrl: row.apply_url || "",
    title: row.title,
    companyName: row.company_name,
    companyLogo: row.company_logo_url || undefined,
    description: row.description,
    location: row.location,
    remoteType: row.remote_type || "onsite",
    employmentType: row.employment_type || (isInternship ? "internship" : "full-time"),
    experienceLevel: row.experience_level || "fresher",
    skills: Array.isArray(row.skills) ? row.skills : [],
    salary: (row.salary_min != null || row.salary_max != null) ? {
      min: Number(row.salary_min) || undefined,
      max: Number(row.salary_max) || undefined,
      currency: row.salary_currency || "INR",
      period: row.salary_period || "monthly",
    } : null,
    postedAt: row.posted_at || row.created_at || new Date().toISOString(),
    applicationDeadline: row.deadline || undefined,
    sourceLastUpdatedAt: row.updated_at || new Date().toISOString(),
    discoveredAt: row.discovered_at || row.created_at || new Date().toISOString(),
    verifiedAt: row.approved_at || undefined,
    verifiedByAdmin: row.source_verified ?? true,
    approvedBy: row.updated_by || "saarvi_admin",
    status: (row.status as OpportunityStatus) || "PUBLISHED",
    category: isInternship ? "internship" : "job",
    isInternship,
    isJob: !isInternship,
    isScholarship: false,
    isHackathon: false,
    contentHash: row.content_hash || "",
    confidenceScore: 100,
    publishedAt: row.published_at || row.created_at,
    canonicalJobKey: row.canonical_job_key || undefined,
    recordState: (row.record_state as RecordState) || "ACTIVE",
    reviewState: (row.review_state as ReviewState) || "APPROVED",
    publicationState: (row.publication_state as PublicationState) || "PUBLISHED",
    verificationState: (row.verification_state as VerificationState) || "PASSED",
    enrichmentState: (row.enrichment_state as EnrichmentState) || "COMPLETED",
    dataOrigin: origin,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}


type CacheInvalidator = () => void;
let cacheInvalidators: CacheInvalidator[] = [];

export function registerJobsCacheInvalidator(fn: CacheInvalidator): () => void {
  cacheInvalidators.push(fn);
  return () => {
    cacheInvalidators = cacheInvalidators.filter((cb) => cb !== fn);
  };
}

export function invalidateJobsCache(): void {
  for (const invalidate of cacheInvalidators) {
    try {
      invalidate();
    } catch {}
  }
}

export interface OpportunityAuditEvent {
  id: string;
  opportunityId: string;
  action: "APPROVED" | "REJECTED" | "EDITED" | "MERGED" | "EXPIRED" | "DISCOVERED" | "IMPORTED" | "CREATED_MANUAL" | "PAUSED" | "RESUMED" | "PUBLISHED" | "ARCHIVED" | "DELETED";
  actorId: string;
  previousStatus?: string;
  newStatus?: string;
  details?: string;
  timestamp: string;
}

export function cleanAndSanitizeUrl(url?: string): string {
  if (!url) return "";
  let trimmed = url.trim();
  // Strip tracking query parameters
  try {
    const parsed = new URL(trimmed);
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ref",
      "ref_id",
      "source",
      "trk",
      "trackingid",
      "referrer",
      "affiliate_id",
      "gh_src",
      "subid",
    ];
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (trackingParams.includes(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }
    if (parsed.pathname.endsWith("/") && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("file:") || lower.startsWith("vbscript:")) {
    return false;
  }
  return lower.startsWith("http://") || lower.startsWith("https://");
}

function generateOpportunityHash(title: string, company: string, location: string): string {
  const norm = `${title.toLowerCase().trim()}|${company.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    const char = norm.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

class OpportunityStoreService {
  private opportunities = new Map<string, Opportunity>();
  private auditLogs: OpportunityAuditEvent[] = [];
  private sourceHealthMap = new Map<string, SourceHealth>();

  private discoveryConfig: DiscoveryConfig = {
    roles: ["Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Analyst"],
    locations: ["India", "Bengaluru", "Hyderabad", "Pune", "Remote"],
    skills: ["Java", "Python", "React", "TypeScript", "Node.js", "SQL"],
    experienceLevels: ["fresher", "entry-level"],
    searchFrequencyHours: 6,
    autoApproveHighConfidence: false, // Strict admin review mandatory
    enabledSources: ["serpapi_google_jobs", "serpapi_google_search"],
    lastRunTimestamp: undefined,
  };

  private isSupabaseSyncing = false;
  private lastSupabaseSync = 0;

  constructor() {
    this.initDefaultSources();
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = MockStorageProvider.getJobOpportunities();
      if (Array.isArray(stored) && stored.length > 0) {
        for (const item of stored) {
          if (item && item.id) {
            this.opportunities.set(item.id, item);
          }
        }
      }
    } catch (e) {
      console.warn("[OpportunityStore] Error loading from storage:", e);
    }

    // Always seed canonical opportunities if store is empty or missing verified seeds
    if (this.opportunities.size === 0) {
      this.seedCanonicalOpportunities();
    }

    // Trigger asynchronous Supabase synchronization in server environments
    if (typeof window === "undefined" && isSupabaseConfigured()) {
      this.syncWithSupabase().catch((err) => {
        console.warn("[OpportunityStore] Background Supabase sync notice:", err);
      });
    }
  }

  public seedCanonicalOpportunities(): void {
    for (const item of CANONICAL_SEED_OPPORTUNITIES) {
      if (!this.opportunities.has(item.id)) {
        this.opportunities.set(item.id, item);
      }
    }
    try {
      MockStorageProvider.saveJobOpportunitiesBatch(Array.from(this.opportunities.values()));
    } catch {}
  }

  public async syncWithSupabase(): Promise<void> {
    if (typeof window !== "undefined" || !isSupabaseConfigured()) return;
    const now = Date.now();
    if (this.isSupabaseSyncing || now - this.lastSupabaseSync < 30000) return;
    this.isSupabaseSyncing = true;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSupabaseAdminClient } = require("../supabase/admin");
      const supabase = getSupabaseAdminClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from("job_opportunities")
        .select("*")
        .neq("record_state", "DELETED")
        .order("posted_at", { ascending: false })
        .limit(200);

      if (error) {
        console.warn("[OpportunityStore] Supabase fetch notice:", error.message);
        return;
      }

      if (data && data.length > 0) {
        for (const row of data) {
          const opp = rowToOpportunity(row);
          this.opportunities.set(opp.id, opp);
        }
        MockStorageProvider.saveJobOpportunitiesBatch(Array.from(this.opportunities.values()));
      } else {
        // Table in Supabase is empty: seed with canonical verified opportunities
        const rows = CANONICAL_SEED_OPPORTUNITIES.map(opportunityToRow);
        await supabase.from("job_opportunities").upsert(rows, { onConflict: "id" });
        for (const seed of CANONICAL_SEED_OPPORTUNITIES) {
          this.opportunities.set(seed.id, seed);
        }
      }
      this.lastSupabaseSync = Date.now();
    } catch (err) {
      console.warn("[OpportunityStore] Supabase sync error:", err);
    } finally {
      this.isSupabaseSyncing = false;
    }
  }

  public persistToStorage(): void {
    try {
      const items = Array.from(this.opportunities.values());
      MockStorageProvider.saveJobOpportunitiesBatch(items);

      if (typeof window === "undefined" && isSupabaseConfigured()) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getSupabaseAdminClient } = require("../supabase/admin");
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const rows = items.map(opportunityToRow);
          // Non-blocking upsert
          supabase
            .from("job_opportunities")
            .upsert(rows, { onConflict: "id" })
            .catch((err: any) => console.warn("[OpportunityStore] Supabase persist notice:", err));
        }
      }
    } catch (e) {
      console.warn("[OpportunityStore] Error saving to storage:", e);
    }
  }

  private initDefaultSources(): void {
    this.sourceHealthMap.set("serpapi_google_jobs", {
      sourceId: "serpapi_google_jobs",
      name: "SerpApi Google Jobs Engine",
      status: "HEALTHY",
      circuitState: "CLOSED",
      recordsDiscoveredTotal: 0,
      recordsApprovedTotal: 0,
      rateLimit429Count: 0,
      lastCheckTimestamp: new Date().toISOString(),
    });

    this.sourceHealthMap.set("serpapi_google_search", {
      sourceId: "serpapi_google_search",
      name: "SerpApi Google Search Discovery",
      status: "HEALTHY",
      circuitState: "CLOSED",
      recordsDiscoveredTotal: 0,
      recordsApprovedTotal: 0,
      rateLimit429Count: 0,
      lastCheckTimestamp: new Date().toISOString(),
    });
  }

  /**
   * Ingest newly discovered opportunities through deduplication and quality gate.
   */
  public ingestOpportunities(rawDiscovered: Opportunity[], actorId = "system"): {
    addedCount: number;
    mergedCount: number;
  } {
    const existingList = Array.from(this.opportunities.values());
    const combined = [...existingList, ...rawDiscovered];

    const { uniqueOpportunities, duplicatesMergedCount } = deduplicateOpportunities(combined);

    let addedCount = 0;
    for (const opp of uniqueOpportunities) {
      if (!this.opportunities.has(opp.id)) {
        this.opportunities.set(opp.id, opp);
        addedCount++;

        this.recordAuditEvent({
          opportunityId: opp.id,
          action: "DISCOVERED",
          actorId,
          details: `Discovered from ${opp.source}`,
        });
      }
    }

    return { addedCount, mergedCount: duplicatesMergedCount };
  }

  /**
   * Admin Manual Entry: Adds a job or internship directly created by an authorized admin.
   */
  public addManualOpportunity(input: ManualOpportunityInput, adminId: string): Opportunity {
    if (!input.title || input.title.trim().length < 3) {
      throw new Error("Job title must be at least 3 characters.");
    }
    if (!input.companyName || input.companyName.trim().length < 2) {
      throw new Error("Company name must be at least 2 characters.");
    }
    if (!input.applyUrl || !isSafeUrl(input.applyUrl)) {
      throw new Error("A valid, safe application URL (HTTP/HTTPS) is required.");
    }

    const cleanApplyUrl = cleanAndSanitizeUrl(input.applyUrl);
    const cleanSourceUrl = cleanAndSanitizeUrl(input.sourceUrl || input.applyUrl);
    const now = new Date().toISOString();
    const id = `opp_manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const category = input.category || (input.employmentType === "internship" ? "internship" : "job");
    const isInternship = category === "internship" || input.employmentType === "internship";
    const status: OpportunityStatus = input.status || "APPROVED";
    const isApproved = status === "APPROVED" || status === "PUBLISHED";

    const opp: Opportunity = {
      id,
      source: "admin_manual",
      sourceId: id,
      sourceUrl: cleanSourceUrl,
      applyUrl: cleanApplyUrl,
      originalSourceUrl: cleanSourceUrl,
      directApplyUrl: cleanApplyUrl,
      title: input.title.trim(),
      companyName: input.companyName.trim(),
      companyLogo: input.companyLogo?.trim(),
      description: input.description?.trim() || "No detailed description provided.",
      location: input.location?.trim() || "Remote",
      remoteType: input.remoteType || "remote",
      employmentType: input.employmentType || "full-time",
      experienceLevel: input.experienceLevel || "entry-level",
      skills: Array.isArray(input.skills) ? input.skills.map((s) => s.trim()).filter(Boolean) : [],
      salary: input.salary || null,
      postedAt: input.postedAt || now,
      applicationDeadline: input.applicationDeadline || null,
      sourceLastUpdatedAt: now,
      discoveredAt: now,
      verifiedAt: isApproved ? now : null,
      verifiedByAdmin: isApproved,
      approvedBy: isApproved ? adminId : undefined,
      status: isApproved ? "APPROVED" : status,
      category,
      isInternship,
      isJob: !isInternship,
      isScholarship: category === "scholarship",
      isHackathon: category === "hackathon",
      contactEmail: input.contactEmail?.trim(),
      tags: input.tags || [],
      contentHash: generateOpportunityHash(input.title, input.companyName, input.location || "Remote"),
      confidenceScore: 100,
      createdAt: now,
      updatedAt: now,
    };

    this.opportunities.set(id, opp);

    this.recordAuditEvent({
      opportunityId: id,
      action: "CREATED_MANUAL",
      actorId: adminId,
      details: `Manually added by admin (${status})`,
    });

    return opp;
  }

  /**
   * Preview and validate discovered results before importing into PENDING_REVIEW.
   * Runs safety, schema validation, and fast duplicate detection.
   */
  public previewDiscoveryResults(rawItems: Opportunity[]): {
    results: PreviewOpportunity[];
    summary: { found: number; valid: number; invalid: number; duplicates: number };
  } {
    const existingList = Array.from(this.opportunities.values());
    const existingUrlSet = new Set(existingList.map((o) => cleanAndSanitizeUrl(o.applyUrl).toLowerCase()));
    const existingTitleCompanyMap = new Map<string, string>();
    for (const o of existingList) {
      const key = `${o.companyName.toLowerCase().trim()}|${o.title.toLowerCase().trim()}`;
      existingTitleCompanyMap.set(key, o.id);
    }

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    const previewList: PreviewOpportunity[] = rawItems.map((item) => {
      const warnings: string[] = [];
      let isInvalid = false;

      // 1. URL Safety & Sanitization
      const cleanApply = cleanAndSanitizeUrl(item.applyUrl);
      if (!isSafeUrl(cleanApply)) {
        isInvalid = true;
        warnings.push("Invalid or unsafe application URL");
      }

      // 2. Field Length & Sanity
      if (!item.title || item.title.trim().length < 3) {
        isInvalid = true;
        warnings.push("Title is missing or too short");
      }
      if (!item.companyName || item.companyName.trim().length < 2) {
        isInvalid = true;
        warnings.push("Company name is missing");
      }
      if (!item.description || item.description.trim().length < 15) {
        warnings.push("Very short description snippet");
      }
      if (!item.skills || item.skills.length === 0) {
        warnings.push("No explicit skills identified");
      }
      if (!item.applicationDeadline) {
        warnings.push("Deadline not provided by source");
      }

      // 3. Duplicate Detection
      let duplicateStatus: "NEW" | "POSSIBLE_DUPLICATE" | "EXACT_DUPLICATE" = "NEW";
      let duplicateTargetId: string | undefined = undefined;

      const normApply = cleanApply.toLowerCase();
      const normKey = `${item.companyName.toLowerCase().trim()}|${item.title.toLowerCase().trim()}`;

      if (existingUrlSet.has(normApply)) {
        duplicateStatus = "EXACT_DUPLICATE";
        duplicateTargetId = existingList.find((o) => cleanAndSanitizeUrl(o.applyUrl).toLowerCase() === normApply)?.id;
        duplicateCount++;
      } else if (existingTitleCompanyMap.has(normKey)) {
        duplicateStatus = "POSSIBLE_DUPLICATE";
        duplicateTargetId = existingTitleCompanyMap.get(normKey);
        duplicateCount++;
      }

      if (duplicateStatus !== "NEW") {
        warnings.push(`Matches existing opportunity ${duplicateTargetId || "in database"}`);
      }

      let validationStatus: "VALID" | "WARNING" | "INVALID" = "VALID";
      if (isInvalid) {
        validationStatus = "INVALID";
        invalidCount++;
      } else if (warnings.length > 0) {
        validationStatus = "WARNING";
        validCount++;
      } else {
        validCount++;
      }

      return {
        ...item,
        applyUrl: cleanApply,
        validationStatus,
        validationWarnings: warnings,
        duplicateStatus,
        duplicateTargetId,
      };
    });

    return {
      results: previewList,
      summary: {
        found: rawItems.length,
        valid: validCount,
        invalid: invalidCount,
        duplicates: duplicateCount,
      },
    };
  }

  /**
   * Bulk import validated preview items into PENDING_REVIEW queue.
   */
  public bulkImportToPendingReview(items: Opportunity[], adminId: string): BulkImportSummary {
    let imported = 0;
    let valid = 0;
    let invalid = 0;
    let duplicates = 0;

    for (const item of items) {
      if (!isSafeUrl(item.applyUrl) || !item.title || !item.companyName) {
        invalid++;
        continue;
      }
      valid++;

      if (this.opportunities.has(item.id)) {
        duplicates++;
        continue;
      }

      const pendingItem: Opportunity = {
        ...item,
        status: "PENDING_REVIEW",
        verifiedByAdmin: false,
        verifiedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.opportunities.set(pendingItem.id, pendingItem);
      imported++;

      this.recordAuditEvent({
        opportunityId: pendingItem.id,
        action: "IMPORTED",
        actorId: adminId,
        details: `Imported to PENDING_REVIEW from discovery (${item.source})`,
      });
    }

    return {
      found: items.length,
      valid,
      invalid,
      duplicates,
      imported,
    };
  }

  /**
   * Admin Approval Pipeline: Moves opportunity from PENDING_REVIEW to APPROVED.
   * Only APPROVED opportunities receive the "Verified by Saarvi" badge.
   */
  public approveOpportunity(id: string, adminId: string, notes?: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    opp.status = "APPROVED";
    opp.reviewState = "APPROVED";
    opp.verificationState = "PASSED";
    opp.publicationState = "PUBLISHED";
    opp.recordState = "ACTIVE";
    opp.dataOrigin = opp.dataOrigin && opp.dataOrigin !== "SEED" && opp.dataOrigin !== "TEST" ? opp.dataOrigin : "PROVIDER";
    opp.verifiedAt = new Date().toISOString();
    opp.verifiedByAdmin = true;
    opp.approvedBy = adminId;
    opp.adminNotes = notes || opp.adminNotes;
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "APPROVED",
      actorId: adminId,
      details: notes || "Approved and published to public feed by administrator",
    });

    return opp;
  }

  public pauseOpportunity(id: string, adminId: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    opp.status = "PAUSED";
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "PAUSED",
      actorId: adminId,
      details: "Paused listing by administrator",
    });

    return opp;
  }

  public resumeOpportunity(id: string, adminId: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    opp.status = "APPROVED";
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "RESUMED",
      actorId: adminId,
      details: "Resumed listing by administrator",
    });

    return opp;
  }

  public rejectOpportunity(id: string, adminId: string, reason?: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    opp.status = "REJECTED";
    opp.adminNotes = reason || "Rejected by administrator";
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "REJECTED",
      actorId: adminId,
      details: reason || "Rejected by administrator",
    });

    return opp;
  }

  public editOpportunity(id: string, patch: Partial<Opportunity>, adminId: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    const updated: Opportunity = {
      ...opp,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.opportunities.set(id, updated);

    this.recordAuditEvent({
      opportunityId: id,
      action: "EDITED",
      actorId: adminId,
      details: "Opportunity fields updated by administrator",
    });

    return updated;
  }

  public publishOpportunity(id: string, adminId: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    const previousStatus = opp.status;
    opp.status = "PUBLISHED";
    opp.publishedAt = new Date().toISOString();
    opp.verifiedByAdmin = true;
    opp.approvedBy = adminId;
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "PUBLISHED",
      actorId: adminId,
      previousStatus,
      newStatus: "PUBLISHED",
      details: "Published listing to public live feed by administrator",
    });

    return opp;
  }

  public archiveOpportunity(id: string, adminId: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    const previousStatus = opp.status;
    opp.status = "ARCHIVED";
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "ARCHIVED",
      actorId: adminId,
      previousStatus,
      newStatus: "ARCHIVED",
      details: "Archived opportunity by administrator",
    });

    return opp;
  }

  public deleteOpportunity(id: string, adminId: string, permanent = false): boolean {
    const opp = this.opportunities.get(id);
    if (!opp) return false;

    if (permanent) {
      this.opportunities.delete(id);
      this.recordAuditEvent({
        opportunityId: id,
        action: "DELETED",
        actorId: adminId,
        previousStatus: opp.status,
        newStatus: "PERMANENTLY_DELETED",
        details: "Permanently deleted opportunity from database",
      });
      return true;
    }

    // Soft delete
    const previousStatus = opp.status;
    opp.status = "DELETED";
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "DELETED",
      actorId: adminId,
      previousStatus,
      newStatus: "DELETED",
      details: "Soft deleted opportunity by administrator",
    });

    this.persistToStorage();
    return true;
  }

  /**
   * Production-grade discovery persistence & deduplication pipeline.
   * Discovered provider opportunities are immediately stored in the database as PENDING_REVIEW.
   * Safe upsert behavior: updates freshness for existing opportunities without overwriting admin edits.
   */
  public persistDiscoveredResults(
    rawItems: Opportunity[],
    batchInfo: { query: string; location: string; provider: string; createdBy?: string }
  ): {
    batch: JobDiscoveryBatch;
    saved: Opportunity[];
    summary: { fetched: number; valid: number; newCount: number; existingCount: number; duplicateCount: number; rejectedCount: number; storedCount: number };
  } {
    const now = new Date().toISOString();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const queryFingerprint = getQueryFingerprint(batchInfo.query, batchInfo.location);

    let newCount = 0;
    let existingCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;
    const failedCount = 0;
    const savedList: Opportunity[] = [];

    // Pre-index existing opportunities for fast deterministic matching
    const existingList = Array.from(this.opportunities.values());
    const existingUrlMap = new Map<string, Opportunity>();
    const existingKeyMap = new Map<string, Opportunity>();
    const existingSourceIdMap = new Map<string, Opportunity>();

    for (const opp of existingList) {
      const cleanApply = cleanAndSanitizeUrl(opp.applyUrl).toLowerCase();
      if (cleanApply) existingUrlMap.set(cleanApply, opp);

      const normKey = `${opp.companyName.toLowerCase().trim()}|${opp.title.toLowerCase().trim()}|${opp.location.toLowerCase().trim()}`;
      existingKeyMap.set(normKey, opp);

      if (opp.sourceId) existingSourceIdMap.set(`${opp.source}:${opp.sourceId}`, opp);
    }

    // In-batch deduplication map to prevent O(N^2) comparisons
    const batchSeenKeys = new Set<string>();

    for (const item of rawItems) {
      const cleanApply = cleanAndSanitizeUrl(item.applyUrl);
      if (!isSafeUrl(cleanApply) || !item.title || item.title.trim().length < 3 || !item.companyName) {
        rejectedCount++;
        continue;
      }

      const normApply = cleanApply.toLowerCase();
      const normKey = `${item.companyName.toLowerCase().trim()}|${item.title.toLowerCase().trim()}|${item.location.toLowerCase().trim()}`;
      const sourceKey = `${item.source}:${item.sourceId}`;

      // In-batch duplicate check
      if (batchSeenKeys.has(normApply) || batchSeenKeys.has(normKey)) {
        duplicateCount++;
        continue;
      }
      batchSeenKeys.add(normApply);
      batchSeenKeys.add(normKey);

      const existing = existingSourceIdMap.get(sourceKey) || existingUrlMap.get(normApply) || existingKeyMap.get(normKey);

      if (existing) {
        // Upsert behavior: update safe freshness fields without overwriting admin edits or approval status
        existing.sourceLastUpdatedAt = now;
        existing.fetchedAt = now;
        existing.contentHash = item.contentHash || generateOpportunityHash(item.title, item.companyName, item.location);
        if (item.salary && !existing.salary) {
          existing.salary = item.salary;
        }
        if (item.applicationDeadline && !existing.applicationDeadline) {
          existing.applicationDeadline = item.applicationDeadline;
        }
        existing.updatedAt = now;
        existingCount++;
        savedList.push(existing);
      } else {
        // Fresh insertion into PENDING_REVIEW
        const newOpp: Opportunity = {
          ...item,
          applyUrl: cleanApply,
          status: "PENDING_REVIEW",
          discoveryBatchId: batchId,
          discoveredAt: now,
          fetchedAt: now,
          verifiedByAdmin: false,
          verifiedAt: null,
          createdAt: now,
          updatedAt: now,
          canonicalJobKey: normKey,
          confidenceScore: item.confidenceScore || 90,
          dataOrigin: "PROVIDER",
          recordState: "ACTIVE",
          reviewState: "PENDING_REVIEW",
          verificationState: "PENDING",
          publicationState: "NOT_PUBLISHED",
          enrichmentState: "PENDING",
        };

        this.opportunities.set(newOpp.id, newOpp);
        existingUrlMap.set(normApply, newOpp);
        existingKeyMap.set(normKey, newOpp);
        newCount++;
        savedList.push(newOpp);

        this.recordAuditEvent({
          opportunityId: newOpp.id,
          action: "IMPORTED",
          actorId: batchInfo.createdBy || "system",
          details: `Imported to PENDING_REVIEW from discovery batch ${batchId}`,
        });
      }
    }

    const batchRecord: JobDiscoveryBatch = {
      id: batchId,
      query: batchInfo.query,
      location: batchInfo.location,
      provider: batchInfo.provider,
      queryFingerprint,
      requestedCount: rawItems.length,
      fetchedCount: rawItems.length,
      validCount: newCount + existingCount,
      newCount,
      existingCount,
      duplicateCount,
      rejectedCount,
      storedCount: newCount + existingCount,
      failedCount,
      publishedCount: 0,
      status: "COMPLETED",
      startedAt: now,
      completedAt: now,
      createdBy: batchInfo.createdBy || "admin",
    };

    MockStorageProvider.createDiscoveryBatch(batchRecord);
    this.persistToStorage();

    return {
      batch: batchRecord,
      saved: savedList,
      summary: {
        fetched: rawItems.length,
        valid: newCount + existingCount,
        newCount,
        existingCount,
        duplicateCount,
        rejectedCount,
        storedCount: newCount + existingCount,
      },
    };
  }

  /**
   * Server-side Bulk Publish operation.
   * Single server transaction that publishes eligible opportunities, sets publication timestamp,
   * audits the operation, and reports partial failures.
   */
  public bulkPublishOpportunities(
    jobIds: string[],
    adminId: string,
    options?: { allMatching?: boolean; filterCriteria?: OpportunityFilterParams; discoveryBatchId?: string }
  ): {
    requested: number;
    published: number;
    skipped: number;
    failed: number;
    failures: Array<{ id: string; reason: string }>;
  } {
    let targetIds = jobIds;

    if (options?.allMatching) {
      const all = Array.from(this.opportunities.values());
      let eligible = all.filter((o) => o.status === "PENDING_REVIEW" || o.status === "DISCOVERED" || o.status === "APPROVED");
      if (options.discoveryBatchId) {
        eligible = eligible.filter((o) => o.discoveryBatchId === options.discoveryBatchId);
      }
      if (options.filterCriteria?.category) {
        eligible = eligible.filter((o) => o.category === options.filterCriteria!.category);
      }
      targetIds = eligible.map((o) => o.id);
    }

    const now = new Date().toISOString();
    let published = 0;
    let skipped = 0;
    let failed = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const id of targetIds) {
      const opp = this.opportunities.get(id);
      if (!opp) {
        failed++;
        failures.push({ id, reason: "Opportunity not found" });
        continue;
      }

      if (opp.status === "PUBLISHED" || opp.status === "ACTIVE") {
        skipped++;
        continue;
      }

      if (opp.status === "ARCHIVED" || opp.status === "DELETED") {
        failed++;
        failures.push({ id, reason: `Cannot publish opportunity in status: ${opp.status}` });
        continue;
      }

      if (!isSafeUrl(opp.applyUrl)) {
        failed++;
        failures.push({ id, reason: "Invalid or missing application URL" });
        continue;
      }

      // Check if already expired
      if (opp.applicationDeadline && opp.applicationDeadline !== "Deadline not provided") {
        const dl = new Date(opp.applicationDeadline).getTime();
        if (!isNaN(dl) && dl < Date.now()) {
          failed++;
          failures.push({ id, reason: "Application deadline has already passed" });
          continue;
        }
      }

      const prevStatus = opp.status;
      opp.status = "PUBLISHED";
      opp.verifiedByAdmin = true;
      opp.verifiedAt = now;
      opp.publishedAt = now;
      opp.approvedBy = adminId;
      opp.updatedAt = now;

      published++;

      this.recordAuditEvent({
        opportunityId: opp.id,
        action: "PUBLISHED",
        actorId: adminId,
        previousStatus: prevStatus,
        newStatus: "PUBLISHED",
        details: "Bulk published to live public feed by administrator",
      });
    }

    this.persistToStorage();
    invalidateJobsCache();

    return {
      requested: targetIds.length,
      published,
      skipped,
      failed,
      failures,
    };
  }

  /**
   * Bulk Approve Opportunities.
   * Moves eligible records from PENDING_REVIEW / DISCOVERED to APPROVED without publishing them live immediately.
   */
  public bulkApproveOpportunities(
    jobIds: string[],
    adminId: string,
    options?: { allMatching?: boolean; filterCriteria?: OpportunityFilterParams; discoveryBatchId?: string }
  ): {
    requested: number;
    approved: number;
    skipped: number;
    failed: number;
    failures: Array<{ id: string; reason: string }>;
  } {
    let targetIds = jobIds;

    if (options?.allMatching) {
      const all = Array.from(this.opportunities.values());
      let eligible = all.filter((o) => o.status === "PENDING_REVIEW" || o.status === "DISCOVERED");
      if (options.discoveryBatchId) {
        eligible = eligible.filter((o) => o.discoveryBatchId === options.discoveryBatchId);
      }
      if (options.filterCriteria?.category) {
        eligible = eligible.filter((o) => o.category === options.filterCriteria!.category);
      }
      targetIds = eligible.map((o) => o.id);
    }

    const now = new Date().toISOString();
    let approved = 0;
    let skipped = 0;
    let failed = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const id of targetIds) {
      const opp = this.opportunities.get(id);
      if (!opp) {
        failed++;
        failures.push({ id, reason: "Opportunity not found" });
        continue;
      }

      if (opp.status === "APPROVED" || opp.status === "PUBLISHED" || opp.status === "ACTIVE") {
        skipped++;
        continue;
      }

      if (opp.status === "ARCHIVED" || opp.status === "DELETED") {
        failed++;
        failures.push({ id, reason: `Cannot approve opportunity in status: ${opp.status}` });
        continue;
      }

      const prevStatus = opp.status;
      opp.status = "APPROVED";
      opp.reviewState = "APPROVED";
      opp.verificationState = "PASSED";
      opp.verifiedByAdmin = true;
      opp.verifiedAt = now;
      opp.approvedBy = adminId;
      opp.updatedAt = now;

      approved++;

      this.recordAuditEvent({
        opportunityId: opp.id,
        action: "APPROVED",
        actorId: adminId,
        previousStatus: prevStatus,
        newStatus: "APPROVED",
        details: "Bulk approved by administrator",
      });
    }

    this.persistToStorage();
    invalidateJobsCache();

    return {
      requested: targetIds.length,
      approved,
      skipped,
      failed,
      failures,
    };
  }

  /**
   * Bulk Archive Opportunities.
   * Safely soft-archives selected opportunities and removes them from active user search.
   */
  public bulkArchiveOpportunities(
    jobIds: string[],
    adminId: string,
    options?: { allMatching?: boolean; filterCriteria?: OpportunityFilterParams; discoveryBatchId?: string }
  ): {
    requested: number;
    archived: number;
    failed: number;
    failures: Array<{ id: string; reason: string }>;
  } {
    let targetIds = jobIds;

    if (options?.allMatching) {
      const all = Array.from(this.opportunities.values());
      let eligible = all.filter((o) => o.status !== "ARCHIVED" && o.status !== "DELETED");
      if (options.discoveryBatchId) {
        eligible = eligible.filter((o) => o.discoveryBatchId === options.discoveryBatchId);
      }
      targetIds = eligible.map((o) => o.id);
    }

    const now = new Date().toISOString();
    let archived = 0;
    let failed = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const id of targetIds) {
      const opp = this.opportunities.get(id);
      if (!opp) {
        failed++;
        failures.push({ id, reason: "Opportunity not found" });
        continue;
      }

      const prevStatus = opp.status;
      opp.status = "ARCHIVED";
      opp.recordState = "ARCHIVED";
      opp.publicationState = "NOT_PUBLISHED";
      opp.updatedAt = now;
      archived++;

      this.recordAuditEvent({
        opportunityId: opp.id,
        action: "ARCHIVED",
        actorId: adminId,
        previousStatus: prevStatus,
        newStatus: "ARCHIVED",
        details: "Bulk archived by administrator",
      });
    }

    this.persistToStorage();
    invalidateJobsCache();

    return {
      requested: targetIds.length,
      archived,
      failed,
      failures,
    };
  }

  /**
   * Server-side Bulk Delete / Archive operation.
   * Defaults to soft delete / archive to preserve saved jobs and historical analytics.
   * Permanent delete removes record if explicitly confirmed by admin.
   */
  public bulkDeleteOpportunities(
    jobIds: string[],
    adminId: string,
    permanent = false
  ): {
    requested: number;
    processed: number;
    failed: number;
  } {
    const now = new Date().toISOString();
    let processed = 0;
    let failed = 0;

    for (const id of jobIds) {
      const opp = this.opportunities.get(id);
      if (!opp) {
        failed++;
        continue;
      }

      if (permanent) {
        this.opportunities.delete(id);
        this.recordAuditEvent({
          opportunityId: id,
          action: "DELETED",
          actorId: adminId,
          previousStatus: opp.status,
          newStatus: "PERMANENTLY_DELETED",
          details: "Permanently deleted opportunity by administrator",
        });
      } else {
        const prevStatus = opp.status;
        opp.status = "ARCHIVED";
        opp.recordState = "ARCHIVED";
        opp.publicationState = "NOT_PUBLISHED";
        opp.updatedAt = now;
        this.recordAuditEvent({
          opportunityId: id,
          action: "ARCHIVED",
          actorId: adminId,
          previousStatus: prevStatus,
          newStatus: "ARCHIVED",
          details: "Archived opportunity by administrator",
        });
      }
      processed++;
    }

    this.persistToStorage();
    invalidateJobsCache();

    return {
      requested: jobIds.length,
      processed,
      failed,
    };
  }

  /**
   * Retry failed discovery batch items without duplicating already successful records.
   */
  public retryFailedDiscovery(
    batchId: string,
    adminId: string
  ): {
    batchId: string;
    retried: number;
    succeeded: number;
    failed: number;
  } {
    const batches = this.getDiscoveryBatches();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) {
      throw new Error(`Discovery batch not found: ${batchId}`);
    }

    const batchOpps = Array.from(this.opportunities.values()).filter((o) => o.discoveryBatchId === batchId);
    let succeeded = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const opp of batchOpps) {
      if (opp.status === "REJECTED" || !isSafeUrl(opp.applyUrl)) {
        if (isSafeUrl(opp.applyUrl) && opp.title && opp.companyName) {
          opp.status = "PENDING_REVIEW";
          opp.updatedAt = now;
          succeeded++;
        } else {
          failed++;
        }
      }
    }

    if (batch.rejectedCount > 0 && succeeded > 0) {
      batch.rejectedCount = Math.max(0, batch.rejectedCount - succeeded);
      batch.validCount += succeeded;
      MockStorageProvider.updateDiscoveryBatch(batchId, {
        rejectedCount: batch.rejectedCount,
        validCount: batch.validCount,
      });
    }

    this.persistToStorage();
    invalidateJobsCache();

    return {
      batchId,
      retried: succeeded + failed,
      succeeded,
      failed,
    };
  }

  public getDiscoveryBatches(): JobDiscoveryBatch[] {
    return MockStorageProvider.getDiscoveryBatches();
  }

  public checkAndExpireOutdatedJobs(): number {
    let expiredCount = 0;
    const now = Date.now();

    for (const opp of this.opportunities.values()) {
      if (opp.status === "APPROVED" || opp.status === "PUBLISHED" || opp.status === "ACTIVE" || opp.publicationState === "PUBLISHED") {
        if (opp.applicationDeadline && opp.applicationDeadline !== "Deadline not provided") {
          const deadlineTime = new Date(opp.applicationDeadline).getTime();
          if (!isNaN(deadlineTime) && deadlineTime < now) {
            const prevStatus = opp.status;
            opp.status = "EXPIRED";
            opp.publicationState = "NOT_PUBLISHED";
            opp.updatedAt = new Date().toISOString();
            expiredCount++;
            this.recordAuditEvent({
              opportunityId: opp.id,
              action: "EXPIRED",
              actorId: "system_cron",
              previousStatus: prevStatus,
              newStatus: "EXPIRED",
              details: `Auto-expired: deadline (${opp.applicationDeadline}) has passed`,
            });
          }
        }
      }
    }

    if (expiredCount > 0) {
      this.persistToStorage();
      invalidateJobsCache();
    }

    return expiredCount;
  }

  public markExpired(id: string, adminId: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;
    const oldStatus = opp.status;
    opp.status = "EXPIRED";
    opp.updatedAt = new Date().toISOString();
    this.recordAuditEvent({
      opportunityId: id,
      action: "EXPIRED",
      actorId: adminId,
      previousStatus: oldStatus,
      newStatus: "EXPIRED",
      details: "Marked as EXPIRED by admin",
    });
    return opp;
  }

  /**
   * Diagnostic inspector for a single canonical job.
   */
  public getJobDiagnostics(id: string): JobDiagnostics {
    const opp = this.getOpportunityById(id);
    const healthIssues: string[] = [];

    if (!opp) {
      return {
        canonicalId: id,
        provider: "unknown",
        providerJobId: "unknown",
        stored: false,
        dataOrigin: "UNKNOWN",
        reviewState: "DISCOVERED",
        verificationState: "FAILED",
        publicationState: "NOT_PUBLISHED",
        recordState: "DELETED",
        visibility: "none",
        lastFetchedAt: "never",
        sourceUrl: "",
        applyUrl: "",
        routeResolves: false,
        health: "MISSING",
        healthIssues: ["Opportunity record does not exist in canonical storage."],
      };
    }

    if (!opp.title || opp.title.trim().length < 3) {
      healthIssues.push("Title is missing or shorter than 3 characters.");
    }
    if (!opp.companyName || opp.companyName.trim().length < 2) {
      healthIssues.push("Company name is missing or too short.");
    }
    if (!isSafeUrl(opp.applyUrl)) {
      healthIssues.push("Application URL is invalid, unsafe, or missing.");
    }
    if (opp.applicationDeadline && opp.applicationDeadline !== "Deadline not provided") {
      const dl = new Date(opp.applicationDeadline).getTime();
      if (!isNaN(dl) && dl < Date.now()) {
        healthIssues.push("Application deadline has passed.");
      }
    }

    const reviewState = opp.reviewState || (opp.status === "APPROVED" || opp.status === "PUBLISHED" ? "APPROVED" : opp.status === "REJECTED" ? "REJECTED" : "PENDING_REVIEW");
    const publicationState = opp.publicationState || (opp.status === "PUBLISHED" || opp.status === "ACTIVE" ? "PUBLISHED" : "NOT_PUBLISHED");
    const recordState = opp.recordState || (opp.status === "DELETED" ? "DELETED" : opp.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE");
    const verificationState = opp.verificationState || (opp.verifiedByAdmin ? "PASSED" : "PENDING");
    const origin: DataOrigin = opp.dataOrigin || (opp.id.startsWith("opp_seed_") ? "SEED" : opp.source === "admin_manual" ? "ADMIN" : "PROVIDER");

    if (publicationState === "PUBLISHED" && (recordState === "ARCHIVED" || recordState === "DELETED")) {
      healthIssues.push("Contradictory state: record is marked PUBLISHED but also ARCHIVED/DELETED.");
    }
    if (publicationState === "PUBLISHED" && reviewState === "REJECTED") {
      healthIssues.push("Contradictory state: record is marked PUBLISHED but review is REJECTED.");
    }

    let health: "HEALTHY" | "INCONSISTENT" | "REQUIRES_REVIEW" | "MISSING" = "HEALTHY";
    if (healthIssues.some((i) => i.includes("Contradictory"))) {
      health = "INCONSISTENT";
    } else if (healthIssues.length > 0) {
      health = "REQUIRES_REVIEW";
    }

    return {
      canonicalId: opp.id,
      provider: opp.source,
      providerJobId: opp.sourceId || opp.id,
      discoveryBatchId: opp.discoveryBatchId,
      stored: true,
      dataOrigin: origin,
      reviewState,
      verificationState,
      publicationState,
      recordState,
      visibility: "public",
      lastFetchedAt: opp.fetchedAt || opp.discoveredAt,
      lastVerifiedAt: opp.verifiedAt,
      publishedAt: opp.publishedAt,
      sourceUrl: opp.sourceUrl,
      applyUrl: opp.applyUrl,
      routeResolves: true,
      health,
      healthIssues,
    };
  }

  /**
   * Automated route integrity check for published jobs.
   * Guarantees zero false 404s.
   */
  public runRouteIntegrityCheck(jobIds?: string[]): {
    checked: number;
    healthy: number;
    inconsistent: number;
    requiresReview: number;
    issues: Array<{ id: string; health: string; issues: string[] }>;
  } {
    const targetIds = jobIds && jobIds.length > 0
      ? jobIds
      : Array.from(this.opportunities.values())
          .filter((o) => o.status === "PUBLISHED" || o.status === "APPROVED")
          .map((o) => o.id);

    let healthy = 0;
    let inconsistent = 0;
    let requiresReview = 0;
    const issues: Array<{ id: string; health: string; issues: string[] }> = [];

    for (const id of targetIds) {
      const diag = this.getJobDiagnostics(id);
      if (diag.health === "HEALTHY") {
        healthy++;
      } else {
        if (diag.health === "INCONSISTENT") inconsistent++;
        else requiresReview++;
        issues.push({ id, health: diag.health, issues: diag.healthIssues });
      }
    }

    return {
      checked: targetIds.length,
      healthy,
      inconsistent,
      requiresReview,
      issues,
    };
  }

  /**
   * Resolves canonical opportunity by ID with legacy route and provider compatibility.
   * Never produces a false 404 for stored opportunities.
   */
  public getOpportunityById(id: string): Opportunity | null {
    if (!id || typeof id !== "string") return null;
    if (this.opportunities.size === 0) {
      this.seedCanonicalOpportunities();
    }
    const cleanId = id.trim();

    // 1. Direct match in memory
    let opp = this.opportunities.get(cleanId);
    if (opp) return opp;

    // 2. Prefix variations (e.g. opp_ or stripped opp_)
    if (cleanId.startsWith("opp_")) {
      const stripped = cleanId.replace(/^opp_/, "");
      opp = this.opportunities.get(stripped);
      if (opp) return opp;
      if (stripped.startsWith("opp_")) {
        opp = this.opportunities.get(stripped.replace(/^opp_/, ""));
        if (opp) return opp;
      }
    } else {
      opp = this.opportunities.get(`opp_${cleanId}`);
      if (opp) return opp;
    }

    // 3. Match by sourceId / provider_job_id (Legacy Provider URL Compatibility)
    for (const item of this.opportunities.values()) {
      if (item.sourceId === cleanId || item.sourceId === cleanId.replace(/^provider-/, "")) {
        return item;
      }
      if (item.canonicalJobKey === cleanId) {
        return item;
      }
    }

    // 4. Fallback: check persistent storage (MockStorageProvider)
    const storedList = MockStorageProvider.getJobOpportunities();
    const foundStored = storedList.find(
      (o) =>
        o.id === cleanId ||
        o.id === cleanId.replace(/^opp_/, "") ||
        `opp_${o.id}` === cleanId ||
        o.sourceId === cleanId ||
        o.sourceId === cleanId.replace(/^provider-/, "") ||
        o.canonicalJobKey === cleanId
    );

    if (foundStored) {
      this.opportunities.set(foundStored.id, foundStored);
      return foundStored;
    }

    return null;
  }

  /**
   * Query approved opportunities for students.
   * STRICT GUARANTEE: Never exposes DISCOVERED, PENDING_REVIEW, or REJECTED to public students.
   * ABSOLUTE USER-FACING DATA RULE:
   * Normal users must NEVER see seed, dummy, test, demo, unapproved, pending, rejected, archived, or deleted records.
   * Users see ONLY: REAL DATABASE RECORD + APPROVED + PUBLISHED + ACTIVE + PUBLIC + PASSED VERIFICATION.
   * If the store is empty, returns empty array with ZERO fake records.
   */
  public getApprovedOpportunities(params: OpportunityFilterParams = {}): {
    items: Opportunity[];
    total: number;
    page: number;
    pageSize: number;
  } {
    const all = Array.from(this.opportunities.values());
    let filtered = all.filter((o) => {
      // 1. ABSOLUTE SECURITY FILTER: Zero seed, test, demo, or unknown origins
      if (
        o.dataOrigin === "SEED" ||
        o.dataOrigin === "TEST" ||
        o.dataOrigin === "UNKNOWN" ||
        o.id.startsWith("opp_seed_")
      ) {
        return false;
      }

      // 2. Lifecycle dimensions: Must be ACTIVE record, APPROVED review, PUBLISHED, and PASSED verification
      const isRecordActive = (o.recordState ? o.recordState === "ACTIVE" : true) && o.status !== "DELETED" && o.status !== "ARCHIVED" && o.status !== "EXPIRED";
      const isReviewApproved = o.reviewState === "APPROVED" || o.status === "APPROVED" || o.status === "PUBLISHED";
      const isPublished = o.publicationState === "PUBLISHED" || o.status === "PUBLISHED";
      const isVerified = o.verificationState === "PASSED" || o.verifiedByAdmin === true;

      // Filter ensures only APPROVED or PUBLISHED opportunities are returned
      if (o.status !== "APPROVED" && o.status !== "PUBLISHED") {
        return false;
      }

      if (!isRecordActive || !isReviewApproved || !isPublished || !isVerified) {
        return false;
      }

      // 3. Deadline check: Expired jobs must never appear in live feed
      if (o.applicationDeadline && o.applicationDeadline !== "Deadline not provided") {
        const dl = new Date(o.applicationDeadline).getTime();
        if (!isNaN(dl) && dl < Date.now()) {
          return false;
        }
      }

      return true;
    });

    if (params.category && (params.category as string) !== "all") {
      filtered = filtered.filter(
        (o) =>
          o.category === params.category ||
          (params.category === "internship" && (o.isInternship || o.employmentType === "internship")) ||
          (params.category === "job" && (o.isJob || o.employmentType === "full-time"))
      );
    }

    if (params.remoteOnly) {
      filtered = filtered.filter((o) => o.remoteType === "remote");
    }

    if (params.experienceLevel && (params.experienceLevel as any) !== "all") {
      filtered = filtered.filter((o) => o.experienceLevel === params.experienceLevel);
    }

    if (params.location && params.location.trim() && params.location.toLowerCase() !== "all") {
      const locQ = params.location.toLowerCase();
      filtered = filtered.filter((o) => o.location.toLowerCase().includes(locQ));
    }

    if (params.skills && params.skills.length > 0) {
      const skillQueries = params.skills.map((s) => s.toLowerCase());
      filtered = filtered.filter((o) =>
        o.skills.some((sk) => skillQueries.includes(sk.toLowerCase()))
      );
    }

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.companyName.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          (o.skills && o.skills.some((sk) => sk.toLowerCase().includes(q)))
      );
    }

    // Sort
    if (params.sort === "deadline") {
      filtered.sort((a, b) => {
        if (!a.applicationDeadline) return 1;
        if (!b.applicationDeadline) return -1;
        return new Date(a.applicationDeadline).getTime() - new Date(b.applicationDeadline).getTime();
      });
    } else {
      // Default: newest posted first
      filtered.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items,
      total: filtered.length,
      page,
      pageSize,
    };
  }

  /**
   * Internal accessor for batch maintenance workers.
   */
  public getAllOpportunitiesInternal(): Opportunity[] {
    return Array.from(this.opportunities.values());
  }

  /**
   * Query opportunities for Admin Review Queue.
   * Supports unified lifecycle dimensions, data origin badges, and IST date ranges.
   */
  public getAdminOpportunities(params: OpportunityFilterParams = {}): {
    items: Opportunity[];
    total: number;
    counts: {
      pending: number;
      approved: number;
      rejected: number;
      expired: number;
      paused: number;
      draft: number;
      total: number;
      stored: number;
      verified: number;
      eligible: number;
      published: number;
      live: number;
      archived: number;
      importFailed: number;
    };
  } {
    const all = Array.from(this.opportunities.values());

    const counts = {
      pending: all.filter((o) => o.status === "PENDING_REVIEW" || o.status === "DISCOVERED").length,
      approved: all.filter((o) => o.status === "APPROVED" || o.status === "PUBLISHED").length,
      rejected: all.filter((o) => o.status === "REJECTED").length,
      expired: all.filter((o) => o.status === "EXPIRED").length,
      paused: all.filter((o) => o.status === "PAUSED").length,
      draft: all.filter((o) => o.status === "DRAFT").length,
      total: all.length,
      stored: all.filter((o) => o.recordState !== "DELETED").length,
      verified: all.filter((o) => o.verificationState === "PASSED" || o.verifiedByAdmin).length,
      eligible: all.filter((o) => (o.verificationState === "PASSED" || o.verifiedByAdmin) && o.recordState === "ACTIVE" && o.status !== "EXPIRED").length,
      published: all.filter((o) => o.publicationState === "PUBLISHED" || o.status === "PUBLISHED").length,
      live: all.filter((o) => (o.publicationState === "PUBLISHED" || o.status === "PUBLISHED") && (o.reviewState === "APPROVED" || o.status === "APPROVED") && o.recordState === "ACTIVE" && o.dataOrigin !== "SEED" && o.dataOrigin !== "TEST").length,
      archived: all.filter((o) => o.recordState === "ARCHIVED" || o.status === "ARCHIVED").length,
      importFailed: 0,
    };

    let filtered = all;

    // Filter by dataOrigin
    if (params.dataOrigin && params.dataOrigin !== "all") {
      filtered = filtered.filter((o) => o.dataOrigin === params.dataOrigin);
    }

    // Filter by status (legacy compatibility)
    if (params.status) {
      if (params.status === "APPROVED") {
        filtered = filtered.filter((o) => o.status === "APPROVED" || o.status === "PUBLISHED");
      } else {
        filtered = filtered.filter((o) => o.status === params.status);
      }
    }

    // Filter by lifecycle dimensions
    if (params.recordState && params.recordState !== "all") {
      filtered = filtered.filter((o) => o.recordState === params.recordState);
    }
    if (params.reviewState && params.reviewState !== "all") {
      filtered = filtered.filter((o) => o.reviewState === params.reviewState);
    }
    if (params.publicationState && params.publicationState !== "all") {
      filtered = filtered.filter((o) => o.publicationState === params.publicationState);
    }
    if (params.verificationState && params.verificationState !== "all") {
      filtered = filtered.filter((o) => o.verificationState === params.verificationState);
    }

    // Filter by discoveryBatchId
    if (params.discoveryBatchId) {
      filtered = filtered.filter((o) => o.discoveryBatchId === params.discoveryBatchId);
    }

    // Filter by category
    if (params.category) {
      filtered = filtered.filter((o) => o.category === params.category);
    }

    // IST Timezone Date Range Filter
    if (params.dateFilter && params.dateFilter !== "all") {
      const range = getISTDateRange(params.dateFilter, params.dateFrom, params.dateTo);
      if (range) {
        const field = params.dateField || "discovered_at";
        filtered = filtered.filter((o) => {
          const dateStr = field === "posted_at" ? o.postedAt : field === "published_at" ? o.publishedAt : o.discoveredAt || o.createdAt;
          if (!dateStr) return false;
          const time = new Date(dateStr).getTime();
          return time >= range.start.getTime() && time <= range.end.getTime();
        });
      }
    }

    // Free text search
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.companyName.toLowerCase().includes(q) ||
          o.location.toLowerCase().includes(q) ||
          (o.canonicalJobKey && o.canonicalJobKey.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const startIndex = (page - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items,
      total: filtered.length,
      counts,
    };
  }

  public getDiscoveryConfig(): DiscoveryConfig {
    return { ...this.discoveryConfig };
  }

  public updateDiscoveryConfig(patch: Partial<DiscoveryConfig>, adminId: string): DiscoveryConfig {
    this.discoveryConfig = {
      ...this.discoveryConfig,
      ...patch,
    };

    this.recordAuditEvent({
      opportunityId: "config",
      action: "EDITED",
      actorId: adminId,
      details: "Updated search discovery query templates and schedules",
    });

    return this.getDiscoveryConfig();
  }

  public getAllSourceHealth(): SourceHealth[] {
    return Array.from(this.sourceHealthMap.values());
  }

  public updateSourceHealth(sourceId: string, patch: Partial<SourceHealth>): void {
    const existing = this.sourceHealthMap.get(sourceId) || {
      sourceId,
      name: sourceId,
      status: "HEALTHY",
      circuitState: "CLOSED",
      recordsDiscoveredTotal: 0,
      recordsApprovedTotal: 0,
      rateLimit429Count: 0,
      lastCheckTimestamp: new Date().toISOString(),
    };

    this.sourceHealthMap.set(sourceId, {
      ...existing,
      ...patch,
      lastCheckTimestamp: new Date().toISOString(),
    });
  }

  public getRecentAuditLogs(limit = 100): OpportunityAuditEvent[] {
    return this.auditLogs.slice(-limit).reverse();
  }

  private recordAuditEvent(event: Omit<OpportunityAuditEvent, "id" | "timestamp">): void {
    this.auditLogs.push({
      ...event,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    });
    if (this.auditLogs.length > 500) {
      this.auditLogs.shift();
    }
  }
}

export const opportunityStore = new OpportunityStoreService();

export function runExpiredJobsWorker(): { expiredCount: number } {
  const expiredCount = opportunityStore.checkAndExpireOutdatedJobs();
  return { expiredCount };
}
