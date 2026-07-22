-- =====================================================================
-- NJD HR — Daily Absence Marking
-- =====================================================================
-- The app only writes attendance rows when an employee checks in
-- ('present' / 'late'). Days with no check-in previously produced NO row
-- at all, so absence penalties (rule P005: 100% of daily salary) could
-- never fire and every absent/on-leave metric in the UI showed 0.
--
-- This migration adds `mark_daily_absences(target_date)` which, for a
-- finished workday, inserts the missing rows:
--
--   - 'absent'   — employee has no attendance row and is not on approved
--                  leave that day.
--   - 'on-leave' — employee has no attendance row but an approved leave
--                  request covers the day.
--
-- Rules:
--   * Weekends (Friday/Saturday, KSA) are skipped entirely.
--   * Employees whose profiles.start_date is after target_date are
--     skipped (they hadn't joined yet).
--   * Remote employees (location_required = false) still get rows —
--     they are exempt from penalties downstream anyway.
--   * Idempotent: existing rows are never touched (ON CONFLICT).
--
-- Schedule: runs daily at 21:00 UTC (00:00 KSA) and marks the KSA day
-- that just ended. Applied via pg_cron at the bottom of this file.
-- =====================================================================


create or replace function mark_daily_absences(target_date date default ((now() at time zone 'Asia/Riyadh')::date - 1))
returns table (absent_count int, on_leave_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  dow int;
  a_count int := 0;
  l_count int := 0;
begin
  -- Skip KSA weekend: ISODOW 5 = Friday, 6 = Saturday.
  dow := extract(isodow from target_date);
  if dow in (5, 6) then
    return query select 0, 0;
    return;
  end if;

  -- Employees on approved leave → 'on-leave' rows.
  with inserted as (
    insert into attendance (employee_id, date, status, method)
    select p.id, target_date, 'on-leave', 'manual'
    from profiles p
    where (p.start_date is null or p.start_date <= target_date)
      and exists (
        select 1 from leave_requests lr
        where lr.employee_id = p.id
          and lr.status = 'approved'
          and lr.start_date <= target_date
          and lr.end_date >= target_date
      )
    on conflict (employee_id, date) do nothing
    returning 1
  )
  select count(*) into l_count from inserted;

  -- Everyone else with no row → 'absent'.
  with inserted as (
    insert into attendance (employee_id, date, status, method)
    select p.id, target_date, 'absent', 'manual'
    from profiles p
    where (p.start_date is null or p.start_date <= target_date)
      and not exists (
        select 1 from attendance a
        where a.employee_id = p.id
          and a.date = target_date
      )
    on conflict (employee_id, date) do nothing
    returning 1
  )
  select count(*) into a_count from inserted;

  return query select a_count, l_count;
end;
$$;

comment on function mark_daily_absences is
  'Inserts absent / on-leave attendance rows for a finished KSA workday. Idempotent; skips Fri/Sat and not-yet-joined employees.';

-- Only the cron role (postgres) should execute this — it writes business
-- data for every employee, so keep it away from authenticated/anon.
revoke all on function mark_daily_absences(date) from public, anon, authenticated;
grant execute on function mark_daily_absences(date) to postgres;


-- -------- pg_cron schedule ---------------------------------------------
-- 21:00 UTC = 00:00 Asia/Riyadh: marks the workday that just ended.
-- Safe to re-run: unschedule is a no-op if the job doesn't exist.

select cron.unschedule(jobid)
from cron.job
where jobname = 'njd_hr_mark_daily_absences';

select cron.schedule(
  'njd_hr_mark_daily_absences',
  '0 21 * * *',
  $$select mark_daily_absences();$$
);

-- Verification:
--   select jobname, schedule, active from cron.job
--   where jobname = 'njd_hr_mark_daily_absences';
-- Manual backfill for a specific past date:
--   select mark_daily_absences('2026-07-21');
