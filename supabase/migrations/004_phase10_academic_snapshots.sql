-- =============================================================================
-- DOC EASE — PHASE 10 MIGRATION: ACADEMIC CALCULATION SNAPSHOTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.student_academic_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  university TEXT NOT NULL DEFAULT 'VTU',
  scheme TEXT NOT NULL DEFAULT '2022',
  branch TEXT NOT NULL DEFAULT 'CSE',
  cgpa NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  total_credits INTEGER NOT NULL DEFAULT 0,
  earned_credits INTEGER NOT NULL DEFAULT 0,
  total_credit_points NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  percentage_equivalent NUMERIC(5,2) DEFAULT 0.00,
  curriculum_version TEXT NOT NULL DEFAULT '1.0',
  grading_version TEXT NOT NULL DEFAULT '1.0',
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user retrieval
CREATE INDEX IF NOT EXISTS idx_student_academic_records_user_id
  ON public.student_academic_records(user_id);

CREATE INDEX IF NOT EXISTS idx_student_academic_records_user_status
  ON public.student_academic_records(user_id, status, updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.student_academic_records ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy
DROP POLICY IF EXISTS "Users can view own academic records" ON public.student_academic_records;
CREATE POLICY "Users can view own academic records"
  ON public.student_academic_records
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- 2. INSERT Policy
DROP POLICY IF EXISTS "Users can insert own academic records" ON public.student_academic_records;
CREATE POLICY "Users can insert own academic records"
  ON public.student_academic_records
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 3. UPDATE Policy
DROP POLICY IF EXISTS "Users can update own academic records" ON public.student_academic_records;
CREATE POLICY "Users can update own academic records"
  ON public.student_academic_records
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 4. DELETE Policy
DROP POLICY IF EXISTS "Users can delete own academic records" ON public.student_academic_records;
CREATE POLICY "Users can delete own academic records"
  ON public.student_academic_records
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));
