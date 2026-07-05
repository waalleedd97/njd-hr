-- =====================================================================
-- NJD HR - Supabase hardening and performance advisor fixes
-- =====================================================================
-- Target project: Supabase Landing project (iauulqfgrbegwcnfatmx).
-- This file is intentionally committed for review only; do not apply it
-- from Codex. All statements are idempotent or safe to re-run.
-- =====================================================================

-- 9.1 Pin search_path on advisor-flagged SECURITY DEFINER functions.
ALTER FUNCTION public.get_user_role(uuid) SET search_path = public;
ALTER FUNCTION public.has_app_access(uuid, text) SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_email_allowed(text) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.admin_update_role(uuid, text) SET search_path = public;
ALTER FUNCTION public.admin_toggle_app_access(uuid, text, boolean) SET search_path = public;
ALTER FUNCTION public.admin_delete_user(uuid) SET search_path = public;
ALTER FUNCTION public.admin_send_notification(uuid, text, text, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.admin_add_allowed_email(text) SET search_path = public;
ALTER FUNCTION public.admin_remove_allowed_email(uuid) SET search_path = public;
ALTER FUNCTION public.admin_update_location_required(uuid, boolean) SET search_path = public;
ALTER FUNCTION public.admin_list_users() SET search_path = public;

-- 9.2 Remove anonymous/public execution from helper SECURITY DEFINER RPCs.
-- Revoke from PUBLIC as well as anon; otherwise the default PUBLIC EXECUTE
-- grant still leaves these functions callable by anon.
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_app_access(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_app_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- Keep public/anon access to is_email_allowed until the Landing signup flow is
-- explicitly verified to not call it before authentication.

-- 9.3 Rewrite bare auth.* calls in RLS policies to initplans.
-- This keeps policy semantics unchanged while avoiding per-row auth function
-- re-evaluation. The guard keeps this idempotent after the first run.
-- Scope: public schema only. storage.objects policies are owned by
-- supabase_storage_admin and ALTER POLICY on them can fail with an ownership
-- error when run as postgres; they are handled separately (best-effort).
DO $$
DECLARE
  p record;
  new_qual text;
  new_with_check text;
  ddl text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual LIKE '%auth.uid()%' AND qual NOT ILIKE '%select auth.uid%')
        OR (with_check LIKE '%auth.uid()%' AND with_check NOT ILIKE '%select auth.uid%')
        OR (qual LIKE '%auth.jwt()%' AND qual NOT ILIKE '%select auth.jwt%')
        OR (with_check LIKE '%auth.jwt()%' AND with_check NOT ILIKE '%select auth.jwt%')
        OR (qual LIKE '%auth.role()%' AND qual NOT ILIKE '%select auth.role%')
        OR (with_check LIKE '%auth.role()%' AND with_check NOT ILIKE '%select auth.role%')
      )
  LOOP
    new_qual := p.qual;
    new_with_check := p.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
      new_qual := replace(new_qual, 'auth.jwt()', '(select auth.jwt())');
      new_qual := replace(new_qual, 'auth.role()', '(select auth.role())');
    END IF;

    IF new_with_check IS NOT NULL THEN
      new_with_check := replace(new_with_check, 'auth.uid()', '(select auth.uid())');
      new_with_check := replace(new_with_check, 'auth.jwt()', '(select auth.jwt())');
      new_with_check := replace(new_with_check, 'auth.role()', '(select auth.role())');
    END IF;

    ddl := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);

    IF new_qual IS NOT NULL THEN
      ddl := ddl || format(' USING (%s)', new_qual);
    END IF;

    IF new_with_check IS NOT NULL THEN
      ddl := ddl || format(' WITH CHECK (%s)', new_with_check);
    END IF;

    EXECUTE ddl;
  END LOOP;
END $$;

-- 9.4 Consolidate duplicate SELECT policies on the first hot tables called out
-- by the plan. Write policies remain separate so each action stays explicit.

