import { NextResponse } from "next/server";
import { opportunityStore, runExpiredJobsWorker } from "@/lib/opportunities/opportunity-store";
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

    // Non-blocking: auto-expire any jobs whose deadline has passed since last load
    // This ensures admin counts are accurate and "Published Live" reflects reality
    runExpiredJobsWorker().catch((err) =>
      console.warn("[Admin Career Opportunities] Expiry worker error:", err)
    );

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

/**
 * POST /api/admin/career/opportunities
 * Supports:
 * 1. MANUAL_ADD: Directly adds an admin-created opportunity.
 * 2. BULK_IMPORT: Ingests previewed external items into PENDING_REVIEW queue.
 */
export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "MANAGE");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, "adminMutations", authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const { action, input, items } = body;

    if (action === "MANUAL_ADD") {
      if (!input) {
        return NextResponse.json({ error: "Missing manual opportunity payload" }, { status: 400 });
      }

      const opp = opportunityStore.addManualOpportunity(input, authResult.user.id);
      const response = NextResponse.json({
        success: true,
        opportunity: opp,
        message: "Opportunity successfully created",
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    if (action === "BULK_IMPORT") {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "No items provided for bulk import" }, { status: 400 });
      }

      const summary = opportunityStore.bulkImportToPendingReview(items, authResult.user.id);
      const response = NextResponse.json({
        success: true,
        summary,
        message: `Imported ${summary.imported} opportunities to Pending Review.`,
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    return NextResponse.json({ error: "Invalid action specified. Supported: MANUAL_ADD, BULK_IMPORT" }, { status: 400 });
  } catch (error: any) {
    console.error("[Admin Career Opportunities POST] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process opportunity mutation" }, { status: 500 });
  }
}

