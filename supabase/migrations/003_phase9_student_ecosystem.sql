-- DocEase Phase 9: Student Productivity Ecosystem Schema
-- Execute this migration in your Supabase SQL Editor

-- 1. Study Plans Table
CREATE TABLE IF NOT EXISTS public.student_study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  task_date DATE NOT NULL,
  start_time TEXT NOT NULL DEFAULT '19:00',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Assignments Table
CREATE TABLE IF NOT EXISTS public.student_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  due_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Timetables Table
CREATE TABLE IF NOT EXISTS public.student_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  subject TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT,
  notes TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Certificates Metadata Table (0 document bytes uploaded, strictly metadata)
CREATE TABLE IF NOT EXISTS public.student_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT 'Academic' CHECK (category IN ('Academic', 'Course', 'Competition', 'Internship', 'Other')),
  credential_id TEXT,
  verification_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Internships Tracker Table
CREATE TABLE IF NOT EXISTS public.student_internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT,
  application_date DATE NOT NULL,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('interested', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn')),
  link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Hackathons Tracker Table
CREATE TABLE IF NOT EXISTS public.student_hackathons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  organizer TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  registration_deadline DATE,
  team_name TEXT,
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'registered', 'selected', 'finalist', 'winner', 'completed')),
  link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Cover Letters Table
CREATE TABLE IF NOT EXISTS public.student_cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT NOT NULL,
  linkedin TEXT,
  github TEXT,
  letter_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recipient_name TEXT NOT NULL,
  recipient_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_address TEXT,
  target_role TEXT NOT NULL,
  opening TEXT NOT NULL,
  body_paragraph1 TEXT NOT NULL,
  body_paragraph2 TEXT,
  skills_highlight TEXT NOT NULL,
  closing TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'classic' CHECK (template IN ('classic', 'modern', 'minimal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_study_plans_user_date ON public.student_study_plans(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_assignments_user_due ON public.student_assignments(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_timetables_user_day ON public.student_timetables(user_id, day);
CREATE INDEX IF NOT EXISTS idx_certificates_user_created ON public.student_certificates(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internships_user_status ON public.student_internships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_hackathons_user_start ON public.student_hackathons(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_updated ON public.student_cover_letters(user_id, updated_at DESC);

-- Enable RLS on all 7 tables
ALTER TABLE public.student_study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_hackathons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cover_letters ENABLE ROW LEVEL SECURITY;

-- Strict User Isolation Policies (auth.uid() = user_id)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'student_study_plans',
    'student_assignments',
    'student_timetables',
    'student_certificates',
    'student_internships',
    'student_hackathons',
    'student_cover_letters'
  ] LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Users own select %I" ON public.%I;
      CREATE POLICY "Users own select %I" ON public.%I FOR SELECT USING (user_id = (SELECT auth.uid()));

      DROP POLICY IF EXISTS "Users own insert %I" ON public.%I;
      CREATE POLICY "Users own insert %I" ON public.%I FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

      DROP POLICY IF EXISTS "Users own update %I" ON public.%I;
      CREATE POLICY "Users own update %I" ON public.%I FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

      DROP POLICY IF EXISTS "Users own delete %I" ON public.%I;
      CREATE POLICY "Users own delete %I" ON public.%I FOR DELETE USING (user_id = (SELECT auth.uid()));
    ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;
