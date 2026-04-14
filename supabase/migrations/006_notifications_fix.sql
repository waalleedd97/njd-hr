-- =============================================================================
-- 006_notifications_fix.sql
-- =============================================================================
--
-- Run this in Supabase Dashboard → SQL Editor (Landing project: iauulqfgrbegwcnfatmx)
--
-- The notifications table already exists in Landing with this schema:
--   id, user_id, app_name, type, title_ar, title_en,
--   body_ar, body_en, link, is_read, created_at
--
-- This migration only adds what's missing: RLS policies, indexes, Realtime.
-- Idempotent — safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Indexes for performance
-- -----------------------------------------------------------------------------
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_created_at on notifications(created_at desc);
create index if not exists idx_notifications_user_unread on notifications(user_id, is_read) where is_read = false;

-- -----------------------------------------------------------------------------
-- 2. Row-Level Security
-- -----------------------------------------------------------------------------
alter table notifications enable row level security;

-- Users can SELECT their own notifications
drop policy if exists "Users see own notifications" on notifications;
create policy "Users see own notifications" on notifications
  for select using (user_id = auth.uid());

-- Users can UPDATE their own notifications (mark-as-read)
drop policy if exists "Users update own notifications" on notifications;
create policy "Users update own notifications" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Note: INSERT happens server-side via /api/notifications/* using
-- SUPABASE_SERVICE_ROLE_KEY which bypasses RLS. No INSERT policy needed.

-- -----------------------------------------------------------------------------
-- 3. Enable Realtime publication (so the app receives live INSERT events)
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

-- -----------------------------------------------------------------------------
-- 4. notification_preferences (for Settings → Notifications tab)
-- -----------------------------------------------------------------------------
create table if not exists notification_preferences (
  user_id uuid references auth.users(id) on delete cascade,
  app_name text default 'hr',
  email_notifications boolean default true,
  push_notifications boolean default true,
  attendance_reminders boolean default true,
  leave_updates boolean default true,
  payroll_updates boolean default true,
  updated_at timestamptz default now(),
  primary key (user_id, app_name)
);

alter table notification_preferences enable row level security;

drop policy if exists "Users manage own prefs" on notification_preferences;
create policy "Users manage own prefs" on notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- VERIFICATION (run separately to confirm)
-- =============================================================================
--
-- select policyname, cmd from pg_policies where tablename = 'notifications';
--
-- select * from pg_publication_tables
-- where pubname = 'supabase_realtime' and tablename = 'notifications';
--
-- =============================================================================
