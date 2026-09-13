-- =============================================================================
-- SAARVI — PHASE 30E+: MANUAL UPI PAYMENTS, SLA TRACKING & PRO ENTITLEMENTS
-- =============================================================================
-- Establishes server-authoritative tables for Manual UPI payments, admin review SLA,
-- direct UPI intents, and updates subscription provider constraints.

-- 1. UPDATE SUBSCRIPTIONS TABLE TO ALLOW MANUAL_UPI PROVIDER
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'subscriptions_provider_check' 
        AND table_name = 'subscriptions'
    ) THEN
        ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_provider_check;
        ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_check 
            CHECK (provider IN ('razorpay', 'stripe', 'sandbox', 'manual_upi'));
    END IF;
END $$;

-- 2. PAYMENT CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.payment_configs (
    id TEXT PRIMARY KEY DEFAULT 'default',
    upi_id TEXT NOT NULL,
    payee_name TEXT NOT NULL,
    amount_monthly NUMERIC(10, 2) NOT NULL DEFAULT 49.00,
    amount_yearly NUMERIC(10, 2) NOT NULL DEFAULT 399.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    qr_code_url TEXT,
    review_sla_hours INTEGER NOT NULL DEFAULT 2,
    instructions TEXT,
    support_email TEXT NOT NULL DEFAULT 'payments@saarvi.app',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'DISABLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Seed default configuration if empty
INSERT INTO public.payment_configs (
    id, upi_id, payee_name, amount_monthly, amount_yearly, currency, review_sla_hours, support_email, instructions
) VALUES (
    'default',
    'saarvi@upi',
    'Saarvi Educational Services',
    49.00,
    399.00,
    'INR',
    2,
    'payments@saarvi.app',
    '1. Pay exact amount using any UPI App (PhonePe, Google Pay, Paytm) or scan QR code. 2. Copy the 12-digit UTR / Reference number. 3. Submit below. Our team reviews within 2 hours!'
) ON CONFLICT (id) DO NOTHING;

-- 3. MANUAL UPI PAYMENT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.manual_payment_requests (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    plan_duration TEXT NOT NULL CHECK (plan_duration IN ('MONTHLY', 'YEARLY')),
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    payee_upi_id TEXT NOT NULL,
    utr_number TEXT NOT NULL,
    payer_upi_id TEXT,
    payment_proof_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    sla_deadline TIMESTAMPTZ NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    review_notes TEXT,
    subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PERFORMANCE & SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_user_id ON public.manual_payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_status ON public.manual_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_utr ON public.manual_payment_requests(utr_number);
CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_sla ON public.manual_payment_requests(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_created ON public.manual_payment_requests(created_at DESC);

-- 5. ROW-LEVEL SECURITY (RLS)
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;

-- Payment Config: Readable by all authenticated and anonymous users
CREATE POLICY payment_configs_read_all ON public.payment_configs
    FOR SELECT USING (true);

-- Payment Config: Modifiable only by Super Admins / Admins
CREATE POLICY payment_configs_admin_all ON public.payment_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Payment Requests: Users can read their own submissions
CREATE POLICY manual_payment_requests_user_read ON public.manual_payment_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Payment Requests: Users can insert their own payment requests
CREATE POLICY manual_payment_requests_user_insert ON public.manual_payment_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payment Requests: Admins can view and update all requests
CREATE POLICY manual_payment_requests_admin_all ON public.manual_payment_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );
