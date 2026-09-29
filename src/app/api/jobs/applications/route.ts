import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/security/auth-session";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set([
  "SAVED",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
]);

/**
 * GET /api/jobs/applications
 * Returns application tracker records for authenticated user.
 * Persists to Supabase public.job_applications table.
 * If a job is later archived by Admin, the tracker record is preserved
 * (job_id is NOT deleted from job_applications when a job expires).
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to view application tracker." },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: true, items: [], total: 0 });
    }

    // LEFT JOIN with opportunities to get current job details (may be null if archived)
    const { data, error } = await supabase
      .from("job_applications")
      .select(`
        id,
        job_id,
        job_title,
        company_name,
        status,
        applied_at,
        updated_at,
        notes,
        created_at
      `)
      .eq("user_id", authUser.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[GET /api/jobs/applications] Supabase error:", error);
      return NextResponse.json({ error: "Failed to retrieve job applications." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      items: data || [],
      total: (data || []).length,
    });
  } catch (err: any) {
    console.error("[GET /api/jobs/applications] Error:", err);
    return NextResponse.json({ error: "Failed to retrieve job applications." }, { status: 500 });
  }
}

/**
 * POST /api/jobs/applications
 * Creates or updates an application status for authenticated user.
 * Uses upsert on (user_id, job_id) to prevent duplicate rows.
 * Status history is preserved even if a job is later archived.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to update application tracker." },
      { status: 401 }
    );
  }

  const clientIp = getClientIp(req);
  const rateLimitResult = enforceRateLimit(req, "publicWrite", `jobs:app:${authUser.id}:${clientIp}`);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many application tracker updates. Please wait." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { jobId, jobTitle, companyName, status = "APPLIED", notes } = body;

    if (!jobId || !jobTitle || !companyName) {
      return NextResponse.json(
        { error: "Missing required application fields: jobId, jobTitle, and companyName are required." },
        { status: 400 }
      );
    }

    const upperStatus = String(status).toUpperCase();
    if (!VALID_STATUSES.has(upperStatus)) {
      return NextResponse.json(
        { error: `Invalid status '${status}'. Must be one of: ${Array.from(VALID_STATUSES).join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }

    const now = new Date().toISOString();

    // Upsert on (user_id, job_id) — never creates duplicates
    const { data, error } = await supabase
      .from("job_applications")
      .upsert(
        {
          user_id: authUser.id,
          job_id: String(jobId),
          job_title: String(jobTitle),
          company_name: String(companyName),
          status: upperStatus,
          notes: notes ? String(notes).slice(0, 2000) : null,
          updated_at: now,
          // applied_at only set once via DB DEFAULT or first SAVE
        },
        {
          onConflict: "user_id,job_id",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error("[POST /api/jobs/applications] Supabase error:", error);
      return NextResponse.json({ error: "Failed to update job application." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      application: data,
      message: "Application tracker updated.",
    });
  } catch (err: any) {
    console.error("[POST /api/jobs/applications] Error:", err);
    return NextResponse.json({ error: "Failed to update job application." }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/applications?jobId=...
 * Removes an entry from the tracker (user-initiated removal only).
 * Does NOT delete the row when a job is archived by Admin.
 */
export async function DELETE(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId query parameter is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
    }

    const { error } = await supabase
      .from("job_applications")
      .delete()
      .eq("user_id", authUser.id)
      .eq("job_id", jobId);

    if (error) {
      console.error("[DELETE /api/jobs/applications] Supabase error:", error);
      return NextResponse.json({ error: "Failed to remove application from tracker." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Removed from tracker." });
  } catch (err: any) {
    console.error("[DELETE /api/jobs/applications] Error:", err);
    return NextResponse.json({ error: "Failed to remove application from tracker." }, { status: 500 });
  }
}
