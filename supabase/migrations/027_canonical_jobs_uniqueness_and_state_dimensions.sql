-- SAARVI MIGRATION 027: CANONICAL JOBS ZERO-DUPLICATE UNIQUE CONSTRAINTS & MULTI-DIMENSIONAL STATE
-- Enforces database-level uniqueness on (provider, source_job_id) and canonical_job_key
-- Adds explicit decoupled state dimensions: record_state, review_state, publication_state, verification_state, enrichment_state

DO $$
BEGIN
    -- 1. Add state dimensions if not present
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_opportunities' AND column_name = 'record_state') THEN
        ALTER TABLE public.job_opportunities ADD COLUMN record_state TEXT NOT NULL DEFAULT 'ACTIVE' 
            CHECK (record_state IN ('ACTIVE', 'ARCHIVED', 'DELETED'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_opportunities' AND column_name = 'review_state') THEN
        ALTER TABLE public.job_opportunities ADD COLUMN review_state TEXT NOT NULL DEFAULT 'PENDING_REVIEW' 
            CHECK (review_state IN ('DISCOVERED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_opportunities' AND column_name = 'publication_state') THEN
        ALTER TABLE public.job_opportunities ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'NOT_PUBLISHED' 
            CHECK (publication_state IN ('NOT_PUBLISHED', 'PUBLISHED', 'PAUSED'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_opportunities' AND column_name = 'verification_state') THEN
        ALTER TABLE public.job_opportunities ADD COLUMN verification_state TEXT NOT NULL DEFAULT 'PENDING' 
            CHECK (verification_state IN ('PENDING', 'PASSED', 'FAILED', 'REQUIRES_REVIEW'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_opportunities' AND column_name = 'enrichment_state') THEN
        ALTER TABLE public.job_opportunities ADD COLUMN enrichment_state TEXT NOT NULL DEFAULT 'NOT_REQUIRED' 
            CHECK (enrichment_state IN ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));
    END IF;

    -- Backfill state dimensions based on legacy status
    UPDATE public.job_opportunities 
    SET 
        record_state = CASE 
            WHEN status = 'DELETED' THEN 'DELETED'
            WHEN status = 'ARCHIVED' THEN 'ARCHIVED'
            ELSE 'ACTIVE'
        END,
        review_state = CASE 
            WHEN status IN ('APPROVED', 'PUBLISHED', 'ACTIVE') THEN 'APPROVED'
            WHEN status = 'REJECTED' THEN 'REJECTED'
            WHEN status = 'DISCOVERED' THEN 'DISCOVERED'
            ELSE 'PENDING_REVIEW'
        END,
        publication_state = CASE 
            WHEN status IN ('PUBLISHED', 'ACTIVE') THEN 'PUBLISHED'
            WHEN status = 'PAUSED' THEN 'PAUSED'
            ELSE 'NOT_PUBLISHED'
        END,
        verification_state = CASE 
            WHEN verification_status = 'verified' THEN 'PASSED'
            WHEN verification_status = 'reported' THEN 'REQUIRES_REVIEW'
            WHEN verification_status = 'expired' THEN 'FAILED'
            ELSE 'PENDING'
        END
    WHERE record_state = 'ACTIVE' AND publication_state = 'NOT_PUBLISHED';
END $$;

-- 2. Enforce database uniqueness to guarantee ZERO duplicates
-- Primary provider identity uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_opps_provider_source_id 
    ON public.job_opportunities (provider, source_job_id) 
    WHERE source_job_id IS NOT NULL AND record_state != 'DELETED';

-- Fallback canonical key uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_opps_canonical_key 
    ON public.job_opportunities (canonical_job_key) 
    WHERE canonical_job_key IS NOT NULL AND record_state != 'DELETED';

-- Performance index for database-first user search
CREATE INDEX IF NOT EXISTS idx_job_opps_user_query 
    ON public.job_opportunities (publication_state, record_state, visibility, posted_at DESC) 
    WHERE publication_state = 'PUBLISHED' AND record_state = 'ACTIVE' AND visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_job_opps_review_state 
    ON public.job_opportunities (review_state, record_state);
