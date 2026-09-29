-- =============================================================================
-- Migration 034: Smart Navbar Tool Discovery & Real Completion Aggregations
-- Saarvi — Study. Work. Grow.
-- =============================================================================
-- 1. Accelerates navigation ranking aggregations on platform_events.
-- 2. Adds composite indexes for instant category filtering and featured ranking.
-- 3. Provides authoritative get_smart_navigation_ranking RPC.
-- =============================================================================

-- 1. ACCELERATION INDEXES ON PLATFORM_EVENTS
CREATE INDEX IF NOT EXISTS idx_platform_events_completion_ranking
    ON public.platform_events(created_at DESC, tool_key)
    WHERE event_name = 'tool_completed' AND success = TRUE;

CREATE INDEX IF NOT EXISTS idx_platform_events_unique_users
    ON public.platform_events(tool_key, user_id, created_at DESC)
    WHERE user_id IS NOT NULL AND success = TRUE;

-- 2. ACCELERATION INDEXES ON NAVIGATION_CONFIGS
CREATE INDEX IF NOT EXISTS idx_navigation_configs_featured_pos
    ON public.navigation_configs(category_id, featured, position);

CREATE INDEX IF NOT EXISTS idx_navigation_configs_visibility
    ON public.navigation_configs(category_id, visible_in_navbar, visible_in_mega_menu);

-- 3. AUTHORITATIVE DATABASE RPC FOR SMART NAVIGATION RANKING
CREATE OR REPLACE FUNCTION public.get_smart_navigation_ranking(p_period_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    IF p_period_days <= 0 THEN
        v_start_time := '1970-01-01 00:00:00+00'::TIMESTAMPTZ;
    ELSE
        v_start_time := NOW() - (p_period_days || ' days')::INTERVAL;
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'toolKey', tool_k,
            'successfulUses', succ_cnt,
            'uniqueUsers', unique_u,
            'uniqueGuestSessions', unique_gst,
            'lastUsedAt', last_used
        ) ORDER BY succ_cnt DESC
    ) INTO v_result
    FROM (
        SELECT
            tool_key AS tool_k,
            COUNT(*) FILTER (WHERE event_name = 'tool_completed' AND success = TRUE) AS succ_cnt,
            COUNT(DISTINCT user_id) FILTER (WHERE success = TRUE AND user_id IS NOT NULL) AS unique_u,
            COUNT(DISTINCT guest_session_id) FILTER (WHERE success = TRUE AND guest_session_id IS NOT NULL) AS unique_gst,
            MAX(created_at) AS last_used
        FROM public.platform_events
        WHERE created_at >= v_start_time
          AND tool_key IS NOT NULL
          AND success = TRUE
          AND event_name = 'tool_completed'
        GROUP BY tool_key
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_smart_navigation_ranking(INT) TO anon, authenticated, service_role;
