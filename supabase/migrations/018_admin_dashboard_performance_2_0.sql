-- =========================================================================
-- SAARVI ADMIN DASHBOARD PERFORMANCE 2.0
-- Database Aggregations, Indexes & RPCs for Ultra-Fast Analytics
-- =========================================================================

-- 1. INDEXES FOR HIGH-VELOCITY ANALYTICS
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_created ON public.profiles(plan, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_status_created ON public.profiles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_created_name ON public.platform_events(created_at DESC, event_name);
CREATE INDEX IF NOT EXISTS idx_platform_events_created_success ON public.platform_events(created_at DESC, success);
CREATE INDEX IF NOT EXISTS idx_system_errors_timestamp ON public.system_errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_severity_time ON public.system_errors(severity, timestamp DESC);

-- 2. P0: FAST DASHBOARD SUMMARY AGGREGATE RPC
-- Returns counts in a single database round-trip (<15ms)
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
    v_pro_users INT := 0;
    v_suspended_users INT := 0;
    v_active_users INT := 0;
    v_today_activity INT := 0;
    v_open_errors INT := 0;
    v_trend_pct NUMERIC := 0;
    v_trend_diff INT := 0;
BEGIN
    -- User counts from profiles
    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    
    SELECT COUNT(*) INTO v_new_users 
    FROM public.profiles 
    WHERE created_at >= v_start_time;
    
    SELECT COUNT(*) INTO v_previous_new_users 
    FROM public.profiles 
    WHERE created_at >= v_prev_start_time AND created_at < v_start_time;
    
    SELECT COUNT(*) INTO v_pro_users 
    FROM public.profiles 
    WHERE plan = 'PRO';
    
    SELECT COUNT(*) INTO v_suspended_users 
    FROM public.profiles 
    WHERE status = 'SUSPENDED';

    -- Active users: distinct active in period
    SELECT COUNT(DISTINCT user_id) INTO v_active_users
    FROM public.platform_events
    WHERE created_at >= v_start_time AND user_id IS NOT NULL;
    
    -- Fallback active users to profiles with recent update if platform_events is sparse
    IF v_active_users = 0 THEN
        SELECT COUNT(*) INTO v_active_users
        FROM public.profiles
        WHERE updated_at >= v_start_time;
    END IF;

    -- Today activity count
    SELECT COUNT(*) INTO v_today_activity
    FROM public.platform_events
    WHERE created_at >= v_today_start;
    
    -- If platform_events is empty, check analytics_events
    IF v_today_activity = 0 THEN
        SELECT COUNT(*) INTO v_today_activity
        FROM public.analytics_events
        WHERE created_at >= v_today_start;
    END IF;

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

-- 3. P1: USER GROWTH TIME SERIES AGGREGATE RPC
-- Returns pre-grouped daily or weekly new user counts and cumulative sums
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
    v_suspended_users INT;
BEGIN
    -- Aggregated series
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
        WHERE created_at >= v_start_time
        GROUP BY grp_date
        ORDER BY grp_date ASC
    ) sub;

    -- Account status distribution
    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    SELECT COUNT(*) INTO v_active_users FROM public.profiles WHERE status = 'ACTIVE';
    SELECT COUNT(*) INTO v_suspended_users FROM public.profiles WHERE status = 'SUSPENDED';

    v_status_dist := jsonb_build_array(
        jsonb_build_object(
            'label', 'Active',
            'count', v_active_users,
            'color', '#10b981',
            'percentage', CASE WHEN v_total_users > 0 THEN ROUND((v_active_users::NUMERIC / v_total_users) * 100) ELSE 0 END
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

-- 4. P1: PLATFORM ACTIVITY TIME SERIES & TOP TOOLS RPC
-- Adaptive grouping: hourly for <=1 day, daily for <=90 days, weekly for >90 days
CREATE OR REPLACE FUNCTION public.get_platform_activity_aggregate(
    p_period_days INT DEFAULT 30,
    p_category TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_start_time TIMESTAMPTZ := NOW() - (p_period_days || ' days')::INTERVAL;
    v_trunc_unit TEXT := CASE 
        WHEN p_period_days <= 1 THEN 'hour'
        WHEN p_period_days > 90 THEN 'week'
        ELSE 'day' 
    END;
    v_date_format TEXT := CASE
        WHEN p_period_days <= 1 THEN 'HH24:00'
        ELSE 'Mon DD'
    END;
    
    v_total_events INT := 0;
    v_success_count INT := 0;
    v_error_count INT := 0;
    v_success_rate NUMERIC := 100.0;
    v_series JSONB;
    v_top_tools JSONB;
BEGIN
    -- Summary counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE success = TRUE),
        COUNT(*) FILTER (WHERE success = FALSE)
    INTO v_total_events, v_success_count, v_error_count
    FROM public.platform_events
    WHERE created_at >= v_start_time
      AND (p_category = 'all' OR category = p_category);

    -- Fallback to analytics_events if platform_events has no rows yet
    IF v_total_events = 0 THEN
        SELECT COUNT(*) INTO v_total_events
        FROM public.analytics_events
        WHERE created_at >= v_start_time;
        v_success_count := v_total_events;
    END IF;

    IF v_total_events > 0 THEN
        v_success_rate := ROUND(((v_success_count::NUMERIC / v_total_events::NUMERIC) * 100), 1);
    END IF;

    -- Time series
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', TO_CHAR(grp_date, 'YYYY-MM-DD"T"HH24:MI:SS'),
            'label', TO_CHAR(grp_date, v_date_format),
            'total', total_cnt,
            'success', succ_cnt,
            'error', err_cnt
        )
    ) INTO v_series
    FROM (
        SELECT 
            DATE_TRUNC(v_trunc_unit, created_at) AS grp_date,
            COUNT(*) AS total_cnt,
            COUNT(*) FILTER (WHERE success = TRUE) AS succ_cnt,
            COUNT(*) FILTER (WHERE success = FALSE) AS err_cnt
        FROM public.platform_events
        WHERE created_at >= v_start_time
          AND (p_category = 'all' OR category = p_category)
        GROUP BY grp_date
        ORDER BY grp_date ASC
    ) sub;

    -- If platform_events time series is empty, build from analytics_events
    IF v_series IS NULL OR jsonb_array_length(v_series) = 0 THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', TO_CHAR(grp_date, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'label', TO_CHAR(grp_date, v_date_format),
                'total', total_cnt,
                'success', total_cnt,
                'error', 0
            )
        ) INTO v_series
        FROM (
            SELECT 
                DATE_TRUNC(v_trunc_unit, created_at) AS grp_date,
                COUNT(*) AS total_cnt
            FROM public.analytics_events
            WHERE created_at >= v_start_time
            GROUP BY grp_date
            ORDER BY grp_date ASC
        ) sub;
    END IF;

    -- Top Tools
    SELECT jsonb_agg(
        jsonb_build_object(
            'toolKey', tool_k,
            'toolName', tool_k,
            'usageCount', total_cnt,
            'successCount', succ_cnt,
            'errorCount', err_cnt
        )
    ) INTO v_top_tools
    FROM (
        SELECT 
            COALESCE(tool_key, event_name) AS tool_k,
            COUNT(*) AS total_cnt,
            COUNT(*) FILTER (WHERE success = TRUE) AS succ_cnt,
            COUNT(*) FILTER (WHERE success = FALSE) AS err_cnt
        FROM public.platform_events
        WHERE created_at >= v_start_time
          AND (tool_key IS NOT NULL OR event_name IS NOT NULL)
        GROUP BY tool_k
        ORDER BY total_cnt DESC
        LIMIT 10
    ) sub;

    -- Fallback top tools from analytics_events
    IF v_top_tools IS NULL OR jsonb_array_length(v_top_tools) = 0 THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'toolKey', COALESCE(tool_slug, tool_id, 'unknown'),
                'toolName', COALESCE(tool_slug, tool_id, 'unknown'),
                'usageCount', total_cnt,
                'successCount', total_cnt,
                'errorCount', 0
            )
        ) INTO v_top_tools
        FROM (
            SELECT 
                COALESCE(tool_slug, tool_id) AS tool_s,
                tool_slug,
                tool_id,
                COUNT(*) AS total_cnt
            FROM public.analytics_events
            WHERE created_at >= v_start_time
              AND (tool_slug IS NOT NULL OR tool_id IS NOT NULL)
            GROUP BY tool_s, tool_slug, tool_id
            ORDER BY total_cnt DESC
            LIMIT 10
        ) sub;
    END IF;

    RETURN jsonb_build_object(
        'grouping', v_trunc_unit,
        'totalEvents', v_total_events,
        'successfulOperations', v_success_count,
        'failedOperations', v_error_count,
        'successRate', v_success_rate,
        'timeSeries', COALESCE(v_series, '[]'::jsonb),
        'topTools', COALESCE(v_top_tools, '[]'::jsonb)
    );
