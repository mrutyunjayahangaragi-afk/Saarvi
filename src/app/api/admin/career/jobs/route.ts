import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { jobReportsStore } from "@/lib/jobs/reports";
import { jobAlertsStore } from "@/lib/jobs/alerts";
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
    const reports = jobReportsStore.getAllReports();
    const alerts = jobAlertsStore.getAllAlerts();

    return NextResponse.json({
      opportunities: opps,
      reports,
      alerts,
      metrics: {
        totalOpportunities: oppsResult.counts.total,
        approved: oppsResult.counts.approved,
        pending: oppsResult.counts.pending,
        rejected: oppsResult.counts.rejected,
        expired: oppsResult.counts.expired,
        reportsCount: reports.length,
        pendingReports: reports.filter((r) => r.status === "PENDING").length,
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
      const updatedReport = jobReportsStore.updateReportStatus(
        reportId,
        action === "RESOLVE" ? "RESOLVED" : "DISMISSED",
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
