-- =========================================================================
-- Migration 035: Tool Health Center
-- Creates tool_health_checks table for tracking per-tool health status.
-- Used by Admin Health Dashboard and automated smoke tests.
-- =========================================================================

-- 1. Tool health check results table
CREATE TABLE IF NOT EXISTS public.tool_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (status IN (
      'HEALTHY',
      'PARTIALLY_WORKING',
      'BROKEN',
      'COMING_SOON',
      'PLACEHOLDER',
      'MISCONFIGURED',
      'ACCESS_BLOCKED',
      'DEPENDENCY_UNAVAILABLE',
      'UNKNOWN'
    )),
  duration_ms INTEGER,
  error_code TEXT,
  -- Sanitized error message: NEVER store user file contents
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  environment TEXT NOT NULL DEFAULT 'production',
  run_id UUID,
  -- Who triggered this check
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_health_key ON public.tool_health_checks (tool_key);
CREATE INDEX IF NOT EXISTS idx_tool_health_checked_at ON public.tool_health_checks (checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_health_status ON public.tool_health_checks (status);
CREATE INDEX IF NOT EXISTS idx_tool_health_key_checked ON public.tool_health_checks (tool_key, checked_at DESC);

-- 2. Enable RLS
ALTER TABLE public.tool_health_checks ENABLE ROW LEVEL SECURITY;

-- 3. Only admins can read/write tool health checks
CREATE POLICY "Admin read tool health checks"
  ON public.tool_health_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.is_active = true
    )
  );

CREATE POLICY "Admin insert tool health checks"
  ON public.tool_health_checks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.is_active = true
    )
  );

-- 4. Convenience view: latest health check per tool
CREATE OR REPLACE VIEW public.tool_health_latest AS
SELECT DISTINCT ON (tool_key)
  tool_key,
  status,
  duration_ms,
  error_code,
  error_message,
  checked_at,
  environment
FROM public.tool_health_checks
ORDER BY tool_key, checked_at DESC;

-- 5. Convenience view: failure count per tool (last 7 days)
CREATE OR REPLACE VIEW public.tool_health_summary AS
SELECT
  tool_key,
  COUNT(*) AS total_checks,
  COUNT(*) FILTER (WHERE status = 'HEALTHY') AS healthy_count,
  COUNT(*) FILTER (WHERE status IN ('BROKEN', 'MISCONFIGURED', 'DEPENDENCY_UNAVAILABLE')) AS failure_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'HEALTHY') / NULLIF(COUNT(*), 0),
    1
  ) AS health_rate_pct,
  AVG(duration_ms) FILTER (WHERE status = 'HEALTHY') AS avg_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)
    FILTER (WHERE status = 'HEALTHY') AS p95_duration_ms,
  MAX(checked_at) FILTER (WHERE status = 'HEALTHY') AS last_success_at,
  MAX(checked_at) AS last_checked_at
FROM public.tool_health_checks
WHERE checked_at > NOW() - INTERVAL '7 days'
GROUP BY tool_key;

COMMENT ON TABLE public.tool_health_checks IS 'Stores automated and manual health check results per tool. Never stores user file contents.';
COMMENT ON VIEW public.tool_health_latest IS 'Most recent health check result per tool.';
COMMENT ON VIEW public.tool_health_summary IS 'Aggregated health statistics per tool for the last 7 days.';
