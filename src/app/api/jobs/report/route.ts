import { NextRequest, NextResponse } from "next/server";
import { jobReportsStore } from "@/lib/jobs/reports";
import { jobSupportService } from "@/lib/jobs/support";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { getUserEntitlement } from "@/lib/billing/entitlements";
import { JobsFeatureControl } from "@/lib/jobs/feature-control";
import type { JobReportReason } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Mandatory Server-Side Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to submit job reports." },
      { status: 401 }
    );
  }

  // 2. Feature Control Check
  const entitlement = await getUserEntitlement(authUser.id);
  const access = JobsFeatureControl.evaluateAccess(authUser, entitlement);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason || "Jobs & Internships is currently unavailable." },
      { status: 403 }
    );
  }

  const clientIp = getClientIp(req);
  const rateLimitResult = enforceRateLimit(req, "publicWrite", `jobs:report:${clientIp}`);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many report submissions. Please wait before submitting another report." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { jobId, jobTitle, companyName, sourceUrl, reason, notes } = body;

    if (!jobId || !jobTitle || !companyName || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: jobId, jobTitle, companyName, and reason are required." },
        { status: 400 }
      );
    }

    // Persist to in-memory store for fast fallback
    const report = jobReportsStore.submitReport({
      jobId: String(jobId),
      jobTitle: String(jobTitle),
      companyName: String(companyName),
      sourceUrl: sourceUrl ? String(sourceUrl) : undefined,
      reason: reason as JobReportReason,
      notes: notes ? String(notes) : undefined,
      reporterId: authUser.id,
    });

    // Also persist into Supabase job_reports
    await jobSupportService.submitJobReport({
      jobId: String(jobId),
      jobTitle: String(jobTitle),
      companyName: String(companyName),
      sourceUrl: sourceUrl ? String(sourceUrl) : undefined,
      reason: reason as JobReportReason,
      notes: notes ? String(notes) : undefined,
      reporterId: authUser.id,
      reporterEmail: authUser.email,
    });

    return NextResponse.json({
      success: true,
      message: "Listing reported successfully. Our team will review this listing.",
      reportId: report.id,
    });
  } catch (err: any) {
    console.error("[POST /api/jobs/report] Error:", err);
    return NextResponse.json({ error: "Failed to record report." }, { status: 500 });
  }
}
