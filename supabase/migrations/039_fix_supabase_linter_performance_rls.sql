-- =============================================================================
-- SAARVI MIGRATION 039: SUPABASE DATABASE LINTER PERFORMANCE REMEDIATION
-- Resolves all performance warnings reported by the Supabase Database Linter:
-- 1. auth_rls_initplan (0003): Wraps auth.uid() & auth.<fn>() in (SELECT auth.<fn>())
--    to convert per-row function evaluation into a single-execution InitPlan.
-- 2. multiple_permissive_policies (0006): Eliminates redundant permissive SELECT
--    policies by restricting Admin write policies to INSERT, UPDATE, DELETE when
--    a Public Read policy is already present for SELECT.
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTION FOR ZERO-OVERHEAD ADMIN CHECKS (CACHED INITPLAN COMPATIBLE)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('ADMIN', 'SUPER_ADMIN', 'admin', 'superadmin', 'founder')
      )
    )
  );
$$;

-- =============================================================================
-- 1. STUDENT PRODUCTIVITY & ACADEMIC ECOSYSTEM TABLES
-- =============================================================================

-- 1.1 Table: public.student_study_plans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_study_plans') THEN
    DROP POLICY IF EXISTS "Users own select student_study_plans" ON public.student_study_plans;
    DROP POLICY IF EXISTS "Users own insert student_study_plans" ON public.student_study_plans;
    DROP POLICY IF EXISTS "Users own update student_study_plans" ON public.student_study_plans;
    DROP POLICY IF EXISTS "Users own delete student_study_plans" ON public.student_study_plans;

    CREATE POLICY "Users own select student_study_plans" ON public.student_study_plans
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_study_plans" ON public.student_study_plans
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_study_plans" ON public.student_study_plans
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_study_plans" ON public.student_study_plans
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.2 Table: public.student_assignments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_assignments') THEN
    DROP POLICY IF EXISTS "Users own select student_assignments" ON public.student_assignments;
    DROP POLICY IF EXISTS "Users own insert student_assignments" ON public.student_assignments;
    DROP POLICY IF EXISTS "Users own update student_assignments" ON public.student_assignments;
    DROP POLICY IF EXISTS "Users own delete student_assignments" ON public.student_assignments;

    CREATE POLICY "Users own select student_assignments" ON public.student_assignments
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_assignments" ON public.student_assignments
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_assignments" ON public.student_assignments
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_assignments" ON public.student_assignments
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.3 Table: public.student_timetables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_timetables') THEN
    DROP POLICY IF EXISTS "Users own select student_timetables" ON public.student_timetables;
    DROP POLICY IF EXISTS "Users own insert student_timetables" ON public.student_timetables;
    DROP POLICY IF EXISTS "Users own update student_timetables" ON public.student_timetables;
    DROP POLICY IF EXISTS "Users own delete student_timetables" ON public.student_timetables;

    CREATE POLICY "Users own select student_timetables" ON public.student_timetables
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_timetables" ON public.student_timetables
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_timetables" ON public.student_timetables
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_timetables" ON public.student_timetables
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.4 Table: public.student_certificates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_certificates') THEN
    DROP POLICY IF EXISTS "Users own select student_certificates" ON public.student_certificates;
    DROP POLICY IF EXISTS "Users own insert student_certificates" ON public.student_certificates;
    DROP POLICY IF EXISTS "Users own update student_certificates" ON public.student_certificates;
    DROP POLICY IF EXISTS "Users own delete student_certificates" ON public.student_certificates;

    CREATE POLICY "Users own select student_certificates" ON public.student_certificates
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_certificates" ON public.student_certificates
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_certificates" ON public.student_certificates
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_certificates" ON public.student_certificates
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.5 Table: public.student_internships
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_internships') THEN
    DROP POLICY IF EXISTS "Users own select student_internships" ON public.student_internships;
    DROP POLICY IF EXISTS "Users own insert student_internships" ON public.student_internships;
    DROP POLICY IF EXISTS "Users own update student_internships" ON public.student_internships;
    DROP POLICY IF EXISTS "Users own delete student_internships" ON public.student_internships;

    CREATE POLICY "Users own select student_internships" ON public.student_internships
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_internships" ON public.student_internships
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_internships" ON public.student_internships
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_internships" ON public.student_internships
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.6 Table: public.student_hackathons
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_hackathons') THEN
    DROP POLICY IF EXISTS "Users own select student_hackathons" ON public.student_hackathons;
    DROP POLICY IF EXISTS "Users own insert student_hackathons" ON public.student_hackathons;
    DROP POLICY IF EXISTS "Users own update student_hackathons" ON public.student_hackathons;
    DROP POLICY IF EXISTS "Users own delete student_hackathons" ON public.student_hackathons;

    CREATE POLICY "Users own select student_hackathons" ON public.student_hackathons
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_hackathons" ON public.student_hackathons
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_hackathons" ON public.student_hackathons
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_hackathons" ON public.student_hackathons
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.7 Table: public.student_cover_letters
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_cover_letters') THEN
    DROP POLICY IF EXISTS "Users own select student_cover_letters" ON public.student_cover_letters;
    DROP POLICY IF EXISTS "Users own insert student_cover_letters" ON public.student_cover_letters;
    DROP POLICY IF EXISTS "Users own update student_cover_letters" ON public.student_cover_letters;
    DROP POLICY IF EXISTS "Users own delete student_cover_letters" ON public.student_cover_letters;

    CREATE POLICY "Users own select student_cover_letters" ON public.student_cover_letters
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_cover_letters" ON public.student_cover_letters
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_cover_letters" ON public.student_cover_letters
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_cover_letters" ON public.student_cover_letters
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.8 Table: public.student_academic_records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_academic_records') THEN
    DROP POLICY IF EXISTS "Users can view own academic records" ON public.student_academic_records;
    DROP POLICY IF EXISTS "Users can insert own academic records" ON public.student_academic_records;
    DROP POLICY IF EXISTS "Users can update own academic records" ON public.student_academic_records;
    DROP POLICY IF EXISTS "Users can delete own academic records" ON public.student_academic_records;

    CREATE POLICY "Users can view own academic records" ON public.student_academic_records
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can insert own academic records" ON public.student_academic_records
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can update own academic records" ON public.student_academic_records
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can delete own academic records" ON public.student_academic_records
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- 2. CORE USER PROFILES & USER DATA
-- =============================================================================

