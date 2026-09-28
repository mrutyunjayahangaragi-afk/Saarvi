import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/jobs/discovery-batches
 * Returns discovery history sessions and batches for operational traceability.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedAdmin(req, "VIEW");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(req, "adminReads", authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const batches = opportunityStore.getDiscoveryBatches();

    const response = NextResponse.json({
      success: true,
      batches,
      total: batches.length,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Discovery Batches API] Error:", error);
    return NextResponse.json(
      { error: "Failed to load discovery batches history." },
      { status: 500 }
    );
  }
}
