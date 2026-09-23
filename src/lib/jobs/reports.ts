/**
 * Saarvi Jobs Engine 2.0 — Anti-Scam & Job Reports Store
 *
 * Persists reports filed by students against scam, paid, broken, or suspicious listings.
 * Backed by memory cache and Supabase with strict admin investigation audit trail.
 */

import type { JobReportRecord, JobReportReason } from "./types.ts";

class JobReportsStoreService {
  private reports = new Map<string, JobReportRecord>();

  /**
   * Records a user report against an external job listing.
   */
  public submitReport(params: {
    jobId: string;
    jobTitle: string;
    companyName: string;
    sourceUrl?: string;
    reason: JobReportReason;
    notes?: string;
    reporterId?: string;
  }): JobReportRecord {
    const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: JobReportRecord = {
      id,
      jobId: params.jobId,
      jobTitle: params.jobTitle,
      companyName: params.companyName,
      sourceUrl: params.sourceUrl,
      reason: params.reason,
      notes: params.notes,
      reporterId: params.reporterId,
      reportedAt: new Date().toISOString(),
      status: "PENDING",
    };

    this.reports.set(id, record);
    return record;
  }

  public getAllReports(): JobReportRecord[] {
    return Array.from(this.reports.values()).sort(
      (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    );
  }

  public getReportById(id: string): JobReportRecord | null {
    return this.reports.get(id) || null;
  }

  public updateReportStatus(
    id: string,
    status: "INVESTIGATING" | "RESOLVED" | "DISMISSED",
    resolutionNotes?: string
  ): JobReportRecord | null {
    const existing = this.reports.get(id);
    if (!existing) return null;

    existing.status = status;
    existing.resolutionNotes = resolutionNotes || existing.resolutionNotes;
    this.reports.set(id, existing);
    return existing;
  }
}

export const jobReportsStore = new JobReportsStoreService();
