-- =============================================================================
-- SAARVI MIGRATION 039: SUPABASE DATABASE LINTER PERFORMANCE REMEDIATION
-- Resolves all performance warnings reported by the Supabase Database Linter:
-- 1. auth_rls_initplan (0003): Wraps auth.uid() & auth.<fn>() in (SELECT auth.<fn>())
--    or (SELECT auth.uid())::text to convert per-row function evaluation into a
--    single-execution InitPlan.
-- 2. multiple_permissive_policies (0006): Eliminates redundant permissive SELECT/INSERT
--    policies by unifying user + admin SELECT policies, or separating Admin writes
--    into INSERT, UPDATE, DELETE when a Public Read policy is already present.
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTION FOR ZERO-OVERHEAD ADMIN CHECKS (PL/PGSQL PREVENTS INLINING)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_service_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('ADMIN', 'SUPER_ADMIN', 'admin', 'superadmin', 'founder')
    )
  );
END;
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

-- 1.7 Table: public.student_project_showcases
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_project_showcases') THEN
    DROP POLICY IF EXISTS "Users own select student_project_showcases" ON public.student_project_showcases;
    DROP POLICY IF EXISTS "Users own insert student_project_showcases" ON public.student_project_showcases;
    DROP POLICY IF EXISTS "Users own update student_project_showcases" ON public.student_project_showcases;
    DROP POLICY IF EXISTS "Users own delete student_project_showcases" ON public.student_project_showcases;

    CREATE POLICY "Users own select student_project_showcases" ON public.student_project_showcases
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_project_showcases" ON public.student_project_showcases
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_project_showcases" ON public.student_project_showcases
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_project_showcases" ON public.student_project_showcases
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.8 Table: public.student_subject_notes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_subject_notes') THEN
    DROP POLICY IF EXISTS "Users own select student_subject_notes" ON public.student_subject_notes;
    DROP POLICY IF EXISTS "Users own insert student_subject_notes" ON public.student_subject_notes;
    DROP POLICY IF EXISTS "Users own update student_subject_notes" ON public.student_subject_notes;
    DROP POLICY IF EXISTS "Users own delete student_subject_notes" ON public.student_subject_notes;

    CREATE POLICY "Users own select student_subject_notes" ON public.student_subject_notes
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_subject_notes" ON public.student_subject_notes
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_subject_notes" ON public.student_subject_notes
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_subject_notes" ON public.student_subject_notes
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.9 Table: public.student_cgpa_forecasts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_cgpa_forecasts') THEN
    DROP POLICY IF EXISTS "Users own select student_cgpa_forecasts" ON public.student_cgpa_forecasts;
    DROP POLICY IF EXISTS "Users own insert student_cgpa_forecasts" ON public.student_cgpa_forecasts;
    DROP POLICY IF EXISTS "Users own update student_cgpa_forecasts" ON public.student_cgpa_forecasts;
    DROP POLICY IF EXISTS "Users own delete student_cgpa_forecasts" ON public.student_cgpa_forecasts;

    CREATE POLICY "Users own select student_cgpa_forecasts" ON public.student_cgpa_forecasts
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_cgpa_forecasts" ON public.student_cgpa_forecasts
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_cgpa_forecasts" ON public.student_cgpa_forecasts
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_cgpa_forecasts" ON public.student_cgpa_forecasts
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.10 Table: public.student_study_streaks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_study_streaks') THEN
    DROP POLICY IF EXISTS "Users own select student_study_streaks" ON public.student_study_streaks;
    DROP POLICY IF EXISTS "Users own insert student_study_streaks" ON public.student_study_streaks;
    DROP POLICY IF EXISTS "Users own update student_study_streaks" ON public.student_study_streaks;
    DROP POLICY IF EXISTS "Users own delete student_study_streaks" ON public.student_study_streaks;

    CREATE POLICY "Users own select student_study_streaks" ON public.student_study_streaks
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_study_streaks" ON public.student_study_streaks
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_study_streaks" ON public.student_study_streaks
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_study_streaks" ON public.student_study_streaks
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.11 Table: public.student_peer_study_rooms
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_peer_study_rooms') THEN
    DROP POLICY IF EXISTS "Users own select student_peer_study_rooms" ON public.student_peer_study_rooms;
    DROP POLICY IF EXISTS "Users own insert student_peer_study_rooms" ON public.student_peer_study_rooms;
    DROP POLICY IF EXISTS "Users own update student_peer_study_rooms" ON public.student_peer_study_rooms;
    DROP POLICY IF EXISTS "Users own delete student_peer_study_rooms" ON public.student_peer_study_rooms;

    CREATE POLICY "Users own select student_peer_study_rooms" ON public.student_peer_study_rooms
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_peer_study_rooms" ON public.student_peer_study_rooms
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_peer_study_rooms" ON public.student_peer_study_rooms
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_peer_study_rooms" ON public.student_peer_study_rooms
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.12 Table: public.student_study_buddies
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_study_buddies') THEN
    DROP POLICY IF EXISTS "Users own select student_study_buddies" ON public.student_study_buddies;
    DROP POLICY IF EXISTS "Users own insert student_study_buddies" ON public.student_study_buddies;
    DROP POLICY IF EXISTS "Users own update student_study_buddies" ON public.student_study_buddies;
    DROP POLICY IF EXISTS "Users own delete student_study_buddies" ON public.student_study_buddies;

    CREATE POLICY "Users own select student_study_buddies" ON public.student_study_buddies
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_study_buddies" ON public.student_study_buddies
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_study_buddies" ON public.student_study_buddies
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_study_buddies" ON public.student_study_buddies
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.13 Table: public.student_academic_goals
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_academic_goals') THEN
    DROP POLICY IF EXISTS "Users own select student_academic_goals" ON public.student_academic_goals;
    DROP POLICY IF EXISTS "Users own insert student_academic_goals" ON public.student_academic_goals;
    DROP POLICY IF EXISTS "Users own update student_academic_goals" ON public.student_academic_goals;
    DROP POLICY IF EXISTS "Users own delete student_academic_goals" ON public.student_academic_goals;

    CREATE POLICY "Users own select student_academic_goals" ON public.student_academic_goals
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_academic_goals" ON public.student_academic_goals
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_academic_goals" ON public.student_academic_goals
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_academic_goals" ON public.student_academic_goals
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.14 Table: public.student_syllabus_trackers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_syllabus_trackers') THEN
    DROP POLICY IF EXISTS "Users own select student_syllabus_trackers" ON public.student_syllabus_trackers;
    DROP POLICY IF EXISTS "Users own insert student_syllabus_trackers" ON public.student_syllabus_trackers;
    DROP POLICY IF EXISTS "Users own update student_syllabus_trackers" ON public.student_syllabus_trackers;
    DROP POLICY IF EXISTS "Users own delete student_syllabus_trackers" ON public.student_syllabus_trackers;

    CREATE POLICY "Users own select student_syllabus_trackers" ON public.student_syllabus_trackers
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_syllabus_trackers" ON public.student_syllabus_trackers
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_syllabus_trackers" ON public.student_syllabus_trackers
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_syllabus_trackers" ON public.student_syllabus_trackers
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 1.15 Table: public.student_attendance_records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_attendance_records') THEN
    DROP POLICY IF EXISTS "Users own select student_attendance_records" ON public.student_attendance_records;
    DROP POLICY IF EXISTS "Users own insert student_attendance_records" ON public.student_attendance_records;
    DROP POLICY IF EXISTS "Users own update student_attendance_records" ON public.student_attendance_records;
    DROP POLICY IF EXISTS "Users own delete student_attendance_records" ON public.student_attendance_records;

    CREATE POLICY "Users own select student_attendance_records" ON public.student_attendance_records
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own insert student_attendance_records" ON public.student_attendance_records
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own update student_attendance_records" ON public.student_attendance_records
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users own delete student_attendance_records" ON public.student_attendance_records
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- 2. ACADEMIC SNAPSHOTS & BACKUPS
-- =============================================================================

