import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/jobs/bulk-approve
 * Single server-side operation to bulk-approve opportunities without immediately publishing live.
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
      all_matching = false,
      allMatching = false,
      filter_criteria,
      filterCriteria,
      discovery_batch_id,
      discoveryBatchId,
    } = body;

    const targetJobIds = Array.isArray(job_ids) && job_ids.length > 0 ? job_ids : (Array.isArray(jobIds) ? jobIds : []);
    const isAllMatching = Boolean(all_matching || allMatching);
    const effectiveCriteria = filter_criteria || filterCriteria;
    const effectiveBatchId = discovery_batch_id || discoveryBatchId;

    if (!isAllMatching && targetJobIds.length === 0) {
      return NextResponse.json(
        { error: "Please provide an array of job IDs to approve, or set all_matching: true." },
        { status: 400 }
      );
    }

    const result = opportunityStore.bulkApproveOpportunities(targetJobIds, authResult.user.id, {
      allMatching: isAllMatching,
      filterCriteria: effectiveCriteria,
      discoveryBatchId: effectiveBatchId,
    });

    const response = NextResponse.json({
      success: true,
      message: `Successfully approved ${result.approved} of ${result.requested} opportunities.`,
      summary: result,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (err: any) {
    console.error("[POST /api/admin/jobs/bulk-approve] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to bulk approve opportunities." }, { status: 500 });
  }
}
