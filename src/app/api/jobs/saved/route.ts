import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { mockStorage } from "@/lib/supabase/mock-storage";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/saved
 * Returns array of saved job opportunities for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to view saved jobs." },
      { status: 401 }
    );
  }

  try {
    const savedRecords = mockStorage.getSavedJobs(authUser.id);
    const savedJobs = savedRecords.map((r: any) => {
      const opp = opportunityStore.getOpportunityById(r.jobId.replace("opp_", ""));
      return {
        id: r.id,
        jobId: r.jobId,
        createdAt: r.createdAt,
        opportunity: opp || null,
      };
    });

    return NextResponse.json({
      success: true,
      items: savedJobs,
      total: savedJobs.length,
    });
  } catch (err: any) {
    console.error("[GET /api/jobs/saved] Error:", err);
    return NextResponse.json({ error: "Failed to retrieve saved jobs." }, { status: 500 });
  }
}

/**
 * POST /api/jobs/saved
 * Saves or unsaves a job for the authenticated user.
 * Body: { jobId: string, action?: "SAVE" | "UNSAVE" }
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to save jobs." },
      { status: 401 }
    );
  }

  const clientIp = getClientIp(req);
  const rateLimitResult = enforceRateLimit(req, "publicWrite", `jobs:save:${authUser.id}:${clientIp}`);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many save operations. Please slow down." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { jobId, action = "SAVE" } = body;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "A valid jobId is required." }, { status: 400 });
    }

    if (action === "UNSAVE") {
      const res = mockStorage.unsaveJob(authUser.id, jobId);
      return NextResponse.json({ success: true, isSaved: false });
    }

    // Default: SAVE
    const res = mockStorage.saveJob(authUser.id, jobId);
    return NextResponse.json({ success: true, isSaved: true });
  } catch (err: any) {
    console.error("[POST /api/jobs/saved] Error:", err);
    return NextResponse.json({ error: "Failed to update saved job status." }, { status: 500 });
  }
}