-- 2.1 Table: public.academic_snapshots
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_snapshots') THEN
    DROP POLICY IF EXISTS "Users can view own snapshots" ON public.academic_snapshots;
    DROP POLICY IF EXISTS "Users can create own snapshots" ON public.academic_snapshots;
    DROP POLICY IF EXISTS "Users can update own snapshots" ON public.academic_snapshots;
    DROP POLICY IF EXISTS "Users can delete own snapshots" ON public.academic_snapshots;

    CREATE POLICY "Users can view own snapshots" ON public.academic_snapshots
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can create own snapshots" ON public.academic_snapshots
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can update own snapshots" ON public.academic_snapshots
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can delete own snapshots" ON public.academic_snapshots
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 2.2 Table: public.academic_snapshot_backups
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_snapshot_backups') THEN
    DROP POLICY IF EXISTS "Users view own backups" ON public.academic_snapshot_backups;
    DROP POLICY IF EXISTS "Users create own backups" ON public.academic_snapshot_backups;
    DROP POLICY IF EXISTS "Users update own backups" ON public.academic_snapshot_backups;
    DROP POLICY IF EXISTS "Users delete own backups" ON public.academic_snapshot_backups;

    CREATE POLICY "Users view own backups" ON public.academic_snapshot_backups
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users create own backups" ON public.academic_snapshot_backups
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users update own backups" ON public.academic_snapshot_backups
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users delete own backups" ON public.academic_snapshot_backups
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 2.3 Table: public.academic_snapshot_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_snapshot_audit_logs') THEN
    DROP POLICY IF EXISTS "Users view own audit logs" ON public.academic_snapshot_audit_logs;
    DROP POLICY IF EXISTS "Users insert own audit logs" ON public.academic_snapshot_audit_logs;

    CREATE POLICY "Users view own audit logs" ON public.academic_snapshot_audit_logs
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users insert own audit logs" ON public.academic_snapshot_audit_logs
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- 3. PAYMENT, BILLING & SUBSCRIPTIONS (MUTUALLY EXCLUSIVE POLICIES)
-- =============================================================================

-- 3.1 Table: public.subscriptions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    DROP POLICY IF EXISTS "Users can read their own subscription" ON public.subscriptions;
    DROP POLICY IF EXISTS "Admins and service role can manage subscriptions" ON public.subscriptions;
    DROP POLICY IF EXISTS "Users and admins read subscriptions" ON public.subscriptions;
    DROP POLICY IF EXISTS "Admin insert subscriptions" ON public.subscriptions;
    DROP POLICY IF EXISTS "Admin update subscriptions" ON public.subscriptions;
    DROP POLICY IF EXISTS "Admin delete subscriptions" ON public.subscriptions;

    CREATE POLICY "Users and admins read subscriptions" ON public.subscriptions
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin insert subscriptions" ON public.subscriptions
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update subscriptions" ON public.subscriptions
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete subscriptions" ON public.subscriptions
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.2 Table: public.invoices
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoices') THEN
    DROP POLICY IF EXISTS "Users can read their own invoices" ON public.invoices;
    DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;
    DROP POLICY IF EXISTS "Users and admins read invoices" ON public.invoices;
    DROP POLICY IF EXISTS "Admin insert invoices" ON public.invoices;
    DROP POLICY IF EXISTS "Admin update invoices" ON public.invoices;
    DROP POLICY IF EXISTS "Admin delete invoices" ON public.invoices;

    CREATE POLICY "Users and admins read invoices" ON public.invoices
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin insert invoices" ON public.invoices
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update invoices" ON public.invoices
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete invoices" ON public.invoices
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.3 Table: public.billing_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_events') THEN
    DROP POLICY IF EXISTS "Admins can view billing events" ON public.billing_events;
    DROP POLICY IF EXISTS "Admins read billing events" ON public.billing_events;
    DROP POLICY IF EXISTS "Admins insert billing events" ON public.billing_events;
    DROP POLICY IF EXISTS "Admins update billing events" ON public.billing_events;
    DROP POLICY IF EXISTS "Admins delete billing events" ON public.billing_events;

    CREATE POLICY "Admins read billing events" ON public.billing_events
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admins insert billing events" ON public.billing_events
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update billing events" ON public.billing_events
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete billing events" ON public.billing_events
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.4 Table: public.payment_orders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_orders') THEN
    DROP POLICY IF EXISTS "Users can view their own payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Admins can view and manage all payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Admins and service role can manage payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Users and admins view payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Users and admins insert payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Admin update payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Admin delete payment orders" ON public.payment_orders;

    CREATE POLICY "Users and admins view payment orders" ON public.payment_orders
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins insert payment orders" ON public.payment_orders
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin update payment orders" ON public.payment_orders
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete payment orders" ON public.payment_orders
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.5 Table: public.payment_transactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_transactions') THEN
    DROP POLICY IF EXISTS "Users can view their own transactions" ON public.payment_transactions;
    DROP POLICY IF EXISTS "Admins can view all transactions" ON public.payment_transactions;
    DROP POLICY IF EXISTS "Users and admins view payment transactions" ON public.payment_transactions;
    DROP POLICY IF EXISTS "Admin insert payment transactions" ON public.payment_transactions;
    DROP POLICY IF EXISTS "Admin update payment transactions" ON public.payment_transactions;
    DROP POLICY IF EXISTS "Admin delete payment transactions" ON public.payment_transactions;

    CREATE POLICY "Users and admins view payment transactions" ON public.payment_transactions
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin insert payment transactions" ON public.payment_transactions
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update payment transactions" ON public.payment_transactions
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete payment transactions" ON public.payment_transactions
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.6 Table: public.payment_webhook_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_webhook_events') THEN
    DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.payment_webhook_events;
    DROP POLICY IF EXISTS "Admins read payment webhook events" ON public.payment_webhook_events;
    DROP POLICY IF EXISTS "Admins insert payment webhook events" ON public.payment_webhook_events;
    DROP POLICY IF EXISTS "Admins update payment webhook events" ON public.payment_webhook_events;
    DROP POLICY IF EXISTS "Admins delete payment webhook events" ON public.payment_webhook_events;

    CREATE POLICY "Admins read payment webhook events" ON public.payment_webhook_events
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admins insert payment webhook events" ON public.payment_webhook_events
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update payment webhook events" ON public.payment_webhook_events
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete payment webhook events" ON public.payment_webhook_events
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.7 Table: public.entitlements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'entitlements') THEN
    DROP POLICY IF EXISTS "Users can view their own entitlements" ON public.entitlements;
    DROP POLICY IF EXISTS "Admins can manage entitlements" ON public.entitlements;
    DROP POLICY IF EXISTS "Users and admins view entitlements" ON public.entitlements;
    DROP POLICY IF EXISTS "Admin insert entitlements" ON public.entitlements;
    DROP POLICY IF EXISTS "Admin update entitlements" ON public.entitlements;
    DROP POLICY IF EXISTS "Admin delete entitlements" ON public.entitlements;

    CREATE POLICY "Users and admins view entitlements" ON public.entitlements
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin insert entitlements" ON public.entitlements
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update entitlements" ON public.entitlements
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete entitlements" ON public.entitlements
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.8 Table: public.subscription_requests
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_requests') THEN
    DROP POLICY IF EXISTS "Users read own subscription requests" ON public.subscription_requests;
    DROP POLICY IF EXISTS "Users insert own subscription requests" ON public.subscription_requests;
    DROP POLICY IF EXISTS "Superadmins manage subscription requests" ON public.subscription_requests;
    DROP POLICY IF EXISTS "Users and admins read subscription requests" ON public.subscription_requests;
    DROP POLICY IF EXISTS "Users and admins insert subscription requests" ON public.subscription_requests;
    DROP POLICY IF EXISTS "Admin update subscription requests" ON public.subscription_requests;
    DROP POLICY IF EXISTS "Admin delete subscription requests" ON public.subscription_requests;

    CREATE POLICY "Users and admins read subscription requests" ON public.subscription_requests
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins insert subscription requests" ON public.subscription_requests
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin update subscription requests" ON public.subscription_requests
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete subscription requests" ON public.subscription_requests
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.9 Table: public.subscription_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_audit_logs') THEN
    DROP POLICY IF EXISTS "Superadmins read audit logs" ON public.subscription_audit_logs;
    DROP POLICY IF EXISTS "Admin insert audit logs" ON public.subscription_audit_logs;

    CREATE POLICY "Superadmins read audit logs" ON public.subscription_audit_logs
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert audit logs" ON public.subscription_audit_logs
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.10 Table: public.payment_configs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_configs') THEN
    DROP POLICY IF EXISTS "payment_configs_read_all" ON public.payment_configs;
    DROP POLICY IF EXISTS "payment_configs_admin_all" ON public.payment_configs;
    DROP POLICY IF EXISTS "Admin insert payment configs" ON public.payment_configs;
    DROP POLICY IF EXISTS "Admin update payment configs" ON public.payment_configs;
    DROP POLICY IF EXISTS "Admin delete payment configs" ON public.payment_configs;

    CREATE POLICY "payment_configs_read_all" ON public.payment_configs
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert payment configs" ON public.payment_configs
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update payment configs" ON public.payment_configs
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete payment configs" ON public.payment_configs
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 3.11 Table: public.manual_payment_requests
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'manual_payment_requests') THEN
    DROP POLICY IF EXISTS "manual_payment_requests_user_read" ON public.manual_payment_requests;
    DROP POLICY IF EXISTS "manual_payment_requests_user_insert" ON public.manual_payment_requests;
    DROP POLICY IF EXISTS "manual_payment_requests_admin_all" ON public.manual_payment_requests;
    DROP POLICY IF EXISTS "Admin update manual payment requests" ON public.manual_payment_requests;
    DROP POLICY IF EXISTS "Admin delete manual payment requests" ON public.manual_payment_requests;

    CREATE POLICY "manual_payment_requests_user_read" ON public.manual_payment_requests
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "manual_payment_requests_user_insert" ON public.manual_payment_requests
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin update manual payment requests" ON public.manual_payment_requests
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete manual payment requests" ON public.manual_payment_requests
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- =============================================================================
-- 4. ACADEMIC HIERARCHY TABLES
-- =============================================================================

