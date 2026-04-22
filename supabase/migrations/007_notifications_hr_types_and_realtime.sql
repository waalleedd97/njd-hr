-- =============================================================================
-- 007_notifications_hr_types_and_realtime.sql
-- =============================================================================
--
-- Run in Supabase Dashboard → SQL Editor (Landing project: iauulqfgrbegwcnfatmx)
--
-- Fixes two issues discovered by end-to-end notification testing:
--
-- 1. The existing `notifications_type_check` constraint only accepts
--    'general', 'leave_request', 'leave_approved', 'leave_rejected' — so every
--    HR client insert (which uses leave/request/payroll/attendance/system) was
--    failing silently with PostgreSQL error 23514.
--
-- 2. `notifications` is not in the supabase_realtime publication, so INSERT
--    events never reach subscribed clients. (Intended fix in 006 did not run.)
--
-- Idempotent — safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Expand notifications_type_check to accept both legacy and HR-specific types
-- -----------------------------------------------------------------------------
alter table notifications drop constraint if exists notifications_type_check;

alter table notifications add constraint notifications_type_check
  check (type in (
    -- Legacy Landing types (keep for backward compatibility with Landing / Board)
    'general',
    'leave_request',
    'leave_approved',
    'leave_rejected',
    -- HR client types (src/lib/notifications.ts)
    'leave',
    'request',
    'payroll',
    'attendance',
    'system'
  ));

-- -----------------------------------------------------------------------------
-- 2. Ensure notifications is published via supabase_realtime
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
    raise notice 'Added notifications to supabase_realtime publication';
  else
    raise notice 'notifications already in supabase_realtime publication';
  end if;
end $$;

-- =============================================================================
-- VERIFICATION (run separately to confirm)
-- =============================================================================
--
-- -- Check constraint:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'notifications'::regclass and contype = 'c';
--
-- -- Realtime publication:
-- select tablename from pg_publication_tables
-- where pubname = 'supabase_realtime' and tablename = 'notifications';
--
-- =============================================================================
