-- =============================================================================
-- SAARVI — PHASE 42: RAZORPAY PAYMENT ORDERS & SECURE CONVERGENCE
-- =============================================================================
-- Stores server-authoritative Razorpay orders, status lifecycle,
-- cryptographic verification outcomes, and reconciliation metadata.

CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    user_name TEXT,
    provider TEXT NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay')),
    provider_order_id TEXT UNIQUE NOT NULL,
    provider_payment_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('pro')),
    billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'paid', 'failed', 'cancelled')),
    receipt TEXT NOT NULL,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bounded Indexes for rapid order reconciliation and user history
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created ON public.payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_order_id ON public.payment_orders(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_payment_id ON public.payment_orders(provider_payment_id);

-- Row Level Security
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payment orders" ON public.payment_orders;
CREATE POLICY "Users can view their own payment orders"
    ON public.payment_orders FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and service role can manage payment orders" ON public.payment_orders;
CREATE POLICY "Admins and service role can manage payment orders"
    ON public.payment_orders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );
