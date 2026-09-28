import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/jobs/retry-failed
 * Retries failed/rejected items from a discovery batch.
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
    const { batch_id, batchId } = body;
    const targetBatchId = batch_id || batchId;

    if (!targetBatchId) {
      return NextResponse.json({ error: "batch_id is required." }, { status: 400 });
    }

    const result = opportunityStore.retryFailedDiscovery(targetBatchId, authResult.user.id);

    const response = NextResponse.json({
      success: true,
      message: `Retried ${result.retried} opportunities from batch ${targetBatchId}. ${result.succeeded} recovered.`,
      summary: result,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (err: any) {
    console.error("[POST /api/admin/jobs/retry-failed] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to retry discovery batch." }, { status: 500 });
  }
}