-- 4.1 Table: public.academic_universities
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_universities') THEN
    DROP POLICY IF EXISTS "Public read active universities" ON public.academic_universities;
    DROP POLICY IF EXISTS "Admins manage universities" ON public.academic_universities;
    DROP POLICY IF EXISTS "Admins write universities" ON public.academic_universities;
    DROP POLICY IF EXISTS "Admins insert universities" ON public.academic_universities;
    DROP POLICY IF EXISTS "Admins update universities" ON public.academic_universities;
    DROP POLICY IF EXISTS "Admins delete universities" ON public.academic_universities;

    CREATE POLICY "Public read active universities" ON public.academic_universities
      FOR SELECT USING (true);

    CREATE POLICY "Admins insert universities" ON public.academic_universities
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update universities" ON public.academic_universities
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete universities" ON public.academic_universities
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.2 Table: public.academic_colleges
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_colleges') THEN
    DROP POLICY IF EXISTS "Public read active colleges" ON public.academic_colleges;
    DROP POLICY IF EXISTS "Admins manage colleges" ON public.academic_colleges;
    DROP POLICY IF EXISTS "Admins write colleges" ON public.academic_colleges;
    DROP POLICY IF EXISTS "Admins insert colleges" ON public.academic_colleges;
    DROP POLICY IF EXISTS "Admins update colleges" ON public.academic_colleges;
    DROP POLICY IF EXISTS "Admins delete colleges" ON public.academic_colleges;

    CREATE POLICY "Public read active colleges" ON public.academic_colleges
      FOR SELECT USING (true);

    CREATE POLICY "Admins insert colleges" ON public.academic_colleges
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update colleges" ON public.academic_colleges
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete colleges" ON public.academic_colleges
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.3 Table: public.academic_programs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_programs') THEN
    DROP POLICY IF EXISTS "Public read active programs" ON public.academic_programs;
    DROP POLICY IF EXISTS "Admins manage programs" ON public.academic_programs;
    DROP POLICY IF EXISTS "Admins write programs" ON public.academic_programs;
    DROP POLICY IF EXISTS "Admins insert programs" ON public.academic_programs;
    DROP POLICY IF EXISTS "Admins update programs" ON public.academic_programs;
    DROP POLICY IF EXISTS "Admins delete programs" ON public.academic_programs;

    CREATE POLICY "Public read active programs" ON public.academic_programs
      FOR SELECT USING (true);

    CREATE POLICY "Admins insert programs" ON public.academic_programs
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update programs" ON public.academic_programs
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete programs" ON public.academic_programs
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.4 Table: public.academic_branches
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_branches') THEN
    DROP POLICY IF EXISTS "Public read active branches" ON public.academic_branches;
    DROP POLICY IF EXISTS "Admins manage branches" ON public.academic_branches;
    DROP POLICY IF EXISTS "Admins write branches" ON public.academic_branches;
    DROP POLICY IF EXISTS "Admins insert branches" ON public.academic_branches;
    DROP POLICY IF EXISTS "Admins update branches" ON public.academic_branches;
    DROP POLICY IF EXISTS "Admins delete branches" ON public.academic_branches;

    CREATE POLICY "Public read active branches" ON public.academic_branches
      FOR SELECT USING (true);

    CREATE POLICY "Admins insert branches" ON public.academic_branches
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update branches" ON public.academic_branches
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete branches" ON public.academic_branches
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.5 Table: public.academic_semesters
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_semesters') THEN
    DROP POLICY IF EXISTS "Public read active semesters" ON public.academic_semesters;
    DROP POLICY IF EXISTS "Admins manage semesters" ON public.academic_semesters;
    DROP POLICY IF EXISTS "Admins write semesters" ON public.academic_semesters;
    DROP POLICY IF EXISTS "Admins insert semesters" ON public.academic_semesters;
    DROP POLICY IF EXISTS "Admins update semesters" ON public.academic_semesters;
    DROP POLICY IF EXISTS "Admins delete semesters" ON public.academic_semesters;

    CREATE POLICY "Public read active semesters" ON public.academic_semesters
      FOR SELECT USING (true);

    CREATE POLICY "Admins insert semesters" ON public.academic_semesters
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update semesters" ON public.academic_semesters
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete semesters" ON public.academic_semesters
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.6 Table: public.academic_subject_conflicts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_subject_conflicts') THEN
    DROP POLICY IF EXISTS "Admins manage subject conflicts" ON public.academic_subject_conflicts;
    DROP POLICY IF EXISTS "Admins read subject conflicts" ON public.academic_subject_conflicts;
    DROP POLICY IF EXISTS "Admins insert subject conflicts" ON public.academic_subject_conflicts;
    DROP POLICY IF EXISTS "Admins update subject conflicts" ON public.academic_subject_conflicts;
    DROP POLICY IF EXISTS "Admins delete subject conflicts" ON public.academic_subject_conflicts;

    CREATE POLICY "Admins read subject conflicts" ON public.academic_subject_conflicts
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admins insert subject conflicts" ON public.academic_subject_conflicts
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update subject conflicts" ON public.academic_subject_conflicts
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete subject conflicts" ON public.academic_subject_conflicts
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.7 Table: public.curriculum_courses
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'curriculum_courses') THEN
    DROP POLICY IF EXISTS "Public read active curriculum courses" ON public.curriculum_courses;
    DROP POLICY IF EXISTS "Admins manage curriculum courses" ON public.curriculum_courses;
    DROP POLICY IF EXISTS "Admins write curriculum courses" ON public.curriculum_courses;
    DROP POLICY IF EXISTS "Admins insert curriculum courses" ON public.curriculum_courses;
    DROP POLICY IF EXISTS "Admins update curriculum courses" ON public.curriculum_courses;
    DROP POLICY IF EXISTS "Admins delete curriculum courses" ON public.curriculum_courses;

    CREATE POLICY "Public read active curriculum courses" ON public.curriculum_courses
      FOR SELECT USING (true);

    CREATE POLICY "Admins insert curriculum courses" ON public.curriculum_courses
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update curriculum courses" ON public.curriculum_courses
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete curriculum courses" ON public.curriculum_courses
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.8 Table: public.curriculum_versions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'curriculum_versions') THEN
    DROP POLICY IF EXISTS "Public read active curriculum" ON public.curriculum_versions;
    DROP POLICY IF EXISTS "Admin manage curriculum" ON public.curriculum_versions;
    DROP POLICY IF EXISTS "Admin write curriculum" ON public.curriculum_versions;
    DROP POLICY IF EXISTS "Admin insert curriculum" ON public.curriculum_versions;
    DROP POLICY IF EXISTS "Admin update curriculum" ON public.curriculum_versions;
    DROP POLICY IF EXISTS "Admin delete curriculum" ON public.curriculum_versions;

    CREATE POLICY "Public read active curriculum" ON public.curriculum_versions
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert curriculum" ON public.curriculum_versions
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update curriculum" ON public.curriculum_versions
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete curriculum" ON public.curriculum_versions
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.9 Table: public.academic_schemes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_schemes') THEN
    DROP POLICY IF EXISTS "Public read active schemes" ON public.academic_schemes;
    DROP POLICY IF EXISTS "Admin manage schemes" ON public.academic_schemes;
    DROP POLICY IF EXISTS "Admin write schemes" ON public.academic_schemes;
    DROP POLICY IF EXISTS "Admin insert schemes" ON public.academic_schemes;
    DROP POLICY IF EXISTS "Admin update schemes" ON public.academic_schemes;
    DROP POLICY IF EXISTS "Admin delete schemes" ON public.academic_schemes;

    CREATE POLICY "Public read active schemes" ON public.academic_schemes
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert schemes" ON public.academic_schemes
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update schemes" ON public.academic_schemes
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete schemes" ON public.academic_schemes
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.10 Table: public.scheme_course_mappings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'scheme_course_mappings') THEN
    DROP POLICY IF EXISTS "Public read active mappings" ON public.scheme_course_mappings;
    DROP POLICY IF EXISTS "Admin manage mappings" ON public.scheme_course_mappings;
    DROP POLICY IF EXISTS "Admin write mappings" ON public.scheme_course_mappings;
    DROP POLICY IF EXISTS "Admin insert mappings" ON public.scheme_course_mappings;
    DROP POLICY IF EXISTS "Admin update mappings" ON public.scheme_course_mappings;
    DROP POLICY IF EXISTS "Admin delete mappings" ON public.scheme_course_mappings;

    CREATE POLICY "Public read active mappings" ON public.scheme_course_mappings
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert mappings" ON public.scheme_course_mappings
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update mappings" ON public.scheme_course_mappings
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete mappings" ON public.scheme_course_mappings
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.11 Table: public.academic_regulations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_regulations') THEN
    DROP POLICY IF EXISTS "Public read active regulations" ON public.academic_regulations;
    DROP POLICY IF EXISTS "Admin manage regulations" ON public.academic_regulations;
    DROP POLICY IF EXISTS "Admin write regulations" ON public.academic_regulations;
    DROP POLICY IF EXISTS "Admin insert regulations" ON public.academic_regulations;
    DROP POLICY IF EXISTS "Admin update regulations" ON public.academic_regulations;
    DROP POLICY IF EXISTS "Admin delete regulations" ON public.academic_regulations;

    CREATE POLICY "Public read active regulations" ON public.academic_regulations
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert regulations" ON public.academic_regulations
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update regulations" ON public.academic_regulations
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete regulations" ON public.academic_regulations
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.12 Table: public.academic_syllabus
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_syllabus') THEN
    DROP POLICY IF EXISTS "Public read active syllabus" ON public.academic_syllabus;
    DROP POLICY IF EXISTS "Admin manage syllabus" ON public.academic_syllabus;
    DROP POLICY IF EXISTS "Admin write syllabus" ON public.academic_syllabus;
    DROP POLICY IF EXISTS "Admin insert syllabus" ON public.academic_syllabus;
    DROP POLICY IF EXISTS "Admin update syllabus" ON public.academic_syllabus;
    DROP POLICY IF EXISTS "Admin delete syllabus" ON public.academic_syllabus;

    CREATE POLICY "Public read active syllabus" ON public.academic_syllabus
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert syllabus" ON public.academic_syllabus
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update syllabus" ON public.academic_syllabus
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete syllabus" ON public.academic_syllabus
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 4.13 Table: public.academic_import_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_import_audit_logs') THEN
    DROP POLICY IF EXISTS "Admins read import audit logs" ON public.academic_import_audit_logs;
    DROP POLICY IF EXISTS "Admins insert import audit logs" ON public.academic_import_audit_logs;
    DROP POLICY IF EXISTS "Admins update import audit logs" ON public.academic_import_audit_logs;
    DROP POLICY IF EXISTS "Admins delete import audit logs" ON public.academic_import_audit_logs;

    CREATE POLICY "Admins read import audit logs" ON public.academic_import_audit_logs
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admins insert import audit logs" ON public.academic_import_audit_logs
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update import audit logs" ON public.academic_import_audit_logs
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete import audit logs" ON public.academic_import_audit_logs
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- =============================================================================
-- 5. JOBS, INTERNSHIPS & CAREER INTELLIGENCE (MUTUALLY EXCLUSIVE POLICIES)
-- =============================================================================

