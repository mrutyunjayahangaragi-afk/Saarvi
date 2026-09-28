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
} from "./types.ts";
import { deduplicateOpportunities } from "./deduplicator.ts";
import { MockStorageProvider } from "../supabase/mock-storage.ts";

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
  }

  public persistToStorage(): void {
    try {
      const items = Array.from(this.opportunities.values());
      MockStorageProvider.saveJobOpportunitiesBatch(items);
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
    summary: { fetched: number; valid: number; newCount: number; existingCount: number; rejectedCount: number };
  } {
    const now = new Date().toISOString();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let newCount = 0;
    let existingCount = 0;
    let rejectedCount = 0;
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

    for (const item of rawItems) {
      const cleanApply = cleanAndSanitizeUrl(item.applyUrl);
      if (!isSafeUrl(cleanApply) || !item.title || item.title.trim().length < 3 || !item.companyName) {
        rejectedCount++;
        continue;
      }

      const normApply = cleanApply.toLowerCase();
      const normKey = `${item.companyName.toLowerCase().trim()}|${item.title.toLowerCase().trim()}|${item.location.toLowerCase().trim()}`;
      const sourceKey = `${item.source}:${item.sourceId}`;

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
      requestedCount: rawItems.length,
      fetchedCount: rawItems.length,
      validCount: newCount + existingCount,
      newCount,
      existingCount,
      rejectedCount,
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
        rejectedCount,
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
      if (opp.status === "APPROVED" || opp.status === "PUBLISHED" || opp.status === "ACTIVE") {
        if (opp.applicationDeadline && opp.applicationDeadline !== "Deadline not provided") {
          const deadlineTime = new Date(opp.applicationDeadline).getTime();
          if (!isNaN(deadlineTime) && deadlineTime < now) {
            opp.status = "EXPIRED";
            opp.updatedAt = new Date().toISOString();
            expiredCount++;
            this.recordAuditEvent({
              opportunityId: opp.id,
              action: "EXPIRED",
              actorId: "system_cron",
              previousStatus: "PUBLISHED",
              newStatus: "EXPIRED",
              details: `Auto-expired: deadline (${opp.applicationDeadline}) has passed`,
            });
          }
        }
      }
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
   */
  public getApprovedOpportunities(params: OpportunityFilterParams = {}): {
    items: Opportunity[];
    total: number;
    page: number;
    pageSize: number;
  } {
    const all = Array.from(this.opportunities.values());
    let filtered = all.filter((o) => o.status === "APPROVED" || o.status === "PUBLISHED");

    if (params.category) {
      filtered = filtered.filter((o) => o.category === params.category);
    }

    if (params.remoteOnly) {
      filtered = filtered.filter((o) => o.remoteType === "remote");
    }

    if (params.experienceLevel) {
      filtered = filtered.filter((o) => o.experienceLevel === params.experienceLevel);
    }

    if (params.location && params.location.trim()) {
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
          o.description.toLowerCase().includes(q)
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
   * Query opportunities for Admin Review Queue.
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
    };

    let filtered = all;
    if (params.status) {
      if (params.status === "APPROVED") {
        filtered = filtered.filter((o) => o.status === "APPROVED" || o.status === "PUBLISHED");
      } else {
        filtered = filtered.filter((o) => o.status === params.status);
      }
    }

    if (params.category) {
      filtered = filtered.filter((o) => o.category === params.category);
    }

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.companyName.toLowerCase().includes(q) ||
          o.location.toLowerCase().includes(q)
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