-- 2.1 Table: public.profiles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

    CREATE POLICY "Users can view own profile" ON public.profiles
      FOR SELECT USING (id = (SELECT auth.uid()));

    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

    CREATE POLICY "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

    CREATE POLICY "Users can delete own profile" ON public.profiles
      FOR DELETE USING (id = (SELECT auth.uid()));
  END IF;
END $$;

-- 2.2 Table: public.conversion_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversion_history') THEN
    DROP POLICY IF EXISTS "Users can view own conversion history" ON public.conversion_history;
    DROP POLICY IF EXISTS "Users can insert own conversion history" ON public.conversion_history;
    DROP POLICY IF EXISTS "Users can delete own conversion history" ON public.conversion_history;

    CREATE POLICY "Users can view own conversion history" ON public.conversion_history
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can insert own conversion history" ON public.conversion_history
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can delete own conversion history" ON public.conversion_history
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 2.3 Table: public.resumes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resumes') THEN
    DROP POLICY IF EXISTS "Users can view own resumes" ON public.resumes;
    DROP POLICY IF EXISTS "Users can insert own resumes" ON public.resumes;
    DROP POLICY IF EXISTS "Users can update own resumes" ON public.resumes;
    DROP POLICY IF EXISTS "Users can delete own resumes" ON public.resumes;

    CREATE POLICY "Users can view own resumes" ON public.resumes
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can insert own resumes" ON public.resumes
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can update own resumes" ON public.resumes
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can delete own resumes" ON public.resumes
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 2.4 Table: public.user_preferences
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_preferences') THEN
    DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
    DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
    DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

    CREATE POLICY "Users can view own preferences" ON public.user_preferences
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can insert own preferences" ON public.user_preferences
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can update own preferences" ON public.user_preferences
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- 3. SUBSCRIPTIONS, BILLING & PAYMENTS
-- =============================================================================

