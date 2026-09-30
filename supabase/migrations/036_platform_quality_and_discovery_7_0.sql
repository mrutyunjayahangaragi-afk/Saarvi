-- =============================================================================
-- Migration 036: Saarvi Platform Quality & Intelligent Discovery 7.0 Master
-- Saarvi — Study. Work. Grow.
-- =============================================================================
-- 1. NOTIFICATIONS 4.0: Canonical campaigns, delivery tracking, audience counts
-- 2. CAREER INTELLIGENCE: Training & learning opportunities schema
-- 3. SMART NAVBAR: Admin-controlled navigation items & draft/publish versioning
-- =============================================================================

-- =============================================================================
-- PART 1: NOTIFICATIONS 4.0 SCHEMA HARDENING
-- =============================================================================

-- Add audience_count, started_at, completed_at to notifications table if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'audience_count'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN audience_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN started_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notification_recipients' AND column_name = 'error_code'
    ) THEN
        ALTER TABLE public.notification_recipients ADD COLUMN error_code TEXT;
    END IF;
END $$;

-- Conceptual View / Alias: notification_campaigns for clear campaign semantics
CREATE OR REPLACE VIEW public.notification_campaigns AS
SELECT
    id,
    category,
    priority,
    title,
    subtitle,
    body,
    cta_text,
    cta_url,
    audience_type,
    ('in_app' = ANY(channels)) AS channel_in_app,
    ('email' = ANY(channels)) AS channel_email,
    status,
    COALESCE(audience_count, 0) AS audience_count,
    created_by,
    created_at,
    scheduled_at,
    started_at,
    completed_at
FROM public.notifications;

-- =============================================================================
-- PART 2: TRAINING & LEARNING OPPORTUNITIES SCHEMA
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.training_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    provider TEXT NOT NULL,
    domain TEXT NOT NULL,
    skills TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    duration_days INTEGER,
    duration_text TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    mode TEXT NOT NULL DEFAULT 'ONLINE' CHECK (mode IN ('ONLINE', 'OFFLINE', 'HYBRID')),
    location TEXT,
    fee TEXT NOT NULL DEFAULT 'Free',
    scholarship_available BOOLEAN NOT NULL DEFAULT FALSE,
    certificate_available BOOLEAN NOT NULL DEFAULT TRUE,
    eligibility TEXT,
    description TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Saarvi Verified',
    apply_url TEXT NOT NULL,
    deadline TIMESTAMPTZ,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'EXPIRED', 'DELETED')),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_domain ON public.training_opportunities(domain);
CREATE INDEX IF NOT EXISTS idx_training_mode ON public.training_opportunities(mode);
CREATE INDEX IF NOT EXISTS idx_training_status ON public.training_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_training_is_verified ON public.training_opportunities(is_verified);
CREATE INDEX IF NOT EXISTS idx_training_start_date ON public.training_opportunities(start_date);
CREATE INDEX IF NOT EXISTS idx_training_created_at ON public.training_opportunities(created_at DESC);

ALTER TABLE public.training_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active training opportunities" ON public.training_opportunities;
CREATE POLICY "Public can view active training opportunities"
    ON public.training_opportunities
    FOR SELECT
    USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "Admins can manage training opportunities" ON public.training_opportunities;
CREATE POLICY "Admins can manage training opportunities"
    ON public.training_opportunities
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- =============================================================================
-- PART 3: ADMIN-CONTROLLED NAVBAR & VERSIONING SCHEMA
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.navigation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    route TEXT NOT NULL,
    icon TEXT,
    parent_id UUID REFERENCES public.navigation_items(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    visible_desktop BOOLEAN NOT NULL DEFAULT TRUE,
    visible_mobile BOOLEAN NOT NULL DEFAULT TRUE,
    open_behavior TEXT NOT NULL DEFAULT 'SAME_TAB' CHECK (open_behavior IN ('SAME_TAB', 'NEW_TAB', 'DRAWER')),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    feature_flag TEXT,
    audience TEXT NOT NULL DEFAULT 'ALL_USERS' CHECK (audience IN ('ALL_USERS', 'AUTHENTICATED', 'FREE', 'PRO', 'ADMINS')),
    external_url TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nav_items_order ON public.navigation_items(order_index ASC);
CREATE INDEX IF NOT EXISTS idx_nav_items_enabled ON public.navigation_items(enabled);
CREATE INDEX IF NOT EXISTS idx_nav_items_key ON public.navigation_items(key);

ALTER TABLE public.navigation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published enabled navigation items" ON public.navigation_items;
CREATE POLICY "Public can read published enabled navigation items"
    ON public.navigation_items
    FOR SELECT
    USING (enabled = TRUE);

DROP POLICY IF EXISTS "Admins can manage navigation items" ON public.navigation_items;
CREATE POLICY "Admins can manage navigation items"
    ON public.navigation_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Table: navigation_versions for Draft / Publish / Rollback
CREATE TABLE IF NOT EXISTS public.navigation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INTEGER NOT NULL DEFAULT 1,
    version_number INTEGER NOT NULL DEFAULT 1,
    snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'navigation_versions' AND column_name = 'version_number'
    ) THEN
        ALTER TABLE public.navigation_versions ADD COLUMN version_number INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'navigation_versions' AND column_name = 'items'
    ) THEN
        ALTER TABLE public.navigation_versions ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nav_versions_version ON public.navigation_versions(version DESC);
