import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/jobs/bulk-delete
 * Production Bulk Delete / Archive API.
 * Soft-deletes/archives jobs by default to preserve saved-job and applicant history,
 * or permanently deletes when explicitly confirmed by superadmin.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedAdmin(req, "MANAGE");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(req, "adminMutations", authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await req.json().catch(() => ({}));
    const {
      job_ids = [],
      jobIds = [],
      permanent = false,
    } = body;

    const targetJobIds = Array.isArray(job_ids) && job_ids.length > 0 ? job_ids : (Array.isArray(jobIds) ? jobIds : []);

    if (targetJobIds.length === 0) {
      return NextResponse.json(
        { error: "Please provide an array of job IDs to delete/archive." },
        { status: 400 }
      );
    }

    const isPermanent = Boolean(permanent);
    const result = opportunityStore.bulkDeleteOpportunities(targetJobIds, authResult.user.id, isPermanent);

    const response = NextResponse.json({
      success: true,
      message: isPermanent
        ? `Permanently deleted ${result.processed} opportunity records.`
        : `Archived ${result.processed} opportunities (removed from active user search).`,
      summary: result,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Bulk Delete API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process bulk deletion request." },
      { status: 500 }
    );
  }
}