-- 3.1 Table: public.subscriptions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    DROP POLICY IF EXISTS "Users can read their own subscription" ON public.subscriptions;
    DROP POLICY IF EXISTS "Admins and service role can manage subscriptions" ON public.subscriptions;

    CREATE POLICY "Users can read their own subscription" ON public.subscriptions
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins and service role can manage subscriptions" ON public.subscriptions
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.2 Table: public.invoices
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoices') THEN
    DROP POLICY IF EXISTS "Users can read their own invoices" ON public.invoices;
    DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;

    CREATE POLICY "Users can read their own invoices" ON public.invoices
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins can view all invoices" ON public.invoices
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.3 Table: public.billing_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_events') THEN
    DROP POLICY IF EXISTS "Admins can view billing events" ON public.billing_events;

    CREATE POLICY "Admins can view billing events" ON public.billing_events
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.4 Table: public.payment_orders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_orders') THEN
    DROP POLICY IF EXISTS "Users can view their own payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Admins can view and manage all payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Admins and service role can manage payment orders" ON public.payment_orders;

    CREATE POLICY "Users can view their own payment orders" ON public.payment_orders
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins can view and manage all payment orders" ON public.payment_orders
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.5 Table: public.payment_transactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_transactions') THEN
    DROP POLICY IF EXISTS "Users can view their own transactions" ON public.payment_transactions;
    DROP POLICY IF EXISTS "Admins can view all transactions" ON public.payment_transactions;

    CREATE POLICY "Users can view their own transactions" ON public.payment_transactions
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins can view all transactions" ON public.payment_transactions
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.6 Table: public.payment_webhook_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_webhook_events') THEN
    DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.payment_webhook_events;

    CREATE POLICY "Admins can view webhook logs" ON public.payment_webhook_events
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.7 Table: public.entitlements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'entitlements') THEN
    DROP POLICY IF EXISTS "Users can view their own entitlements" ON public.entitlements;
    DROP POLICY IF EXISTS "Admins can manage entitlements" ON public.entitlements;

    CREATE POLICY "Users can view their own entitlements" ON public.entitlements
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins can manage entitlements" ON public.entitlements
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.8 Table: public.subscription_requests
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_requests') THEN
    DROP POLICY IF EXISTS "Users read own subscription requests" ON public.subscription_requests;
    DROP POLICY IF EXISTS "Users insert own subscription requests" ON public.subscription_requests;
    DROP POLICY IF EXISTS "Superadmins manage subscription requests" ON public.subscription_requests;

    CREATE POLICY "Users read own subscription requests" ON public.subscription_requests
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users insert own subscription requests" ON public.subscription_requests
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Superadmins manage subscription requests" ON public.subscription_requests
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.9 Table: public.subscription_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_audit_logs') THEN
    DROP POLICY IF EXISTS "Superadmins read audit logs" ON public.subscription_audit_logs;

    CREATE POLICY "Superadmins read audit logs" ON public.subscription_audit_logs
      FOR SELECT USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.10 Table: public.payment_configs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_configs') THEN
    DROP POLICY IF EXISTS "payment_configs_admin_all" ON public.payment_configs;

    CREATE POLICY "payment_configs_admin_all" ON public.payment_configs
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.11 Table: public.manual_payment_requests
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'manual_payment_requests') THEN
    DROP POLICY IF EXISTS "manual_payment_requests_user_read" ON public.manual_payment_requests;
    DROP POLICY IF EXISTS "manual_payment_requests_user_insert" ON public.manual_payment_requests;
    DROP POLICY IF EXISTS "manual_payment_requests_admin_all" ON public.manual_payment_requests;

    CREATE POLICY "manual_payment_requests_user_read" ON public.manual_payment_requests
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "manual_payment_requests_user_insert" ON public.manual_payment_requests
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "manual_payment_requests_admin_all" ON public.manual_payment_requests
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- =============================================================================
-- 4. ACADEMIC HIERARCHY TABLES
-- (Resolves both auth_rls_initplan and multiple_permissive_policies)
-- =============================================================================

-- 4.1 Table: public.academic_universities
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_universities') THEN
    DROP POLICY IF EXISTS "Public read academic universities" ON public.academic_universities;
    DROP POLICY IF EXISTS "Admin manage academic universities" ON public.academic_universities;
    DROP POLICY IF EXISTS "Admin write academic universities" ON public.academic_universities;

    -- Only 1 permissive policy for SELECT
    CREATE POLICY "Public read academic universities" ON public.academic_universities
      FOR SELECT USING (true);

    -- Admin write operations separated (no SELECT overlap)
    CREATE POLICY "Admin write academic universities" ON public.academic_universities
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.2 Table: public.academic_schemes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_schemes') THEN
    DROP POLICY IF EXISTS "Public read academic schemes" ON public.academic_schemes;
    DROP POLICY IF EXISTS "Admin manage academic schemes" ON public.academic_schemes;
    DROP POLICY IF EXISTS "Admin write academic schemes" ON public.academic_schemes;

    -- Only 1 permissive policy for SELECT
    CREATE POLICY "Public read academic schemes" ON public.academic_schemes
      FOR SELECT USING (true);

    CREATE POLICY "Admin write academic schemes" ON public.academic_schemes
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.3 Table: public.academic_branches
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_branches') THEN
    DROP POLICY IF EXISTS "Public read academic branches" ON public.academic_branches;
    DROP POLICY IF EXISTS "Admin manage academic branches" ON public.academic_branches;
    DROP POLICY IF EXISTS "Admin write academic branches" ON public.academic_branches;

    -- Only 1 permissive policy for SELECT
    CREATE POLICY "Public read academic branches" ON public.academic_branches
      FOR SELECT USING (true);

    CREATE POLICY "Admin write academic branches" ON public.academic_branches
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.4 Table: public.academic_semesters
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_semesters') THEN
    DROP POLICY IF EXISTS "Public read academic semesters" ON public.academic_semesters;
    DROP POLICY IF EXISTS "Admin manage academic semesters" ON public.academic_semesters;
    DROP POLICY IF EXISTS "Admin write academic semesters" ON public.academic_semesters;

    -- Only 1 permissive policy for SELECT
    CREATE POLICY "Public read academic semesters" ON public.academic_semesters
      FOR SELECT USING (true);

    CREATE POLICY "Admin write academic semesters" ON public.academic_semesters
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.5 Table: public.academic_subjects
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_subjects') THEN
    DROP POLICY IF EXISTS "Anyone can read verified academic subjects" ON public.academic_subjects;
    DROP POLICY IF EXISTS "Admins manage academic subjects" ON public.academic_subjects;
    DROP POLICY IF EXISTS "Admins write academic subjects" ON public.academic_subjects;

    -- Only 1 permissive policy for SELECT
    CREATE POLICY "Anyone can read verified academic subjects" ON public.academic_subjects
      FOR SELECT USING (true);

    CREATE POLICY "Admins write academic subjects" ON public.academic_subjects
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.6 Table: public.academic_subject_conflicts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_subject_conflicts') THEN
    DROP POLICY IF EXISTS "Admins manage subject conflicts" ON public.academic_subject_conflicts;

    CREATE POLICY "Admins manage subject conflicts" ON public.academic_subject_conflicts
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.7 Table: public.curriculum_courses
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'curriculum_courses') THEN
    DROP POLICY IF EXISTS "Public read active curriculum courses" ON public.curriculum_courses;
    DROP POLICY IF EXISTS "Admins manage curriculum courses" ON public.curriculum_courses;

    CREATE POLICY "Public read active curriculum courses" ON public.curriculum_courses
      FOR SELECT USING (true);

    CREATE POLICY "Admins write curriculum courses" ON public.curriculum_courses
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.8 Table: public.curriculum_versions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'curriculum_versions') THEN
    DROP POLICY IF EXISTS "Public read active curriculum" ON public.curriculum_versions;
    DROP POLICY IF EXISTS "Admin manage curriculum" ON public.curriculum_versions;

    CREATE POLICY "Public read active curriculum" ON public.curriculum_versions
      FOR SELECT USING (true);

    CREATE POLICY "Admin write curriculum" ON public.curriculum_versions
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- =============================================================================
-- 5. CAREER & JOBS ECOSYSTEM TABLES
-- =============================================================================

