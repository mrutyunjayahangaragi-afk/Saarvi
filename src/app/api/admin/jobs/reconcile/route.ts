import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import { opportunityStore, runExpiredJobsWorker } from "@/lib/opportunities/opportunity-store";
import { isJobLiveForUsers, computeAdminJobCounts } from "@/lib/jobs/live-predicate";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/jobs/reconcile
 *
 * Runs a full reconciliation pass:
 * 1. Auto-expires jobs whose deadline has passed
 * 2. Corrects lifecycle state inconsistencies
 * 3. Syncs Supabase rows (if configured)
 * 4. Returns before/after counts
 *
 * Idempotent: safe to run multiple times.
 */
export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "MANAGE");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const allBefore = opportunityStore.getAllOpportunitiesInternal();
    const countsBefore = computeAdminJobCounts(allBefore);

    // Step 1: Run in-memory auto-expiry
    const { expiredCount } = await runExpiredJobsWorker();

    // Step 2: Sync corrected state to Supabase
    let supabaseExpiredCount = 0;
    if (isSupabaseConfigured()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getSupabaseAdminClient } = require("@/lib/supabase/admin");
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          // Run the DB-side expire function
          const { data: expireResult, error: expireErr } = await supabase.rpc("expire_outdated_jobs");
          if (!expireErr && expireResult && expireResult[0]) {
            supabaseExpiredCount = expireResult[0].expired_count || 0;
          }

          // Backfill: sync legacy status with multi-dimensional state for rows with diverged state
          await supabase.rpc("reconcile_job_lifecycle_state").catch(() => {});
        }
      } catch (err) {
        console.warn("[Reconcile] Supabase sync error:", err);
      }
    }

    const allAfter = opportunityStore.getAllOpportunitiesInternal();
    const countsAfter = computeAdminJobCounts(allAfter);

    // Step 3: Invalidate search cache so users see correct results
    const { invalidateJobsCache } = await import("@/lib/opportunities/opportunity-store");
    invalidateJobsCache();

    return NextResponse.json({
      success: true,
      summary: {
        expired: expiredCount + supabaseExpiredCount,
        inMemoryExpired: expiredCount,
        supabaseExpired: supabaseExpiredCount,
        corrected: Math.max(0, countsBefore.published - countsAfter.published),
        before: {
          published: countsBefore.published,
          liveToUsers: countsBefore.liveToUsers,
          expiredPublished: countsBefore.expiredPublished,
        },
        after: {
          published: countsAfter.published,
          liveToUsers: countsAfter.liveToUsers,
          expiredPublished: countsAfter.expiredPublished,
        },
      },
      message: `Reconciliation complete. ${expiredCount + supabaseExpiredCount} jobs expired. ${countsAfter.liveToUsers} jobs are now live to users.`,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/jobs/reconcile] Error:", err);
    return NextResponse.json(
      { error: err.message || "Reconciliation failed." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/jobs/reconcile
 * Returns current lifecycle state without mutating anything.
 * Useful for pre-reconcile health check.
 */
export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "VIEW");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const all = opportunityStore.getAllOpportunitiesInternal();
    const counts = computeAdminJobCounts(all);

    // Identify jobs that need reconciliation
    const needsExpiry = all.filter((o) => {
      const wasPublished =
        o.publicationState === "PUBLISHED" || o.status === "PUBLISHED" || o.status === "APPROVED";
      if (!wasPublished) return false;
      if (!o.applicationDeadline || o.applicationDeadline === "Deadline not provided") return false;
      const dlMs = new Date(o.applicationDeadline).getTime();
      return !isNaN(dlMs) && dlMs < Date.now();
    });

    const isHealthy = counts.published === counts.liveToUsers + (counts.expiredPublished ?? counts.expired ?? 0);

    return NextResponse.json({
      success: true,
      healthy: isHealthy,
      counts,
      needsExpiry: needsExpiry.length,
      message: isHealthy
        ? "Lifecycle state is consistent. No reconciliation needed."
        : `${needsExpiry.length} records need expiry. Run POST to reconcile.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to check reconciliation status." }, { status: 500 });
  }
}
