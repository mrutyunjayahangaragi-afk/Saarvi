-- Migration 015: Saarvi Notification Center 2.0 & SuperAdmin RBAC Hardening
-- Enforces:
-- 1. Strict Server-Side Role Audit Logging
-- 2. Last SuperAdmin Protection Invariant ("At least one active SuperAdmin is required.")
-- 3. Notification Center 2.0 Database Schema & Row-Level Security

-- ============================================================================
-- 1. ROLE AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.role_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    old_role TEXT NOT NULL,
    new_role TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_audit_actor ON public.role_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_target ON public.role_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_action ON public.role_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_role_audit_timestamp ON public.role_audit_logs(timestamp DESC);

ALTER TABLE public.role_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmins can view role audit logs" ON public.role_audit_logs;
CREATE POLICY "SuperAdmins can view role audit logs"
    ON public.role_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'SUPER_ADMIN'
        )
    );

-- ============================================================================
-- 2. LAST SUPERADMIN PROTECTION INVARIANT (DATABASE TRIGGER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_last_superadmin_protection()
RETURNS TRIGGER AS $$
DECLARE
    active_super_count INTEGER;
BEGIN
    -- If demoting, suspending, or deactivating a SUPER_ADMIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.role = 'SUPER_ADMIN' AND (NEW.role <> 'SUPER_ADMIN' OR NEW.status <> 'ACTIVE')) THEN
            SELECT COUNT(*) INTO active_super_count
            FROM public.profiles
            WHERE role = 'SUPER_ADMIN'
              AND status = 'ACTIVE'
              AND id <> OLD.id;

            IF (active_super_count = 0) THEN
                RAISE EXCEPTION 'At least one active SuperAdmin is required.';
            END IF;
        END IF;
    END IF;

    -- If deleting a SUPER_ADMIN
    IF (TG_OP = 'DELETE') THEN
        IF (OLD.role = 'SUPER_ADMIN') THEN
            SELECT COUNT(*) INTO active_super_count
            FROM public.profiles
            WHERE role = 'SUPER_ADMIN'
              AND status = 'ACTIVE'
              AND id <> OLD.id;

            IF (active_super_count = 0) THEN
                RAISE EXCEPTION 'At least one active SuperAdmin is required.';
            END IF;
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_last_superadmin ON public.profiles;
CREATE TRIGGER trg_protect_last_superadmin
    BEFORE UPDATE OR DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_last_superadmin_protection();

-- ============================================================================
-- 3. NOTIFICATION CENTER 2.0 TABLES
-- ============================================================================

-- A. Central Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    body TEXT NOT NULL,
    logo_url TEXT,
    image_url TEXT,
    cta_text TEXT,
    cta_url TEXT,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'CANCELLED', 'FAILED')),
    audience_type TEXT NOT NULL DEFAULT 'ALL_USERS' CHECK (audience_type IN ('ALL_USERS', 'SELECTED_USERS', 'FREE_USERS', 'PRO_USERS', 'VERIFIED_USERS', 'UNVERIFIED_USERS', 'ADMINS', 'CUSTOM_SEGMENT')),
    audience_definition JSONB DEFAULT '{}'::jsonb,
    channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON public.notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON public.notifications(created_by);

-- B. Per-Recipient Delivery Tracking Table
CREATE TABLE IF NOT EXISTS public.notification_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'PROCESSING', 'DELIVERED', 'READ', 'CLICKED', 'FAILED')),
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email')),
    idempotency_key TEXT NOT NULL UNIQUE,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_recipients_user ON public.notification_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_notif_id ON public.notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_status ON public.notification_recipients(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_read_at ON public.notification_recipients(read_at);

-- C. Notification Templates
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    subject TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    cta_text TEXT,
    cta_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- D. User Notification Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON public.notification_preferences(user_id);

-- E. Notification Audit Logs
CREATE TABLE IF NOT EXISTS public.notification_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    recipient_count INTEGER DEFAULT 0,
    target_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_audit_actor ON public.notification_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_audit_action ON public.notification_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_notif_audit_timestamp ON public.notification_audit_logs(timestamp DESC);

-- F. SuperAdmin System Notification Settings
CREATE TABLE IF NOT EXISTS public.notification_system_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    global_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    max_broadcast_size INTEGER NOT NULL DEFAULT 50000,
    require_superadmin_approval BOOLEAN NOT NULL DEFAULT TRUE,
    promotional_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    default_sender_name TEXT NOT NULL DEFAULT 'Saarvi',
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 5000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

-- Insert Default Settings
INSERT INTO public.notification_system_settings (
    id, global_enabled, email_enabled, in_app_enabled, max_broadcast_size,
    require_superadmin_approval, promotional_email_enabled, default_sender_name, rate_limit_per_hour
) VALUES (
    'global', TRUE, TRUE, TRUE, 50000, TRUE, TRUE, 'Saarvi', 5000
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_system_settings ENABLE ROW LEVEL SECURITY;

-- 4.1 Notifications RLS
-- Users can only read notifications delivered to them
DROP POLICY IF EXISTS "Users can read their delivered notifications" ON public.notifications;
CREATE POLICY "Users can read their delivered notifications"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.notification_recipients nr
            WHERE nr.notification_id = notifications.id
              AND nr.user_id = auth.uid()::text
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS "Admins and SuperAdmins can manage notifications" ON public.notifications;
CREATE POLICY "Admins and SuperAdmins can manage notifications"
    ON public.notifications
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- 4.2 Notification Recipients RLS
-- User can read and update (mark read/clicked) only their own recipient rows
DROP POLICY IF EXISTS "Users can view own recipient records" ON public.notification_recipients;
CREATE POLICY "Users can view own recipient records"
    ON public.notification_recipients
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS "Users can update own recipient records" ON public.notification_recipients;
CREATE POLICY "Users can update own recipient records"
    ON public.notification_recipients
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

-- 4.3 Preferences RLS
DROP POLICY IF EXISTS "Users can view and manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view and manage own notification preferences"
    ON public.notification_preferences
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

-- 4.4 Audit Logs RLS
DROP POLICY IF EXISTS "SuperAdmins can view notification audit logs" ON public.notification_audit_logs;
CREATE POLICY "SuperAdmins can view notification audit logs"
    ON public.notification_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'SUPER_ADMIN'
        )
    );
