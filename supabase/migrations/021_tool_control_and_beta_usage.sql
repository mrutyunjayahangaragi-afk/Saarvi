-- =============================================================================
-- SAARVI — PHASE 41: ADMIN TOOL CONTROL CENTER, BETA USAGE LIMITS & TELEMETRY
-- =============================================================================
-- Establishes server-authoritative tables for tool configurations, beta limits,
-- atomic usage reservation, and database-aggregated telemetry.

-- 1. TOOL ACCESS CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.tool_access_configs (
    tool_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BETA', 'COMING_SOON', 'DISABLED', 'MAINTENANCE')),
    access_mode TEXT NOT NULL DEFAULT 'FREE' CHECK (access_mode IN ('FREE', 'PRO')),
    beta_free_limit INTEGER NOT NULL DEFAULT 10,
    maintenance_message TEXT,
    rollout_percentage INTEGER DEFAULT 100,
    max_p95_duration_ms INTEGER DEFAULT 5000,
    max_error_rate_pct NUMERIC(5, 2) DEFAULT 5.0,
    worker_mode TEXT NOT NULL DEFAULT 'client' CHECK (worker_mode IN ('client', 'server', 'hybrid')),
    processing_type TEXT NOT NULL DEFAULT 'local' CHECK (processing_type IN ('local', 'server', 'mixed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_tool_access_configs_status ON public.tool_access_configs(status);
CREATE INDEX IF NOT EXISTS idx_tool_access_configs_access ON public.tool_access_configs(access_mode);

-- 2. TOOL BETA USAGE TABLE (SERVER-AUTHORITATIVE USAGE TRACKING)
CREATE TABLE IF NOT EXISTS public.tool_beta_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_key TEXT NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    reserved_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tool_beta_usage UNIQUE(user_id, tool_key)
);

CREATE INDEX IF NOT EXISTS idx_tool_beta_usages_user_tool ON public.tool_beta_usages(user_id, tool_key);
CREATE INDEX IF NOT EXISTS idx_tool_beta_usages_tool ON public.tool_beta_usages(tool_key);

-- 3. TELEMETRY ACCELERATION INDEXES ON PLATFORM_EVENTS
CREATE INDEX IF NOT EXISTS idx_platform_events_tool_success_time 
    ON public.platform_events(tool_key, success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_user_tool 
    ON public.platform_events(user_id, tool_key, created_at DESC);

-- 4. ROW-LEVEL SECURITY (RLS)
ALTER TABLE public.tool_access_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_beta_usages ENABLE ROW LEVEL SECURITY;

-- Tool Access Configs: Readable by everyone
DROP POLICY IF EXISTS "Anyone can read tool access configs" ON public.tool_access_configs;
CREATE POLICY "Anyone can read tool access configs"
    ON public.tool_access_configs FOR SELECT USING (true);

-- Tool Access Configs: Modifiable only by Admins / Super Admins
DROP POLICY IF EXISTS "Admins manage tool access configs" ON public.tool_access_configs;
CREATE POLICY "Admins manage tool access configs"
    ON public.tool_access_configs FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Beta Usages: Users can read their own usage
DROP POLICY IF EXISTS "Users can read own beta usage" ON public.tool_beta_usages;
CREATE POLICY "Users can read own beta usage"
    ON public.tool_beta_usages FOR SELECT USING (auth.uid() = user_id);

-- Beta Usages: Admins and Service Role can manage all
DROP POLICY IF EXISTS "Admins can manage beta usages" ON public.tool_beta_usages;
CREATE POLICY "Admins can manage beta usages"
    ON public.tool_beta_usages FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- 5. ATOMIC USAGE RESERVATION RPC (CONCURRENCY HARDENED)
-- Atomically checks if current usage + reserved < limit, locks the row, and increments reserved_count.
CREATE OR REPLACE FUNCTION public.atomic_reserve_beta_use(
    p_user_id UUID,
    p_tool_key TEXT,
    p_free_limit INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_usage INT := 0;
    v_reserved INT := 0;
    v_is_allowed BOOLEAN := FALSE;
    v_remaining INT := 0;
BEGIN
    -- Upsert row if it does not exist yet
    INSERT INTO public.tool_beta_usages (user_id, tool_key, usage_count, reserved_count, last_used_at, updated_at)
    VALUES (p_user_id, p_tool_key, 0, 0, NOW(), NOW())
    ON CONFLICT (user_id, tool_key) DO NOTHING;

    -- Row-level exclusive lock prevents race conditions
    SELECT usage_count, reserved_count 
    INTO v_usage, v_reserved
    FROM public.tool_beta_usages
    WHERE user_id = p_user_id AND tool_key = p_tool_key
    FOR UPDATE;

    IF (v_usage + v_reserved) < p_free_limit THEN
        UPDATE public.tool_beta_usages
        SET reserved_count = reserved_count + 1,
            last_used_at = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id AND tool_key = p_tool_key;
        
        v_is_allowed := TRUE;
        v_remaining := GREATEST(0, p_free_limit - (v_usage + v_reserved + 1));
    ELSE
        v_is_allowed := FALSE;
        v_remaining := 0;
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_is_allowed,
        'usageCount', v_usage,
        'reservedCount', CASE WHEN v_is_allowed THEN v_reserved + 1 ELSE v_reserved END,
        'freeLimit', p_free_limit,
        'remainingUses', v_remaining
    );
END;
$$;

-- 6. ATOMIC COMMIT BETA USE RPC
-- Commits the reservation into a finalized usage count upon successful operation.
CREATE OR REPLACE FUNCTION public.commit_beta_use(
    p_user_id UUID,
    p_tool_key TEXT,
    p_duration_ms INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_new_usage INT := 0;
BEGIN
    UPDATE public.tool_beta_usages
    SET usage_count = usage_count + 1,
        reserved_count = GREATEST(0, reserved_count - 1),
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id AND tool_key = p_tool_key
    RETURNING usage_count INTO v_new_usage;

    -- Also record safe operational platform event
    INSERT INTO public.platform_events (
        id, user_id, event_name, tool_key, success, duration_ms, created_at
    ) VALUES (
        'evt_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '_' || SUBSTRING(gen_random_uuid()::text, 1, 8),
        p_user_id,
        'tool_execution',
        p_tool_key,
        TRUE,
        p_duration_ms,
        NOW()
    );

    RETURN jsonb_build_object('success', TRUE, 'usageCount', v_new_usage);
END;
$$;

-- 7. ATOMIC RELEASE BETA USE RPC
-- Releases the reserved count without incrementing usage if an operation fails.
CREATE OR REPLACE FUNCTION public.release_beta_use(
    p_user_id UUID,
    p_tool_key TEXT,
    p_error_msg TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_usage INT := 0;
BEGIN
    UPDATE public.tool_beta_usages
    SET reserved_count = GREATEST(0, reserved_count - 1),
        updated_at = NOW()
    WHERE user_id = p_user_id AND tool_key = p_tool_key
    RETURNING usage_count INTO v_usage;

    -- Record failed platform event for health & telemetry
    INSERT INTO public.platform_events (
        id, user_id, event_name, tool_key, success, duration_ms, metadata, created_at
    ) VALUES (
        'evt_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '_' || SUBSTRING(gen_random_uuid()::text, 1, 8),
        p_user_id,
        'tool_execution',
        p_tool_key,
        FALSE,
        0,
        CASE WHEN p_error_msg IS NOT NULL THEN jsonb_build_object('error', p_error_msg) ELSE '{}'::jsonb END,
        NOW()
    );

    RETURN jsonb_build_object('success', TRUE, 'usageCount', v_usage);
END;
$$;

-- 8. DATABASE-AGGREGATED TOOL OVERVIEW TELEMETRY RPC
-- Returns aggregated telemetry for all tools without browser downloading raw platform events.
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
            'totalUses', total_cnt,
            'uniqueUsers', unique_u,
            'successfulOperations', succ_cnt,
            'failedOperations', fail_cnt,
            'successRate', CASE WHEN total_cnt > 0 THEN ROUND((succ_cnt::NUMERIC / total_cnt::NUMERIC) * 100, 1) ELSE 100.0 END,
            'avgDurationMs', ROUND(COALESCE(avg_dur, 0)::NUMERIC, 0),
            'p95DurationMs', ROUND(COALESCE(p95_dur, 0)::NUMERIC, 0),
            'lastUsedAt', last_used
        )
    ) INTO v_result
    FROM (
        SELECT 
            COALESCE(tool_key, event_name) AS tool_k,
            COUNT(*) AS total_cnt,
            COUNT(DISTINCT user_id) AS unique_u,
            COUNT(*) FILTER (WHERE success = TRUE) AS succ_cnt,
            COUNT(*) FILTER (WHERE success = FALSE) AS fail_cnt,
            AVG(duration_ms) FILTER (WHERE duration_ms > 0) AS avg_dur,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms > 0) AS p95_dur,
            MAX(created_at) AS last_used
        FROM public.platform_events
        WHERE created_at >= v_start_time
          AND (tool_key IS NOT NULL OR event_name IS NOT NULL)
        GROUP BY tool_k
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 9. USER TOOL USAGE BREAKDOWN RPC
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
    WHERE user_id = p_user_id AND tool_key IS NOT NULL;

    IF v_total_ops > 0 THEN
        v_success_rate := ROUND((v_succ_ops::NUMERIC / v_total_ops::NUMERIC) * 100, 1);
        
        -- Most used tool
        SELECT tool_key INTO v_most_used
        FROM public.platform_events
        WHERE user_id = p_user_id AND tool_key IS NOT NULL
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
        ) ORDER BY COUNT(*) DESC
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
