import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/jobs/[id]/publish
 * Publishes an approved opportunity to the public live search feed.
 */
export async function POST(req: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  const authResult = await getAuthenticatedAdmin(req, "MANAGE");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const rateLimit = enforceRateLimit(req, "adminMutations", authResult.user.id);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  const opp = opportunityStore.publishOpportunity(id, authResult.user.id);
  if (!opp) {
    return NextResponse.json({ error: "Job opportunity not found" }, { status: 404 });
  }

  const response = NextResponse.json({
    success: true,
    job: opp,
    message: "Opportunity published successfully.",
  });
  return withRateLimitHeaders(response, rateLimit);
}
