-- =========================================================================
-- Migration 029: Fix RLS, Canonical Live Predicate & Auto-Expiry Worker
-- Root Cause Fix: Published 12 / User 0 discrepancy
-- =========================================================================

-- 1. FIX RLS POLICY ON job_opportunities
-- Old policy used legacy 'status' column. Now uses multi-dimensional state columns.
-- This is the PRIMARY fix for users seeing 0 jobs when admin shows 12 published.

DROP POLICY IF EXISTS "Public read active opportunities" ON public.job_opportunities;

CREATE POLICY "Public read live opportunities"
  ON public.job_opportunities FOR SELECT
  USING (
    publication_state = 'PUBLISHED'
    AND record_state = 'ACTIVE'
    AND visibility = 'public'
    AND (
      deadline IS NULL
      OR deadline > NOW()
    )
  );

-- 2. CANONICAL LIVE PREDICATE FUNCTION
-- Single server-side function used by all user-facing queries.
-- Every user-facing job query MUST use this predicate.
-- Admin jobs list / search / featured / recommendations all reference this.

CREATE OR REPLACE FUNCTION is_job_live_for_users(job public.job_opportunities)
RETURNS boolean AS $$
BEGIN
  RETURN (
    job.publication_state = 'PUBLISHED'
    AND job.record_state = 'ACTIVE'
    AND job.review_state = 'APPROVED'
    AND job.visibility = 'public'
    AND job.data_origin IN ('PROVIDER', 'ADMIN')
    AND (
      job.deadline IS NULL
      OR job.deadline > NOW()
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. AUTO-EXPIRY WORKER FUNCTION
-- Marks expired published jobs as PAUSED / EXPIRED atomically.
-- Run via: SELECT expire_outdated_jobs();
-- Can be called by scheduled cron job or on admin page load.

CREATE OR REPLACE FUNCTION expire_outdated_jobs()
RETURNS TABLE(expired_count integer, job_ids text[]) AS $$
DECLARE
  v_expired_count integer := 0;
  v_job_ids text[] := '{}';
BEGIN
  WITH expired AS (
    UPDATE public.job_opportunities
    SET
      publication_state = 'PAUSED',
      status = 'EXPIRED',
      updated_at = NOW()
    WHERE
      publication_state = 'PUBLISHED'
      AND record_state = 'ACTIVE'
      AND deadline IS NOT NULL
      AND deadline <= NOW()
    RETURNING id
  )
  SELECT COUNT(*)::integer, ARRAY_AGG(id)
  INTO v_expired_count, v_job_ids
  FROM expired;

  RETURN QUERY SELECT v_expired_count, COALESCE(v_job_ids, '{}');
END;
$$ LANGUAGE plpgsql;

-- 4. ADMIN SAFETY: PREVENT PUBLISHING ALREADY-EXPIRED JOBS
-- Raises exception if admin tries to set publication_state=PUBLISHED on expired job.

CREATE OR REPLACE FUNCTION prevent_publish_expired()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.publication_state = 'PUBLISHED'
     AND NEW.deadline IS NOT NULL
     AND NEW.deadline <= NOW() THEN
    RAISE EXCEPTION 'Cannot publish job with expired deadline: %. Archive it or update the deadline first.', NEW.deadline;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_publish_expired ON public.job_opportunities;
CREATE TRIGGER trg_prevent_publish_expired
  BEFORE UPDATE ON public.job_opportunities
  FOR EACH ROW
  WHEN (NEW.publication_state = 'PUBLISHED')
  EXECUTE FUNCTION prevent_publish_expired();

-- 5. SYNC LEGACY STATUS WITH MULTI-DIMENSIONAL STATE
-- Ensures rows that have status=PUBLISHED but publication_state=NOT_PUBLISHED are correctly backfilled.
-- Also ensures data_origin is set for pre-028 rows.

UPDATE public.job_opportunities
SET
  publication_state = CASE
    WHEN status IN ('PUBLISHED', 'ACTIVE') THEN 'PUBLISHED'
    WHEN status = 'PAUSED' THEN 'PAUSED'
    ELSE 'NOT_PUBLISHED'
  END,
  review_state = CASE
    WHEN status IN ('APPROVED', 'PUBLISHED', 'ACTIVE') THEN 'APPROVED'
    WHEN status = 'REJECTED' THEN 'REJECTED'
    WHEN status = 'DISCOVERED' THEN 'DISCOVERED'
    ELSE 'PENDING_REVIEW'
  END,
  record_state = CASE
    WHEN status IN ('DELETED') THEN 'DELETED'
    WHEN status IN ('ARCHIVED') THEN 'ARCHIVED'
    ELSE 'ACTIVE'
  END,
  verification_state = CASE
    WHEN source_verified = TRUE THEN 'PASSED'
    ELSE COALESCE(verification_state, 'PENDING')
  END,
  data_origin = CASE
    WHEN data_origin IS NULL AND id LIKE 'opp_seed_%' THEN 'SEED'
    WHEN data_origin IS NULL AND provider = 'admin_manual' THEN 'ADMIN'
    WHEN data_origin IS NULL THEN 'PROVIDER'
    ELSE data_origin
  END,
  updated_at = NOW()
WHERE
  -- Only update rows that have diverged between legacy status and state dimensions
  (
    (status IN ('PUBLISHED', 'ACTIVE') AND publication_state != 'PUBLISHED')
    OR (status = 'PAUSED' AND publication_state != 'PAUSED')
    OR (status IN ('APPROVED', 'PUBLISHED', 'ACTIVE') AND review_state != 'APPROVED')
    OR (source_verified = TRUE AND verification_state != 'PASSED')
    OR data_origin IS NULL
  );

-- 6. AUTO-EXPIRE ALREADY-EXPIRED ROWS IMMEDIATELY
-- Runs the expiry worker on migration deployment so expired records are immediately corrected.
DO $$
DECLARE
  result record;
BEGIN
  SELECT * INTO result FROM expire_outdated_jobs();
  RAISE NOTICE 'Migration 029: Auto-expired % jobs with passed deadlines', result.expired_count;
END $$;

-- 7. ADD DEADLINE INDEX for expiry worker and user search performance
CREATE INDEX IF NOT EXISTS idx_job_opps_deadline
  ON public.job_opportunities (deadline)
  WHERE deadline IS NOT NULL AND publication_state = 'PUBLISHED' AND record_state = 'ACTIVE';

-- 8. COMPOSITE INDEX for canonical live predicate (covers is_job_live_for_users)
DROP INDEX IF EXISTS idx_job_opps_user_query;
CREATE INDEX IF NOT EXISTS idx_job_opps_live_user_query
  ON public.job_opportunities (publication_state, record_state, review_state, visibility, deadline DESC, posted_at DESC)
  WHERE publication_state = 'PUBLISHED'
    AND record_state = 'ACTIVE'
    AND review_state = 'APPROVED'
    AND visibility = 'public';

-- 9. ADMIN VIEW: Separate "Published" vs "Live to Users" vs "Expired Published"
-- Provides accurate counts for admin dashboard metrics.

CREATE OR REPLACE VIEW admin_job_lifecycle_counts AS
SELECT
  COUNT(*) FILTER (WHERE record_state != 'DELETED') AS stored,
  COUNT(*) FILTER (WHERE review_state IN ('PENDING_REVIEW', 'DISCOVERED')) AS pending,
  COUNT(*) FILTER (WHERE review_state = 'APPROVED' AND record_state = 'ACTIVE') AS approved,
  COUNT(*) FILTER (WHERE publication_state = 'PUBLISHED' AND record_state = 'ACTIVE') AS published,
  COUNT(*) FILTER (
    WHERE publication_state = 'PUBLISHED'
      AND record_state = 'ACTIVE'
      AND review_state = 'APPROVED'
      AND visibility = 'public'
      AND data_origin IN ('PROVIDER', 'ADMIN')
      AND (deadline IS NULL OR deadline > NOW())
  ) AS live_to_users,
  COUNT(*) FILTER (
    WHERE publication_state IN ('PUBLISHED', 'PAUSED')
      AND deadline IS NOT NULL
      AND deadline <= NOW()
  ) AS expired_published,
  COUNT(*) FILTER (WHERE status = 'EXPIRED' OR (deadline IS NOT NULL AND deadline <= NOW() AND publication_state = 'PUBLISHED')) AS total_expired,
  COUNT(*) FILTER (WHERE record_state = 'ARCHIVED') AS archived,
  COUNT(*) FILTER (WHERE review_state = 'REJECTED') AS rejected,
  COUNT(*) AS total_catalog
FROM public.job_opportunities;

-- Grant read access to admin role functions
-- (No explicit grant needed when using admin client with service role key)
