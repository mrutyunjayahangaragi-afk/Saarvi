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
 *
 * Never implement a separate version of this predicate.
 */

import type { Opportunity } from "@/lib/opportunities/types";

/** IST offset in ms (UTC+5:30) */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns current UTC timestamp for expiry comparison.
 * Uses server time (never browser time).
 */
function getNowUtcMs(): number {
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
 * CANONICAL LIVE PREDICATE (TypeScript / in-memory version)
 *
 * Mirrors the SQL is_job_live_for_users() function in migration 029.
 * Must be kept in sync with the SQL version.
 *
 * A job is LIVE only when ALL conditions pass:
 *  1. record_state = ACTIVE (not deleted/archived)
 *  2. review_state = APPROVED (admin-reviewed)
 *  3. publication_state = PUBLISHED (explicitly published)
 *  4. visibility = public (public-facing)
 *  5. data_origin = PROVIDER | ADMIN (no seed/test data)
 *  6. deadline IS NULL OR deadline > now (not expired)
 *  7. status NOT IN [EXPIRED, DELETED, ARCHIVED, REJECTED, PAUSED]
 */
export function isJobLiveForUsers(opp: Opportunity): boolean {
  // 1. Data origin guard — never expose seed or test data
  if (
    opp.dataOrigin === "SEED" ||
    opp.dataOrigin === "TEST" ||
    opp.dataOrigin === "UNKNOWN" ||
    opp.id.startsWith("opp_seed_")
  ) {
    return false;
  }

  // 2. Record state — must be active (not deleted or archived)
  const recordActive =
    opp.recordState === "ACTIVE" ||
    (!opp.recordState && opp.status !== "DELETED" && opp.status !== "ARCHIVED");
  if (!recordActive) return false;

  // 3. Explicit lifecycle blockers
  if (
    opp.status === "EXPIRED" ||
    opp.status === "DELETED" ||
    opp.status === "ARCHIVED" ||
    opp.status === "REJECTED" ||
    opp.status === "PAUSED"
  ) {
    return false;
  }

  // 4. Review state — must be approved
  const reviewApproved =
    opp.reviewState === "APPROVED" ||
    opp.status === "APPROVED" ||
    opp.status === "PUBLISHED";
  if (!reviewApproved) return false;

  // 5. Publication state — must be published
  const isPublished =
    opp.publicationState === "PUBLISHED" ||
    opp.status === "PUBLISHED" ||
    opp.status === "APPROVED"; // APPROVED in this system implies published
  if (!isPublished) return false;

  // 6. Verification state — must pass
  const verificationPassed =
    opp.verificationState === "PASSED" ||
    opp.verifiedByAdmin === true;
  if (!verificationPassed) return false;

  // 7. Deadline check — expired jobs must not appear
  if (isDeadlineExpired(opp.applicationDeadline || undefined)) {
    return false;
  }

  return true;
}

/**
 * CANONICAL LIVE PREDICATE for Supabase row objects (snake_case fields).
 * Used in querySupabaseLiveJobs after fetching from DB.
 */
export function isJobRowLiveForUsers(row: Record<string, unknown>): boolean {
  // Data origin guard
  const dataOrigin = row.data_origin as string | undefined;
  if (
    dataOrigin === "SEED" ||
    dataOrigin === "TEST" ||
    dataOrigin === "UNKNOWN" ||
    (typeof row.id === "string" && row.id.startsWith("opp_seed_"))
  ) {
    return false;
  }

  // Record state
  const recordState = row.record_state as string | undefined;
  const status = row.status as string | undefined;
  const recordActive =
    recordState === "ACTIVE" ||
    (!recordState && status !== "DELETED" && status !== "ARCHIVED");
  if (!recordActive) return false;

  // Lifecycle blockers
  if (
    status === "EXPIRED" ||
    status === "DELETED" ||
    status === "ARCHIVED" ||
    status === "REJECTED" ||
    status === "PAUSED"
  ) {
    return false;
  }

  // Review state
  const reviewState = row.review_state as string | undefined;
  const reviewApproved =
    reviewState === "APPROVED" ||
    status === "APPROVED" ||
    status === "PUBLISHED";
  if (!reviewApproved) return false;

  // Publication state
  const pubState = row.publication_state as string | undefined;
  const isPublished =
    pubState === "PUBLISHED" ||
    status === "PUBLISHED" ||
    status === "APPROVED";
  if (!isPublished) return false;

  // Deadline check
  const deadline = row.deadline as string | null | undefined;
  if (isDeadlineExpired(deadline)) return false;

  return true;
}

/**
 * Explains WHY a job is NOT live. Used in admin diagnostics.
 */
export function explainJobNotLive(opp: Opportunity): string[] {
  const reasons: string[] = [];

  if (opp.dataOrigin === "SEED" || opp.dataOrigin === "TEST" || opp.id.startsWith("opp_seed_")) {
    reasons.push(`Data origin is ${opp.dataOrigin || "SEED"} — seed/test records never appear in public feed.`);
  }

  if (opp.recordState === "DELETED") reasons.push("Record state is DELETED.");
  if (opp.recordState === "ARCHIVED") reasons.push("Record state is ARCHIVED.");
  if (opp.status === "EXPIRED") reasons.push("Status is EXPIRED.");
  if (opp.status === "REJECTED") reasons.push("Status is REJECTED.");
  if (opp.status === "PAUSED") reasons.push("Status is PAUSED.");
  if (opp.status === "PENDING_REVIEW") reasons.push("Status is PENDING_REVIEW — not yet approved.");
  if (opp.status === "DISCOVERED") reasons.push("Status is DISCOVERED — not yet reviewed.");

  const reviewApproved =
    opp.reviewState === "APPROVED" || opp.status === "APPROVED" || opp.status === "PUBLISHED";
  if (!reviewApproved) reasons.push(`Review state is ${opp.reviewState || "not set"} — must be APPROVED.`);

  const isPublished =
    opp.publicationState === "PUBLISHED" || opp.status === "PUBLISHED" || opp.status === "APPROVED";
  if (!isPublished) reasons.push(`Publication state is ${opp.publicationState || "NOT_PUBLISHED"} — must be PUBLISHED.`);

  const verificationPassed = opp.verificationState === "PASSED" || opp.verifiedByAdmin;
  if (!verificationPassed) reasons.push(`Verification state is ${opp.verificationState || "PENDING"} — must be PASSED.`);

  if (isDeadlineExpired(opp.applicationDeadline || undefined)) {
    reasons.push(`Deadline (${opp.applicationDeadline}) has already passed — job is expired.`);
  }

  if (reasons.length === 0 && isJobLiveForUsers(opp)) {
    reasons.push("Job IS live. No issues detected.");
  } else if (reasons.length === 0) {
    reasons.push("Unknown reason — all checks passed but job is not appearing. Check RLS policies.");
  }

  return reasons;
}

/**
 * Admin count metrics using canonical live predicate.
 * Returns counts that match what users actually see.
 */
export function computeAdminJobCounts(opportunities: Opportunity[]): {
  total: number;
  stored: number;
  pending: number;
  approved: number;
  published: number;
  liveToUsers: number;
  expiredPublished: number;
  archived: number;
  rejected: number;
  paused: number;
} {
  const now = getNowUtcMs();

  const stored = opportunities.filter((o) => o.recordState !== "DELETED").length;
  const pending = opportunities.filter(
    (o) => o.status === "PENDING_REVIEW" || o.status === "DISCOVERED" || o.reviewState === "PENDING_REVIEW"
  ).length;
  const approved = opportunities.filter(
    (o) => o.reviewState === "APPROVED" && o.recordState === "ACTIVE"
  ).length;
  const published = opportunities.filter(
    (o) =>
      (o.publicationState === "PUBLISHED" || o.status === "PUBLISHED") &&
      o.recordState === "ACTIVE"
  ).length;

  // liveToUsers uses the canonical predicate — includes deadline check
  const liveToUsers = opportunities.filter(isJobLiveForUsers).length;

  // expiredPublished: was published but deadline passed
  const expiredPublished = opportunities.filter((o) => {
    const wasPublished =
      o.publicationState === "PUBLISHED" ||
      o.status === "PUBLISHED" ||
      o.status === "APPROVED";
    const recordOk = o.recordState === "ACTIVE" && o.status !== "DELETED" && o.status !== "ARCHIVED";
    if (!wasPublished || !recordOk) return false;
    if (!o.applicationDeadline || o.applicationDeadline === "Deadline not provided") return false;
    const dlMs = new Date(o.applicationDeadline).getTime();
    return !isNaN(dlMs) && dlMs < now;
  }).length;

  const archived = opportunities.filter(
    (o) => o.recordState === "ARCHIVED" || o.status === "ARCHIVED"
  ).length;

  const rejected = opportunities.filter(
    (o) => o.reviewState === "REJECTED" || o.status === "REJECTED"
  ).length;

  const paused = opportunities.filter(
    (o) => o.status === "PAUSED" || o.publicationState === "PAUSED"
  ).length;

  return {
    total: opportunities.length,
    stored,
    pending,
    approved,
    published,
    liveToUsers,
    expiredPublished,
    archived,
    rejected,
    paused,
  };
}