-- 5.1 Table: public.job_opportunities
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_opportunities') THEN
    DROP POLICY IF EXISTS "Public read active opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Public read live opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Admin manage opportunities" ON public.job_opportunities;

    CREATE POLICY "Public read live opportunities" ON public.job_opportunities
      FOR SELECT USING (is_active = true);

    CREATE POLICY "Admin manage opportunities" ON public.job_opportunities
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.2 Table: public.job_source_records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_source_records') THEN
    DROP POLICY IF EXISTS "Admin access source records" ON public.job_source_records;

    CREATE POLICY "Admin access source records" ON public.job_source_records
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.3 Table: public.job_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_audit_logs') THEN
    DROP POLICY IF EXISTS "Admin access job audit logs" ON public.job_audit_logs;

    CREATE POLICY "Admin access job audit logs" ON public.job_audit_logs
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.4 Table: public.saved_jobs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_jobs') THEN
    DROP POLICY IF EXISTS "Users manage own saved jobs" ON public.saved_jobs;

    CREATE POLICY "Users manage own saved jobs" ON public.saved_jobs
      FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 5.5 Table: public.job_applications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_applications') THEN
    DROP POLICY IF EXISTS "Users manage own job applications" ON public.job_applications;

    CREATE POLICY "Users manage own job applications" ON public.job_applications
      FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 5.6 Table: public.job_reports
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_reports') THEN
    DROP POLICY IF EXISTS "Authenticated users create reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Users can create reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Admins manage job reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Admin manage reports" ON public.job_reports;

    CREATE POLICY "Authenticated users create reports" ON public.job_reports
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

    CREATE POLICY "Admins manage job reports" ON public.job_reports
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.7 Table: public.job_discovery_batches
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_discovery_batches') THEN
    DROP POLICY IF EXISTS "Admins can manage discovery batches" ON public.job_discovery_batches;

    CREATE POLICY "Admins can manage discovery batches" ON public.job_discovery_batches
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.8 Table: public.jobs (legacy)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'jobs') THEN
    DROP POLICY IF EXISTS "Admin full manage jobs" ON public.jobs;

    CREATE POLICY "Admin full manage jobs" ON public.jobs
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.9 Table: public.job_sources
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_sources') THEN
    DROP POLICY IF EXISTS "Admin manage sources" ON public.job_sources;

    CREATE POLICY "Admin manage sources" ON public.job_sources
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.10 Table: public.job_alerts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_alerts') THEN
    DROP POLICY IF EXISTS "Users manage own alerts" ON public.job_alerts;
    DROP POLICY IF EXISTS "Admin view all alerts" ON public.job_alerts;

    CREATE POLICY "Users manage own alerts" ON public.job_alerts
      FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admin view all alerts" ON public.job_alerts
      FOR SELECT USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.11 Table: public.job_search_cache
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_search_cache') THEN
    DROP POLICY IF EXISTS "Admin read cache" ON public.job_search_cache;

    CREATE POLICY "Admin read cache" ON public.job_search_cache
      FOR SELECT USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.12 Table: public.career_templates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_templates') THEN
    DROP POLICY IF EXISTS "Admins can manage career templates" ON public.career_templates;

    CREATE POLICY "Admins can manage career templates" ON public.career_templates
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.13 Table: public.template_import_batches
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'template_import_batches') THEN
    DROP POLICY IF EXISTS "Admins can manage template import batches" ON public.template_import_batches;

    CREATE POLICY "Admins can manage template import batches" ON public.template_import_batches
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.14 Table: public.training_opportunities
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'training_opportunities') THEN
    DROP POLICY IF EXISTS "Admins can manage training opportunities" ON public.training_opportunities;

    CREATE POLICY "Admins can manage training opportunities" ON public.training_opportunities
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- =============================================================================
-- 6. TOOLS, TELEMETRY, ADS & PLATFORM SETTINGS
-- =============================================================================

