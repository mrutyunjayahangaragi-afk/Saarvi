import { NextResponse } from "next/server";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { SerpApiGoogleJobsAdapter } from "@/lib/opportunities/adapters/serpapi-jobs-adapter";
import { SerpApiGoogleSearchAdapter } from "@/lib/opportunities/adapters/serpapi-search-adapter";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import {
  enforceRateLimit,
  createRateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "VIEW");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const config = opportunityStore.getDiscoveryConfig();
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to load discovery configuration" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "MANAGE");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const updated = opportunityStore.updateDiscoveryConfig(body, authResult.user.id);
    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update discovery configuration" }, { status: 500 });
  }
}

/**
 * POST /api/admin/career/discovery
 * Triggers a live opportunity discovery run across enabled sources (SerpApi Google Jobs & Search).
 * Results are ingested into PENDING_REVIEW queue.
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

    const config = opportunityStore.getDiscoveryConfig();
    const jobsAdapter = new SerpApiGoogleJobsAdapter();
    const searchAdapter = new SerpApiGoogleSearchAdapter();

    let totalDiscovered = 0;
    let totalAdded = 0;
    let totalMerged = 0;
    const errors: string[] = [];

    // Run discovery for top 2 configured roles and locations
    const targetRoles = config.roles.slice(0, 2);
    const targetLocations = config.locations.slice(0, 2);

    for (const role of targetRoles) {
      for (const loc of targetLocations) {
        if (config.enabledSources.includes("serpapi_google_jobs")) {
          try {
            const jobsRes = await jobsAdapter.search({ role, location: loc });
            totalDiscovered += jobsRes.results.length;
            const ingestRes = opportunityStore.ingestOpportunities(jobsRes.results, authResult.user.id);
            totalAdded += ingestRes.addedCount;
            totalMerged += ingestRes.mergedCount;
          } catch (e: any) {
            errors.push(`Google Jobs (${role}, ${loc}): ${e.message}`);
          }
        }

        if (config.enabledSources.includes("serpapi_google_search")) {
          try {
            const searchRes = await searchAdapter.search({ role, location: loc, isInternship: true });
            totalDiscovered += searchRes.results.length;
            const ingestRes = opportunityStore.ingestOpportunities(searchRes.results, authResult.user.id);
            totalAdded += ingestRes.addedCount;
            totalMerged += ingestRes.mergedCount;
          } catch (e: any) {
            errors.push(`Google Search (${role}, ${loc}): ${e.message}`);
          }
        }
      }
    }

    opportunityStore.updateDiscoveryConfig({ lastRunTimestamp: new Date().toISOString() }, authResult.user.id);

    // Update source health records
    const jobsHealth = await jobsAdapter.healthCheck();
    opportunityStore.updateSourceHealth(jobsHealth.sourceId, jobsHealth);

    const searchHealth = await searchAdapter.healthCheck();
    opportunityStore.updateSourceHealth(searchHealth.sourceId, searchHealth);

    const response = NextResponse.json({
      success: true,
      summary: {
        totalDiscovered,
        totalAddedToPendingReview: totalAdded,
        totalDuplicatesMerged: totalMerged,
        errors,
        runAt: new Date().toISOString(),
      },
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Admin Career Discovery Run] Error:", error);
    return NextResponse.json({ error: "Discovery run encountered an error" }, { status: 500 });
  }
}
