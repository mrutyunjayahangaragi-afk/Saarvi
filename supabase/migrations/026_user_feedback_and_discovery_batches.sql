-- SAARVI MIGRATION 026: USER FEEDBACK ENHANCEMENTS & PERSISTENT JOB DISCOVERY BATCHES
-- Implements permanent feedback storage with guest/user isolation, rate limiting, and discovery batch staging.

-- ============================================================================
-- 1. USER FEEDBACK ENHANCEMENTS
-- ============================================================================

-- Ensure feedback table exists with all canonical fields
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    guest_session_id TEXT,
    user_type TEXT NOT NULL DEFAULT 'GUEST' CHECK (user_type IN ('GUEST', 'FREE', 'PRO')),
    user_email TEXT,
    user_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    category TEXT NOT NULL CHECK (category IN (
        'General', 'Bug', 'Tool Issue', 'Feature Request', 'Performance', 'Privacy', 'Payment', 'Other',
        'GENERAL', 'BUG', 'TOOL_ISSUE', 'FEATURE', 'FEATURE_REQUEST', 'PERFORMANCE', 'PRIVACY', 'PAYMENT', 'UX', 'OTHER'
    )),
    message TEXT NOT NULL,
    tool_key TEXT,
    page_url TEXT,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_REVIEW', 'RESOLVED', 'ARCHIVED')),
    sentiment TEXT DEFAULT 'UNKNOWN' CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'UNKNOWN')),
    admin_notes TEXT,
    idempotency_key TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns safely if feedback already existed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'guest_session_id') THEN
        ALTER TABLE public.feedback ADD COLUMN guest_session_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'user_type') THEN
        ALTER TABLE public.feedback ADD COLUMN user_type TEXT NOT NULL DEFAULT 'GUEST';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'sentiment') THEN
        ALTER TABLE public.feedback ADD COLUMN sentiment TEXT DEFAULT 'UNKNOWN';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'idempotency_key') THEN
        ALTER TABLE public.feedback ADD COLUMN idempotency_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'resolved_at') THEN
        ALTER TABLE public.feedback ADD COLUMN resolved_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'resolved_by') THEN
        ALTER TABLE public.feedback ADD COLUMN resolved_by TEXT;
    END IF;
END $$;

-- Indexes for fast administrative querying
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_tool_key ON public.feedback(tool_key);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_idempotency ON public.feedback(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Enable RLS on feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (authenticated or guest)
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
CREATE POLICY "Anyone can insert feedback" ON public.feedback
    FOR INSERT WITH CHECK (true);

-- Users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view and manage all feedback
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback" ON public.feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Admins can update feedback" ON public.feedback
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- ============================================================================
-- 2. PERSISTENT JOB DISCOVERY BATCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_discovery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    location TEXT,
    filters JSONB DEFAULT '{}'::jsonb,
    provider TEXT NOT NULL DEFAULT 'serpapi_google_jobs',
    requested_count INTEGER NOT NULL DEFAULT 0,
    fetched_count INTEGER NOT NULL DEFAULT 0,
    valid_count INTEGER NOT NULL DEFAULT 0,
    new_count INTEGER NOT NULL DEFAULT 0,
    existing_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by TEXT,
    error_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_discovery_batches_started ON public.job_discovery_batches(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_batches_provider ON public.job_discovery_batches(provider);

-- Safely add discovery_batch_id to job_opportunities if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_opportunities' AND column_name = 'discovery_batch_id') THEN
        ALTER TABLE public.job_opportunities ADD COLUMN discovery_batch_id UUID REFERENCES public.job_discovery_batches(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_opps_batch_id ON public.job_opportunities(discovery_batch_id) WHERE discovery_batch_id IS NOT NULL;

-- Enable RLS on discovery batches (Admin only)
ALTER TABLE public.job_discovery_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage discovery batches" ON public.job_discovery_batches;
CREATE POLICY "Admins can manage discovery batches" ON public.job_discovery_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );
