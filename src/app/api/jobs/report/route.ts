import { NextRequest, NextResponse } from "next/server";
import { jobReportsStore } from "@/lib/jobs/reports";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import type { JobReportReason } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
    const { jobId, jobTitle, companyName, sourceUrl, reason, notes, reporterId } = body;

    if (!jobId || !jobTitle || !companyName || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: jobId, jobTitle, companyName, and reason are required." },
        { status: 400 }
      );
    }

    const report = jobReportsStore.submitReport({
      jobId: String(jobId),
      jobTitle: String(jobTitle),
      companyName: String(companyName),
      sourceUrl: sourceUrl ? String(sourceUrl) : undefined,
      reason: reason as JobReportReason,
      notes: notes ? String(notes) : undefined,
      reporterId: reporterId ? String(reporterId) : undefined,
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
