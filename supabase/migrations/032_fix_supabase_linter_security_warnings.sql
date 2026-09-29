-- SAARVI MIGRATION 032: SUPABASE SECURITY LINTER REMEDIATION
-- Resolves all linter warnings reported by Supabase Database Linter:
-- 1. function_search_path_mutable: Sets fixed search_path = public on all sensitive functions
-- 2. rls_policy_always_true: Replaces unconstrained WITH CHECK (true) / USING (true) with explicit checks & role restrictions
-- 3. anon_security_definer_function_executable & authenticated_security_definer_function_executable:
--    Revokes execution from PUBLIC/anon/authenticated on trigger & internal security definer functions, granting strictly to service_role

-- ============================================================================
-- 1. RESOLVE function_search_path_mutable
-- ============================================================================
-- Dynamically sets search_path = public on all functions flagged by Supabase linter.
-- Using pg_proc introspection guarantees all existing function signatures & overloads are matched.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              -- Flagged functions
              'check_last_superadmin_protection',
              'sync_academic_subject_columns',
              'expire_outdated_jobs',
              'prevent_publish_expired',
              'is_job_live_for_users',
              -- Proactive hardening for all SECURITY DEFINER functions
              'handle_new_user',
              'handle_user_email_confirmed',
              'protect_profile_role',
              'atomic_reserve_beta_use',
              'commit_beta_use',
              'release_beta_use',
              'get_user_tool_usage_summary',
              'get_admin_dashboard_summary',
              'get_error_analytics_aggregate',
              'get_platform_activity_aggregate',
              'get_tool_overview_telemetry',
              'get_user_growth_aggregate',
              'rls_auto_enable'
          )
    ) LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public;', r.nspname, r.proname, r.args);
    END LOOP;
END $$;

-- ============================================================================
-- 2. RESOLVE rls_policy_always_true
-- ============================================================================

-- 2.1 Table public.ad_analytics_events
-- Replace WITH CHECK (true) with explicit payload constraints
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_analytics_events') THEN
        DROP POLICY IF EXISTS "Public insert ad events" ON public.ad_analytics_events;
        CREATE POLICY "Public insert ad events" ON public.ad_analytics_events
            FOR INSERT WITH CHECK (
                ad_id IS NOT NULL 
                AND event_type IS NOT NULL 
                AND length(event_type) > 0
            );
    END IF;
END $$;

-- 2.2 Table public.analytics_events
-- Replace WITH CHECK (true) with explicit event_type validation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analytics_events') THEN
        DROP POLICY IF EXISTS "Allow analytics event inserts" ON public.analytics_events;
        CREATE POLICY "Allow analytics event inserts" ON public.analytics_events
            FOR INSERT WITH CHECK (
                event_type IS NOT NULL 
                AND length(event_type) > 0
            );

        DROP POLICY IF EXISTS "Service role analytics access" ON public.analytics_events;
        CREATE POLICY "Service role analytics access" ON public.analytics_events
            FOR SELECT TO service_role USING (true);
    END IF;
END $$;

-- 2.3 Table public.auth_email_logs
-- Restrict full ALL policy specifically TO service_role (prevents public role bypass)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_email_logs') THEN
        DROP POLICY IF EXISTS "Service role auth email logs full access" ON public.auth_email_logs;
        CREATE POLICY "Service role auth email logs full access" ON public.auth_email_logs
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2.4 Table public.feedback
-- Replace WITH CHECK (true) with validation on rating (1-5) and non-empty message
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback') THEN
        DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
        CREATE POLICY "Anyone can insert feedback" ON public.feedback
            FOR INSERT WITH CHECK (
                rating >= 1 AND rating <= 5
                AND message IS NOT NULL
                AND length(message) >= 3
            );
    END IF;
END $$;

-- 2.5 Table public.job_reports
-- Replace WITH CHECK (true) with authenticated caller identity & non-empty reason check
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_reports') THEN
        DROP POLICY IF EXISTS "Authenticated users create reports" ON public.job_reports;
        CREATE POLICY "Authenticated users create reports" ON public.job_reports
            FOR INSERT TO authenticated WITH CHECK (
                auth.uid() IS NOT NULL
                AND (reporter_id IS NULL OR reporter_id = auth.uid())
                AND reason IS NOT NULL
                AND length(reason) >= 3
            );
    END IF;
END $$;

-- 2.6 Table public.navigation_configs
-- Restrict full ALL policy specifically TO service_role (prevents public role bypass)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'navigation_configs') THEN
        DROP POLICY IF EXISTS "Service role full navigation access" ON public.navigation_configs;
        CREATE POLICY "Service role full navigation access" ON public.navigation_configs
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2.7 Table public.platform_events
-- Replace WITH CHECK (true) with non-empty event_name check
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_events') THEN
        DROP POLICY IF EXISTS "Anyone can insert platform events" ON public.platform_events;
        CREATE POLICY "Anyone can insert platform events" ON public.platform_events
            FOR INSERT WITH CHECK (
                event_name IS NOT NULL
                AND length(event_name) > 0
            );
    END IF;
END $$;

-- ============================================================================
-- 3. RESOLVE anon_security_definer_function_executable &
--    authenticated_security_definer_function_executable
-- ============================================================================
-- Revokes public/anon/authenticated execute privileges from internal trigger
-- and service-role functions. PostgREST will no longer expose them as public RPCs.
-- Triggers and service_role backend operations continue to execute normally.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              -- Trigger functions (executed internally by PostgreSQL engine on DML)
              'check_last_superadmin_protection',
              'handle_new_user',
              'handle_user_email_confirmed',
              'protect_profile_role',
              'rls_auto_enable',
              'sync_academic_subject_columns',
              'prevent_publish_expired',
              -- Internal / Service Role RPC functions (executed server-side via service_role key)
              'atomic_reserve_beta_use',
              'commit_beta_use',
              'release_beta_use',
              'get_user_tool_usage_summary',
              'get_admin_dashboard_summary',
              'get_error_analytics_aggregate',
              'get_platform_activity_aggregate',
              'get_tool_overview_telemetry',
              'get_user_growth_aggregate',
              'expire_outdated_jobs'
          )
    ) LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated;', r.nspname, r.proname, r.args);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role;', r.nspname, r.proname, r.args);
    END LOOP;
END $$;