-- 5.1 Table: public.job_opportunities
DO $$ 
DECLARE
  has_is_active BOOLEAN;
  has_record_state BOOLEAN;
  has_verification_tier BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_opportunities') THEN
    DROP POLICY IF EXISTS "Public read live opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Public read active opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Admin manage opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Admin write opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Admin insert opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Admin update opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Admin delete opportunities" ON public.job_opportunities;
    DROP POLICY IF EXISTS "Users read live and source opportunities" ON public.job_opportunities;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'job_opportunities' AND column_name = 'is_active'
    ) INTO has_is_active;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'job_opportunities' AND column_name = 'record_state'
    ) INTO has_record_state;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'job_opportunities' AND column_name = 'verification_tier'
    ) INTO has_verification_tier;

    IF has_is_active AND has_verification_tier THEN
      EXECUTE $pol$
        CREATE POLICY "Users read live and source opportunities" ON public.job_opportunities
          FOR SELECT USING (
            (
              is_active = true
              AND (
                (
                  status = 'APPROVED'
                  AND verification_tier IN ('HR_VERIFIED', 'OFFICIAL_SOURCE', 'COMMUNITY_VERIFIED')
                  AND (deadline IS NULL OR deadline > NOW())
                )
                OR
                (
                  verification_tier = 'SOURCE_DISCOVERY'
                  AND (deadline IS NULL OR deadline > NOW())
                )
              )
            )
            OR public.is_admin_or_service_role()
          );
      $pol$;
    ELSIF has_record_state THEN
      EXECUTE $pol$
        CREATE POLICY "Users read live and source opportunities" ON public.job_opportunities
          FOR SELECT USING (
            (
              publication_state = 'PUBLISHED'
              AND record_state = 'ACTIVE'
              AND visibility = 'public'
              AND (deadline IS NULL OR deadline > NOW())
            )
            OR public.is_admin_or_service_role()
          );
      $pol$;
    ELSE
      EXECUTE $pol$
        CREATE POLICY "Users read live and source opportunities" ON public.job_opportunities
          FOR SELECT USING (
            (
              status IN ('PUBLISHED', 'ACTIVE', 'published')
              AND visibility = 'public'
              AND (deadline IS NULL OR deadline > NOW())
            )
            OR public.is_admin_or_service_role()
          );
      $pol$;
    END IF;

    CREATE POLICY "Admin insert opportunities" ON public.job_opportunities
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update opportunities" ON public.job_opportunities
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete opportunities" ON public.job_opportunities
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.2 Table: public.job_source_records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_source_records') THEN
    DROP POLICY IF EXISTS "Admin access source records" ON public.job_source_records;
    DROP POLICY IF EXISTS "Admin read source records" ON public.job_source_records;
    DROP POLICY IF EXISTS "Admin insert source records" ON public.job_source_records;
    DROP POLICY IF EXISTS "Admin update source records" ON public.job_source_records;
    DROP POLICY IF EXISTS "Admin delete source records" ON public.job_source_records;

    CREATE POLICY "Admin read source records" ON public.job_source_records
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert source records" ON public.job_source_records
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update source records" ON public.job_source_records
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete source records" ON public.job_source_records
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.3 Table: public.job_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_audit_logs') THEN
    DROP POLICY IF EXISTS "Admin access job audit logs" ON public.job_audit_logs;
    DROP POLICY IF EXISTS "Admin read job audit logs" ON public.job_audit_logs;
    DROP POLICY IF EXISTS "Admin insert job audit logs" ON public.job_audit_logs;

    CREATE POLICY "Admin read job audit logs" ON public.job_audit_logs
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert job audit logs" ON public.job_audit_logs
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.4 Table: public.saved_jobs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_jobs') THEN
    DROP POLICY IF EXISTS "Users manage own saved jobs" ON public.saved_jobs;
    DROP POLICY IF EXISTS "Users select own saved jobs" ON public.saved_jobs;
    DROP POLICY IF EXISTS "Users insert own saved jobs" ON public.saved_jobs;
    DROP POLICY IF EXISTS "Users update own saved jobs" ON public.saved_jobs;
    DROP POLICY IF EXISTS "Users delete own saved jobs" ON public.saved_jobs;

    CREATE POLICY "Users select own saved jobs" ON public.saved_jobs
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users insert own saved jobs" ON public.saved_jobs
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users update own saved jobs" ON public.saved_jobs
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users delete own saved jobs" ON public.saved_jobs
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 5.5 Table: public.job_applications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_applications') THEN
    DROP POLICY IF EXISTS "Users manage own job applications" ON public.job_applications;
    DROP POLICY IF EXISTS "Users select own job applications" ON public.job_applications;
    DROP POLICY IF EXISTS "Users insert own job applications" ON public.job_applications;
    DROP POLICY IF EXISTS "Users update own job applications" ON public.job_applications;
    DROP POLICY IF EXISTS "Users delete own job applications" ON public.job_applications;

    CREATE POLICY "Users select own job applications" ON public.job_applications
      FOR SELECT USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users insert own job applications" ON public.job_applications
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users update own job applications" ON public.job_applications
      FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users delete own job applications" ON public.job_applications
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 5.6 Table: public.job_reports
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_reports') THEN
    DROP POLICY IF EXISTS "Authenticated users create reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Users can create reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Admins manage job reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Admin manage reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Users and admins create job reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Admin read job reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Admin update job reports" ON public.job_reports;
    DROP POLICY IF EXISTS "Admin delete job reports" ON public.job_reports;

    CREATE POLICY "Admin read job reports" ON public.job_reports
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Users and admins create job reports" ON public.job_reports
      FOR INSERT
      WITH CHECK (
        ((SELECT auth.uid()) IS NOT NULL)
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin update job reports" ON public.job_reports
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete job reports" ON public.job_reports
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.7 Table: public.job_discovery_batches
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_discovery_batches') THEN
    DROP POLICY IF EXISTS "Admins can manage discovery batches" ON public.job_discovery_batches;
    DROP POLICY IF EXISTS "Admins read discovery batches" ON public.job_discovery_batches;
    DROP POLICY IF EXISTS "Admins insert discovery batches" ON public.job_discovery_batches;
    DROP POLICY IF EXISTS "Admins update discovery batches" ON public.job_discovery_batches;
    DROP POLICY IF EXISTS "Admins delete discovery batches" ON public.job_discovery_batches;

    CREATE POLICY "Admins read discovery batches" ON public.job_discovery_batches
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admins insert discovery batches" ON public.job_discovery_batches
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update discovery batches" ON public.job_discovery_batches
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete discovery batches" ON public.job_discovery_batches
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.8 Table: public.jobs (legacy)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'jobs') THEN
    DROP POLICY IF EXISTS "Admin full manage jobs" ON public.jobs;
    DROP POLICY IF EXISTS "Public read verified jobs" ON public.jobs;
    DROP POLICY IF EXISTS "Admin insert jobs" ON public.jobs;
    DROP POLICY IF EXISTS "Admin update jobs" ON public.jobs;
    DROP POLICY IF EXISTS "Admin delete jobs" ON public.jobs;

    CREATE POLICY "Public read verified jobs" ON public.jobs
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert jobs" ON public.jobs
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update jobs" ON public.jobs
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete jobs" ON public.jobs
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.9 Table: public.job_sources
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_sources') THEN
    DROP POLICY IF EXISTS "Admin manage sources" ON public.job_sources;
    DROP POLICY IF EXISTS "Public read sources" ON public.job_sources;
    DROP POLICY IF EXISTS "Admin insert job sources" ON public.job_sources;
    DROP POLICY IF EXISTS "Admin update job sources" ON public.job_sources;
    DROP POLICY IF EXISTS "Admin delete job sources" ON public.job_sources;

    CREATE POLICY "Public read sources" ON public.job_sources
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert job sources" ON public.job_sources
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update job sources" ON public.job_sources
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete job sources" ON public.job_sources
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.10 Table: public.job_alerts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_alerts') THEN
    DROP POLICY IF EXISTS "Users manage own alerts" ON public.job_alerts;
    DROP POLICY IF EXISTS "Admin view all alerts" ON public.job_alerts;
    DROP POLICY IF EXISTS "Users and admins read job alerts" ON public.job_alerts;
    DROP POLICY IF EXISTS "Users and admins insert job alerts" ON public.job_alerts;
    DROP POLICY IF EXISTS "Users and admins update job alerts" ON public.job_alerts;
    DROP POLICY IF EXISTS "Users and admins delete job alerts" ON public.job_alerts;

    CREATE POLICY "Users and admins read job alerts" ON public.job_alerts
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins insert job alerts" ON public.job_alerts
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins update job alerts" ON public.job_alerts
      FOR UPDATE USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      ) WITH CHECK (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins delete job alerts" ON public.job_alerts
      FOR DELETE USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );
  END IF;
END $$;

-- 5.11 Table: public.job_search_cache
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_search_cache') THEN
    DROP POLICY IF EXISTS "Admin read cache" ON public.job_search_cache;
    DROP POLICY IF EXISTS "Admin insert cache" ON public.job_search_cache;
    DROP POLICY IF EXISTS "Admin update cache" ON public.job_search_cache;
    DROP POLICY IF EXISTS "Admin delete cache" ON public.job_search_cache;

    CREATE POLICY "Admin read cache" ON public.job_search_cache
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert cache" ON public.job_search_cache
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update cache" ON public.job_search_cache
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete cache" ON public.job_search_cache
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.12 Table: public.career_templates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_templates') THEN
    DROP POLICY IF EXISTS "Admins can manage career templates" ON public.career_templates;
    DROP POLICY IF EXISTS "Public can view active published templates" ON public.career_templates;
    DROP POLICY IF EXISTS "Admin insert career templates" ON public.career_templates;
    DROP POLICY IF EXISTS "Admin update career templates" ON public.career_templates;
    DROP POLICY IF EXISTS "Admin delete career templates" ON public.career_templates;

    CREATE POLICY "Public can view active published templates" ON public.career_templates
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert career templates" ON public.career_templates
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update career templates" ON public.career_templates
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete career templates" ON public.career_templates
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.13 Table: public.template_import_batches
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'template_import_batches') THEN
    DROP POLICY IF EXISTS "Admins can manage template import batches" ON public.template_import_batches;
    DROP POLICY IF EXISTS "Admin read template import batches" ON public.template_import_batches;
    DROP POLICY IF EXISTS "Admin insert template import batches" ON public.template_import_batches;
    DROP POLICY IF EXISTS "Admin update template import batches" ON public.template_import_batches;
    DROP POLICY IF EXISTS "Admin delete template import batches" ON public.template_import_batches;

    CREATE POLICY "Admin read template import batches" ON public.template_import_batches
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert template import batches" ON public.template_import_batches
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update template import batches" ON public.template_import_batches
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete template import batches" ON public.template_import_batches
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 5.14 Table: public.training_opportunities
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'training_opportunities') THEN
    DROP POLICY IF EXISTS "Admins can manage training opportunities" ON public.training_opportunities;
    DROP POLICY IF EXISTS "Public can view active training opportunities" ON public.training_opportunities;
    DROP POLICY IF EXISTS "Admin insert training opportunities" ON public.training_opportunities;
    DROP POLICY IF EXISTS "Admin update training opportunities" ON public.training_opportunities;
    DROP POLICY IF EXISTS "Admin delete training opportunities" ON public.training_opportunities;

    CREATE POLICY "Public can view active training opportunities" ON public.training_opportunities
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert training opportunities" ON public.training_opportunities
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update training opportunities" ON public.training_opportunities
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete training opportunities" ON public.training_opportunities
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- =============================================================================
-- 6. TOOLS, TELEMETRY, ADS & PLATFORM SETTINGS (MUTUALLY EXCLUSIVE POLICIES)
-- =============================================================================

