-- =====================================================================
-- NJD HR — Lifecycle Maintenance Jobs
-- =====================================================================
-- This migration adds three housekeeping routines:
--
--   1. annual_leave_rollover(target_year int)
--      Closes the old year's leave_balances rows and opens new ones for
--      target_year. Carry-over is capped per Saudi labor law guidance
--      (Article 109 permits up to 30 days, but most contracts cap much
--      lower — we default to 5 days, configurable via app_settings).
--
--   2. expire_stale_invitations()
--      Flips `pending_invitations` older than 30 days to 'expired' so
--      the UI stops showing stale invites for employees who never
--      clicked through.
--
--   3. archive_attendance(cutoff date)
--      Copies attendance rows older than cutoff into `attendance_archive`
--      and deletes them from the live table. Archive is kept forever
--      for GOSI/tax compliance.
--
-- Schedule these with Supabase cron (pg_cron) or a Supabase Edge Function
-- calling `supabase.rpc(...)` on a daily/annual basis.
-- =====================================================================


-- -------- 1. Annual leave roll-over -----------------------------------

create or replace function annual_leave_rollover(target_year int default extract(year from current_date)::int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  carry_cap int;
begin
  -- Read carry-over cap from app_settings; default to 5 days.
  select coalesce(
    (value->>'leave_carryover_cap_days')::int,
    5
  ) into carry_cap
  from app_settings
  where key = 'leave_policy'
  limit 1;

  if carry_cap is null then
    carry_cap := 5;
  end if;

  -- Roll over only the annual leave bucket; sick/maternity/etc. reset fresh.
  insert into leave_balances (employee_id, type_key, year, total, used)
  select
    prev.employee_id,
    prev.type_key,
    target_year,
    case
      when prev.type_key = 'annual' then
        21 + least(greatest(prev.total - prev.used, 0), carry_cap)
      when prev.type_key = 'sick' then 30
      when prev.type_key = 'maternity' then 70
      when prev.type_key = 'unpaid' then 30
      when prev.type_key = 'marriage' then 5
      when prev.type_key = 'paternity' then 3
      when prev.type_key = 'bereavement' then 5
      when prev.type_key = 'hajj' then 15
      else prev.total
    end,
    0
  from leave_balances prev
  where prev.year = target_year - 1
  on conflict (employee_id, type_key, year) do nothing;
end;
$$;

comment on function annual_leave_rollover is
  'Opens next-year leave_balances with carry-over capped from app_settings.leave_policy.leave_carryover_cap_days.';


-- -------- 2. Expire stale invitations ---------------------------------

create or replace function expire_stale_invitations(older_than_days int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  update pending_invitations
  set status = 'expired'
  where status = 'pending'
    and sent_date < current_date - (older_than_days || ' days')::interval;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function expire_stale_invitations is
  'Flips pending_invitations older than N days to status=expired. Returns count affected.';


-- -------- 3. Attendance archival --------------------------------------

create table if not exists attendance_archive (
  id bigint primary key,
  employee_id text,
  date date not null,
  check_in time,
  check_out time,
  method text,
  status text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz,
  archived_at timestamptz default now()
);

create index if not exists idx_attendance_archive_employee_date
  on attendance_archive(employee_id, date desc);


create or replace function archive_attendance(cutoff date default current_date - interval '2 years')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  moved int;
begin
  with moved_rows as (
    delete from attendance
    where date < cutoff
    returning *
  )
  insert into attendance_archive (
    id, employee_id, date, check_in, check_out, method, status,
    latitude, longitude, created_at
  )
  select
    id, employee_id, date, check_in, check_out, method, status,
    latitude, longitude, created_at
  from moved_rows;

  get diagnostics moved = row_count;
  return moved;
end;
$$;

comment on function archive_attendance is
  'Moves attendance rows older than cutoff into attendance_archive. Default cutoff: 2 years.';


-- -------- RLS: archive visible to admins only -------------------------

alter table attendance_archive enable row level security;

create policy "admins_read_attendance_archive" on attendance_archive
  for select using (is_super_admin(auth.uid()));


-- -------- Suggested pg_cron schedule (run in Supabase dashboard) -----
--
-- -- Annual rollover: Jan 1 at 00:05 KSA (21:05 UTC Dec 31)
-- select cron.schedule('annual_leave_rollover',
--   '5 21 31 12 *',
--   $$select annual_leave_rollover();$$);
--
-- -- Invitation expiry: daily at 03:00 KSA (00:00 UTC)
-- select cron.schedule('expire_stale_invitations',
--   '0 0 * * *',
--   $$select expire_stale_invitations();$$);
--
-- -- Attendance archival: monthly on 1st at 04:00 KSA (01:00 UTC)
-- select cron.schedule('archive_attendance',
--   '0 1 1 * *',
--   $$select archive_attendance();$$);
