-- =============================================================================
-- DOC EASE — PHASE 13: PRO SUBSCRIPTIONS, BILLING & SECURE ENTITLEMENTS
-- =============================================================================
-- Establishes server-authoritative tables for subscriptions, idempotent webhook
-- event processing, invoice records, and row-level security policies.

-- 1. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'stripe', 'sandbox')),
    provider_customer_id TEXT,
    provider_subscription_id TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('pro')),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
    billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
    currency TEXT NOT NULL DEFAULT 'INR',
    amount_cents INTEGER NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rapid user subscription lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub_id ON public.subscriptions(provider_subscription_id);

-- 2. BILLING EVENTS TABLE (WEBHOOK IDEMPOTENCY)
CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PROCESSED', 'FAILED', 'IGNORED')),
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_provider_event_id ON public.billing_events(provider_event_id);

-- 3. INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    provider_invoice_id TEXT UNIQUE NOT NULL,
    amount_paid INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'paid',
    invoice_url TEXT,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Subscriptions: User can view their own subscription
DROP POLICY IF EXISTS "Users can read their own subscription" ON public.subscriptions;
CREATE POLICY "Users can read their own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Subscriptions: Admins and service role can manage subscriptions
DROP POLICY IF EXISTS "Admins and service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins and service role can manage subscriptions"
    ON public.subscriptions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Invoices: Users can read their own invoices
DROP POLICY IF EXISTS "Users can read their own invoices" ON public.invoices;
CREATE POLICY "Users can read their own invoices"
    ON public.invoices FOR SELECT
    USING (auth.uid() = user_id);

-- Invoices: Admins can view all invoices
DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;
CREATE POLICY "Admins can view all invoices"
    ON public.invoices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Billing Events: Admins can view billing events
DROP POLICY IF EXISTS "Admins can view billing events" ON public.billing_events;
CREATE POLICY "Admins can view billing events"
    ON public.billing_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );
