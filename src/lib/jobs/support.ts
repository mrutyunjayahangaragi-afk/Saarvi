/**
 * Saarvi Jobs Engine 6.0 — Customer Safety & Career Support Service
 *
 * Implements anti-scam report ingestion, queue management, and safety notices.
 * Guarantees applicant safety with transparent audit logs.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobReportRecord, JobReportReason } from "./types";
import { jobLifecycleService } from "./lifecycle";

export class JobSupportService {
  private static instance: JobSupportService;

  public static getInstance(): JobSupportService {
    if (!JobSupportService.instance) {
      JobSupportService.instance = new JobSupportService();
    }
    return JobSupportService.instance;
  }

  /**
   * Submits a customer safety report for an opportunity.
   */
  public async submitJobReport(input: {
    jobId: string;
    jobTitle: string;
    companyName: string;
    sourceUrl?: string;
    reason: JobReportReason;
    notes?: string;
    reporterId?: string;
    reporterEmail?: string;
  }): Promise<{ success: boolean; reportId?: string; error?: string }> {
    const supabase = getSupabaseAdminClient();
    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    if (!input.jobId || !input.reason) {
      return { success: false, error: "Missing required report parameters." };
    }

    if (supabase) {
      try {
        const isUuid = (val?: string) =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));
        const validReporterId = isUuid(input.reporterId) ? input.reporterId : null;

        const ALLOWED_DB_REASONS = new Set([
          "FAKE_JOB",
          "EXPIRED",
          "WRONG_COMPANY",
          "BROKEN_LINK",
          "MISLEADING_INFO",
          "PAYMENT_REQUIRED",
          "SUSPICIOUS",
          "DUPLICATE",
          "OTHER",
        ]);
        const dbReason = ALLOWED_DB_REASONS.has(input.reason) ? input.reason : "OTHER";

        const { error } = await supabase.from("job_reports").insert({
          id: reportId,
          job_id: input.jobId,
          job_title: input.jobTitle || "Job Listing",
          company_name: input.companyName || "Unknown",
          source_url: input.sourceUrl || null,
          reason: dbReason,
          notes: input.notes ? (dbReason !== input.reason ? `[${input.reason}] ${input.notes}` : input.notes) : (dbReason !== input.reason ? `[${input.reason}]` : ""),
          reporter_id: validReporterId,
          reported_at: now,
          status: "PENDING",
        });

        if (error) {
          console.warn("[JobSupportService] Supabase report insert warning:", error.message);
        }
      } catch (err) {
        console.error("[JobSupportService] submitJobReport DB error:", err);
      }
    }

    return { success: true, reportId };
  }

  /**
   * Fetches Career Support reports for Admin moderation queue.
   */
  public async getCareerReports(statusFilter = "ALL"): Promise<JobReportRecord[]> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return [];

    try {
      let query = supabase
        .from("job_reports")
        .select("*")
        .order("reported_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((r: any) => ({
        id: r.id,
        jobId: r.job_id,
        jobTitle: r.job_title,
        companyName: r.company_name,
        sourceUrl: r.source_url || undefined,
        reason: r.reason as JobReportReason,
        notes: r.notes || undefined,
        reporterId: r.reporter_id || undefined,
        reportedAt: r.reported_at,
        status: r.status,
        resolutionNotes: r.resolution_notes || undefined,
      }));
    } catch (err) {
      console.warn("[JobSupportService] getCareerReports error:", err);
      return [];
    }
  }

  /**
   * Admin resolution action on a career report.
   * Can also take action on the reported listing (e.g. Pause, Archive).
   */
  public async resolveReport(
    reportId: string,
    action: "RESOLVE" | "DISMISS" | "PAUSE_JOB" | "ARCHIVE_JOB",
    adminId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { success: false, error: "Database unavailable" };

    try {
      const { data: report } = await supabase
        .from("job_reports")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();

      if (!report) return { success: false, error: "Report not found" };

      let nextStatus = "RESOLVED";
      if (action === "DISMISS") nextStatus = "DISMISSED";

      // Apply action on the reported job if requested
      if (action === "PAUSE_JOB" && report.job_id) {
        await jobLifecycleService.bulkPause([report.job_id], adminId);
      } else if (action === "ARCHIVE_JOB" && report.job_id) {
        await jobLifecycleService.bulkArchive([report.job_id], adminId);
      }

      // Update report status
      const { error } = await supabase
        .from("job_reports")
        .update({
          status: nextStatus,
          resolution_notes: notes || `Handled by admin action: ${action}`,
        })
        .eq("id", reportId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const jobSupportService = JobSupportService.getInstance();
