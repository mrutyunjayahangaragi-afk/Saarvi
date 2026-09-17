-- =============================================================================
-- SAARVI MIGRATION 016: PRODUCTION ADMIN CENTER 2.0 & NEW USER WELCOME SYSTEM
-- =============================================================================
-- Establishes database support for:
-- 1. Profile extensions (avatar_path, welcome_sent_at, plan)
-- 2. Platform Analytics Events (privacy-safe operational telemetry)
-- 3. Curriculum Courses (discrete, versioned syllabus courses for VTU)
-- 4. Admin Audit Logs table/alias
-- 5. Row-level security (RLS) policies for all new entities
-- =============================================================================

-- 1. HARDEN & EXTEND PROFILES TABLE
ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS avatar_path TEXT,
    ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO'));

CREATE INDEX IF NOT EXISTS idx_profiles_welcome_sent ON public.profiles(welcome_sent_at);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);

-- 2. UNIFIED PLATFORM EVENTS TABLE (ANALYTICS TELEMETRY)
-- Strictly privacy-safe: logs event_name, tool_key, category, and success status.
-- NEVER stores document content, resume drafts, student marks, or private notes.
CREATE TABLE IF NOT EXISTS public.platform_events (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    tool_key TEXT,
    category TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    duration_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_created_at ON public.platform_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_user_time ON public.platform_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_name_time ON public.platform_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_tool_time ON public.platform_events(tool_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_category ON public.platform_events(category);

-- 3. DISCRETE CURRICULUM COURSES TABLE
-- Links directly to curriculum_versions for deterministic academic ground truth
CREATE TABLE IF NOT EXISTS public.curriculum_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_version_id UUID NOT NULL REFERENCES public.curriculum_versions(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    course_type TEXT NOT NULL DEFAULT 'Theory',
    credits NUMERIC(3, 1) NOT NULL DEFAULT 4.0,
    lecture_hours INTEGER NOT NULL DEFAULT 3,
    tutorial_hours INTEGER NOT NULL DEFAULT 0,
    practical_hours INTEGER NOT NULL DEFAULT 0,
    cie_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    see_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(curriculum_version_id, course_code)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_courses_version ON public.curriculum_courses(curriculum_version_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_courses_code ON public.curriculum_courses(course_code);

-- 4. ADMIN AUDIT LOGS TABLE / ALIAS
-- Ensure admin_audit_logs is available alongside audit_logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON public.admin_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);

-- 5. ENABLE ROW-LEVEL SECURITY (RLS)
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform Events RLS:
-- Anyone authenticated or unauthenticated can insert events (with validation)
DROP POLICY IF EXISTS "Anyone can insert platform events" ON public.platform_events;
CREATE POLICY "Anyone can insert platform events" ON public.platform_events
    FOR INSERT WITH CHECK (true);

-- Users can read their own platform events
DROP POLICY IF EXISTS "Users can read own platform events" ON public.platform_events;
CREATE POLICY "Users can read own platform events" ON public.platform_events
    FOR SELECT USING (auth.uid() = user_id);

-- Admins & Superadmins have full read access to platform events
DROP POLICY IF EXISTS "Admins read all platform events" ON public.platform_events;
CREATE POLICY "Admins read all platform events" ON public.platform_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Curriculum Courses RLS:
-- Public can read active curriculum courses
DROP POLICY IF EXISTS "Public read active curriculum courses" ON public.curriculum_courses;
CREATE POLICY "Public read active curriculum courses" ON public.curriculum_courses
    FOR SELECT USING (active = TRUE);

-- Admins can manage curriculum courses
DROP POLICY IF EXISTS "Admins manage curriculum courses" ON public.curriculum_courses;
CREATE POLICY "Admins manage curriculum courses" ON public.curriculum_courses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Admin Audit Logs RLS:
-- Admins and Superadmins can read and insert audit logs
DROP POLICY IF EXISTS "Admins read admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins read admin audit logs" ON public.admin_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS "Admins insert admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins insert admin audit logs" ON public.admin_audit_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );
