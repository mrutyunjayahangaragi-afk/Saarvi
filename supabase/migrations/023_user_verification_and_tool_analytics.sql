-- =============================================================================
-- SAARVI MIGRATION 023: USER REGISTRATION LIFECYCLE, REAL TOOL TELEMETRY & FEEDBACK
-- =============================================================================
-- 1. Hardens profile registration lifecycle: pending until email confirmed
-- 2. Creates authoritative public.feedback table with RLS
-- 3. Updates get_admin_dashboard_summary to strictly count ACTIVE verified users
-- 4. Updates get_user_growth_aggregate & get_tool_overview_telemetry
-- =============================================================================

-- 1. HARDEN PROFILES STATUS CONSTRAINT & REGISTRATION TRIGGER
DO $$
BEGIN
    ALTER TABLE IF EXISTS public.profiles
        DROP CONSTRAINT IF EXISTS profiles_status_check;

    ALTER TABLE IF EXISTS public.profiles
        ADD CONSTRAINT profiles_status_check
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING', 'PENDING_EMAIL_VERIFICATION'));
END $$;

-- Update handle_new_user() trigger function:
-- Google OAuth users (pre-verified) start ACTIVE.
-- Email/password signups with NULL email_confirmed_at start PENDING_EMAIL_VERIFICATION.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_is_superadmin BOOLEAN;
    v_initial_status TEXT;
    v_provider TEXT;
BEGIN
    v_is_superadmin := (LOWER(COALESCE(NEW.email, '')) = 'muttuhangaragi161@gmail.com');
    v_provider := LOWER(COALESCE(NEW.raw_app_meta_data->>'provider', 'email'));

    -- Determine initial status:
    -- If Google OAuth or email is already confirmed at insertion -> ACTIVE
    -- Else -> PENDING_EMAIL_VERIFICATION
    IF v_provider = 'google' OR NEW.email_confirmed_at IS NOT NULL OR NEW.confirmed_at IS NOT NULL THEN
        v_initial_status := 'ACTIVE';
    ELSE
        v_initial_status := 'PENDING_EMAIL_VERIFICATION';
    END IF;

    INSERT INTO public.profiles (id, full_name, avatar_url, role, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        CASE WHEN v_is_superadmin THEN 'SUPER_ADMIN' ELSE 'USER' END,
        v_initial_status
    )
    ON CONFLICT (id) DO UPDATE
        SET role = CASE WHEN v_is_superadmin THEN 'SUPER_ADMIN' ELSE public.profiles.role END;

    INSERT INTO public.user_preferences (user_id, auto_download, theme)
    VALUES (NEW.id, TRUE, 'light')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Trigger to automatically activate profile upon email verification
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
       OR (NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL) THEN
        UPDATE public.profiles
        SET status = 'ACTIVE',
            updated_at = NOW()
        WHERE id = NEW.id
          AND status IN ('PENDING', 'PENDING_EMAIL_VERIFICATION');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
    AFTER UPDATE OF email_confirmed_at, confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_email_confirmed();


-- 2. AUTHORITATIVE USER FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    category TEXT NOT NULL CHECK (category IN (
        'General', 'Bug', 'Tool Issue', 'Feature Request', 'Performance', 'Privacy', 'Payment', 'Other'
    )),
    message TEXT NOT NULL,
    tool_key TEXT,
    page_url TEXT,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_REVIEW', 'RESOLVED', 'ARCHIVED')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_tool_key ON public.feedback(tool_key);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);

-- Enable RLS on feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone (authenticated or anonymous) to insert feedback
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
CREATE POLICY "Anyone can insert feedback" ON public.feedback
    FOR INSERT WITH CHECK (true);

-- Users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can read and manage all feedback
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


