-- =====================================================================
-- NJD HR — Defense-in-Depth: Lock Down SECURITY DEFINER Function Access
-- =====================================================================
-- Supabase Postgres grants EXECUTE on every function to PUBLIC by default.
-- For SECURITY DEFINER functions that internally check `is_super_admin()`,
-- this is functionally safe — but the linter (and an attacker scanning the
-- REST surface) sees them as exposed.
--
-- This migration tightens the EXECUTE grants on all admin and lifecycle
-- functions so the role permission acts as a *first* gate, not just the
-- internal check. Net result on Supabase advisors: ~14 warnings cleared.
--
-- Functions kept callable by `authenticated` (still gate via is_super_admin
-- inside the body — but Landing admin panel + HR app need to RPC them):
--   - admin_add_allowed_email, admin_remove_allowed_email
--   - admin_delete_user, admin_update_role, admin_toggle_app_access
--   - admin_send_notification, admin_update_location_required, admin_list_users
--
-- Functions locked to `postgres` only (called by pg_cron from
-- supabase/migrations/008_schedule_cron_jobs.sql):
--   - annual_leave_rollover, expire_stale_invitations, archive_attendance
-- =====================================================================

-- Admin RPCs: revoke from PUBLIC + anon, keep authenticated grant
revoke execute on function public.admin_add_allowed_email(text) from public, anon;
revoke execute on function public.admin_remove_allowed_email(uuid) from public, anon;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
revoke execute on function public.admin_update_role(uuid, text) from public, anon;
revoke execute on function public.admin_toggle_app_access(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_send_notification(uuid, text, text, text, text, text, text) from public, anon;
revoke execute on function public.admin_update_location_required(uuid, boolean) from public, anon;
revoke execute on function public.admin_list_users() from public, anon;

grant execute on function public.admin_add_allowed_email(text) to authenticated;
grant execute on function public.admin_remove_allowed_email(uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_update_role(uuid, text) to authenticated;
grant execute on function public.admin_toggle_app_access(uuid, text, boolean) to authenticated;
grant execute on function public.admin_send_notification(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_update_location_required(uuid, boolean) to authenticated;
grant execute on function public.admin_list_users() to authenticated;

-- Lifecycle jobs: only postgres (pg_cron) needs to call them.
revoke execute on function public.annual_leave_rollover(integer) from public, anon, authenticated;
revoke execute on function public.archive_attendance(date) from public, anon, authenticated;
revoke execute on function public.expire_stale_invitations(integer) from public, anon, authenticated;

-- Helpers (is_super_admin, get_user_role, has_app_access, is_email_allowed,
-- handle_new_user) are intentionally NOT revoked — they back RLS policies
-- and the AuthProvider hydration check, so anon/authenticated need them.