-- 6.1 Table: public.tool_health_checks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tool_health_checks') THEN
    DROP POLICY IF EXISTS "Public read active tool health" ON public.tool_health_checks;
    DROP POLICY IF EXISTS "Admin manage tool health" ON public.tool_health_checks;
    DROP POLICY IF EXISTS "Admin write tool health" ON public.tool_health_checks;
    DROP POLICY IF EXISTS "Admin insert tool health" ON public.tool_health_checks;
    DROP POLICY IF EXISTS "Admin update tool health" ON public.tool_health_checks;
    DROP POLICY IF EXISTS "Admin delete tool health" ON public.tool_health_checks;

    CREATE POLICY "Public read active tool health" ON public.tool_health_checks
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert tool health" ON public.tool_health_checks
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update tool health" ON public.tool_health_checks
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete tool health" ON public.tool_health_checks
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.2 Table: public.tool_access_configs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tool_access_configs') THEN
    DROP POLICY IF EXISTS "Admins manage tool access configs" ON public.tool_access_configs;
    DROP POLICY IF EXISTS "Anyone can read tool access configs" ON public.tool_access_configs;
    DROP POLICY IF EXISTS "Admin insert tool access configs" ON public.tool_access_configs;
    DROP POLICY IF EXISTS "Admin update tool access configs" ON public.tool_access_configs;
    DROP POLICY IF EXISTS "Admin delete tool access configs" ON public.tool_access_configs;

    CREATE POLICY "Anyone can read tool access configs" ON public.tool_access_configs
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert tool access configs" ON public.tool_access_configs
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update tool access configs" ON public.tool_access_configs
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete tool access configs" ON public.tool_access_configs
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.3 Table: public.tool_beta_usages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tool_beta_usages') THEN
    DROP POLICY IF EXISTS "Users can read own beta usage" ON public.tool_beta_usages;
    DROP POLICY IF EXISTS "Admins can manage beta usages" ON public.tool_beta_usages;
    DROP POLICY IF EXISTS "Users and admins read beta usages" ON public.tool_beta_usages;
    DROP POLICY IF EXISTS "Users and admins insert beta usages" ON public.tool_beta_usages;
    DROP POLICY IF EXISTS "Admin update beta usages" ON public.tool_beta_usages;
    DROP POLICY IF EXISTS "Admin delete beta usages" ON public.tool_beta_usages;

    CREATE POLICY "Users and admins read beta usages" ON public.tool_beta_usages
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins insert beta usages" ON public.tool_beta_usages
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin update beta usages" ON public.tool_beta_usages
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete beta usages" ON public.tool_beta_usages
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.4 Table: public.tool_overrides
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tool_overrides') THEN
    DROP POLICY IF EXISTS "Admin manage tool overrides" ON public.tool_overrides;
    DROP POLICY IF EXISTS "Public read tool overrides" ON public.tool_overrides;
    DROP POLICY IF EXISTS "Admin insert tool overrides" ON public.tool_overrides;
    DROP POLICY IF EXISTS "Admin update tool overrides" ON public.tool_overrides;
    DROP POLICY IF EXISTS "Admin delete tool overrides" ON public.tool_overrides;

    CREATE POLICY "Public read tool overrides" ON public.tool_overrides
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert tool overrides" ON public.tool_overrides
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update tool overrides" ON public.tool_overrides
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete tool overrides" ON public.tool_overrides
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.5 Table: public.platform_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_settings') THEN
    DROP POLICY IF EXISTS "Admin manage platform settings" ON public.platform_settings;
    DROP POLICY IF EXISTS "Public read platform settings" ON public.platform_settings;
    DROP POLICY IF EXISTS "Admin insert platform settings" ON public.platform_settings;
    DROP POLICY IF EXISTS "Admin update platform settings" ON public.platform_settings;
    DROP POLICY IF EXISTS "Admin delete platform settings" ON public.platform_settings;

    CREATE POLICY "Public read platform settings" ON public.platform_settings
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert platform settings" ON public.platform_settings
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update platform settings" ON public.platform_settings
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete platform settings" ON public.platform_settings
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.6 Table: public.announcements
DO $$
DECLARE
  has_dates BOOLEAN;
  has_status BOOLEAN;