-- 3. UPGRADE ADMIN DASHBOARD SUMMARY (STRICT ACTIVE USER DEFINITION)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary(p_period_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_start_time TIMESTAMPTZ := NOW() - (p_period_days || ' days')::INTERVAL;
    v_prev_start_time TIMESTAMPTZ := NOW() - (p_period_days * 2 || ' days')::INTERVAL;
    v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
    
    v_total_users INT := 0;
    v_new_users INT := 0;
    v_previous_new_users INT := 0;
    v_pending_users INT := 0;
    v_pro_users INT := 0;
    v_suspended_users INT := 0;
    v_active_users INT := 0;
    v_today_activity INT := 0;
    v_open_errors INT := 0;
    v_trend_pct NUMERIC := 0;
    v_trend_diff INT := 0;
BEGIN
    -- Authoritative Active Users: ONLY count profiles with status = 'ACTIVE'
    SELECT COUNT(*) INTO v_total_users 
    FROM public.profiles 
    WHERE status = 'ACTIVE';
    
    SELECT COUNT(*) INTO v_new_users 
    FROM public.profiles 
    WHERE status = 'ACTIVE' AND created_at >= v_start_time;
    
    SELECT COUNT(*) INTO v_previous_new_users 
    FROM public.profiles 
    WHERE status = 'ACTIVE' AND created_at >= v_prev_start_time AND created_at < v_start_time;
    
    -- Pending unverified signups explicitly separated
    SELECT COUNT(*) INTO v_pending_users
    FROM public.profiles
    WHERE status IN ('PENDING', 'PENDING_EMAIL_VERIFICATION');

    SELECT COUNT(*) INTO v_pro_users 
    FROM public.profiles 
    WHERE plan = 'PRO' AND status = 'ACTIVE';
    
    SELECT COUNT(*) INTO v_suspended_users 
    FROM public.profiles 
    WHERE status = 'SUSPENDED';

    -- Active users: distinct verified active users with telemetry in period
    SELECT COUNT(DISTINCT pe.user_id) INTO v_active_users
    FROM public.platform_events pe
    INNER JOIN public.profiles pr ON pr.id = pe.user_id
    WHERE pe.created_at >= v_start_time 
      AND pe.user_id IS NOT NULL
      AND pr.status = 'ACTIVE';
    
    -- Fallback active users to profiles with recent update if platform_events is sparse
    IF v_active_users = 0 THEN
        SELECT COUNT(*) INTO v_active_users
        FROM public.profiles
        WHERE status = 'ACTIVE' AND updated_at >= v_start_time;
    END IF;

    -- Today activity count
    SELECT COUNT(*) INTO v_today_activity
    FROM public.platform_events
    WHERE created_at >= v_today_start;

    -- Open errors
    SELECT COUNT(*) INTO v_open_errors
    FROM public.system_errors
    WHERE status = 'NEW';

    -- Trend calculations
    v_trend_diff := v_new_users - v_previous_new_users;
    IF v_previous_new_users > 0 THEN
        v_trend_pct := ROUND(((v_trend_diff::NUMERIC / v_previous_new_users::NUMERIC) * 100), 1);
    ELSIF v_new_users > 0 THEN
        v_trend_pct := 100.0;
    ELSE
        v_trend_pct := 0.0;
    END IF;

    RETURN jsonb_build_object(
        'totalUsers', v_total_users,
        'newUsers', v_new_users,
        'previousPeriodNewUsers', v_previous_new_users,
        'newUsersChangePct', v_trend_pct,
        'newUsersDiff', v_trend_diff,
        'activeUsers', v_active_users,
        'pendingUsers', v_pending_users,
        'freeUsers', GREATEST(0, v_total_users - v_pro_users),
        'proUsers', v_pro_users,
        'suspendedUsers', v_suspended_users,
        'todayActivity', v_today_activity,
        'openErrorsCount', v_open_errors,
        'systemStatus', CASE WHEN v_open_errors > 10 THEN 'Critical' WHEN v_open_errors > 2 THEN 'Warning' ELSE 'Healthy' END,
        'generatedAt', NOW()
    );
END;
$$;


-- 4. UPGRADE USER GROWTH TIME SERIES AGGREGATE RPC
CREATE OR REPLACE FUNCTION public.get_user_growth_aggregate(p_period_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_start_time TIMESTAMPTZ := NOW() - (p_period_days || ' days')::INTERVAL;
    v_trunc_unit TEXT := CASE WHEN p_period_days > 90 THEN 'week' ELSE 'day' END;
    v_series JSONB;
    v_status_dist JSONB;
    v_total_users INT;
    v_active_users INT;
    v_pending_users INT;
    v_suspended_users INT;
BEGIN
    -- Aggregated series for verified ACTIVE users only
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', TO_CHAR(grp_date, 'YYYY-MM-DD'),
            'label', TO_CHAR(grp_date, 'Mon DD'),
            'newUsers', count_val,
            'cumulative', SUM(count_val) OVER (ORDER BY grp_date)
        )
    ) INTO v_series
    FROM (
        SELECT 
            DATE_TRUNC(v_trunc_unit, created_at) AS grp_date,
            COUNT(*) AS count_val
        FROM public.profiles
        WHERE created_at >= v_start_time AND status = 'ACTIVE'
        GROUP BY grp_date
        ORDER BY grp_date ASC
    ) sub;

    -- Account status distribution
    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    SELECT COUNT(*) INTO v_active_users FROM public.profiles WHERE status = 'ACTIVE';
    SELECT COUNT(*) INTO v_pending_users FROM public.profiles WHERE status IN ('PENDING', 'PENDING_EMAIL_VERIFICATION');
    SELECT COUNT(*) INTO v_suspended_users FROM public.profiles WHERE status = 'SUSPENDED';

    v_status_dist := jsonb_build_array(
        jsonb_build_object(
            'label', 'Active',
            'count', v_active_users,
            'color', '#10b981',
            'percentage', CASE WHEN v_total_users > 0 THEN ROUND((v_active_users::NUMERIC / v_total_users) * 100) ELSE 0 END
        ),
        jsonb_build_object(
            'label', 'Pending Email Verification',
            'count', v_pending_users,
            'color', '#6366f1',
            'percentage', CASE WHEN v_total_users > 0 THEN ROUND((v_pending_users::NUMERIC / v_total_users) * 100) ELSE 0 END
        ),
        jsonb_build_object(
            'label', 'Suspended',
            'count', v_suspended_users,
            'color', '#f59e0b',
            'percentage', CASE WHEN v_total_users > 0 THEN ROUND((v_suspended_users::NUMERIC / v_total_users) * 100) ELSE 0 END
        )
    );

    RETURN jsonb_build_object(
        'series', COALESCE(v_series, '[]'::jsonb),
        'accountStatusDist', v_status_dist
    );
END;
$$;


-- 5. UPGRADE TOOL OVERVIEW TELEMETRY (AUTHORITATIVE TOOL COMPLETION EVENTS)
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
            'uniqueUsers', unique_u,
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
            COUNT(*) FILTER (WHERE (event_name = 'tool_error' OR event_name = 'tool_execution') AND success = FALSE) AS fail_cnt,
            COUNT(DISTINCT user_id) FILTER (WHERE success = TRUE) AS unique_u,
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
