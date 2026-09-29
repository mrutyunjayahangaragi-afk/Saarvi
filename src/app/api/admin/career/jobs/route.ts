import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { jobReportsStore } from "@/lib/jobs/reports";
import { jobAlertsStore } from "@/lib/jobs/alerts";
import { jobSupportService } from "@/lib/jobs/support";
import { jobRepository } from "@/lib/jobs/repository";
import type { Opportunity } from "@/lib/opportunities/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const oppsResult = opportunityStore.getAdminOpportunities({ pageSize: 1000 });
    const opps: Opportunity[] = oppsResult.items || [];
    
    // Fetch reports from Supabase DB first, then fallback
    let reports = await jobSupportService.getCareerReports("ALL");
    if (reports.length === 0) {
      reports = jobReportsStore.getAllReports();
    }
    const alerts = jobAlertsStore.getAllAlerts();

    // Fetch authoritative database lifecycle counts
    const dbCounts = await jobRepository.getAdminLifecycleCounts();

    return NextResponse.json({
      opportunities: opps,
      reports,
      alerts,
      metrics: {
        totalOpportunities: dbCounts.totalCatalog || oppsResult.counts.total,
        approved: dbCounts.saarviVerified || oppsResult.counts.approved,
        pending: dbCounts.pendingReview || oppsResult.counts.pending,
        rejected: oppsResult.counts.rejected,
        expired: dbCounts.expired || oppsResult.counts.expired,
        published: dbCounts.published,
        liveToUsers: dbCounts.liveToUsers,
        sourceDiscoveries: dbCounts.sourceDiscoveries,
        archived: dbCounts.archived,
        reportsCount: reports.length,
        pendingReports: reports.filter((r) => r.status === "PENDING" || r.status === "INVESTIGATING").length,
        totalAlerts: alerts.length,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/admin/career/jobs] Error:", err);
    return NextResponse.json({ error: "Failed to load moderation data." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "MANAGE");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await req.json();
    const { action, id, reportId, resolutionNotes } = body;

    if (reportId) {
      // 1. Resolve in jobSupportService (Supabase DB + optional pause/archive)
      const supportAction = action === "PAUSE_JOB" ? "PAUSE_JOB" : action === "ARCHIVE_JOB" ? "ARCHIVE_JOB" : action === "DISMISS" ? "DISMISS" : "RESOLVE";
      await jobSupportService.resolveReport(reportId, supportAction, authResult.user.id, resolutionNotes);

      // 2. Also update in-memory reports store
      const updatedReport = jobReportsStore.updateReportStatus(
        reportId,
        action === "DISMISS" ? "DISMISSED" : "RESOLVED",
        resolutionNotes
      );
      return NextResponse.json({ success: true, report: updatedReport });
    }

    if (id && action) {
      if (action === "APPROVE") {
        const opp = opportunityStore.approveOpportunity(id, authResult.user.id || "admin");
        return NextResponse.json({ success: true, opportunity: opp });
      }
      if (action === "REJECT") {
        const opp = opportunityStore.rejectOpportunity(id, authResult.user.id || "admin", resolutionNotes);
        return NextResponse.json({ success: true, opportunity: opp });
      }
      if (action === "EXPIRE") {
        const opp = opportunityStore.markExpired(id, authResult.user.id || "admin");
        return NextResponse.json({ success: true, opportunity: opp });
      }
    }

    return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
  } catch (err: any) {
    console.error("[PATCH /api/admin/career/jobs] Error:", err);
    return NextResponse.json({ error: "Failed to update moderation state." }, { status: 500 });
  }
}
