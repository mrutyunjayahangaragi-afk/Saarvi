-- =========================================================================
-- Migration 028: Canonical Career & Mock Interview 2.0 Moderation Hub
-- Enforces data origin isolation, query fingerprinting, and review schema
-- =========================================================================

-- 1. ADD DATA ORIGIN TO JOB OPPORTUNITIES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_opportunities' AND column_name = 'data_origin') THEN
        ALTER TABLE public.job_opportunities ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'PROVIDER' 
            CHECK (data_origin IN ('PROVIDER', 'ADMIN', 'SEED', 'TEST', 'UNKNOWN'));
    END IF;
END $$;

-- 2. ADD QUERY FINGERPRINT TO DISCOVERY BATCHES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_discovery_batches') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_discovery_batches' AND column_name = 'query_fingerprint') THEN
            ALTER TABLE public.job_discovery_batches ADD COLUMN query_fingerprint TEXT;
            CREATE INDEX IF NOT EXISTS idx_discovery_batches_fingerprint ON public.job_discovery_batches (query_fingerprint, started_at DESC);
        END IF;
    END IF;
END $$;

-- 3. ENFORCE USER SEARCH STRICT SECURITY INDEX
-- Normal users may only see ACTIVE, PUBLISHED, APPROVED, and non-seed records
CREATE INDEX IF NOT EXISTS idx_job_opps_user_security_origin 
    ON public.job_opportunities (publication_state, record_state, review_state, data_origin, visibility, posted_at DESC) 
    WHERE publication_state = 'PUBLISHED' 
      AND record_state = 'ACTIVE' 
      AND review_state = 'APPROVED'
      AND data_origin IN ('PROVIDER', 'ADMIN')
      AND visibility = 'public';

-- 4. CREATE MOCK INTERVIEW REVIEWS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.mock_interview_reviews (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'FLAGGED', 'NEEDS_RETAKE', 'REJECTED')),
    overall_score NUMERIC DEFAULT 0,
    technical_score NUMERIC DEFAULT 0,
    communication_score NUMERIC DEFAULT 0,
    internal_notes TEXT DEFAULT '',
    candidate_feedback TEXT DEFAULT '',
    flag_reasons TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_reviews_session ON public.mock_interview_reviews (session_id);
CREATE INDEX IF NOT EXISTS idx_interview_reviews_admin ON public.mock_interview_reviews (admin_id);

-- 5. CREATE MOCK INTERVIEW AUDIT & TELEMETRY EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.mock_interview_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL DEFAULT 'system',
    actor_role TEXT NOT NULL DEFAULT 'candidate',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_events_session ON public.mock_interview_events (session_id, created_at ASC);
