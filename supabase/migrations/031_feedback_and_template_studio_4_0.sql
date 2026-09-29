-- SAARVI MIGRATION 031: CANONICAL USER FEEDBACK & CAREER TEMPLATE STUDIO 4.0
-- Implements:
-- 1. Canonical user_feedback enhancements (operation_id, sentiment_confidence, aliases, RLS)
-- 2. Canonical career_templates table (Resume & Cover Letter templates, versions, layout schema, sample data)
-- 3. Template import batches & task queue tables with SHA-256 duplicate detection

-- ============================================================================
-- 1. USER FEEDBACK CANONICAL ENHANCEMENTS
-- ============================================================================

-- Ensure feedback table exists with all required columns
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    guest_session_id TEXT,
    user_type TEXT NOT NULL DEFAULT 'GUEST' CHECK (user_type IN ('GUEST', 'FREE', 'PRO')),
    user_email TEXT,
    user_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    category TEXT NOT NULL CHECK (category IN (
        'General', 'Bug', 'Tool Issue', 'Feature Request', 'Performance', 'Privacy', 'Payment', 'Other',
        'GENERAL', 'BUG', 'TOOL_ISSUE', 'FEATURE', 'FEATURE_REQUEST', 'PERFORMANCE', 'PRIVACY', 'PAYMENT', 'UX', 'OTHER'
    )),
    message TEXT NOT NULL,
    tool_key TEXT,
    page_url TEXT,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_REVIEW', 'RESOLVED', 'ARCHIVED')),
    sentiment TEXT DEFAULT 'UNKNOWN' CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'UNKNOWN')),
    admin_notes TEXT,
    idempotency_key TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely add missing columns to public.feedback
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'operation_id') THEN
        ALTER TABLE public.feedback ADD COLUMN operation_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'sentiment_confidence') THEN
        ALTER TABLE public.feedback ADD COLUMN sentiment_confidence NUMERIC(3, 2) DEFAULT 0.90;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'page') THEN
        ALTER TABLE public.feedback ADD COLUMN page TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'admin_note') THEN
        ALTER TABLE public.feedback ADD COLUMN admin_note TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'email') THEN
        ALTER TABLE public.feedback ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback' AND column_name = 'tool_slug') THEN
        ALTER TABLE public.feedback ADD COLUMN tool_slug TEXT;
    END IF;
END $$;

-- Indexes for feedback querying
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_tool_key ON public.feedback(tool_key);
CREATE INDEX IF NOT EXISTS idx_feedback_operation_id ON public.feedback(operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_idempotency ON public.feedback(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Enable RLS on feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (authenticated or guest)
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
CREATE POLICY "Anyone can insert feedback" ON public.feedback
    FOR INSERT WITH CHECK (true);

-- Users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view and manage all feedback
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

-- Create canonical user_feedback view for backwards and forwards compatibility
CREATE OR REPLACE VIEW public.user_feedback AS
SELECT
    id,
    user_id,
    user_type,
    guest_session_id,
    COALESCE(user_email, email) AS email,
    user_name,
    rating,
    category,
    message,
    COALESCE(tool_key, tool_slug) AS tool_key,
    COALESCE(page, page_url) AS page,
    page_url,
    operation_id,
    status,
    sentiment,
    sentiment_confidence,
    COALESCE(admin_note, admin_notes) AS admin_note,
    admin_notes,
    idempotency_key,
    resolved_at,
    resolved_by,
    created_at,
    updated_at
FROM public.feedback;

-- ============================================================================
-- 2. CAREER TEMPLATES TABLE (RESUME & COVER LETTER)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.career_templates (
    id TEXT PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (document_type IN ('RESUME', 'COVER_LETTER')),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'STANDARD' CHECK (category IN (
        'STANDARD', 'TECHNICAL', 'ACADEMIC', 'CREATIVE', 'EXECUTIVE', 'ATS_FRIENDLY', 'MINIMAL'
    )),
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'PROCESSING', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'DISABLED', 'ARCHIVED'
    )),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_pro BOOLEAN NOT NULL DEFAULT false,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    primary_color TEXT NOT NULL DEFAULT '#0f172a',
    font_family TEXT NOT NULL DEFAULT 'Inter, sans-serif',
    layout TEXT NOT NULL DEFAULT 'single-column' CHECK (layout IN (
        'single-column', 'two-column-left', 'two-column-right', 'compact-grid', 'executive-serif'
    )),
    page_size TEXT NOT NULL DEFAULT 'A4' CHECK (page_size IN ('A4', 'LETTER')),
    margins JSONB NOT NULL DEFAULT '{"top": 20, "bottom": 20, "left": 20, "right": 20}',
    schema JSONB NOT NULL DEFAULT '{}',
    sample_data JSONB,
    thumbnail_url TEXT,
    source_file_url TEXT,
    file_hash TEXT,
    source TEXT NOT NULL DEFAULT 'Saarvi Original',
    source_url TEXT,
    license TEXT NOT NULL DEFAULT 'Saarvi Proprietary',
    license_url TEXT,
    rights_verified BOOLEAN NOT NULL DEFAULT true,
    rights_notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for career templates
CREATE INDEX IF NOT EXISTS idx_templates_doc_type ON public.career_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_templates_status ON public.career_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_active ON public.career_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_templates_sort ON public.career_templates(sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_templates_file_hash ON public.career_templates(file_hash) WHERE file_hash IS NOT NULL;

-- Enable RLS on career_templates
ALTER TABLE public.career_templates ENABLE ROW LEVEL SECURITY;

-- Public can view active published templates
DROP POLICY IF EXISTS "Public can view active published templates" ON public.career_templates;
CREATE POLICY "Public can view active published templates" ON public.career_templates
    FOR SELECT USING (status = 'PUBLISHED' AND is_active = true);

-- Admins can view and manage all templates
DROP POLICY IF EXISTS "Admins can manage career templates" ON public.career_templates;
CREATE POLICY "Admins can manage career templates" ON public.career_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- ============================================================================
-- 3. TEMPLATE IMPORT BATCHES & TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.template_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'RESUME' CHECK (document_type IN ('RESUME', 'COVER_LETTER')),
    total_files INTEGER NOT NULL DEFAULT 0,
    processed_count INTEGER NOT NULL DEFAULT 0,
    needs_review_count INTEGER NOT NULL DEFAULT 0,
    ready_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    published_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
        'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL_SUCCESS'
    )),
    tasks JSONB NOT NULL DEFAULT '[]',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_batches_created_at ON public.template_import_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_batches_status ON public.template_import_batches(status);

ALTER TABLE public.template_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage template import batches" ON public.template_import_batches;
CREATE POLICY "Admins can manage template import batches" ON public.template_import_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );
