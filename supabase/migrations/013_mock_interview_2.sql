-- ============================================================
-- SAARVI MIGRATION 013: MOCK INTERVIEW 2.0
-- 
-- System:
-- 1. interview_questions: Authoritative question bank with company attribution
-- 2. interview_sessions: Full session transcripts & proctoring logs
-- 3. interview_settings: Default timers and proctoring parameters
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interview_questions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    type TEXT NOT NULL, -- 'mcq', 'behavioral', 'technical_coding', 'system_design'
    difficulty TEXT NOT NULL, -- 'Easy', 'Medium', 'Hard'
    company TEXT NOT NULL, -- 'Google', 'Microsoft', 'Amazon', 'Infosys', 'TCS', 'Wipro', 'Accenture', 'General'
    question TEXT NOT NULL,
    options JSONB, -- array of strings for MCQ
    correct_answer INTEGER, -- index for MCQ (hidden from client during active test)
    explanation TEXT,
    rubric JSONB, -- evaluation criteria & sample answer
    time_limit_seconds INTEGER NOT NULL DEFAULT 90,
    exposure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_role_comp ON public.interview_questions(role, company);
CREATE INDEX IF NOT EXISTS idx_interview_questions_type ON public.interview_questions(type);

CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mode TEXT NOT NULL, -- 'text_mcq', 'live_video'
    role TEXT NOT NULL,
    company TEXT,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    responses JSONB NOT NULL DEFAULT '[]'::jsonb,
    overall_score NUMERIC NOT NULL DEFAULT 0,
    proctoring_violations JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'terminated_proctoring'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON public.interview_sessions(status);

CREATE TABLE IF NOT EXISTS public.interview_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.interview_settings (key, value)
VALUES 
    ('general', jsonb_build_object(
        'defaultMcqTimeLimitSeconds', 60,
        'defaultVideoTimeLimitSeconds', 120,
        'maxProctoringWarnings', 4,
        'enableCameraDeviceCheck', true,
        'enableAiTtsFallback', true
    ))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Enable RLS
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_settings ENABLE ROW LEVEL SECURITY;

-- Questions: anyone authenticated can read; admin can manage
DROP POLICY IF EXISTS "Public interview questions read" ON public.interview_questions;
CREATE POLICY "Public interview questions read" ON public.interview_questions
    FOR SELECT USING (true);

-- Sessions: users read/write their own; service role full access
DROP POLICY IF EXISTS "Users read own sessions" ON public.interview_sessions;
CREATE POLICY "Users read own sessions" ON public.interview_sessions
    FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'guest');

DROP POLICY IF EXISTS "Users insert own sessions" ON public.interview_sessions;
CREATE POLICY "Users insert own sessions" ON public.interview_sessions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'guest');

DROP POLICY IF EXISTS "Users update own sessions" ON public.interview_sessions;
CREATE POLICY "Users update own sessions" ON public.interview_sessions
    FOR UPDATE USING (auth.uid()::text = user_id OR user_id = 'guest');

-- Settings: read accessible
DROP POLICY IF EXISTS "Settings read" ON public.interview_settings;
CREATE POLICY "Settings read" ON public.interview_settings
    FOR SELECT USING (true);
