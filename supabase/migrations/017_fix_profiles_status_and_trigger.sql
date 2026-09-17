-- =============================================================================
-- SAARVI MIGRATION 017: FIX PROFILES STATUS COLUMN & LAST SUPERADMIN TRIGGER
-- =============================================================================
-- Solves: "record 'new' has no field 'status'" error when updating user profiles.
--
-- Root cause:
-- The trigger 'trg_protect_last_superadmin' on 'public.profiles' referenced
-- 'NEW.status', but 'public.profiles' was missing the 'status' column.
--
-- This migration:
-- 1. Adds the 'status' column to 'public.profiles' with default 'ACTIVE'.
-- 2. Hardens 'check_last_superadmin_protection()' to safely read status via JSON
--    so it NEVER throws a missing field error on any table schema state.
-- =============================================================================

-- 1. Ensure 'status' column exists on public.profiles
ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_status_check
            CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 2. Update all existing profiles without a status to 'ACTIVE'
UPDATE public.profiles
SET status = 'ACTIVE'
WHERE status IS NULL;

-- 3. Replace trigger function with bulletproof, safe implementation
CREATE OR REPLACE FUNCTION public.check_last_superadmin_protection()
RETURNS TRIGGER AS $$
DECLARE
    active_super_count INTEGER;
    old_role TEXT;
    new_role TEXT;
    old_status TEXT;
    new_status TEXT;
BEGIN
    -- Extract values safely using to_jsonb to prevent "record has no field" errors
    old_role := to_jsonb(OLD) ->> 'role';
    new_role := to_jsonb(NEW) ->> 'role';
    old_status := COALESCE(to_jsonb(OLD) ->> 'status', 'ACTIVE');
    new_status := COALESCE(to_jsonb(NEW) ->> 'status', 'ACTIVE');

    -- If demoting, suspending, or deactivating a SUPER_ADMIN
    IF (TG_OP = 'UPDATE') THEN
        IF (old_role = 'SUPER_ADMIN' AND (new_role <> 'SUPER_ADMIN' OR new_status <> 'ACTIVE')) THEN
            SELECT COUNT(*) INTO active_super_count
            FROM public.profiles
            WHERE role = 'SUPER_ADMIN'
              AND COALESCE(to_jsonb(profiles) ->> 'status', 'ACTIVE') = 'ACTIVE'
              AND id <> OLD.id;

            IF (active_super_count = 0) THEN
                RAISE EXCEPTION 'At least one active SuperAdmin is required.';
            END IF;
        END IF;
    END IF;

    -- If deleting a SUPER_ADMIN
    IF (TG_OP = 'DELETE') THEN
        IF (old_role = 'SUPER_ADMIN') THEN
            SELECT COUNT(*) INTO active_super_count
            FROM public.profiles
            WHERE role = 'SUPER_ADMIN'
              AND COALESCE(to_jsonb(profiles) ->> 'status', 'ACTIVE') = 'ACTIVE'
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

-- 4. Re-bind the trigger to public.profiles
DROP TRIGGER IF EXISTS trg_protect_last_superadmin ON public.profiles;
CREATE TRIGGER trg_protect_last_superadmin
    BEFORE UPDATE OR DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_last_superadmin_protection();
