import { NextResponse } from "next/server";
import { opportunityStore, runExpiredJobsWorker } from "@/lib/opportunities/opportunity-store";
import { jobRepository } from "@/lib/jobs/repository";
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

    const rawStatus = searchParams.get("status");
    let items: any[] = result.items;
    let total = result.total;

    if (rawStatus === "SOURCE_DISCOVERY" || rawStatus === "SOURCE_DISCOVERIES") {
      const sourceRes = await jobRepository.getStoredSourceDiscoveries({
        limit: pageSize,
        page,
      });
      items = sourceRes.map((j: any) => ({
        id: j.id,
        title: j.title,
        companyName: j.companyName,
        companyLogo: j.companyLogoUrl || j.companyLogo,
        category: (j.isInternship ? "internship" : "job") as any,
        employmentType: (j.employmentType || "full-time") as any,
        remoteType: (j.remoteType || "onsite") as any,
        experienceLevel: (j.experienceLevel || "fresher") as any,
        location: j.location,
        description: j.description,
        skills: j.skills,
        salary: j.salary ? { currency: "₹", min: 0, max: 0, period: "monthly" } : undefined,
        sourceUrl: j.sourceUrl,
        applyUrl: j.applyUrl,
        source: j.sourceName,
        verifiedByAdmin: false,
        verificationTier: j.verificationTier,
        status: "PENDING_REVIEW" as any,
        reviewState: (j.reviewState || "DISCOVERED") as any,
        publicationState: (j.publicationState || "NOT_PUBLISHED") as any,
        recordState: (j.recordState || "ACTIVE") as any,
        postedAt: j.datePosted,
        applicationDeadline: j.applicationDeadline,
        createdAt: j.datePosted,
        updatedAt: j.datePosted,
      }));
      total = sourceRes.length;
    }

    // Fetch authoritative database lifecycle counts
    const dbCounts = await jobRepository.getAdminLifecycleCounts();

    const finalCounts = {
      ...result.counts,
      ...dbCounts,
      // Map both naming conventions so all admin UI tabs and components match
      pending: dbCounts.pendingReview || result.counts.pending,
      pendingReview: dbCounts.pendingReview || result.counts.pending,
      approved: dbCounts.saarviVerified || result.counts.approved,
      saarviVerified: dbCounts.saarviVerified || result.counts.approved,
      published: dbCounts.published,
      live: dbCounts.liveToUsers,
      liveToUsers: dbCounts.liveToUsers,
      expired: dbCounts.expired,
      expiredPublished: dbCounts.expired,
      stored: dbCounts.stored || result.counts.stored,
      totalStored: dbCounts.stored || result.counts.stored,
      archived: dbCounts.archived || result.counts.archived,
      reports: dbCounts.reports,
      sourceDiscoveries: dbCounts.sourceDiscoveries,
    };

    const response = NextResponse.json({
      success: true,
      items,
      total,
      counts: finalCounts,
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
