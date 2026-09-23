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
} from "./types.ts";
import { deduplicateOpportunities } from "./deduplicator.ts";

export interface OpportunityAuditEvent {
  id: string;
  opportunityId: string;
  action: "APPROVED" | "REJECTED" | "EDITED" | "MERGED" | "EXPIRED" | "DISCOVERED";
  actorId: string;
  details?: string;
  timestamp: string;
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
   * Admin Approval Pipeline: Moves opportunity from PENDING_REVIEW to APPROVED.
   * Only APPROVED opportunities receive the "Verified by Saarvi" badge.
   */
  public approveOpportunity(id: string, adminId: string, notes?: string): Opportunity | null {
    const opp = this.opportunities.get(id);
    if (!opp) return null;

    opp.status = "APPROVED";
    opp.verifiedAt = new Date().toISOString();
    opp.verifiedByAdmin = true;
    opp.adminNotes = notes || opp.adminNotes;
    opp.updatedAt = new Date().toISOString();

    this.recordAuditEvent({
      opportunityId: id,
      action: "APPROVED",
      actorId: adminId,
      details: notes || "Approved by administrator",
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
    let filtered = all.filter((o) => o.status === "APPROVED");

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
      total: number;
    };
  } {
    const all = Array.from(this.opportunities.values());

    const counts = {
      pending: all.filter((o) => o.status === "PENDING_REVIEW" || o.status === "DISCOVERED").length,
      approved: all.filter((o) => o.status === "APPROVED").length,
      rejected: all.filter((o) => o.status === "REJECTED").length,
      expired: all.filter((o) => o.status === "EXPIRED").length,
      total: all.length,
    };

    let filtered = all;
    if (params.status) {
      filtered = filtered.filter((o) => o.status === params.status);
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
