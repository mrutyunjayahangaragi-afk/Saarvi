-- =============================================================================
-- Migration 010: Admin Portal Persistence & Multi-University Academic Platform
-- =============================================================================
-- Establishes persistent database tables for Multi-University Academic Platform
-- and ensures durable storage for Payment Assets, QR Codes, and Ad Media.

-- 1. EXTEND PAYMENT CONFIGS WITH NEW FIELDS IF MISSING
ALTER TABLE IF EXISTS public.payment_configs
  ADD COLUMN IF NOT EXISTS manual_upi_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS review_sla_minutes INTEGER NOT NULL DEFAULT 120;

-- 2. ACADEMIC UNIVERSITIES TABLE
CREATE TABLE IF NOT EXISTS public.academic_universities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ACADEMIC SCHEMES TABLE
CREATE TABLE IF NOT EXISTS public.academic_schemes (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES public.academic_universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ACADEMIC BRANCHES TABLE
CREATE TABLE IF NOT EXISTS public.academic_branches (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES public.academic_universities(id) ON DELETE CASCADE,
  scheme_id TEXT NOT NULL REFERENCES public.academic_schemes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scheme_id, code)
);

-- 5. ACADEMIC SEMESTERS TABLE
CREATE TABLE IF NOT EXISTS public.academic_semesters (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES public.academic_universities(id) ON DELETE CASCADE,
  scheme_id TEXT NOT NULL REFERENCES public.academic_schemes(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.academic_branches(id) ON DELETE CASCADE,
  semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
  status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, semester_number)
);

-- 6. ACADEMIC SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.academic_subjects (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES public.academic_universities(id) ON DELETE CASCADE,
  scheme_id TEXT NOT NULL REFERENCES public.academic_schemes(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.academic_branches(id) ON DELETE CASCADE,
  semester_id TEXT NOT NULL REFERENCES public.academic_semesters(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  credits NUMERIC(4, 2) NOT NULL DEFAULT 3.0,
  course_type TEXT NOT NULL DEFAULT 'INTEGRATED_PROFESSIONAL_CORE',
  see_applicable BOOLEAN NOT NULL DEFAULT true,
  cie_passing_marks INTEGER DEFAULT 20,
  see_passing_marks INTEGER DEFAULT 18,
  total_passing_marks INTEGER DEFAULT 40,
  max_marks INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED', 'DISABLED')),
  publish_status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (publish_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, semester_id, code)
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_academic_schemes_univ ON public.academic_schemes(university_id);
CREATE INDEX IF NOT EXISTS idx_academic_branches_scheme ON public.academic_branches(scheme_id);
CREATE INDEX IF NOT EXISTS idx_academic_semesters_branch ON public.academic_semesters(branch_id);
CREATE INDEX IF NOT EXISTS idx_academic_subjects_sem ON public.academic_subjects(semester_id);
CREATE INDEX IF NOT EXISTS idx_academic_subjects_code ON public.academic_subjects(code);

-- 8. ROW LEVEL SECURITY
ALTER TABLE public.academic_universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_subjects ENABLE ROW LEVEL SECURITY;

-- Public can read enabled academic data
CREATE POLICY "Public read academic universities" ON public.academic_universities
  FOR SELECT USING (status = 'ENABLED');

CREATE POLICY "Public read academic schemes" ON public.academic_schemes
  FOR SELECT USING (status = 'ENABLED');

CREATE POLICY "Public read academic branches" ON public.academic_branches
  FOR SELECT USING (status = 'ENABLED');

CREATE POLICY "Public read academic semesters" ON public.academic_semesters
  FOR SELECT USING (status = 'ENABLED');

CREATE POLICY "Public read academic subjects" ON public.academic_subjects
  FOR SELECT USING (publish_status = 'PUBLISHED' AND status = 'ENABLED');

-- Admin full management access
CREATE POLICY "Admin manage academic universities" ON public.academic_universities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
  );

CREATE POLICY "Admin manage academic schemes" ON public.academic_schemes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
  );

CREATE POLICY "Admin manage academic branches" ON public.academic_branches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
  );

CREATE POLICY "Admin manage academic semesters" ON public.academic_semesters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
  );

CREATE POLICY "Admin manage academic subjects" ON public.academic_subjects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN'))
  );
