-- =========================================================================
-- Migration 030: Saarvi Jobs & Internships 6.0 Platform
-- Unified Career Discovery: Tier A (Saarvi Verified) vs Tier B (Source Discovery)
-- Canonical Live Predicate, Zero-Duplicate Invariants, Customer Safety & 9-Metric Reporting
-- =========================================================================

-- 1. ADD TIER AND PROVIDER JOB ID COLUMNS
DO $$
BEGIN
  -- Verification tier column: SAARVI_VERIFIED (Tier A) vs SOURCE_DISCOVERY (Tier B)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_opportunities' AND column_name = 'verification_tier'
  ) THEN
    ALTER TABLE public.job_opportunities 
      ADD COLUMN verification_tier TEXT NOT NULL DEFAULT 'SOURCE_DISCOVERY'
      CHECK (verification_tier IN ('SAARVI_VERIFIED', 'SOURCE_DISCOVERY'));
  END IF;

  -- Provider job ID column (canonical alias for source_job_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_opportunities' AND column_name = 'provider_job_id'
  ) THEN
    ALTER TABLE public.job_opportunities 
      ADD COLUMN provider_job_id TEXT;
  END IF;

  -- Last verified timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_opportunities' AND column_name = 'last_verified_at'
  ) THEN
    ALTER TABLE public.job_opportunities 
      ADD COLUMN last_verified_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 2. BACKFILL AND SYNC TIERS
UPDATE public.job_opportunities
SET 
  provider_job_id = COALESCE(provider_job_id, source_job_id, id),
  verification_tier = CASE
    WHEN publication_state = 'PUBLISHED' AND review_state = 'APPROVED' THEN 'SAARVI_VERIFIED'
    ELSE 'SOURCE_DISCOVERY'
  END,
  last_verified_at = COALESCE(last_verified_at, updated_at, NOW())
WHERE verification_tier IS NULL OR provider_job_id IS NULL;

-- 3. UNIQUE CONSTRAINTS FOR ZERO DUPLICATES
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_opps_provider_job_id
  ON public.job_opportunities (provider, provider_job_id)
  WHERE provider_job_id IS NOT NULL AND record_state != 'DELETED';

-- 4. PERFORMANCE & SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_job_opps_verification_tier
  ON public.job_opportunities (verification_tier, record_state);

CREATE INDEX IF NOT EXISTS idx_job_opps_source_discovery
  ON public.job_opportunities (verification_tier, record_state, posted_at DESC)
  WHERE verification_tier = 'SOURCE_DISCOVERY' AND record_state = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_job_opps_verified_live
  ON public.job_opportunities (verification_tier, publication_state, record_state, review_state, visibility, posted_at DESC)
  WHERE verification_tier = 'SAARVI_VERIFIED' 
    AND publication_state = 'PUBLISHED' 
    AND record_state = 'ACTIVE' 
    AND review_state = 'APPROVED' 
    AND visibility = 'public';

