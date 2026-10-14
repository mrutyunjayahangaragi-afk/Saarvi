-- =============================================================================
-- Migration 040: Canonical VTU Curriculum Publishing & Revision Consistency
-- =============================================================================
-- Establishes permanent database tables and revision tracking for:
-- 1. Authoritative Published Curriculum Revisions (academic_curriculum_revisions)
-- 2. Auditable Revision History (academic_curriculum_revision_history)
-- 3. Robust column synchronization and RLS policies for academic_subjects
-- =============================================================================

-- 1. CANONICAL CURRICULUM REVISIONS TABLE
-- Stores the active published revision per (university, scheme, branch, semester)
CREATE TABLE IF NOT EXISTS public.academic_curriculum_revisions (
    id TEXT PRIMARY KEY, -- e.g. "vtu_vtu-2022_vtu-2022-cse_sem3"
    university_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 12),
    revision_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'SUPERSEDED', 'ARCHIVED')),
    published_by TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    courses_count INTEGER NOT NULL DEFAULT 0,
    courses_checksum TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_academic_curriculum_revisions_scope UNIQUE (university_id, scheme_id, branch_id, semester)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_revisions_lookup 
    ON public.academic_curriculum_revisions(university_id, scheme_id, branch_id, semester, status);

-- 2. CURRICULUM REVISION HISTORY TABLE (APPEND-ONLY AUDIT)
CREATE TABLE IF NOT EXISTS public.academic_curriculum_revision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_id TEXT NOT NULL,
    university_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    semester INTEGER NOT NULL,
    revision_number INTEGER NOT NULL,
    published_by TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    courses_count INTEGER NOT NULL DEFAULT 0,
    courses_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_curriculum_revision_history_scope 
    ON public.academic_curriculum_revision_history(scope_id, revision_number DESC);

-- 3. ENSURE ACADEMIC_SUBJECTS HAS REVISION AND PUBLICATION STATUS COLUMNS
ALTER TABLE IF EXISTS public.academic_subjects
    ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS see_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS cie_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ENABLED';

-- Ensure index for fast published subject querying by student public requests
CREATE INDEX IF NOT EXISTS idx_academic_subjects_pub_scope 
    ON public.academic_subjects(university_id, scheme_id, branch_id, semester, publish_status);

-- 4. ROW LEVEL SECURITY POLICIES
ALTER TABLE public.academic_curriculum_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_curriculum_revision_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academic_subjects ENABLE ROW LEVEL SECURITY;

-- Revisions: Public can read active published revisions
DROP POLICY IF EXISTS "Public read active curriculum revisions" ON public.academic_curriculum_revisions;
CREATE POLICY "Public read active curriculum revisions"
    ON public.academic_curriculum_revisions FOR SELECT
    USING (status = 'ACTIVE');

-- Revisions: Admins manage curriculum revisions
DROP POLICY IF EXISTS "Admins manage curriculum revisions" ON public.academic_curriculum_revisions;
CREATE POLICY "Admins manage curriculum revisions"
    ON public.academic_curriculum_revisions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Revision History: Admins read history
DROP POLICY IF EXISTS "Admins read curriculum revision history" ON public.academic_curriculum_revision_history;
CREATE POLICY "Admins read curriculum revision history"
    ON public.academic_curriculum_revision_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS "Admins insert curriculum revision history" ON public.academic_curriculum_revision_history;
CREATE POLICY "Admins insert curriculum revision history"
    ON public.academic_curriculum_revision_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Subjects: Public read published subjects
DROP POLICY IF EXISTS "Public read published academic subjects" ON public.academic_subjects;
CREATE POLICY "Public read published academic subjects"
    ON public.academic_subjects FOR SELECT
    USING (
        publish_status = 'PUBLISHED'
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Grants
GRANT SELECT ON public.academic_curriculum_revisions TO anon, authenticated, service_role;
GRANT ALL ON public.academic_curriculum_revisions TO authenticated, service_role;
GRANT SELECT ON public.academic_curriculum_revision_history TO anon, authenticated, service_role;
GRANT ALL ON public.academic_curriculum_revision_history TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_subjects TO authenticated, service_role;
