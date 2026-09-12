-- DocEase Phase 7: Database Addendum
-- Adds tool_name column to conversion_history for richer dashboard display
-- Execute this in your Supabase SQL Editor AFTER migration 001

-- 1. Add optional tool_name column to conversion_history
-- This stores the human-readable tool name alongside the tool_id slug
ALTER TABLE public.conversion_history
  ADD COLUMN IF NOT EXISTS tool_name TEXT;

-- 2. Confirm existing performance indexes are present (idempotent)
CREATE INDEX IF NOT EXISTS idx_conversion_history_user_created
  ON public.conversion_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resumes_user_updated
  ON public.resumes(user_id, updated_at DESC);

-- 3. Add index to support single-record delete by id + user_id (RLS + DELETE queries)
CREATE INDEX IF NOT EXISTS idx_conversion_history_id_user
  ON public.conversion_history(id, user_id);
