-- =============================================================================
-- SAARVI MIGRATION 024: CANONICAL TOOL USAGE TELEMETRY & ACADEMIC SUBJECT PIPELINE
-- =============================================================================
-- 1. Enhances public.platform_events with user_type, guest_session_id, and operation_id.
-- 2. Adds unique index on (operation_id, tool_key) to enforce database-level idempotency.
-- 3. Adds authoritative academic_subjects table with source verification & conflict metadata.
-- 4. Creates subject_conflicts table for administrative review of conflicting sources.
-- 5. Updates get_tool_overview_telemetry to accurately segment guest vs authenticated usage.
-- 6. Updates get_user_tool_usage_summary to query canonical platform events.
-- =============================================================================

-- 1. ENHANCE PLATFORM_EVENTS TABLE
DO $$
BEGIN
    -- Add user_type column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_events' AND column_name = 'user_type'
    ) THEN
        ALTER TABLE public.platform_events 
        ADD COLUMN user_type TEXT NOT NULL DEFAULT 'authenticated' 
        CHECK (user_type IN ('authenticated', 'guest'));
    END IF;

    -- Add guest_session_id column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_events' AND column_name = 'guest_session_id'
    ) THEN
        ALTER TABLE public.platform_events 
        ADD COLUMN guest_session_id TEXT;
    END IF;

    -- Add operation_id column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_events' AND column_name = 'operation_id'
    ) THEN
        ALTER TABLE public.platform_events 
        ADD COLUMN operation_id TEXT;
    END IF;
END $$;

-- Enforce strict database-level idempotency: same operation_id + tool_key cannot be counted twice
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_events_operation_tool 
    ON public.platform_events(operation_id, tool_key) 
    WHERE operation_id IS NOT NULL;

-- Telemetry acceleration indexes
CREATE INDEX IF NOT EXISTS idx_platform_events_guest_session 
    ON public.platform_events(guest_session_id) 
    WHERE guest_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_events_user_type_time 
    ON public.platform_events(user_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_tool_user_type 
    ON public.platform_events(tool_key, user_type, success, created_at DESC);


-- 2. AUTHORITATIVE ACADEMIC SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.academic_subjects (
    id TEXT PRIMARY KEY, -- e.g. "vtu_2022_cse_sem3_21cs32"
    university_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 12),
    academic_year TEXT NOT NULL DEFAULT '2022-2026',
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    credits NUMERIC(3, 1) NOT NULL CHECK (credits >= 0),
    course_type TEXT NOT NULL DEFAULT 'Theory' CHECK (course_type IN ('Theory', 'Lab', 'Practical', 'Project', 'Activity', 'Other')),
    see_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    cie_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    source_type TEXT NOT NULL DEFAULT 'OFFICIAL_CURRICULUM_PDF' CHECK (source_type IN (
        'OFFICIAL_UNIVERSITY_WEBSITE',
        'OFFICIAL_CURRICULUM_PDF',
        'OFFICIAL_UNIVERSITY_API',
        'VERIFIED_ACADEMIC_DATASET',
        'MANUAL_ADMIN_ENTRY'
    )),
    source_url TEXT,
    source_document TEXT,
    verification_status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN (
        'VERIFIED',
        'UNVERIFIED',
        'DISPUTED',
        'CONFLICT_REQUIRES_REVIEW',
        'REJECTED'
    )),
    conflict_details JSONB DEFAULT NULL,
    audit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_academic_subject_scope UNIQUE(university_id, scheme_id, branch_id, semester, subject_code)
);

CREATE INDEX IF NOT EXISTS idx_academic_subjects_scope 
    ON public.academic_subjects(university_id, scheme_id, branch_id, semester);
CREATE INDEX IF NOT EXISTS idx_academic_subjects_code 
    ON public.academic_subjects(subject_code);
CREATE INDEX IF NOT EXISTS idx_academic_subjects_status 
    ON public.academic_subjects(verification_status);

-- Enable RLS on academic_subjects
ALTER TABLE public.academic_subjects ENABLE ROW LEVEL SECURITY;

-- Anyone can read verified academic subjects
DROP POLICY IF EXISTS "Anyone can read verified academic subjects" ON public.academic_subjects;
CREATE POLICY "Anyone can read verified academic subjects"
    ON public.academic_subjects FOR SELECT
    USING (verification_status = 'VERIFIED' OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = auth.uid()
        AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    ));

-- Admins can manage all academic subjects
DROP POLICY IF EXISTS "Admins manage academic subjects" ON public.academic_subjects;
CREATE POLICY "Admins manage academic subjects"
    ON public.academic_subjects FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );


-- 3. ACADEMIC SUBJECT CONFLICTS TABLE (FOR ADMIN REVIEW QUEUE)
CREATE TABLE IF NOT EXISTS public.academic_subject_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_code TEXT NOT NULL,
    subject_id TEXT REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
    university_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    semester INTEGER NOT NULL,
    existing_source TEXT NOT NULL,
    existing_data JSONB NOT NULL,
    conflicting_source TEXT NOT NULL,
    conflicting_data JSONB NOT NULL,
    resolution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (resolution_status IN ('PENDING', 'RESOLVED', 'REJECTED')),
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_conflicts_status ON public.academic_subject_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_subject_conflicts_code ON public.academic_subject_conflicts(subject_code);

ALTER TABLE public.academic_subject_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage subject conflicts" ON public.academic_subject_conflicts;
CREATE POLICY "Admins manage subject conflicts"
    ON public.academic_subject_conflicts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );


