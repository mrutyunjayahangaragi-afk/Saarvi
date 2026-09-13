-- =============================================================================
-- Migration 009: Admin-Controlled Advertisement & Promotional Gate System
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  headline TEXT,
  body_text TEXT,
  cta_text TEXT,
  cta_url TEXT,
  advertiser_name TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED')),
  priority INTEGER NOT NULL DEFAULT 0,
  audience TEXT NOT NULL DEFAULT 'FREE_ONLY' CHECK (audience IN ('FREE_ONLY', 'PRO_EXCLUDED', 'ALL_AUTHENTICATED_FREE', 'PUBLIC_VISITORS', 'CUSTOM')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  duration_seconds INTEGER NOT NULL DEFAULT 15 CHECK (duration_seconds >= 3 AND duration_seconds <= 120),
  skip_enabled BOOLEAN NOT NULL DEFAULT true,
  skip_after_seconds INTEGER NOT NULL DEFAULT 5 CHECK (skip_after_seconds >= 0 AND skip_after_seconds <= duration_seconds),
  display_mode TEXT NOT NULL DEFAULT 'FULLSCREEN_GATE' CHECK (display_mode IN ('FULLSCREEN_GATE', 'CENTER_MODAL', 'BANNER')),
  frequency_mode TEXT NOT NULL DEFAULT 'ONCE_PER_SESSION' CHECK (frequency_mode IN ('ONCE_PER_SESSION', 'EVERY_VISIT', 'ONCE_PER_DAY', 'ONCE_PER_TIME_WINDOW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS public.ad_display_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  ads_enabled BOOLEAN NOT NULL DEFAULT true,
  default_display_mode TEXT NOT NULL DEFAULT 'FULLSCREEN_GATE' CHECK (default_display_mode IN ('FULLSCREEN_GATE', 'CENTER_MODAL', 'BANNER')),
  default_duration_seconds INTEGER NOT NULL DEFAULT 15,
  default_skip_enabled BOOLEAN NOT NULL DEFAULT true,
  default_skip_after_seconds INTEGER NOT NULL DEFAULT 5,
  default_frequency_mode TEXT NOT NULL DEFAULT 'ONCE_PER_SESSION' CHECK (default_frequency_mode IN ('ONCE_PER_SESSION', 'EVERY_VISIT', 'ONCE_PER_DAY', 'ONCE_PER_TIME_WINDOW')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS public.ad_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('AD_IMPRESSION', 'AD_STARTED', 'AD_SKIPPED', 'AD_COMPLETED', 'AD_CTA_CLICKED', 'AD_MEDIA_ERROR')),
  user_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed global display settings if not present
INSERT INTO public.ad_display_settings (id, ads_enabled, default_display_mode, default_duration_seconds, default_skip_enabled, default_skip_after_seconds, default_frequency_mode)
VALUES ('global', true, 'FULLSCREEN_GATE', 15, true, 5, 'ONCE_PER_SESSION')
ON CONFLICT (id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ads_status_priority ON public.advertisements (status, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_schedule ON public.advertisements (status, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_ad_event ON public.ad_analytics_events (ad_id, event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ad_analytics_timestamp ON public.ad_analytics_events (timestamp DESC);

-- Enable RLS
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_display_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_analytics_events ENABLE ROW LEVEL SECURITY;

-- Public can read active advertisements for display
CREATE POLICY "Public read active ads" ON public.advertisements
  FOR SELECT USING (status = 'ACTIVE');

-- Public can read global ad settings
CREATE POLICY "Public read ad settings" ON public.ad_display_settings
  FOR SELECT USING (true);

-- Public can log anonymous ad analytics events
CREATE POLICY "Public insert ad events" ON public.ad_analytics_events
  FOR INSERT WITH CHECK (true);

-- Authenticated admins have full management access
CREATE POLICY "Admin manage advertisements" ON public.advertisements
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Admin manage ad display settings" ON public.ad_display_settings
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Admin view ad analytics" ON public.ad_analytics_events
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );
