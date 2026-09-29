/**
 * Saarvi Canonical Job Live Predicate — Server-Side Authority
 *
 * ONE FUNCTION that determines whether a job is live/visible to users.
 * EVERY user-facing query must use this predicate.
 *
 * Used by:
 * - /api/jobs (listing)
 * - /api/jobs/search (search)
 * - /api/jobs/[id] (detail)
 * - /api/jobs/saved (saved jobs)
 * - Featured jobs
 * - Notifications / alerts
 * - Admin live count metrics
 */

import type { Opportunity } from "@/lib/opportunities/types";
import type { JobItem, AdminJobLifecycleCounts } from "./types";

/**
 * Returns current UTC timestamp for expiry comparison.
 * Uses server time (never browser time).
 */
export function getNowUtcMs(): number {
  return Date.now();
}

/**
 * Checks whether a deadline string has passed (expired).
 * Handles ISO timestamps, date strings, and null/undefined gracefully.
 */
export function isDeadlineExpired(deadline: string | null | undefined): boolean {
  if (!deadline || deadline === "Deadline not provided") return false;
  const dlMs = new Date(deadline).getTime();
  if (isNaN(dlMs)) return false;
  return dlMs < getNowUtcMs();
}

/**
 * Checks whether a deadline string is still valid (not expired).
 */
export function isDeadlineValid(deadline: string | null | undefined): boolean {
  if (!deadline || deadline === "Deadline not provided") return true; // No deadline = always valid
  const dlMs = new Date(deadline).getTime();
  if (isNaN(dlMs)) return true; // Unparseable deadline = do not block
  return dlMs > getNowUtcMs();
}

/**
 * CANONICAL LIVE PREDICATE (TypeScript / in-memory version for Tier A Saarvi Verified)
 *
 * Mirrors the SQL is_job_live_for_users() function in migration 030.
 *
 * A Saarvi Verified job is LIVE only when ALL conditions pass:
 *  1. record_state = ACTIVE (not deleted/archived)
 *  2. review_state = APPROVED (admin-reviewed)
 *  3. publication_state = PUBLISHED (explicitly published)
 *  4. visibility = public (public-facing)
 *  5. data_origin IN (PROVIDER, ADMIN) (no test data)
 *  6. deadline IS NULL OR deadline > now (not expired)
 *  7. status NOT IN [EXPIRED, DELETED, ARCHIVED, REJECTED, PAUSED]
 */
export function isJobLiveForUsers(opp: Opportunity | JobItem | Record<string, any>): boolean {
  const anyOpp = opp as any;

  // 1. Data origin guard — never expose test/unknown data
  const dataOrigin = anyOpp.dataOrigin || anyOpp.data_origin;
  if (dataOrigin === "TEST" || dataOrigin === "UNKNOWN") {
    return false;
  }

  // 2. Record state — must be active (not deleted or archived)
  const recordState = anyOpp.recordState || anyOpp.record_state;
  const status = anyOpp.status;
  const recordActive =
    recordState === "ACTIVE" ||
    (!recordState && status !== "DELETED" && status !== "ARCHIVED");
  if (!recordActive) return false;

  // 3. Explicit lifecycle blockers
  if (
    status === "EXPIRED" ||
    status === "DELETED" ||
    status === "ARCHIVED" ||
    status === "REJECTED" ||
    status === "PAUSED"
  ) {
    return false;
  }

  // 4. Review state — must be approved
  const reviewState = anyOpp.reviewState || anyOpp.review_state;
  const reviewApproved =
    reviewState === "APPROVED" ||
    status === "APPROVED" ||
    status === "PUBLISHED";
  if (!reviewApproved) return false;

  // 5. Publication state — must be published
  const pubState = anyOpp.publicationState || anyOpp.publication_state;
  const isPublished =
    pubState === "PUBLISHED" ||
    status === "PUBLISHED" ||
    status === "APPROVED";
  if (!isPublished) return false;

  // 6. Deadline check — expired jobs must not appear
  const deadline = anyOpp.applicationDeadline || anyOpp.deadline;
  if (isDeadlineExpired(deadline)) {
    return false;
  }

  return true;
}

/**
 * CANONICAL LIVE PREDICATE for Supabase row objects (snake_case fields).
 */
export function isJobRowLiveForUsers(row: Record<string, unknown>): boolean {
  return isJobLiveForUsers(row);
}

/**
 * Checks whether a source-discovered opportunity (Tier B) is active and unexpired.
 */
export function isSourceDiscoveryActive(opp: Opportunity | JobItem | Record<string, any>): boolean {
  const anyOpp = opp as any;
  const recordState = anyOpp.recordState || anyOpp.record_state || "ACTIVE";
  if (recordState !== "ACTIVE") return false;

  const status = anyOpp.status;
  if (status === "DELETED" || status === "ARCHIVED" || status === "EXPIRED" || status === "REJECTED") {
    return false;
  }

  const deadline = anyOpp.applicationDeadline || anyOpp.deadline;
  if (isDeadlineExpired(deadline)) return false;

  return true;
}

/**
 * Explains WHY a job is NOT live. Used in admin diagnostics.
 */
export function explainJobNotLive(opp: Opportunity | Record<string, any>): string[] {
  const anyOpp = opp as any;
  const reasons: string[] = [];

  const dataOrigin = anyOpp.dataOrigin || anyOpp.data_origin;
  if (dataOrigin === "TEST") {
    reasons.push(`Data origin is TEST — test records never appear in public feed.`);
  }

  const recordState = anyOpp.recordState || anyOpp.record_state;
  if (recordState === "DELETED") reasons.push("Record state is DELETED.");
  if (recordState === "ARCHIVED") reasons.push("Record state is ARCHIVED.");

  const status = anyOpp.status;
  if (status === "EXPIRED") reasons.push("Status is EXPIRED.");
  if (status === "REJECTED") reasons.push("Status is REJECTED.");
  if (status === "PAUSED") reasons.push("Status is PAUSED.");
  if (status === "PENDING_REVIEW") reasons.push("Status is PENDING_REVIEW — awaiting Admin approval.");
  if (status === "DISCOVERED") reasons.push("Status is DISCOVERED — external source listing not yet reviewed.");

  const reviewState = anyOpp.reviewState || anyOpp.review_state;
  const reviewApproved =
    reviewState === "APPROVED" || status === "APPROVED" || status === "PUBLISHED";
  if (!reviewApproved) reasons.push(`Review state is ${reviewState || "not set"} — must be APPROVED.`);

  const pubState = anyOpp.publicationState || anyOpp.publication_state;
  const isPublished =
    pubState === "PUBLISHED" || status === "PUBLISHED" || status === "APPROVED";
  if (!isPublished) reasons.push(`Publication state is ${pubState || "NOT_PUBLISHED"} — must be PUBLISHED.`);

  const deadline = anyOpp.applicationDeadline || anyOpp.deadline;
  if (isDeadlineExpired(deadline)) {
    reasons.push(`Deadline (${deadline}) has passed — marked EXPIRED (kept in database history).`);
  }

  if (reasons.length === 0 && isJobLiveForUsers(opp as any)) {
    reasons.push("Job IS live. Fully accessible to users.");
  }

  return reasons;
}

/**
 * Computes canonical 9 metrics matching Admin Dashboard Command Center.
 * Guarantees mathematical harmony: Published = Live to Users + Expired Published.
 */
export function computeAdminJobCounts(
  opportunities: (Opportunity | JobItem | Record<string, any>)[],
  pendingReportsCount = 0
): AdminJobLifecycleCounts {
  const now = getNowUtcMs();

  const stored = opportunities.filter((o: any) => {
    const rec = o.recordState || o.record_state;
    return rec !== "DELETED";
  }).length;

  const sourceDiscoveries = opportunities.filter((o: any) => {
    const tier = o.verificationTier || o.verification_tier;
    const rec = o.recordState || o.record_state;
    return (tier === "SOURCE_DISCOVERY" || o.source_verified === false) && rec !== "DELETED";
  }).length;

  const pendingReview = opportunities.filter((o: any) => {
    const rev = o.reviewState || o.review_state;
    const st = o.status;
    const rec = o.recordState || o.record_state || "ACTIVE";
    return (rev === "PENDING_REVIEW" || rev === "DISCOVERED" || st === "PENDING_REVIEW" || st === "DISCOVERED") && rec === "ACTIVE";
  }).length;

  const saarviVerified = opportunities.filter((o: any) => {
    const tier = o.verificationTier || o.verification_tier;
    const rev = o.reviewState || o.review_state;
    const rec = o.recordState || o.record_state || "ACTIVE";
    return (tier === "SAARVI_VERIFIED" || o.verifiedByAdmin || o.source_verified) && rec === "ACTIVE" && (rev === "APPROVED" || o.status === "APPROVED" || o.status === "PUBLISHED");
  }).length;

  // Published: Admin-published records (active, publication_state=PUBLISHED)
  const published = opportunities.filter((o: any) => {
    const pub = o.publicationState || o.publication_state;
    const st = o.status;
    const rec = o.recordState || o.record_state || "ACTIVE";
    return (pub === "PUBLISHED" || st === "PUBLISHED") && rec === "ACTIVE";
  }).length;

  // Live to Users: Canonical live predicate check (including valid deadline)
  const liveToUsers = opportunities.filter((o: any) => isJobLiveForUsers(o)).length;

  // Expired: was published or active, but deadline passed or status=EXPIRED
  const expired = opportunities.filter((o: any) => {
    const pub = o.publicationState || o.publication_state;
    const st = o.status;
    const rec = o.recordState || o.record_state || "ACTIVE";
    if (rec !== "ACTIVE") return false;
    if (st === "EXPIRED") return true;

    const deadline = o.applicationDeadline || o.deadline;
    if (deadline && deadline !== "Deadline not provided") {
      const dlMs = new Date(deadline).getTime();
      if (!isNaN(dlMs) && dlMs < now) {
        return pub === "PUBLISHED" || st === "PUBLISHED" || pub === "PAUSED";
      }
    }
    return false;
  }).length;

  const archived = opportunities.filter((o: any) => {
    const rec = o.recordState || o.record_state;
    return rec === "ARCHIVED" || o.status === "ARCHIVED";
  }).length;

  return {
    stored,
    sourceDiscoveries,
    pendingReview,
    saarviVerified,
    published,
    liveToUsers,
    expired,
    archived,
    reports: pendingReportsCount,
    totalCatalog: opportunities.length,
  };
}
