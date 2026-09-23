import { NextResponse } from "next/server";
import { SerpApiGoogleJobsAdapter } from "@/lib/opportunities/adapters/serpapi-jobs-adapter";
import { SerpApiGoogleSearchAdapter } from "@/lib/opportunities/adapters/serpapi-search-adapter";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import {
  enforceRateLimit,
  createRateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/security/rate-limit";
import type { Opportunity } from "@/lib/opportunities/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/career/discover
 * Admin-controlled external discovery via SerpApi (Google Jobs / Google Search).
 * CRITICAL RULE: Returns validated PREVIEW items with duplicate detection.
 * Does NOT auto-publish or silently insert into database until Admin imports.
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
    const {
      keyword = "",
      role = "",
      location = "India",
      country = "India",
      jobType = "full-time",
      experience = "fresher",
      remote = false,
      skills = [],
      source = "google_jobs",
      isInternship = false,
      limit = 20,
    } = body;

    const queryTerm = (keyword || role || (isInternship ? "internship" : "software engineer")).trim();
    let rawResults: Opportunity[] = [];

    if (source === "google_search") {
      const searchAdapter = new SerpApiGoogleSearchAdapter();
      const res = await searchAdapter.search({
        role: queryTerm,
        location: `${location} ${country}`.trim(),
        isInternship: Boolean(isInternship),
        limit: Math.min(limit, 30),
      });
      rawResults = res.results;
    } else {
      // Default: Google Jobs engine
      const jobsAdapter = new SerpApiGoogleJobsAdapter();
      const res = await jobsAdapter.search({
        role: queryTerm,
        location: `${location} ${country}`.trim(),
        isInternship: Boolean(isInternship),
        experienceLevel: experience,
        limit: Math.min(limit, 30),
      });
      rawResults = res.results;
    }

    // Run preview validation and duplicate detection against Saarvi's catalog
    const { results: previewItems, summary } = opportunityStore.previewDiscoveryResults(rawResults);

    const response = NextResponse.json({
      success: true,
      query: {
        keyword: queryTerm,
        location,
        source,
        isInternship,
      },
      results: previewItems,
      summary,
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Admin Career Discover Preview] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search external opportunities" },
      { status: 500 }
    );
  }
}
