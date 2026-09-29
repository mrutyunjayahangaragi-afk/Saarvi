import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { jobLifecycleService } from "@/lib/jobs/lifecycle";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/jobs/bulk-publish
 * Production Bulk Publish API.
 * Publishes selected jobs or all matching eligible jobs in a single efficient server-side transaction.
 * Tracks audit events, invalidates caches, and returns detailed partial failure reporting.
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
        { error: "Please provide an array of job IDs to publish, or set all_matching: true." },
        { status: 400 }
      );
    }

    // 1. Update in-memory store
    const result = opportunityStore.bulkPublishOpportunities(targetJobIds, authResult.user.id, {
      allMatching: isAllMatching,
      filterCriteria: effectiveCriteria,
      discoveryBatchId: effectiveBatchId,
    });

    // 2. Synchronize to Supabase PostgreSQL database
    const dbTargetIds = isAllMatching ? ((result as any).publishedOpportunities || targetJobIds) : targetJobIds;
    if (dbTargetIds.length > 0) {
      await jobLifecycleService.bulkPublish(dbTargetIds, authResult.user.id);
    }

    const response = NextResponse.json({
      success: true,
      message: `Successfully published ${result.published} of ${result.requested} opportunities to live Saarvi catalog.`,
      summary: result,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Bulk Publish API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process bulk publication request." },
      { status: 500 }
    );
  }
}
