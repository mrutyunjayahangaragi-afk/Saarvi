-- =========================================================================
-- Migration 019: Saarvi Jobs & Career Intelligence Engine 2.0
-- Tables, Indexes, and Strict Row Level Security Policies
-- =========================================================================

-- 1. JOBS TABLE (Curated, Discovered, and Approved Opportunities)
CREATE TABLE IF NOT EXISTS public.jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_logo TEXT,
  location TEXT NOT NULL,
  remote_type TEXT NOT NULL CHECK (remote_type IN ('remote', 'hybrid', 'onsite')),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full-time', 'part-time', 'internship', 'contract', 'temporary')),
  experience_level TEXT NOT NULL CHECK (experience_level IN ('fresher', 'entry-level', 'mid-level', 'senior')),
  salary TEXT DEFAULT 'Salary not disclosed',
  description TEXT NOT NULL,
  qualifications TEXT[] DEFAULT '{}',
  responsibilities TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  date_posted TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  application_deadline TEXT DEFAULT 'Deadline not provided',
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  apply_url TEXT NOT NULL,
  source_job_id TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  verified_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verified_status IN ('verified', 'source_checked', 'unverified', 'reported', 'expired')),
  is_internship BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score INTEGER DEFAULT 85,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-performance searching
CREATE INDEX IF NOT EXISTS idx_jobs_search ON public.jobs (title, location, employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (verified_status);
CREATE INDEX IF NOT EXISTS idx_jobs_date_posted ON public.jobs (date_posted DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_is_internship ON public.jobs (is_internship);

-- 2. JOB SOURCES TABLE
CREATE TABLE IF NOT EXISTS public.job_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'HEALTHY' CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN')),
  circuit_state TEXT NOT NULL DEFAULT 'CLOSED' CHECK (circuit_state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  records_discovered_total INTEGER NOT NULL DEFAULT 0,
  records_approved_total INTEGER NOT NULL DEFAULT 0,
  rate_limit_429_count INTEGER NOT NULL DEFAULT 0,
  last_check_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. JOB REPORTS TABLE (Anti-Scam & User Feedback)
CREATE TABLE IF NOT EXISTS public.job_reports (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  source_url TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('FAKE_JOB', 'EXPIRED', 'WRONG_COMPANY', 'BROKEN_LINK', 'MISLEADING_INFO', 'PAYMENT_REQUIRED', 'SUSPICIOUS', 'OTHER')),
  notes TEXT,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_reports_status ON public.job_reports (status);

-- 4. JOB ALERTS SUBSCRIPTION TABLE
CREATE TABLE IF NOT EXISTS public.job_alerts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  employment_type TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_alerts_user ON public.job_alerts (user_id);

-- 5. JOB SEARCH CACHE TABLE
CREATE TABLE IF NOT EXISTS public.job_search_cache (
  cache_key TEXT PRIMARY KEY,
  query_payload JSONB NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_search_cache_expiry ON public.job_search_cache (expires_at);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_search_cache ENABLE ROW LEVEL SECURITY;

-- JOBS: Public read only for verified or source_checked jobs; admin full access
CREATE POLICY "Public read verified jobs"
  ON public.jobs FOR SELECT
  USING (verified_status IN ('verified', 'source_checked'));

CREATE POLICY "Admin full manage jobs"
  ON public.jobs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- JOB SOURCES: Public read; admin manage
CREATE POLICY "Public read sources"
  ON public.job_sources FOR SELECT
  USING (true);

CREATE POLICY "Admin manage sources"
  ON public.job_sources FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- JOB REPORTS: Any authenticated user can submit; Admin can read and update
CREATE POLICY "Users can create reports"
  ON public.job_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid() OR reporter_id IS NULL);

CREATE POLICY "Admin manage reports"
  ON public.job_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- JOB ALERTS: Strictly isolated by user_id
CREATE POLICY "Users manage own alerts"
  ON public.job_alerts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin view all alerts"
  ON public.job_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- JOB SEARCH CACHE: System role & Admin access
CREATE POLICY "Admin read cache"
  ON public.job_search_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );
