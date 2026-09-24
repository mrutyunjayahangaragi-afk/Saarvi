import { NextRequest, NextResponse } from "next/server";
import { jobSearchService } from "@/lib/jobs/search";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { getUserEntitlement } from "@/lib/billing/entitlements";
import { JobsFeatureControl } from "@/lib/jobs/feature-control";

export const dynamic = "force-dynamic";

/**
 * GET /api/internships/search
 * Internships search endpoint.
 * Protected by server-side authentication, rate limiting, and JobsFeatureControl feature gating.
 */
export async function GET(req: NextRequest) {
  // 1. Mandatory Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to search internships." },
      { status: 401 }
    );
  }

  // 2. Server-Authoritative Feature Gate Evaluation
  const entitlement = await getUserEntitlement(authUser.id);
  const access = JobsFeatureControl.evaluateAccess(authUser, entitlement);
  if (!access.allowed) {
    return NextResponse.json(
      {
        error: access.reason || "Jobs & Internships is currently unavailable.",
        code: "FEATURE_DISABLED",
        status: access.status,
        maintenanceMessage: access.maintenanceMessage,
        items: [],
        total: 0,
      },
      { status: 403 }
    );
  }

  // 3. Rate Limiting
  const clientIp = getClientIp(req);
  const rateLimitResult = enforceRateLimit(req, "search", `internships:search:${clientIp}`);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "You're searching too quickly. Please try again in a moment.",
        retryAfter: rateLimitResult.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      }
    );
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const location = url.searchParams.get("location") || "";
    const remote = url.searchParams.get("remote") === "true";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20", 10), 50);

    const result = await jobSearchService.searchJobs({
      q,
      location,
      employmentType: "internship",
      remote: remote ? "remote" : undefined,
      page,
      limit: pageSize,
    });

    return NextResponse.json({
      success: true,
      ...result,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to search student internships." },
      { status: 500 }
    );
  }
}
