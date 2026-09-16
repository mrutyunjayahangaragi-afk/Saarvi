-- =============================================================================
-- SAARVI MIGRATION 014: MOCK INTERVIEW 2.0 & SUPERADMIN BILLING CONTROL
-- =============================================================================
-- Establishes server-authoritative tables for:
-- 1. interview_questions: Full question bank with source attribution, Free/Pro access
-- 2. interview_sessions: Server state machine, privacy modes, proctoring warnings
-- 3. interview_answers: Multi-dimensional scoring & AI vs deterministic tagging
-- 4. interview_events: Immutable audit event tracking
-- 5. interview_permissions: Permission gate audit logs
-- 6. interview_centers & interview_locations: Center management & location audit
-- 7. interview_interviewers: Realtime availability for human interviewers
-- 8. subscription_requests & subscription_audit_logs: Superadmin manual review queue
-- =============================================================================

-- 1. EXTEND / ENHANCE INTERVIEW QUESTIONS
ALTER TABLE IF EXISTS public.interview_questions
    ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS subtopic TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Technical',
    ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT 'Saarvi Question Bank',
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS source_date TEXT,
    ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'Saarvi practice question',
    ADD COLUMN IF NOT EXISTS is_admin_created BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS expected_time_seconds INTEGER DEFAULT 90,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_interview_questions_active_plan 
    ON public.interview_questions(is_active, is_free, is_pro);
CREATE INDEX IF NOT EXISTS idx_interview_questions_topic 
    ON public.interview_questions(topic);

-- 2. EXTEND / ENHANCE INTERVIEW SESSIONS
ALTER TABLE IF EXISTS public.interview_sessions
    ADD COLUMN IF NOT EXISTS session_state TEXT DEFAULT 'REGISTERED',
    ADD COLUMN IF NOT EXISTS privacy_mode TEXT DEFAULT 'FULL_VIDEO',
    ADD COLUMN IF NOT EXISTS interviewer_role TEXT DEFAULT 'ai',
    ADD COLUMN IF NOT EXISTS interviewer_id TEXT,
    ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS center_id TEXT,
    ADD COLUMN IF NOT EXISTS candidate_email TEXT,
    ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'FREE',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_interview_sessions_state 
    ON public.interview_sessions(session_state);

