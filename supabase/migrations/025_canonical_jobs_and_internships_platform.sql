-- =========================================================================
-- Migration 025: Canonical Jobs & Internships Platform
-- Production PostgreSQL Schema, tsvector Full-Text Search & Strict RLS
-- =========================================================================

-- 1. CANONICAL JOB OPPORTUNITIES TABLE
CREATE TABLE IF NOT EXISTS public.job_opportunities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'JOB' CHECK (type IN ('JOB', 'INTERNSHIP')),
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_logo_url TEXT,
  location TEXT NOT NULL DEFAULT 'India',
  country TEXT NOT NULL DEFAULT 'India',
  remote_type TEXT NOT NULL DEFAULT 'onsite' CHECK (remote_type IN ('remote', 'hybrid', 'onsite')),
  employment_type TEXT NOT NULL DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'part-time', 'internship', 'contract', 'temporary')),
  experience_level TEXT NOT NULL DEFAULT 'entry-level' CHECK (experience_level IN ('fresher', 'entry-level', 'mid-level', 'senior')),
  description TEXT NOT NULL,
  skills TEXT[] DEFAULT '{}',
  responsibilities TEXT[] DEFAULT '{}',
  qualifications TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT DEFAULT 'INR',
  salary_period TEXT DEFAULT 'yearly',
  salary_text TEXT DEFAULT 'Salary not disclosed',
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline TIMESTAMPTZ,
  source_name TEXT NOT NULL DEFAULT 'Saarvi Direct',
  source_url TEXT,
  source_job_id TEXT,
  apply_url TEXT NOT NULL,
  apply_options JSONB DEFAULT '[]'::jsonb,
  provider TEXT NOT NULL DEFAULT 'serpapi_google_jobs',
  source_verified BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'source_checked', 'unverified', 'reported', 'expired')),
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('DISCOVERED', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED', 'ARCHIVED', 'DELETED')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  canonical_job_key TEXT,
  content_hash TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  admin_notes TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company_name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location, ''))
  ) STORED
);

-- Full-Text Search and composite indexes
CREATE INDEX IF NOT EXISTS idx_job_opps_fts ON public.job_opportunities USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_job_opps_status_vis ON public.job_opportunities (status, visibility);
CREATE INDEX IF NOT EXISTS idx_job_opps_type ON public.job_opportunities (type);
CREATE INDEX IF NOT EXISTS idx_job_opps_remote ON public.job_opportunities (remote_type);
CREATE INDEX IF NOT EXISTS idx_job_opps_exp ON public.job_opportunities (experience_level);
CREATE INDEX IF NOT EXISTS idx_job_opps_posted ON public.job_opportunities (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_opps_canonical_key ON public.job_opportunities (canonical_job_key);

-- 2. RAW SOURCE RECORDS STORAGE (Keeps provider payloads separate and internal)
CREATE TABLE IF NOT EXISTS public.job_source_records (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_job_id TEXT NOT NULL,
  source_url TEXT,
  source_apply_url TEXT,
  raw_payload JSONB NOT NULL,
  raw_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parse_status TEXT NOT NULL DEFAULT 'SUCCESS',
  validation_status TEXT NOT NULL DEFAULT 'VALID',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_source_records_provider ON public.job_source_records (provider, provider_job_id);

-- 3. AUDIT LOGS TABLE (Tracks all status transitions and admin actions)
CREATE TABLE IF NOT EXISTS public.job_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  details TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_audit_job ON public.job_audit_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_job_audit_timestamp ON public.job_audit_logs (timestamp DESC);

-- 4. SAVED JOBS (Authenticated users, unique constraint)
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_saved_jobs_user_job UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_user ON public.saved_jobs (user_id);

-- 5. JOB APPLICATION TRACKER (User application lifecycle)
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('SAVED', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN')),
  notes TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_job_apps_user_job UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_apps_user ON public.job_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_job_apps_status ON public.job_applications (status);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.job_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Job Opportunities: Public read for published/active only
CREATE POLICY "Public read active opportunities"
  ON public.job_opportunities FOR SELECT
  USING (
    status IN ('PUBLISHED', 'ACTIVE') AND
    visibility = 'public'
  );

-- Job Opportunities: Admins full control
CREATE POLICY "Admin manage opportunities"
  ON public.job_opportunities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin', 'founder')
    )
  );

-- Job Source Records: Admins only (Never exposed to regular users)
CREATE POLICY "Admin access source records"
  ON public.job_source_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin', 'founder')
    )
  );

-- Job Audit Logs: Admins only
CREATE POLICY "Admin access job audit logs"
  ON public.job_audit_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin', 'founder')
    )
  );

-- Saved Jobs: User isolation
CREATE POLICY "Users manage own saved jobs"
  ON public.saved_jobs FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Job Applications: User isolation
CREATE POLICY "Users manage own job applications"
  ON public.job_applications FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