CREATE INDEX IF NOT EXISTS idx_nav_versions_ver_num ON public.navigation_versions(version_number DESC);
CREATE INDEX IF NOT EXISTS idx_nav_versions_active ON public.navigation_versions(is_active);

-- Auto-sync trigger for version/version_number and snapshot/items columns
CREATE OR REPLACE FUNCTION public.sync_nav_version_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.version IS NULL OR NEW.version = 1) AND NEW.version_number IS NOT NULL AND NEW.version_number != 1 THEN
        NEW.version := NEW.version_number;
    ELSIF (NEW.version_number IS NULL OR NEW.version_number = 1) AND NEW.version IS NOT NULL AND NEW.version != 1 THEN
        NEW.version_number := NEW.version;
    END IF;
    IF (NEW.snapshot IS NULL OR NEW.snapshot = '[]'::jsonb) AND NEW.items IS NOT NULL AND NEW.items != '[]'::jsonb THEN
        NEW.snapshot := NEW.items;
    ELSIF (NEW.items IS NULL OR NEW.items = '[]'::jsonb) AND NEW.snapshot IS NOT NULL AND NEW.snapshot != '[]'::jsonb THEN
        NEW.items := NEW.snapshot;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_nav_version_columns ON public.navigation_versions;
CREATE TRIGGER trg_sync_nav_version_columns
    BEFORE INSERT OR UPDATE ON public.navigation_versions
    FOR EACH ROW EXECUTE FUNCTION public.sync_nav_version_columns();

ALTER TABLE public.navigation_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active navigation version" ON public.navigation_versions;
CREATE POLICY "Public can read active navigation version"
    ON public.navigation_versions
    FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage navigation versions" ON public.navigation_versions;
CREATE POLICY "Admins can manage navigation versions"
    ON public.navigation_versions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Seed Default Canonical Navigation Items (Home, Tools, Jobs & Internships, Plans)
INSERT INTO public.navigation_items (key, label, route, icon, order_index, enabled, visible_desktop, visible_mobile, is_system)
VALUES
    ('home', 'Home', '/', 'Home', 0, TRUE, TRUE, TRUE, TRUE),
    ('tools', 'Tools', '/tools', 'Grid', 1, TRUE, TRUE, TRUE, TRUE),
    ('jobs', 'Jobs & Internships', '/jobs', 'Briefcase', 2, TRUE, TRUE, TRUE, FALSE),
    ('plans', 'Plans', '/pricing', 'Sparkles', 3, TRUE, TRUE, TRUE, FALSE)
ON CONFLICT (key) DO UPDATE
SET
    label = EXCLUDED.label,
    route = EXCLUDED.route,
    order_index = EXCLUDED.order_index;

-- Initial active version snapshot
INSERT INTO public.navigation_versions (version, version_number, snapshot, items, created_by, published_at, is_active, notes)
VALUES (
    1,
    1,
    jsonb_build_array(
        jsonb_build_object('id', 'nav_home', 'key', 'home', 'label', 'Home', 'route', '/', 'icon', 'Home', 'order_index', 0, 'enabled', true, 'visible_desktop', true, 'visible_mobile', true, 'is_system', true, 'audience', 'ALL_USERS'),
        jsonb_build_object('id', 'nav_tools', 'key', 'tools', 'label', 'Tools', 'route', '/tools', 'icon', 'Grid', 'order_index', 1, 'enabled', true, 'visible_desktop', true, 'visible_mobile', true, 'is_system', true, 'audience', 'ALL_USERS'),
        jsonb_build_object('id', 'nav_jobs', 'key', 'jobs', 'label', 'Jobs & Internships', 'route', '/jobs', 'icon', 'Briefcase', 'order_index', 2, 'enabled', true, 'visible_desktop', true, 'visible_mobile', true, 'is_system', false, 'audience', 'ALL_USERS'),
        jsonb_build_object('id', 'nav_plans', 'key', 'plans', 'label', 'Plans', 'route', '/pricing', 'icon', 'Sparkles', 'order_index', 3, 'enabled', true, 'visible_desktop', true, 'visible_mobile', true, 'is_system', false, 'audience', 'ALL_USERS')
    ),
    jsonb_build_array(
        jsonb_build_object('id', 'nav_home', 'key', 'home', 'label', 'Home', 'route', '/', 'icon', 'Home', 'order_index', 0, 'enabled', true, 'visible_desktop', true, 'visible_mobile', true, 'is_system', true, 'audience', 'ALL_USERS'),
        jsonb_build_object('id', 'nav_tools', 'key', 'tools', 'label', 'Tools', 'route', '/tools', 'icon', 'Grid', 'order_index', 1, 'enabled', true, 'visible_desktop', true, 'visible_mobile', true, 'is_system', true, 'audience', 'ALL_USERS'),
        jsonb_build_object('id', 'nav_jobs', 'key', 'jobs', 'label', 'Jobs & Internships', 'route', '/jobs', 'icon', 'Briefcase', 'order_index', 2, 'enabled', true, 'visible_desktop', true, 'visible_mobile', true, 'is_system', false, 'audience', 'ALL_USERS'),
        jsonb_build_object('id', 'nav_plans', 'key', 'plans', 'label', 'Plans', 'route', '/pricing', 'icon', 'Sparkles', 'order_index', 3, 'enabled', true, 'visible_desktop', true, 'visible_mobile', true, 'is_system', false, 'audience', 'ALL_USERS')
    ),
    'system_initializer',
    NOW(),
    TRUE,
    'Initial default navigation release 7.0'
) ON CONFLICT DO NOTHING;