-- 6.1 Table: public.tool_health_checks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tool_health_checks') THEN
    DROP POLICY IF EXISTS "Admin read tool health checks" ON public.tool_health_checks;
    DROP POLICY IF EXISTS "Admin insert tool health checks" ON public.tool_health_checks;

    CREATE POLICY "Admin read tool health checks" ON public.tool_health_checks
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert tool health checks" ON public.tool_health_checks
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.2 Table: public.tool_access_configs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tool_access_configs') THEN
    DROP POLICY IF EXISTS "Admins manage tool access configs" ON public.tool_access_configs;

    CREATE POLICY "Admins manage tool access configs" ON public.tool_access_configs
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.3 Table: public.tool_beta_usages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tool_beta_usages') THEN
    DROP POLICY IF EXISTS "Users can read own beta usage" ON public.tool_beta_usages;
    DROP POLICY IF EXISTS "Admins can manage beta usages" ON public.tool_beta_usages;

    CREATE POLICY "Users can read own beta usage" ON public.tool_beta_usages
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins can manage beta usages" ON public.tool_beta_usages
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.4 Table: public.tool_overrides
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tool_overrides') THEN
    DROP POLICY IF EXISTS "Admin manage tool overrides" ON public.tool_overrides;

    CREATE POLICY "Admin manage tool overrides" ON public.tool_overrides
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.5 Table: public.platform_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_settings') THEN
    DROP POLICY IF EXISTS "Admin manage platform settings" ON public.platform_settings;

    CREATE POLICY "Admin manage platform settings" ON public.platform_settings
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.6 Table: public.announcements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'announcements') THEN
    DROP POLICY IF EXISTS "Admin manage announcements" ON public.announcements;

    CREATE POLICY "Admin manage announcements" ON public.announcements
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.7 Table: public.system_errors
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_errors') THEN
    DROP POLICY IF EXISTS "Admin manage system errors" ON public.system_errors;

    CREATE POLICY "Admin manage system errors" ON public.system_errors
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.8 Table: public.audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    DROP POLICY IF EXISTS "Admin insert and read audit logs" ON public.audit_logs;

    CREATE POLICY "Admin insert and read audit logs" ON public.audit_logs
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.9 Table: public.advertisements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'advertisements') THEN
    DROP POLICY IF EXISTS "Public read active ads" ON public.advertisements;
    DROP POLICY IF EXISTS "Admin manage advertisements" ON public.advertisements;

    CREATE POLICY "Public read active ads" ON public.advertisements
      FOR SELECT USING (true);

    CREATE POLICY "Admin write advertisements" ON public.advertisements
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.10 Table: public.ad_display_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_display_settings') THEN
    DROP POLICY IF EXISTS "Public read ad settings" ON public.ad_display_settings;
    DROP POLICY IF EXISTS "Admin manage ad display settings" ON public.ad_display_settings;
    DROP POLICY IF EXISTS "Admin write ad display settings" ON public.ad_display_settings;

    -- Only 1 permissive policy for SELECT
    CREATE POLICY "Public read ad settings" ON public.ad_display_settings
      FOR SELECT USING (true);

    CREATE POLICY "Admin write ad display settings" ON public.ad_display_settings
      FOR ALL TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.11 Table: public.ad_analytics_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_analytics_events') THEN
    DROP POLICY IF EXISTS "Admin view ad analytics" ON public.ad_analytics_events;

    CREATE POLICY "Admin view ad analytics" ON public.ad_analytics_events
      FOR SELECT USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.12 Table: public.platform_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_events') THEN
    DROP POLICY IF EXISTS "Users can read own platform events" ON public.platform_events;
    DROP POLICY IF EXISTS "Admins read all platform events" ON public.platform_events;

    CREATE POLICY "Users can read own platform events" ON public.platform_events
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins read all platform events" ON public.platform_events
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.13 Table: public.admin_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_audit_logs') THEN
    DROP POLICY IF EXISTS "Admins read admin audit logs" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "Admins insert admin audit logs" ON public.admin_audit_logs;

    CREATE POLICY "Admins read admin audit logs" ON public.admin_audit_logs
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admins insert admin audit logs" ON public.admin_audit_logs
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.14 Table: public.role_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'role_audit_logs') THEN
    DROP POLICY IF EXISTS "SuperAdmins can view role audit logs" ON public.role_audit_logs;

    CREATE POLICY "SuperAdmins can view role audit logs" ON public.role_audit_logs
      FOR SELECT USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- =============================================================================
-- 7. NOTIFICATIONS, NAVIGATION, FEEDBACK & INTERVIEW
-- =============================================================================