-- app_access: users read their own access; super admins read/manage all access.
DROP POLICY IF EXISTS "Super admins manage access" ON public.app_access;
DROP POLICY IF EXISTS "Users read own access" ON public.app_access;
DROP POLICY IF EXISTS "app_access_select_own_or_admin" ON public.app_access;
DROP POLICY IF EXISTS "app_access_insert_admin" ON public.app_access;
DROP POLICY IF EXISTS "app_access_update_admin" ON public.app_access;
DROP POLICY IF EXISTS "app_access_delete_admin" ON public.app_access;

CREATE POLICY "app_access_select_own_or_admin"
  ON public.app_access
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_super_admin((select auth.uid()))
  );

CREATE POLICY "app_access_insert_admin"
  ON public.app_access
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin((select auth.uid())));

CREATE POLICY "app_access_update_admin"
  ON public.app_access
  FOR UPDATE
  TO authenticated
  USING (is_super_admin((select auth.uid())))
  WITH CHECK (is_super_admin((select auth.uid())));

CREATE POLICY "app_access_delete_admin"
  ON public.app_access
  FOR DELETE
  TO authenticated
  USING (is_super_admin((select auth.uid())));

-- app_settings: authenticated users read settings; super admins write.
DROP POLICY IF EXISTS "admins_write_app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "public_read_app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_read_authenticated" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_insert_admin" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_update_admin" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_delete_admin" ON public.app_settings;

-- NOTE: the old policy was named public_read_app_settings and applied to the
-- public role — the Landing page may read app_settings before login, so anon
-- read access is preserved intentionally.
CREATE POLICY "app_settings_read_authenticated"
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "app_settings_insert_admin"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin((select auth.uid())));

CREATE POLICY "app_settings_update_admin"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (is_super_admin((select auth.uid())))
  WITH CHECK (is_super_admin((select auth.uid())));

CREATE POLICY "app_settings_delete_admin"
  ON public.app_settings
  FOR DELETE
  TO authenticated
  USING (is_super_admin((select auth.uid())));

-- profiles: users read their own profile; super admins read all profiles.
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid())
    OR is_super_admin((select auth.uid()))
  );

-- 9.5 Add covering indexes for all 16 advisor-flagged foreign keys.
CREATE INDEX IF NOT EXISTS idx_allowed_emails_added_by_fk
  ON public.allowed_emails(added_by);

CREATE INDEX IF NOT EXISTS idx_app_access_granted_by_fk
  ON public.app_access(granted_by);

CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_employee_id_fk
  ON public.attendance_adjustments(employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_reviewed_by_fk
  ON public.attendance_adjustments(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_compliance_items_reviewed_by_fk
  ON public.compliance_items(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_departments_created_by_fk
  ON public.departments(created_by);

CREATE INDEX IF NOT EXISTS idx_employee_assets_issued_by_fk
  ON public.employee_assets(issued_by);

CREATE INDEX IF NOT EXISTS idx_employee_requests_employee_id_fk
  ON public.employee_requests(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_requests_reviewed_by_fk
  ON public.employee_requests(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id_fk
  ON public.leave_requests(employee_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_reviewed_by_fk
  ON public.leave_requests(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_pending_invitations_invited_by_fk
  ON public.pending_invitations(invited_by);

CREATE INDEX IF NOT EXISTS idx_salary_advances_employee_id_fk
  ON public.salary_advances(employee_id);

CREATE INDEX IF NOT EXISTS idx_salary_advances_reviewed_by_fk
  ON public.salary_advances(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_name_fk
  ON public.user_roles(role_name);

CREATE INDEX IF NOT EXISTS idx_user_roles_updated_by_fk
  ON public.user_roles(updated_by);

-- 9.6 Advisor-flagged unused indexes are intentionally not dropped here.
-- Their "unused" status must be verified against production traffic after the
-- latest deploy; idx_profiles_manager_id is new org-chart infrastructure.

-- 9.7 SKIPPED: the attachments bucket is used by the Board app (object paths
-- contain /tasks/). Board's source is not available to verify whether it reads
-- objects through the authenticated Storage API (which requires this SELECT
-- policy) rather than public object URLs. Dropping it could break Board.
-- Revisit after auditing the Board repo:
--   DROP POLICY IF EXISTS "Public read attachments" ON storage.objects;
