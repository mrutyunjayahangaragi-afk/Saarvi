-- =============================================================================
-- Migration 011: Navigation Management & Platform Analytics Events
-- Master Phase 35-39 & Phase 40 Unified Admin Control Center 2.0
-- =============================================================================

-- 1. NAVIGATION CONFIGS TABLE
CREATE TABLE IF NOT EXISTS public.navigation_configs (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  visible_in_navbar BOOLEAN NOT NULL DEFAULT true,
  visible_in_mega_menu BOOLEAN NOT NULL DEFAULT true,
  visible_in_search BOOLEAN NOT NULL DEFAULT true,
  visible_in_homepage BOOLEAN NOT NULL DEFAULT true,
  visible_in_ai BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  badge TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'NAVBAR_HIDDEN', 'DISABLED', 'MAINTENANCE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT DEFAULT 'admin@saarvi.in',
  UNIQUE (tool_id, category_id)
);

-- 2. PLATFORM ANALYTICS EVENTS TABLE
-- Stores real platform event telemetry (strictly safe metadata; zero private content)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT NOT NULL,
  tool_id TEXT,
  tool_slug TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES FOR HIGH-THROUGHPUT ANALYTICS AGGREGATIONS
CREATE INDEX IF NOT EXISTS idx_navigation_configs_cat_pos ON public.navigation_configs(category_id, position);
CREATE INDEX IF NOT EXISTS idx_navigation_configs_tool ON public.navigation_configs(tool_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON public.analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_slug_time ON public.analytics_events(tool_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON public.analytics_events(event_type, created_at DESC);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.navigation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Public can read active navigation configs
DROP POLICY IF EXISTS "Public read navigation configs" ON public.navigation_configs;
CREATE POLICY "Public read navigation configs" ON public.navigation_configs
  FOR SELECT USING (status != 'DISABLED');

-- Service role has full access
DROP POLICY IF EXISTS "Service role full navigation access" ON public.navigation_configs;
CREATE POLICY "Service role full navigation access" ON public.navigation_configs
  FOR ALL USING (true);

-- Anyone can insert analytics events
DROP POLICY IF EXISTS "Allow analytics event inserts" ON public.analytics_events;
CREATE POLICY "Allow analytics event inserts" ON public.analytics_events
  FOR INSERT WITH CHECK (true);

-- Service role can read/aggregate analytics
DROP POLICY IF EXISTS "Service role analytics access" ON public.analytics_events;
CREATE POLICY "Service role analytics access" ON public.analytics_events
  FOR SELECT USING (true);