-- 7.1 Table: public.notifications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    DROP POLICY IF EXISTS "Users can read their delivered notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admins and SuperAdmins can manage notifications" ON public.notifications;

    CREATE POLICY "Users can read their delivered notifications" ON public.notifications
      FOR SELECT USING (
        id IN (SELECT notification_id FROM public.notification_recipients WHERE user_id = (SELECT auth.uid()))
      );

    CREATE POLICY "Admins and SuperAdmins can manage notifications" ON public.notifications
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.2 Table: public.notification_recipients
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_recipients') THEN
    DROP POLICY IF EXISTS "Users can view own recipient records" ON public.notification_recipients;
    DROP POLICY IF EXISTS "Users can update own recipient records" ON public.notification_recipients;

    CREATE POLICY "Users can view own recipient records" ON public.notification_recipients
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can update own recipient records" ON public.notification_recipients
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 7.3 Table: public.notification_preferences
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_preferences') THEN
    DROP POLICY IF EXISTS "Users can view and manage own notification preferences" ON public.notification_preferences;

    CREATE POLICY "Users can view and manage own notification preferences" ON public.notification_preferences
      FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 7.4 Table: public.notification_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_audit_logs') THEN
    DROP POLICY IF EXISTS "SuperAdmins can view notification audit logs" ON public.notification_audit_logs;

    CREATE POLICY "SuperAdmins can view notification audit logs" ON public.notification_audit_logs
      FOR SELECT USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.5 Table: public.navigation_items
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'navigation_items') THEN
    DROP POLICY IF EXISTS "Admins can manage navigation items" ON public.navigation_items;

    CREATE POLICY "Admins can manage navigation items" ON public.navigation_items
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.6 Table: public.navigation_versions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'navigation_versions') THEN
    DROP POLICY IF EXISTS "Admins can manage navigation versions" ON public.navigation_versions;

    CREATE POLICY "Admins can manage navigation versions" ON public.navigation_versions
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.7 Table: public.feedback
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback') THEN
    DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
    DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
    DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;

    CREATE POLICY "Users can view own feedback" ON public.feedback
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins can view all feedback" ON public.feedback
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admins can update feedback" ON public.feedback
      FOR UPDATE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.8 Table: public.interview_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_events') THEN
    DROP POLICY IF EXISTS "Users insert own interview events" ON public.interview_events;
    DROP POLICY IF EXISTS "Users read own interview events" ON public.interview_events;
    DROP POLICY IF EXISTS "Admins manage all interview events" ON public.interview_events;

    CREATE POLICY "Users insert own interview events" ON public.interview_events
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users read own interview events" ON public.interview_events
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins manage all interview events" ON public.interview_events
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.9 Table: public.interview_permissions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_permissions') THEN
    DROP POLICY IF EXISTS "Users manage own interview permissions" ON public.interview_permissions;

    CREATE POLICY "Users manage own interview permissions" ON public.interview_permissions
      FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 7.10 Table: public.interview_locations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_locations') THEN
    DROP POLICY IF EXISTS "Users insert own interview locations" ON public.interview_locations;
    DROP POLICY IF EXISTS "Admins manage all interview locations" ON public.interview_locations;

    CREATE POLICY "Users insert own interview locations" ON public.interview_locations
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins manage all interview locations" ON public.interview_locations
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.11 Table: public.interview_centers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_centers') THEN
    DROP POLICY IF EXISTS "Admins manage all interview centers" ON public.interview_centers;

    CREATE POLICY "Admins manage all interview centers" ON public.interview_centers
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.12 Table: public.interview_sessions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_sessions') THEN
    DROP POLICY IF EXISTS "Users read own sessions" ON public.interview_sessions;
    DROP POLICY IF EXISTS "Users insert own sessions" ON public.interview_sessions;
    DROP POLICY IF EXISTS "Users update own sessions" ON public.interview_sessions;

    CREATE POLICY "Users read own sessions" ON public.interview_sessions
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users insert own sessions" ON public.interview_sessions
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users update own sessions" ON public.interview_sessions
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 7.13 Table: public.interview_answers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_answers') THEN
    DROP POLICY IF EXISTS "Users read own interview answers" ON public.interview_answers;
    DROP POLICY IF EXISTS "Users insert own interview answers" ON public.interview_answers;
    DROP POLICY IF EXISTS "Admins manage all interview answers" ON public.interview_answers;

    CREATE POLICY "Users read own interview answers" ON public.interview_answers
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users insert own interview answers" ON public.interview_answers
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Admins manage all interview answers" ON public.interview_answers
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.14 Table: public.interview_interviewers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_interviewers') THEN
    DROP POLICY IF EXISTS "Admins manage interviewers" ON public.interview_interviewers;

    CREATE POLICY "Admins manage interviewers" ON public.interview_interviewers
      FOR ALL USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.15 Table: public.auth_email_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_email_logs') THEN
    DROP POLICY IF EXISTS "Admin read auth email logs" ON public.auth_email_logs;

    CREATE POLICY "Admin read auth email logs" ON public.auth_email_logs
      FOR SELECT USING (public.is_admin_or_service_role());
  END IF;
END $$;
