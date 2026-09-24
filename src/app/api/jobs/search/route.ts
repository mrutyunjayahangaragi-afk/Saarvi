import { NextRequest, NextResponse } from "next/server";
import { jobSearchService } from "@/lib/jobs/search";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { getUserEntitlement } from "@/lib/billing/entitlements";
import { JobsFeatureControl } from "@/lib/jobs/feature-control";
import type { JobSortOption } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1. Mandatory Server-Side Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to search opportunities." },
      { status: 401 }
    );
  }

  // 2. Server-Authoritative Feature Gate & Entitlement Evaluation
  const entitlement = await getUserEntitlement(authUser.id);
  const access = JobsFeatureControl.evaluateAccess(authUser, entitlement);

  if (!access.allowed) {
    return NextResponse.json(
      {
        error: access.reason || "Jobs & Internships is currently unavailable.",
        status: access.status,
        maintenanceMessage: access.maintenanceMessage,
        items: [],
        total: 0,
        page: 1,
        pageSize: 0,
        cached: false,
      },
      { status: 403 }
    );
  }

  // 2. Rate Limiting
  const clientIp = getClientIp(req);
  const rateLimitResult = enforceRateLimit(req, "search", `jobs:search:${clientIp}`);

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
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      }
    );
  }

  // 2. Parse & Validate Query Parameters
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const location = searchParams.get("location") || undefined;
  const employmentType = searchParams.get("employmentType") || undefined;
  const remote = searchParams.get("remote") || undefined;
  const experience = searchParams.get("experience") || undefined;
  const datePosted = searchParams.get("datePosted") || undefined;
  const sortBy = (searchParams.get("sortBy") as JobSortOption) || "relevant";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const skillsRaw = searchParams.get("skills");
  const skills = skillsRaw ? skillsRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    const result = await jobSearchService.searchJobs({
      q,
      location,
      employmentType,
      remote,
      experience,
      datePosted,
      skills,
      page,
      limit,
      sortBy,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-RateLimit-Limit": String(rateLimitResult.limit),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/jobs/search] Error:", err);
    return NextResponse.json(
      {
        error: "Job search is temporarily unavailable. Please try again.",
        items: [],
        total: 0,
        page: 1,
        pageSize: limit,
        cached: false,
      },
      { status: 500 }
    );
  }
}