END;
$$;

-- 5. P2: ERROR ANALYTICS AGGREGATE RPC
CREATE OR REPLACE FUNCTION public.get_error_analytics_aggregate(p_period_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_start_time TIMESTAMPTZ := NOW() - (p_period_days || ' days')::INTERVAL;
    v_trunc_unit TEXT := CASE WHEN p_period_days > 90 THEN 'week' ELSE 'day' END;
    
    v_total_errors INT := 0;
    v_unresolved INT := 0;
    v_series JSONB;
    v_severity_dist JSONB;
    v_top_errors JSONB;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'NEW')
    INTO v_total_errors, v_unresolved
    FROM public.system_errors
    WHERE timestamp >= v_start_time;

    -- Time series
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', TO_CHAR(grp_date, 'YYYY-MM-DD'),
            'label', TO_CHAR(grp_date, 'Mon DD'),
            'count', err_cnt
        )
    ) INTO v_series
    FROM (
        SELECT 
            DATE_TRUNC(v_trunc_unit, timestamp) AS grp_date,
            COUNT(*) AS err_cnt
        FROM public.system_errors
        WHERE timestamp >= v_start_time
        GROUP BY grp_date
        ORDER BY grp_date ASC
    ) sub;

    -- Severity distribution
    SELECT jsonb_agg(
        jsonb_build_object(
            'label', sev,
            'count', cnt,
            'color', CASE 
                WHEN sev = 'CRITICAL' THEN '#ef4444'
                WHEN sev = 'ERROR' THEN '#f97316'
                WHEN sev = 'WARNING' THEN '#f59e0b'
                ELSE '#3b82f6'
            END
        )
    ) INTO v_severity_dist
    FROM (
        SELECT 
            severity AS sev,
            COUNT(*) AS cnt
        FROM public.system_errors
        WHERE timestamp >= v_start_time
        GROUP BY severity
        ORDER BY cnt DESC
    ) sub;

    -- Top errors
    SELECT jsonb_agg(
        jsonb_build_object(
            'errorCode', error_type,
            'feature', COALESCE(tool, service, 'system'),
            'count', cnt,
            'lastSeen', last_seen,
            'severity', max_sev
        )
    ) INTO v_top_errors
    FROM (
        SELECT 
            error_type,
            tool,
            service,
            COUNT(*) AS cnt,
            MAX(timestamp) AS last_seen,
            MAX(severity) AS max_sev
        FROM public.system_errors
        WHERE timestamp >= v_start_time
        GROUP BY error_type, tool, service
        ORDER BY cnt DESC
        LIMIT 10
    ) sub;

    RETURN jsonb_build_object(
        'totalErrors', v_total_errors,
        'unresolved', v_unresolved,
        'timeSeries', COALESCE(v_series, '[]'::jsonb),
        'severityDistribution', COALESCE(v_severity_dist, '[]'::jsonb),
        'topErrors', COALESCE(v_top_errors, '[]'::jsonb)
    );
END;
$$;