-- 4. UPGRADE TOOL OVERVIEW TELEMETRY RPC (AUTHENTICATED VS GUEST SEGMENTATION)
CREATE OR REPLACE FUNCTION public.get_tool_overview_telemetry(p_period_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_start_time TIMESTAMPTZ := CASE 
        WHEN p_period_days <= 0 THEN '1970-01-01'::TIMESTAMPTZ
        ELSE NOW() - (p_period_days || ' days')::INTERVAL
    END;
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'toolKey', tool_k,
            'totalUses', succ_cnt,
            'authenticatedUses', auth_succ_cnt,
            'guestUses', guest_succ_cnt,
            'uniqueUsers', unique_u,
            'uniqueGuestSessions', unique_gst,
            'successfulOperations', succ_cnt,
            'failedOperations', fail_cnt,
            'successRate', CASE 
                WHEN (succ_cnt + fail_cnt) > 0 
                THEN ROUND((succ_cnt::NUMERIC / (succ_cnt + fail_cnt)::NUMERIC) * 100, 1) 
                ELSE 100.0 
            END,
            'avgDurationMs', ROUND(COALESCE(avg_dur, 0)::NUMERIC, 0),
            'p95DurationMs', ROUND(COALESCE(p95_dur, 0)::NUMERIC, 0),
            'lastUsedAt', last_used
        )
    ) INTO v_result
    FROM (
        SELECT 
            tool_key AS tool_k,
            COUNT(*) FILTER (WHERE (event_name = 'tool_completed' OR event_name = 'tool_execution') AND success = TRUE) AS succ_cnt,
            COUNT(*) FILTER (WHERE (event_name = 'tool_completed' OR event_name = 'tool_execution') AND success = TRUE AND (user_type = 'authenticated' OR user_id IS NOT NULL)) AS auth_succ_cnt,
            COUNT(*) FILTER (WHERE (event_name = 'tool_completed' OR event_name = 'tool_execution') AND success = TRUE AND user_type = 'guest' AND user_id IS NULL) AS guest_succ_cnt,
            COUNT(*) FILTER (WHERE (event_name = 'tool_error' OR event_name = 'tool_cancelled' OR event_name = 'tool_execution') AND success = FALSE) AS fail_cnt,
            COUNT(DISTINCT user_id) FILTER (WHERE success = TRUE AND user_id IS NOT NULL) AS unique_u,
            COUNT(DISTINCT guest_session_id) FILTER (WHERE success = TRUE AND guest_session_id IS NOT NULL) AS unique_gst,
            AVG(duration_ms) FILTER (WHERE duration_ms > 0 AND success = TRUE) AS avg_dur,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms > 0 AND success = TRUE) AS p95_dur,
            MAX(created_at) AS last_used
        FROM public.platform_events
        WHERE created_at >= v_start_time
          AND tool_key IS NOT NULL
        GROUP BY tool_key
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- 5. UPGRADE USER TOOL USAGE BREAKDOWN RPC
CREATE OR REPLACE FUNCTION public.get_user_tool_usage_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_total_ops INT := 0;
    v_unique_tools INT := 0;
    v_succ_ops INT := 0;
    v_fail_ops INT := 0;
    v_success_rate NUMERIC := 100.0;
    v_most_used TEXT := 'None';
    v_last_used TEXT := 'None';
    v_last_activity TIMESTAMPTZ;
    v_tool_breakdown JSONB;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(DISTINCT tool_key),
        COUNT(*) FILTER (WHERE success = TRUE),
        COUNT(*) FILTER (WHERE success = FALSE),
        MAX(created_at)
    INTO v_total_ops, v_unique_tools, v_succ_ops, v_fail_ops, v_last_activity
    FROM public.platform_events
    WHERE user_id = p_user_id 
      AND tool_key IS NOT NULL
      AND (event_name = 'tool_completed' OR event_name = 'tool_execution' OR event_name = 'tool_error');

    IF v_total_ops > 0 THEN
        v_success_rate := ROUND((v_succ_ops::NUMERIC / v_total_ops::NUMERIC) * 100, 1);
        
        -- Most used tool (by successful completions)
        SELECT tool_key INTO v_most_used
        FROM public.platform_events
        WHERE user_id = p_user_id 
          AND tool_key IS NOT NULL
          AND success = TRUE
        GROUP BY tool_key
        ORDER BY COUNT(*) DESC
        LIMIT 1;

        -- Last used tool
        SELECT tool_key INTO v_last_used
        FROM public.platform_events
        WHERE user_id = p_user_id AND tool_key IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    -- Breakdown by tool
    SELECT jsonb_agg(
        jsonb_build_object(
            'toolKey', tool_key,
            'totalUses', COUNT(*),
            'successfulUses', COUNT(*) FILTER (WHERE success = TRUE),
            'failedUses', COUNT(*) FILTER (WHERE success = FALSE),
            'lastUsedAt', MAX(created_at)
        ) ORDER BY COUNT(*) FILTER (WHERE success = TRUE) DESC
    ) INTO v_tool_breakdown
    FROM public.platform_events
    WHERE user_id = p_user_id AND tool_key IS NOT NULL
    GROUP BY tool_key;

    RETURN jsonb_build_object(
        'totalOperations', v_total_ops,
        'uniqueTools', v_unique_tools,
        'mostUsedTool', COALESCE(v_most_used, 'None'),
        'lastUsedTool', COALESCE(v_last_used, 'None'),
        'lastActivity', v_last_activity,
        'successRate', v_success_rate,
        'tools', COALESCE(v_tool_breakdown, '[]'::jsonb)
    );
END;
$$;
