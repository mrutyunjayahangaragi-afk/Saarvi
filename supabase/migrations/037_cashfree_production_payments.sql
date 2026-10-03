-- =============================================================================
-- Migration 037: Production Real-Money Payments — Cashfree Only
-- Saarvi — Study. Work. Grow.
-- =============================================================================
-- 1. PAYMENT ORDERS: Server-authoritative order tracking (provider = 'cashfree')
-- 2. PAYMENT TRANSACTIONS: Financial ledger of captured/verified payments
-- 3. PAYMENT WEBHOOK EVENTS: Cryptographic idempotency log for Cashfree webhooks
-- 4. ENTITLEMENTS: Server-authoritative Pro features and access intervals
-- =============================================================================

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PAYMENT ORDERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade existing or newly created table with all required Cashfree columns
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'cashfree';
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS order_reference TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS amount_paise INTEGER;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'CREATED';
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'SANDBOX';
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS payment_session_id TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Relax legacy NOT NULL and CHECK constraints from migration 022 if they exist
DO $$
BEGIN
    -- Drop legacy check constraints if they exist
    ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_provider_check;
    ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_check;
    ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_plan_check;
    ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_billing_interval_check;
    
    -- Relax legacy NOT NULL columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'user_email'
    ) THEN
        ALTER TABLE public.payment_orders ALTER COLUMN user_email DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'receipt'
    ) THEN
        ALTER TABLE public.payment_orders ALTER COLUMN receipt DROP NOT NULL;
    END IF;
    
    -- Backfill order_reference on legacy records if null
    UPDATE public.payment_orders
    SET order_reference = COALESCE(provider_order_id, 'ord_' || replace(id::text, '-', ''))
    WHERE order_reference IS NULL;

    -- Backfill amount_paise from amount_cents if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'amount_cents'
    ) THEN
        UPDATE public.payment_orders
        SET amount_paise = amount_cents
        WHERE amount_paise IS NULL AND amount_cents IS NOT NULL;
    END IF;

    -- Backfill plan_id from plan if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'plan'
    ) THEN
        UPDATE public.payment_orders
        SET plan_id = COALESCE(plan, 'pro_monthly')
        WHERE plan_id IS NULL;
    END IF;
END $$;

-- Indexes for rapid order lookup and user history
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created ON public.payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_order_id ON public.payment_orders(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_ref ON public.payment_orders(order_reference);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);

-- -----------------------------------------------------------------------------
-- 2. PAYMENT TRANSACTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'cashfree' CHECK (provider = 'cashfree'),
    provider_payment_id TEXT NOT NULL,
    provider_reference TEXT,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    status TEXT NOT NULL 
        CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED', 'REFUNDED')),
    payment_method TEXT,
    gateway_response_reference JSONB DEFAULT '{}'::jsonb,
    captured_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_payment_transactions_provider_payment UNIQUE (provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON public.payment_transactions(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON public.payment_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON public.payment_transactions(provider_payment_id);

-- -----------------------------------------------------------------------------
-- 3. PAYMENT WEBHOOK EVENTS (Idempotency Fortress)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'cashfree' CHECK (provider = 'cashfree'),
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    payload_hash TEXT NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_payment_webhook_events_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_processed ON public.payment_webhook_events(processed, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_type ON public.payment_webhook_events(event_type);

-- -----------------------------------------------------------------------------
-- 4. ENTITLEMENTS (Server-Authoritative Pro Grants)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL DEFAULT 'pro',
    plan_id TEXT NOT NULL CHECK (plan_id IN ('pro_monthly', 'pro_yearly')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL DEFAULT 'CASHFREE',
    payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_active ON public.entitlements(user_id, status, ends_at DESC);

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- payment_orders policies
DROP POLICY IF EXISTS "Users can view their own payment orders" ON public.payment_orders;
CREATE POLICY "Users can view their own payment orders"
    ON public.payment_orders FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view and manage all payment orders" ON public.payment_orders;
CREATE POLICY "Admins can view and manage all payment orders"
    ON public.payment_orders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- payment_transactions policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.payment_transactions;
CREATE POLICY "Users can view their own transactions"
    ON public.payment_transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.payment_transactions;
CREATE POLICY "Admins can view all transactions"
    ON public.payment_transactions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- payment_webhook_events policies (Service Role and Admin only)
DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.payment_webhook_events;
CREATE POLICY "Admins can view webhook logs"
    ON public.payment_webhook_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- entitlements policies
DROP POLICY IF EXISTS "Users can view their own entitlements" ON public.entitlements;
CREATE POLICY "Users can view their own entitlements"
    ON public.entitlements FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage entitlements" ON public.entitlements;
CREATE POLICY "Admins can manage entitlements"
    ON public.entitlements FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );
