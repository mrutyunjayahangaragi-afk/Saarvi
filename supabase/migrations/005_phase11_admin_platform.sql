-- DocEase Phase 11: Admin Control Center Platform Schema
-- Central operational control panel configuration & audit logging

-- 1. Upgrade profiles role check if not already upgraded
ALTER TABLE IF EXISTS public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE IF EXISTS public.profiles 
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN'));

-- 2. Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_config',
  app_name TEXT NOT NULL DEFAULT 'DocEase',
  tagline TEXT NOT NULL DEFAULT 'Smart Document & Student Utility Platform',
  logo_url TEXT NOT NULL DEFAULT '/logo.svg',
  favicon_url TEXT NOT NULL DEFAULT '/favicon.ico',
  brand_accent TEXT NOT NULL DEFAULT '#2563eb',
  support_email TEXT NOT NULL DEFAULT 'support@docease.com',
  contact_email TEXT NOT NULL DEFAULT 'contact@docease.com',
  default_language TEXT NOT NULL DEFAULT 'en',
  default_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT NOT NULL DEFAULT 'DocEase is temporarily under maintenance. Please try again shortly.',
  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  guest_access_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_auto_download BOOLEAN NOT NULL DEFAULT TRUE,
  public_tool_availability BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tool Overrides Table
CREATE TABLE IF NOT EXISTS public.tool_overrides (
  id TEXT PRIMARY KEY, -- matches tool slug e.g. 'jpg-to-pdf'
  name TEXT,
  category TEXT CHECK (category IN ('image', 'pdf', 'student')),
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BETA', 'COMING_SOON', 'DISABLED', 'MAINTENANCE')),
  requires_auth BOOLEAN DEFAULT FALSE,
  requires_pro BOOLEAN DEFAULT FALSE,
  max_size_mb INTEGER,
  max_files INTEGER DEFAULT 20,
  max_pages INTEGER DEFAULT 100,
  order_index INTEGER DEFAULT 0,
  hidden BOOLEAN DEFAULT FALSE,
  description TEXT,
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Curriculum Versions Table
CREATE TABLE IF NOT EXISTS public.curriculum_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme TEXT NOT NULL, -- e.g. '2022'
  branch TEXT NOT NULL, -- e.g. 'CSE'
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATE', 'REVIEW', 'VERIFIED', 'ACTIVE', 'DEPRECATED')),
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  retrieved_date DATE NOT NULL DEFAULT CURRENT_DATE,
  verification_date TIMESTAMPTZ,
  verified_by TEXT,
  courses_count INTEGER NOT NULL DEFAULT 0,
  courses_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scheme, branch, semester, version)
);

-- 5. Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'UPDATE' CHECK (type IN ('MAINTENANCE', 'FEATURE', 'UPDATE', 'STUDENT')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'EXPIRED')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  target_audience TEXT NOT NULL DEFAULT 'ALL' CHECK (target_audience IN ('ALL', 'STUDENTS', 'LOGGED_IN')),
  is_dismissible BOOLEAN NOT NULL DEFAULT TRUE,
  published_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. System Errors Log Table
CREATE TABLE IF NOT EXISTS public.system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  service TEXT NOT NULL,
  tool TEXT,
  severity TEXT NOT NULL DEFAULT 'ERROR' CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  error_type TEXT NOT NULL,
  request_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED')),
  safe_message TEXT NOT NULL,
  diagnostics TEXT
);

-- 7. Audit Logs Table (Append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_curriculum_scheme_branch ON public.curriculum_versions(scheme, branch, semester);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status, priority);
CREATE INDEX IF NOT EXISTS idx_system_errors_status ON public.system_errors(status, severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- 9. Row Level Security Policies
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Public can read active platform settings, active announcements, and verified/active curriculum
DROP POLICY IF EXISTS "Public read platform settings" ON public.platform_settings;
CREATE POLICY "Public read platform settings" ON public.platform_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read tool overrides" ON public.tool_overrides;
CREATE POLICY "Public read tool overrides" ON public.tool_overrides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read active curriculum" ON public.curriculum_versions;
CREATE POLICY "Public read active curriculum" ON public.curriculum_versions FOR SELECT USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "Public read active announcements" ON public.announcements;
CREATE POLICY "Public read active announcements" ON public.announcements FOR SELECT USING (status = 'PUBLISHED');

-- Admin write access: Only authenticated users with ADMIN or SUPER_ADMIN role can modify platform configs
DROP POLICY IF EXISTS "Admin manage platform settings" ON public.platform_settings;
CREATE POLICY "Admin manage platform settings" ON public.platform_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')));

DROP POLICY IF EXISTS "Admin manage tool overrides" ON public.tool_overrides;
CREATE POLICY "Admin manage tool overrides" ON public.tool_overrides FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')));

DROP POLICY IF EXISTS "Admin manage curriculum" ON public.curriculum_versions;
CREATE POLICY "Admin manage curriculum" ON public.curriculum_versions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')));

DROP POLICY IF EXISTS "Admin manage announcements" ON public.announcements;
CREATE POLICY "Admin manage announcements" ON public.announcements FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')));

DROP POLICY IF EXISTS "Admin manage system errors" ON public.system_errors;
CREATE POLICY "Admin manage system errors" ON public.system_errors FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')));

DROP POLICY IF EXISTS "Admin insert and read audit logs" ON public.audit_logs;
CREATE POLICY "Admin insert and read audit logs" ON public.audit_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')));

-- -----------------------------------------------------------------------------
-- 7. SuperAdmin Account Auto-Provisioning (for muttuhangaragi161@gmail.com)
-- -----------------------------------------------------------------------------
-- Updates the auth.users signup trigger so muttuhangaragi161@gmail.com is automatically assigned SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    CASE 
      WHEN LOWER(NEW.email) = 'muttuhangaragi161@gmail.com' THEN 'SUPER_ADMIN'
      ELSE 'USER'
    END
  )
  ON CONFLICT (id) DO UPDATE
    SET role = CASE 
      WHEN LOWER(NEW.email) = 'muttuhangaragi161@gmail.com' THEN 'SUPER_ADMIN'
      ELSE public.profiles.role
    END;

  INSERT INTO public.user_preferences (user_id, auto_download, theme)
  VALUES (NEW.id, TRUE, 'light')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- If muttuhangaragi161@gmail.com has already registered in auth.users, promote existing profile:
UPDATE public.profiles
SET role = 'SUPER_ADMIN'
WHERE id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = 'muttuhangaragi161@gmail.com'
);
