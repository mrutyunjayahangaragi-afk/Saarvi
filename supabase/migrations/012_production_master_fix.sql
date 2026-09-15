-- =============================================================================
-- Migration 012: Production Master Fix & Hardening
-- Unifies Tool Access Control, Auth Email Telemetry, and Profile Consistency
-- =============================================================================

-- 1. EXPAND TOOL OVERRIDES TABLE
-- Remove restrictive category check so all canonical categories are supported
ALTER TABLE IF EXISTS public.tool_overrides 
  DROP CONSTRAINT IF EXISTS tool_overrides_category_check;

-- Add access_mode and public_visible columns if missing
ALTER TABLE IF EXISTS public.tool_overrides
  ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT 'PUBLIC_FREE' 
    CHECK (access_mode IN ('PUBLIC_FREE', 'AUTH_REQUIRED', 'PRO', 'ADMIN_ONLY', 'DISABLED')),
  ADD COLUMN IF NOT EXISTS public_visible BOOLEAN DEFAULT TRUE;

-- Create index on tool_overrides access_mode
CREATE INDEX IF NOT EXISTS idx_tool_overrides_access_mode ON public.tool_overrides(access_mode);

-- 2. HARDEN PROFILES TABLE
-- Ensure email column exists on profiles table
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Populate existing profile emails from auth.users if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3. AUTH EMAIL LOGS (DELIVERABILITY & DIAGNOSTICS TELEMETRY)
-- Strictly privacy-safe: logs event, provider, delivery status and error categories.
-- NEVER stores passwords, OTP tokens, or message bodies containing codes.
CREATE TABLE IF NOT EXISTS public.auth_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('SIGNUP_OTP_SENT', 'RESEND_OTP_SENT', 'OTP_DELIVERY_FAILED', 'OTP_VERIFIED')),
  provider TEXT NOT NULL DEFAULT 'Gmail SMTP',
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
  error_category TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for high-performance diagnostics queries
CREATE INDEX IF NOT EXISTS idx_auth_email_logs_created_at ON public.auth_email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_email_logs_status ON public.auth_email_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_email_logs_email ON public.auth_email_logs(email, created_at DESC);

-- 4. ROW LEVEL SECURITY (RLS) FOR NEW TABLES
ALTER TABLE public.auth_email_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full access to auth email logs
DROP POLICY IF EXISTS "Service role auth email logs full access" ON public.auth_email_logs;
CREATE POLICY "Service role auth email logs full access" ON public.auth_email_logs
  FOR ALL USING (true);

-- Admins can read auth email logs for diagnostic dashboards
DROP POLICY IF EXISTS "Admin read auth email logs" ON public.auth_email_logs;
CREATE POLICY "Admin read auth email logs" ON public.auth_email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );
