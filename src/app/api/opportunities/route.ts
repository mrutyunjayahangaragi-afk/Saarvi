import { NextResponse } from "next/server";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";
import { OpportunityCategory, ExperienceLevel } from "@/lib/opportunities/types";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { getUserEntitlement } from "@/lib/billing/entitlements";
import { JobsFeatureControl } from "@/lib/jobs/feature-control";

export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities
 * Student opportunity discovery endpoint.
 * STRICT GUARANTEE: Returns ONLY administrator-approved verified opportunities to authenticated users.
 */
export async function GET(request: Request) {
  // 1. Mandatory Server-Side Authentication Check
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to access opportunities." },
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

  try {
    const { searchParams } = new URL(request.url);

    const category = (searchParams.get("category") as OpportunityCategory) || undefined;
    const remoteOnly = searchParams.get("remoteOnly") === "true";
    const experienceLevel = (searchParams.get("experienceLevel") as ExperienceLevel) || undefined;
    const skillsParam = searchParams.get("skills");
    const skills = skillsParam ? skillsParam.split(",").map((s) => s.trim()) : undefined;
    const search = searchParams.get("search") || undefined;
    const sort = (searchParams.get("sort") as "newest" | "deadline" | "match") || "newest";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 50);

    const result = opportunityStore.getApprovedOpportunities({
      category,
      remoteOnly,
      experienceLevel,
      skills,
      search,
      sort,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      items: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("[Public Opportunities GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve verified opportunities." },
      { status: 500 }
    );
  }
}