BEGIN
  IF to_regclass('public.announcements') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin manage announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Public read active announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Admin insert announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Admin update announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Admin delete announcements" ON public.announcements;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'start_date'
    ) INTO has_dates;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'status'
    ) INTO has_status;

    IF has_dates AND has_status THEN
      EXECUTE $pol$
        CREATE POLICY "Public read active announcements"
          ON public.announcements
          FOR SELECT
          USING (
            (
              status IN ('PUBLISHED', 'ACTIVE')
              AND (start_date IS NULL OR start_date <= now())
              AND (end_date IS NULL OR end_date > now())
            )
            OR public.is_admin_or_service_role()
          );
      $pol$;
    ELSIF has_status THEN
      EXECUTE $pol$
        CREATE POLICY "Public read active announcements"
          ON public.announcements
          FOR SELECT
          USING (
            status IN ('PUBLISHED', 'ACTIVE')
            OR public.is_admin_or_service_role()
          );
      $pol$;
    ELSE
      EXECUTE $pol$
        CREATE POLICY "Public read active announcements"
          ON public.announcements
          FOR SELECT
          USING (true);
      $pol$;
    END IF;

    CREATE POLICY "Admin insert announcements"
      ON public.announcements
      FOR INSERT
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update announcements"
      ON public.announcements
      FOR UPDATE
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete announcements"
      ON public.announcements
      FOR DELETE
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.7 Table: public.system_errors
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_errors') THEN
    DROP POLICY IF EXISTS "Admin manage system errors" ON public.system_errors;
    DROP POLICY IF EXISTS "Admin read system errors" ON public.system_errors;
    DROP POLICY IF EXISTS "Admin insert system errors" ON public.system_errors;
    DROP POLICY IF EXISTS "Admin update system errors" ON public.system_errors;
    DROP POLICY IF EXISTS "Admin delete system errors" ON public.system_errors;

    CREATE POLICY "Admin read system errors" ON public.system_errors
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert system errors" ON public.system_errors
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update system errors" ON public.system_errors
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete system errors" ON public.system_errors
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.8 Table: public.analytics_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analytics_events') THEN
    DROP POLICY IF EXISTS "Admin manage analytics events" ON public.analytics_events;
    DROP POLICY IF EXISTS "Admin read analytics events" ON public.analytics_events;
    DROP POLICY IF EXISTS "Admin insert analytics events" ON public.analytics_events;
    DROP POLICY IF EXISTS "Admin update analytics events" ON public.analytics_events;
    DROP POLICY IF EXISTS "Admin delete analytics events" ON public.analytics_events;

    CREATE POLICY "Admin read analytics events" ON public.analytics_events
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert analytics events" ON public.analytics_events
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update analytics events" ON public.analytics_events
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete analytics events" ON public.analytics_events
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.9 Table: public.advertisements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'advertisements') THEN
    DROP POLICY IF EXISTS "Public read active ads" ON public.advertisements;
    DROP POLICY IF EXISTS "Admin manage advertisements" ON public.advertisements;
    DROP POLICY IF EXISTS "Admin write advertisements" ON public.advertisements;
    DROP POLICY IF EXISTS "Admin insert advertisements" ON public.advertisements;
    DROP POLICY IF EXISTS "Admin update advertisements" ON public.advertisements;
    DROP POLICY IF EXISTS "Admin delete advertisements" ON public.advertisements;

    CREATE POLICY "Public read active ads" ON public.advertisements
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert advertisements" ON public.advertisements
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update advertisements" ON public.advertisements
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete advertisements" ON public.advertisements
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.10 Table: public.ad_display_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_display_settings') THEN
    DROP POLICY IF EXISTS "Public read ad settings" ON public.ad_display_settings;
    DROP POLICY IF EXISTS "Admin manage ad display settings" ON public.ad_display_settings;
    DROP POLICY IF EXISTS "Admin write ad display settings" ON public.ad_display_settings;
    DROP POLICY IF EXISTS "Admin insert ad display settings" ON public.ad_display_settings;
    DROP POLICY IF EXISTS "Admin update ad display settings" ON public.ad_display_settings;
    DROP POLICY IF EXISTS "Admin delete ad display settings" ON public.ad_display_settings;

    CREATE POLICY "Public read ad settings" ON public.ad_display_settings
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert ad display settings" ON public.ad_display_settings
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update ad display settings" ON public.ad_display_settings
      FOR UPDATE TO authenticated
      USING (public.is_admin_or_service_role())
      WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete ad display settings" ON public.ad_display_settings
      FOR DELETE TO authenticated
      USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 6.11 Table: public.ad_analytics_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_analytics_events') THEN
    DROP POLICY IF EXISTS "Admin view ad analytics" ON public.ad_analytics_events;
    DROP POLICY IF EXISTS "Public insert ad analytics" ON public.ad_analytics_events;

    CREATE POLICY "Admin view ad analytics" ON public.ad_analytics_events
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Public insert ad analytics" ON public.ad_analytics_events
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 6.12 Table: public.platform_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_events') THEN
    DROP POLICY IF EXISTS "Users can read own platform events" ON public.platform_events;
    DROP POLICY IF EXISTS "Admins read all platform events" ON public.platform_events;
    DROP POLICY IF EXISTS "Users and admins read platform events" ON public.platform_events;
    DROP POLICY IF EXISTS "Admins insert platform events" ON public.platform_events;
    DROP POLICY IF EXISTS "Anyone can insert platform events" ON public.platform_events;
    DROP POLICY IF EXISTS "Admins update platform events" ON public.platform_events;
    DROP POLICY IF EXISTS "Admins delete platform events" ON public.platform_events;

    CREATE POLICY "Users and admins read platform events" ON public.platform_events
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Anyone can insert platform events" ON public.platform_events
      FOR INSERT WITH CHECK (true);

    CREATE POLICY "Admins update platform events" ON public.platform_events
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete platform events" ON public.platform_events
      FOR DELETE USING (public.is_admin_or_service_role());
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
    DROP POLICY IF EXISTS "SuperAdmins read role audit logs" ON public.role_audit_logs;

    CREATE POLICY "SuperAdmins read role audit logs" ON public.role_audit_logs
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
    DROP POLICY IF EXISTS "Users and admins read notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admins insert notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admins update notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admins delete notifications" ON public.notifications;

    CREATE POLICY "Users and admins read notifications" ON public.notifications
      FOR SELECT USING (
        (id IN (SELECT notification_id FROM public.notification_recipients WHERE user_id = (SELECT auth.uid())::text))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admins insert notifications" ON public.notifications
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins update notifications" ON public.notifications
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete notifications" ON public.notifications
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.2 Table: public.notification_recipients
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_recipients') THEN
    DROP POLICY IF EXISTS "Users can view own recipient records" ON public.notification_recipients;
    DROP POLICY IF EXISTS "Users can update own recipient records" ON public.notification_recipients;
    DROP POLICY IF EXISTS "Users and admins view recipient records" ON public.notification_recipients;
    DROP POLICY IF EXISTS "Admin insert recipient records" ON public.notification_recipients;
    DROP POLICY IF EXISTS "Admin delete recipient records" ON public.notification_recipients;

    CREATE POLICY "Users and admins view recipient records" ON public.notification_recipients
      FOR SELECT USING (
        (user_id = (SELECT auth.uid())::text)
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users can update own recipient records" ON public.notification_recipients
      FOR UPDATE USING (
        (user_id = (SELECT auth.uid())::text)
        OR public.is_admin_or_service_role()
      ) WITH CHECK (
        (user_id = (SELECT auth.uid())::text)
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin insert recipient records" ON public.notification_recipients
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete recipient records" ON public.notification_recipients
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.3 Table: public.notification_preferences
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_preferences') THEN
    DROP POLICY IF EXISTS "Users can view and manage own notification preferences" ON public.notification_preferences;
    DROP POLICY IF EXISTS "Users and admins view notification preferences" ON public.notification_preferences;
    DROP POLICY IF EXISTS "Users and admins insert notification preferences" ON public.notification_preferences;
    DROP POLICY IF EXISTS "Users and admins update notification preferences" ON public.notification_preferences;
    DROP POLICY IF EXISTS "Admin delete notification preferences" ON public.notification_preferences;

    CREATE POLICY "Users and admins view notification preferences" ON public.notification_preferences
      FOR SELECT USING (
        (user_id = (SELECT auth.uid())::text)
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins insert notification preferences" ON public.notification_preferences
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid())::text)
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins update notification preferences" ON public.notification_preferences
      FOR UPDATE USING (
        (user_id = (SELECT auth.uid())::text)
        OR public.is_admin_or_service_role()
      ) WITH CHECK (
        (user_id = (SELECT auth.uid())::text)
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin delete notification preferences" ON public.notification_preferences
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.4 Table: public.notification_audit_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_audit_logs') THEN
    DROP POLICY IF EXISTS "SuperAdmins can view notification audit logs" ON public.notification_audit_logs;
    DROP POLICY IF EXISTS "SuperAdmins read notification audit logs" ON public.notification_audit_logs;

    CREATE POLICY "SuperAdmins read notification audit logs" ON public.notification_audit_logs
      FOR SELECT USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.5 Table: public.navigation_items
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'navigation_items') THEN
    DROP POLICY IF EXISTS "Admins can manage navigation items" ON public.navigation_items;
    DROP POLICY IF EXISTS "Public can read published enabled navigation items" ON public.navigation_items;
    DROP POLICY IF EXISTS "Admin insert navigation items" ON public.navigation_items;
    DROP POLICY IF EXISTS "Admin update navigation items" ON public.navigation_items;
    DROP POLICY IF EXISTS "Admin delete navigation items" ON public.navigation_items;

    CREATE POLICY "Public can read published enabled navigation items" ON public.navigation_items
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert navigation items" ON public.navigation_items
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update navigation items" ON public.navigation_items
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete navigation items" ON public.navigation_items
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.6 Table: public.navigation_versions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'navigation_versions') THEN
    DROP POLICY IF EXISTS "Admins can manage navigation versions" ON public.navigation_versions;
    DROP POLICY IF EXISTS "Public can read active navigation version" ON public.navigation_versions;
    DROP POLICY IF EXISTS "Admin insert navigation versions" ON public.navigation_versions;
    DROP POLICY IF EXISTS "Admin update navigation versions" ON public.navigation_versions;
    DROP POLICY IF EXISTS "Admin delete navigation versions" ON public.navigation_versions;

    CREATE POLICY "Public can read active navigation version" ON public.navigation_versions
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert navigation versions" ON public.navigation_versions
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update navigation versions" ON public.navigation_versions
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete navigation versions" ON public.navigation_versions
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.7 Table: public.feedback
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback') THEN
    DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
    DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
    DROP POLICY IF EXISTS "Users and admins view feedback" ON public.feedback;
    DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
    DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
    DROP POLICY IF EXISTS "Admins can delete feedback" ON public.feedback;

    CREATE POLICY "Users and admins view feedback" ON public.feedback
      FOR SELECT USING (
        (user_id = (SELECT auth.uid()))
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users can insert feedback" ON public.feedback
      FOR INSERT WITH CHECK (true);

    CREATE POLICY "Admins can update feedback" ON public.feedback
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins can delete feedback" ON public.feedback
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.8 Table: public.interview_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_events') THEN
    DROP POLICY IF EXISTS "Users insert own interview events" ON public.interview_events;
    DROP POLICY IF EXISTS "Users read own interview events" ON public.interview_events;
    DROP POLICY IF EXISTS "Admins manage all interview events" ON public.interview_events;
    DROP POLICY IF EXISTS "Users and admins read interview events" ON public.interview_events;
    DROP POLICY IF EXISTS "Admins update interview events" ON public.interview_events;
    DROP POLICY IF EXISTS "Admins delete interview events" ON public.interview_events;

    CREATE POLICY "Users and admins read interview events" ON public.interview_events
      FOR SELECT USING (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users insert own interview events" ON public.interview_events
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admins update interview events" ON public.interview_events
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete interview events" ON public.interview_events
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.9 Table: public.interview_permissions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_permissions') THEN
    DROP POLICY IF EXISTS "Users manage own interview permissions" ON public.interview_permissions;
    DROP POLICY IF EXISTS "Users and admins read interview permissions" ON public.interview_permissions;
    DROP POLICY IF EXISTS "Users and admins insert interview permissions" ON public.interview_permissions;
    DROP POLICY IF EXISTS "Users and admins update interview permissions" ON public.interview_permissions;
    DROP POLICY IF EXISTS "Admins delete interview permissions" ON public.interview_permissions;

    CREATE POLICY "Users and admins read interview permissions" ON public.interview_permissions
      FOR SELECT USING (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins insert interview permissions" ON public.interview_permissions
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins update interview permissions" ON public.interview_permissions
      FOR UPDATE USING (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      ) WITH CHECK (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admins delete interview permissions" ON public.interview_permissions
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.10 Table: public.interview_locations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_locations') THEN
    DROP POLICY IF EXISTS "Users insert own interview locations" ON public.interview_locations;
    DROP POLICY IF EXISTS "Admins manage all interview locations" ON public.interview_locations;
    DROP POLICY IF EXISTS "Users and admins read interview locations" ON public.interview_locations;
    DROP POLICY IF EXISTS "Users and admins insert interview locations" ON public.interview_locations;
    DROP POLICY IF EXISTS "Admin update interview locations" ON public.interview_locations;
    DROP POLICY IF EXISTS "Admin delete interview locations" ON public.interview_locations;

    CREATE POLICY "Users and admins read interview locations" ON public.interview_locations
      FOR SELECT USING (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users and admins insert interview locations" ON public.interview_locations
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin update interview locations" ON public.interview_locations
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete interview locations" ON public.interview_locations
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.11 Table: public.interview_centers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_centers') THEN
    DROP POLICY IF EXISTS "Admins manage all interview centers" ON public.interview_centers;
    DROP POLICY IF EXISTS "Anyone can view active interview centers" ON public.interview_centers;
    DROP POLICY IF EXISTS "Admin insert interview centers" ON public.interview_centers;
    DROP POLICY IF EXISTS "Admin update interview centers" ON public.interview_centers;
    DROP POLICY IF EXISTS "Admin delete interview centers" ON public.interview_centers;

    CREATE POLICY "Anyone can view active interview centers" ON public.interview_centers
      FOR SELECT USING (
        (status = 'ACTIVE')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admin insert interview centers" ON public.interview_centers
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update interview centers" ON public.interview_centers
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete interview centers" ON public.interview_centers
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.12 Table: public.interview_sessions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_sessions') THEN
    DROP POLICY IF EXISTS "Users read own sessions" ON public.interview_sessions;
    DROP POLICY IF EXISTS "Users insert own sessions" ON public.interview_sessions;
    DROP POLICY IF EXISTS "Users update own sessions" ON public.interview_sessions;
    DROP POLICY IF EXISTS "Admins delete sessions" ON public.interview_sessions;

    CREATE POLICY "Users read own sessions" ON public.interview_sessions
      FOR SELECT USING (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users insert own sessions" ON public.interview_sessions
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users update own sessions" ON public.interview_sessions
      FOR UPDATE USING (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      ) WITH CHECK (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admins delete sessions" ON public.interview_sessions
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.13 Table: public.interview_answers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_answers') THEN
    DROP POLICY IF EXISTS "Users read own interview answers" ON public.interview_answers;
    DROP POLICY IF EXISTS "Users insert own interview answers" ON public.interview_answers;
    DROP POLICY IF EXISTS "Admins manage all interview answers" ON public.interview_answers;
    DROP POLICY IF EXISTS "Users and admins read interview answers" ON public.interview_answers;
    DROP POLICY IF EXISTS "Admins update interview answers" ON public.interview_answers;
    DROP POLICY IF EXISTS "Admins delete interview answers" ON public.interview_answers;

    CREATE POLICY "Users and admins read interview answers" ON public.interview_answers
      FOR SELECT USING (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Users insert own interview answers" ON public.interview_answers
      FOR INSERT WITH CHECK (
        (user_id = (SELECT auth.uid())::text OR user_id = 'guest')
        OR public.is_admin_or_service_role()
      );

    CREATE POLICY "Admins update interview answers" ON public.interview_answers
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admins delete interview answers" ON public.interview_answers
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.14 Table: public.interview_interviewers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_interviewers') THEN
    DROP POLICY IF EXISTS "Admins manage interviewers" ON public.interview_interviewers;
    DROP POLICY IF EXISTS "Anyone can view interviewers availability" ON public.interview_interviewers;
    DROP POLICY IF EXISTS "Admin insert interview interviewers" ON public.interview_interviewers;
    DROP POLICY IF EXISTS "Admin update interview interviewers" ON public.interview_interviewers;
    DROP POLICY IF EXISTS "Admin delete interview interviewers" ON public.interview_interviewers;

    CREATE POLICY "Anyone can view interviewers availability" ON public.interview_interviewers
      FOR SELECT USING (true);

    CREATE POLICY "Admin insert interview interviewers" ON public.interview_interviewers
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin update interview interviewers" ON public.interview_interviewers
      FOR UPDATE USING (public.is_admin_or_service_role()) WITH CHECK (public.is_admin_or_service_role());

    CREATE POLICY "Admin delete interview interviewers" ON public.interview_interviewers
      FOR DELETE USING (public.is_admin_or_service_role());
  END IF;
END $$;

-- 7.15 Table: public.auth_email_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_email_logs') THEN
    DROP POLICY IF EXISTS "Admin read auth email logs" ON public.auth_email_logs;
    DROP POLICY IF EXISTS "Admin insert auth email logs" ON public.auth_email_logs;

    CREATE POLICY "Admin read auth email logs" ON public.auth_email_logs
      FOR SELECT USING (public.is_admin_or_service_role());

    CREATE POLICY "Admin insert auth email logs" ON public.auth_email_logs
      FOR INSERT WITH CHECK (public.is_admin_or_service_role());
  END IF;
END $$;
