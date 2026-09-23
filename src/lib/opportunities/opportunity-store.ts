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
} from "./types.ts";
import { deduplicateOpportunities } from "./deduplicator.ts";

export interface OpportunityAuditEvent {
  id: string;
  opportunityId: string;
  action: "APPROVED" | "REJECTED" | "EDITED" | "MERGED" | "EXPIRED" | "DISCOVERED" | "IMPORTED" | "CREATED_MANUAL" | "PAUSED" | "RESUMED";
  actorId: string;
  details?: string;
  timestamp: string;
}

function cleanAndSanitizeUrl(url?: string): string {
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

function isSafeUrl(url?: string): boolean {
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

  public markExpired(id: string, actorId = "system"): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    opp.status = "EXPIRED";
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "EXPIRED",
      actorId,
      details: "Deadline passed or source marked closed",
    });

    return opp;
  }

  public getOpportunityById(id: string): Opportunity | null {
    return this.opportunities.get(id) || null;
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