-- 5. CANONICAL LIVE PREDICATE FUNCTION (Server-side authority)
CREATE OR REPLACE FUNCTION is_job_live_for_users(job public.job_opportunities)
RETURNS boolean AS $$
BEGIN
  RETURN (
    job.publication_state = 'PUBLISHED'
    AND job.record_state = 'ACTIVE'
    AND job.review_state = 'APPROVED'
    AND job.verification_tier = 'SAARVI_VERIFIED'
    AND job.visibility = 'public'
    AND job.data_origin IN ('PROVIDER', 'ADMIN')
    AND (
      job.deadline IS NULL
      OR job.deadline > NOW()
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. CANONICAL 9-METRIC VIEW FOR ADMIN COMMAND CENTER
CREATE OR REPLACE VIEW admin_job_lifecycle_counts_v6 AS
SELECT
  -- 1. Total Stored
  COUNT(*) FILTER (WHERE record_state != 'DELETED') AS stored,
  
  -- 2. Source Discoveries (Tier B)
  COUNT(*) FILTER (WHERE verification_tier = 'SOURCE_DISCOVERY' AND record_state != 'DELETED') AS source_discoveries,
  
  -- 3. Pending Review
  COUNT(*) FILTER (WHERE review_state IN ('PENDING_REVIEW', 'DISCOVERED') AND record_state = 'ACTIVE') AS pending_review,
  
  -- 4. Saarvi Verified (Tier A Approved)
  COUNT(*) FILTER (WHERE verification_tier = 'SAARVI_VERIFIED' AND record_state = 'ACTIVE') AS saarvi_verified,
  
  -- 5. Published (Explicitly Published by Admin)
  COUNT(*) FILTER (WHERE publication_state = 'PUBLISHED' AND record_state = 'ACTIVE') AS published,
  
  -- 6. Live to Users (Canonical Live Predicate — EXACT match with /jobs feed)
  COUNT(*) FILTER (
    WHERE publication_state = 'PUBLISHED'
      AND record_state = 'ACTIVE'
      AND review_state = 'APPROVED'
      AND verification_tier = 'SAARVI_VERIFIED'
      AND visibility = 'public'
      AND data_origin IN ('PROVIDER', 'ADMIN')
      AND (deadline IS NULL OR deadline > NOW())
  ) AS live_to_users,
  
  -- 7. Expired (Deadline passed or marked expired — retained in DB, removed from live feed)
  COUNT(*) FILTER (
    WHERE record_state = 'ACTIVE'
      AND (
        status = 'EXPIRED'
        OR (deadline IS NOT NULL AND deadline <= NOW())
      )
  ) AS expired,
  
  -- 8. Archived
  COUNT(*) FILTER (WHERE record_state = 'ARCHIVED') AS archived,
  
  -- 9. Active Career Safety Reports
  (SELECT COUNT(*)::bigint FROM public.job_reports WHERE status IN ('PENDING', 'INVESTIGATING')) AS reports,

  -- Catalog Total
  COUNT(*) AS total_catalog
FROM public.job_opportunities;

-- 7. CUSTOMER SAFETY: ENSURE JOB_REPORTS HAS AUDIT & TELEMETRY COLUMNS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_reports' AND column_name = 'verification_tier'
  ) THEN
    ALTER TABLE public.job_reports ADD COLUMN verification_tier TEXT DEFAULT 'SOURCE_DISCOVERY';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_reports' AND column_name = 'reporter_email'
  ) THEN
    ALTER TABLE public.job_reports ADD COLUMN reporter_email TEXT;
  END IF;
END $$;

-- 8. RLS POLICIES FOR USER FEED & CUSTOMER SAFETY
DROP POLICY IF EXISTS "Public read live opportunities" ON public.job_opportunities;
DROP POLICY IF EXISTS "Users read live and source opportunities" ON public.job_opportunities;

CREATE POLICY "Users read live and source opportunities"
  ON public.job_opportunities FOR SELECT
  USING (
    record_state = 'ACTIVE'
    AND visibility = 'public'
    AND (
      -- Tier A: Published Saarvi Verified
      (
        verification_tier = 'SAARVI_VERIFIED'
        AND publication_state = 'PUBLISHED'
        AND review_state = 'APPROVED'
        AND data_origin IN ('PROVIDER', 'ADMIN')
        AND (deadline IS NULL OR deadline > NOW())
      )
      OR
      -- Tier B: Discovered source listings for search discovery
      (
        verification_tier = 'SOURCE_DISCOVERY'
        AND (deadline IS NULL OR deadline > NOW())
      )
    )
  );

-- Allow authenticated users to report any job
DROP POLICY IF EXISTS "Authenticated users create reports" ON public.job_reports;
CREATE POLICY "Authenticated users create reports"
  ON public.job_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admins full control over job_reports
DROP POLICY IF EXISTS "Admins manage job reports" ON public.job_reports;
CREATE POLICY "Admins manage job reports"
  ON public.job_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin', 'founder', 'ADMIN', 'SUPER_ADMIN')
    )
  );
