import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { enforceRateLimit, createRateLimitResponse, withRateLimitHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/jobs
 * Returns paginated jobs for admin review and management.
 */
export async function GET(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "VIEW");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") as any) || undefined;
  const category = (searchParams.get("category") as any) || undefined;
  const search = searchParams.get("search") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

  const result = opportunityStore.getAdminOpportunities({
    status,
    category,
    search,
    page,
    pageSize,
  });

  return NextResponse.json({
    success: true,
    items: result.items,
    total: result.total,
    counts: result.counts,
    page,
    pageSize,
  });
}

/**
 * POST /api/admin/jobs
 * Manually creates a new canonical job or internship.
 */
export async function POST(req: NextRequest) {
  const authResult = await getAuthenticatedAdmin(req, "MANAGE");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const rateLimit = enforceRateLimit(req, "adminMutations", authResult.user.id);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const body = await req.json();
    const opp = opportunityStore.addManualOpportunity(body, authResult.user.id);

    const response = NextResponse.json({
      success: true,
      job: opp,
      message: "Job opportunity created successfully.",
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (err: any) {
    console.error("[POST /api/admin/jobs] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create job" }, { status: 400 });
  }
}