-- 3. INTERVIEW ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.interview_answers (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    is_correct BOOLEAN, -- Deterministic for MCQ
    score NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 0-100
    scores_breakdown JSONB DEFAULT '{}'::jsonb, -- technical, communication, problemSolving, clarity, relevance, timeManagement
    is_ai_evaluated BOOLEAN NOT NULL DEFAULT false,
    feedback JSONB DEFAULT '{}'::jsonb,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_answers_session ON public.interview_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_user ON public.interview_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_question ON public.interview_answers(question_id);

-- 4. INTERVIEW EVENTS TABLE (IMMUTABLE AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.interview_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'INTERVIEW_REGISTERED', 'PERMISSION_REQUESTED', 'PERMISSION_GRANTED', 'PERMISSION_DENIED', 'READY', 'STARTED', 'QUESTION_SHOWN', 'ANSWER_SUBMITTED', 'QUESTION_SKIPPED', 'QUESTION_TIMEOUT', 'TAB_SWITCH_WARNING', 'PAUSED', 'RESUMED', 'COMPLETED', 'TERMINATED', 'ABANDONED', 'AI_FALLBACK_USED', 'HUMAN_INTERVIEWER_JOINED'
    warning_number INTEGER,
    page_visibility_state TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_events_session ON public.interview_events(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_events_type ON public.interview_events(event_type);
CREATE INDEX IF NOT EXISTS idx_interview_events_created ON public.interview_events(created_at DESC);

-- 5. INTERVIEW PERMISSION GATE AUDIT
CREATE TABLE IF NOT EXISTS public.interview_permissions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    camera_status TEXT NOT NULL DEFAULT 'requested', -- requested, granted, denied, unavailable
    microphone_status TEXT NOT NULL DEFAULT 'requested',
    location_status TEXT NOT NULL DEFAULT 'unavailable',
    screen_status TEXT NOT NULL DEFAULT 'unavailable',
    consent_status TEXT NOT NULL DEFAULT 'accepted', -- accepted, rejected
    browser_supported BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_permissions_session ON public.interview_permissions(session_id);

-- 6. INTERVIEW CENTERS & LOCATIONS
CREATE TABLE IF NOT EXISTS public.interview_centers (
    id TEXT PRIMARY KEY,
    center_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    country TEXT NOT NULL DEFAULT 'India',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default center
INSERT INTO public.interview_centers (id, center_name, address, city, country, latitude, longitude, timezone, status)
VALUES ('center_blr_main', 'Saarvi Tech Assessment Center — Bengaluru', 'Electronic City Phase 1', 'Bengaluru', 'India', 12.8399, 77.6770, 'Asia/Kolkata', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.interview_locations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    center_id TEXT REFERENCES public.interview_centers(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL,
    consent_status TEXT NOT NULL DEFAULT 'granted',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    accuracy NUMERIC(10, 2),
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_locations_session ON public.interview_locations(session_id);

-- 7. INTERVIEW INTERVIEWERS (AVAILABILITY TRACKING)
CREATE TABLE IF NOT EXISTS public.interview_interviewers (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin_interviewer', 'superadmin_interviewer')),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BUSY', 'OFFLINE')),
    current_session_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_interviewers_status ON public.interview_interviewers(status);

-- 8. SUPERADMIN SUBSCRIPTION REQUESTS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.subscription_requests (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'PRO' CHECK (plan IN ('FREE', 'PRO')),
    payment_reference TEXT NOT NULL, -- UTR or transaction ref
    provider TEXT NOT NULL DEFAULT 'manual_upi',
    amount NUMERIC(10, 2) NOT NULL DEFAULT 49.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_status TEXT NOT NULL DEFAULT 'VERIFIED',
    subscription_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (subscription_status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    rejected_at TIMESTAMPTZ,
    rejected_by TEXT,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_user ON public.subscription_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_status ON public.subscription_requests(subscription_status);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_requested ON public.subscription_requests(requested_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_audit_logs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'REQUEST_CREATED', 'APPROVED_PRO', 'REJECTED', 'SUSPENDED', 'REACTIVATED', 'PLAN_CHANGED', 'EXPIRY_EXTENDED'
    old_status TEXT,
    new_status TEXT,
    performed_by TEXT NOT NULL,
    reason TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_user ON public.subscription_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_time ON public.subscription_audit_logs(timestamp DESC);

-- 9. ENABLE RLS
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_interviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;

-- Candidates read own answers, events, permissions, locations
CREATE POLICY "Users read own interview answers" ON public.interview_answers
    FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'guest');

CREATE POLICY "Users insert own interview answers" ON public.interview_answers
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'guest');

CREATE POLICY "Users insert own interview events" ON public.interview_events
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'guest');

CREATE POLICY "Users read own interview events" ON public.interview_events
    FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'guest');

CREATE POLICY "Users manage own interview permissions" ON public.interview_permissions
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'guest');

CREATE POLICY "Users insert own interview locations" ON public.interview_locations
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'guest');

-- Centers: anyone can read active centers
CREATE POLICY "Anyone can view active interview centers" ON public.interview_centers
    FOR SELECT USING (status = 'ACTIVE');

-- Interviewers: read availability
CREATE POLICY "Anyone can view interviewers availability" ON public.interview_interviewers
    FOR SELECT USING (true);

-- Subscription requests: users read their own
CREATE POLICY "Users read own subscription requests" ON public.subscription_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subscription requests" ON public.subscription_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins and Superadmins have full management access
CREATE POLICY "Admins manage all interview answers" ON public.interview_answers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
    );

CREATE POLICY "Admins manage all interview events" ON public.interview_events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
    );

CREATE POLICY "Admins manage all interview centers" ON public.interview_centers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
    );

CREATE POLICY "Admins manage all interview locations" ON public.interview_locations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
    );

CREATE POLICY "Admins manage interviewers" ON public.interview_interviewers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
    );

CREATE POLICY "Superadmins manage subscription requests" ON public.subscription_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
    );

CREATE POLICY "Superadmins read audit logs" ON public.subscription_audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
    );
