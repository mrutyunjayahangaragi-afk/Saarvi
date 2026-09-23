import { NextResponse } from "next/server";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import {
  enforceRateLimit,
  createRateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/security/rate-limit";
import { OpportunityCategory, OpportunityStatus } from "@/lib/opportunities/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/career/opportunities
 * Returns paginated opportunities for the Admin Review Queue with counts.
 * Rate limited under 'adminReads' (120 req/min).
 */
export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "VIEW");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, "adminReads", authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as OpportunityStatus) || undefined;
    const category = (searchParams.get("category") as OpportunityCategory) || undefined;
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

    const response = NextResponse.json({
      success: true,
      items: result.items,
      total: result.total,
      counts: result.counts,
      page,
      pageSize,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Admin Career Opportunities GET] Error:", error);
    return NextResponse.json(
      { error: "Internal error loading opportunities for review." },
      { status: 500 }
    );
  }
}
