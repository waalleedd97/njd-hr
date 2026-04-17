-- =====================================================================
-- NJD HR — Schedule pg_cron Jobs
-- =====================================================================
-- Run this AFTER 007_lifecycle_jobs.sql has been applied.
--
-- Prerequisites (one-time per Supabase project):
--   1. Dashboard → Database → Extensions → enable `pg_cron`
--   2. Dashboard → Database → Extensions → enable `pg_net` (optional,
--      needed only if cron jobs will call HTTP endpoints)
--
-- All schedules are expressed in UTC. KSA is UTC+3.
-- =====================================================================

-- -------- Remove any existing jobs with these names -------------------
-- Safe to run repeatedly — no-op if the job doesn't exist.
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'njd_hr_annual_leave_rollover',
  'njd_hr_expire_stale_invitations',
  'njd_hr_archive_attendance'
);


-- -------- 1. Annual leave roll-over -----------------------------------
-- Runs Dec 31 at 21:05 UTC (Jan 1 00:05 KSA). Targets the new calendar year.
select cron.schedule(
  'njd_hr_annual_leave_rollover',
  '5 21 31 12 *',
  $$select annual_leave_rollover(extract(year from current_date + interval '1 day')::int);$$
);


-- -------- 2. Expire stale invitations --------------------------------
-- Runs daily at 00:00 UTC (03:00 KSA). Expires invitations older than 30 days.
select cron.schedule(
  'njd_hr_expire_stale_invitations',
  '0 0 * * *',
  $$select expire_stale_invitations(30);$$
);


-- -------- 3. Archive old attendance -----------------------------------
-- Runs 1st of every month at 01:00 UTC (04:00 KSA).
-- Moves rows older than 2 years into attendance_archive.
select cron.schedule(
  'njd_hr_archive_attendance',
  '0 1 1 * *',
  $$select archive_attendance(current_date - interval '2 years');$$
);


-- -------- Verification ------------------------------------------------
-- After running, inspect with:
--
--   select jobname, schedule, active
--   from cron.job
--   where jobname like 'njd_hr_%';
--
-- Most-recent run status:
--
--   select jobid, runid, job_pid, status, return_message, start_time, end_time
--   from cron.job_run_details
--   where jobid in (select jobid from cron.job where jobname like 'njd_hr_%')
--   order by start_time desc
--   limit 10;
