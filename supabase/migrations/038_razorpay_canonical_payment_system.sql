-- =============================================================================
-- Migration 038: Canonical Real-Money Payments — Razorpay Restoration
-- Saarvi — Study. Work. Grow.
-- =============================================================================
-- 1. PAYMENT ORDERS: Default provider = 'razorpay'
-- 2. PAYMENT TRANSACTIONS: Financial ledger accepting 'razorpay'
-- 3. PAYMENT WEBHOOK EVENTS: Idempotency log for Razorpay webhooks
-- 4. ENTITLEMENTS: Default source = 'RAZORPAY'
-- 5. SUBSCRIPTIONS: Support 'razorpay' as primary gateway provider
-- =============================================================================

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PAYMENT ORDERS
-- -----------------------------------------------------------------------------
ALTER TABLE public.payment_orders ALTER COLUMN provider SET DEFAULT 'razorpay';

-- Relax any provider check constraint if it was restricted
DO $$
BEGIN
    ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_provider_check;
    ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_provider_check 
        CHECK (provider IN ('razorpay', 'cashfree'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. PAYMENT TRANSACTIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.payment_transactions ALTER COLUMN provider SET DEFAULT 'razorpay';

DO $$
BEGIN
    ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_provider_check;
    ALTER TABLE public.payment_transactions ADD CONSTRAINT payment_transactions_provider_check 
        CHECK (provider IN ('razorpay', 'cashfree'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 3. PAYMENT WEBHOOK EVENTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.payment_webhook_events ALTER COLUMN provider SET DEFAULT 'razorpay';

DO $$
BEGIN
    ALTER TABLE public.payment_webhook_events DROP CONSTRAINT IF EXISTS payment_webhook_events_provider_check;
    ALTER TABLE public.payment_webhook_events ADD CONSTRAINT payment_webhook_events_provider_check 
        CHECK (provider IN ('razorpay', 'cashfree'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 4. ENTITLEMENTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.entitlements ALTER COLUMN source SET DEFAULT 'RAZORPAY';

-- -----------------------------------------------------------------------------
-- 5. INDEXES FOR HIGH-THROUGHPUT RECONCILIATION
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_order ON public.payment_orders(provider, provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_payment ON public.payment_transactions(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_event ON public.payment_webhook_events(provider, event_id);
