import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { opportunityStore } from "@/lib/opportunities/opportunity-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/saved
 * Returns array of saved job opportunities for the authenticated user.
 * Persists to Supabase public.saved_jobs table.
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
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      // Graceful degradation: return empty list instead of crashing
      return NextResponse.json({ success: true, items: [], total: 0 });
    }

    const { data, error } = await supabase
      .from("saved_jobs")
      .select("id, job_id, created_at")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/jobs/saved] Supabase error:", error);
      return NextResponse.json({ error: "Failed to retrieve saved jobs." }, { status: 500 });
    }

    const savedJobs = (data || []).map((r: any) => {
      const opp = opportunityStore.getOpportunityById(r.job_id.replace("opp_", ""));
      return {
        id: r.id,
        jobId: r.job_id,
        createdAt: r.created_at,
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
 * Uses INSERT ... ON CONFLICT DO NOTHING for idempotent saves.
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

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }

    if (action === "UNSAVE") {
      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("user_id", authUser.id)
        .eq("job_id", jobId);

      if (error) {
        console.error("[POST /api/jobs/saved] Unsave error:", error);
        return NextResponse.json({ error: "Failed to remove saved job." }, { status: 500 });
      }

      return NextResponse.json({ success: true, isSaved: false });
    }

    // Default: SAVE — idempotent upsert (ON CONFLICT DO NOTHING effectively)
    const { error: saveError } = await supabase
      .from("saved_jobs")
      .upsert(
        { user_id: authUser.id, job_id: jobId },
        { onConflict: "user_id,job_id", ignoreDuplicates: true }
      );

    if (saveError) {
      console.error("[POST /api/jobs/saved] Save error:", saveError);
      return NextResponse.json({ error: "Failed to save job." }, { status: 500 });
    }

    return NextResponse.json({ success: true, isSaved: true });
  } catch (err: any) {
    // 23505 = unique_violation (already saved) — idempotent, return success
    if (err?.code === "23505") {
      return NextResponse.json({ success: true, isSaved: true });
    }
    console.error("[POST /api/jobs/saved] Error:", err);
    return NextResponse.json({ error: "Failed to update saved job status." }, { status: 500 });
  }
}
