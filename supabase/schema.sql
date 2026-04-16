-- ============================================================
-- NJD Games HR System — Supabase Database Schema
-- Run this in your Supabase SQL Editor to create all tables
-- ============================================================

-- Departments
create table if not exists departments (
  id text primary key,
  name_ar text not null,
  name_en text not null
);

insert into departments (id, name_ar, name_en) values
  ('software-dev', 'تطوير البرمجيات', 'Software Development'),
  ('game-dev', 'تطوير الألعاب', 'Game Development'),
  ('design', 'التصميم', 'Design'),
  ('hr', 'الموارد البشرية', 'Human Resources'),
  ('marketing', 'التسويق', 'Marketing'),
  ('finance', 'الشؤون المالية', 'Finance'),
  ('project-mgmt', 'إدارة المشاريع', 'Project Management')
on conflict (id) do nothing;

-- Employees
create table if not exists employees (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  position_ar text not null,
  position_en text not null,
  department text references departments(id),
  email text unique not null,
  phone text,
  status text not null default 'active' check (status in ('active', 'on-leave', 'inactive')),
  join_date date not null default current_date,
  salary_basic numeric not null default 0,
  salary_housing numeric not null default 0,
  salary_transport numeric not null default 0,
  salary_other numeric not null default 0,
  initials text,
  avatar_color text,
  created_at timestamptz default now()
);

-- Attendance Records
create table if not exists attendance (
  id bigint generated always as identity primary key,
  employee_id text references employees(id) on delete cascade,
  date date not null default current_date,
  check_in time,
  check_out time,
  method text default 'geofence' check (method in ('geofence', 'manual', 'biometric')),
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'on-leave', 'half-day')),
  latitude numeric,
  longitude numeric,
  created_at timestamptz default now(),
  unique (employee_id, date)
);

-- Leave Balances
create table if not exists leave_balances (
  id bigint generated always as identity primary key,
  employee_id text references employees(id) on delete cascade,
  type_key text not null,
  total integer not null default 0,
  used integer not null default 0,
  remaining integer generated always as (total - used) stored,
  year integer not null default extract(year from current_date),
  unique (employee_id, type_key, year)
);

-- Leave Requests
create table if not exists leave_requests (
  id text primary key default 'LR' || gen_random_uuid()::text,
  employee_id text references employees(id) on delete cascade,
  type_key text not null,
  start_date date not null,
  end_date date not null,
  days integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason_ar text,
  reason_en text,
  reviewed_by text references employees(id),
  created_at timestamptz default now()
);

-- Employee Requests (salary cert, permission, document, etc.)
create table if not exists employee_requests (
  id text primary key default 'REQ' || gen_random_uuid()::text,
  employee_id text references employees(id) on delete cascade,
  type_key text not null,
  date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'in-review', 'approved', 'rejected')),
  details_ar text,
  details_en text,
  reviewed_by text references employees(id),
  created_at timestamptz default now()
);

-- Attendance Adjustments
create table if not exists attendance_adjustments (
  id text primary key default 'ADJ' || gen_random_uuid()::text,
  employee_id text references employees(id) on delete cascade,
  date date not null,
  original_in time,
  requested_in time,
  original_out time,
  requested_out time,
  reason_ar text,
  reason_en text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text references employees(id),
  created_at timestamptz default now()
);

-- Salary Advances
create table if not exists salary_advances (
  id text primary key default 'ADV' || gen_random_uuid()::text,
  employee_id text references employees(id) on delete cascade,
  amount numeric not null,
  reason_ar text,
  reason_en text,
  request_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  repayment_months integer not null default 3,
  monthly_deduction numeric not null default 0,
  remaining_balance numeric not null default 0,
  paid_months integer not null default 0,
  reviewed_by text references employees(id),
  created_at timestamptz default now()
);

-- Pending Invitations
create table if not exists pending_invitations (
  id text primary key default 'INV' || gen_random_uuid()::text,
  email text not null,
  name_ar text not null,
  name_en text not null,
  department text references departments(id),
  position_ar text,
  position_en text,
  sent_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'expired')),
  created_at timestamptz default now()
);

-- Notifications
create table if not exists notifications (
  id text primary key default 'N' || gen_random_uuid()::text,
  user_id text references employees(id) on delete cascade,
  type text not null check (type in ('leave', 'request', 'payroll', 'attendance', 'system')),
  title_ar text not null,
  title_en text not null,
  desc_ar text,
  desc_en text,
  href text,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- Saudi Public Holidays
create table if not exists holidays (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  start_date date not null,
  end_date date not null,
  days integer not null default 1
);

insert into holidays (id, name_ar, name_en, start_date, end_date, days) values
  ('H001', 'يوم التأسيس', 'Founding Day', '2026-02-22', '2026-02-22', 1),
  ('H002', 'عيد الفطر', 'Eid Al-Fitr', '2026-03-30', '2026-04-02', 4),
  ('H003', 'عيد الأضحى', 'Eid Al-Adha', '2026-06-06', '2026-06-09', 4),
  ('H004', 'اليوم الوطني', 'National Day', '2026-09-23', '2026-09-23', 1)
on conflict (id) do nothing;

-- Penalty Rules
create table if not exists penalty_rules (
  id text primary key,
  condition_ar text not null,
  condition_en text not null,
  deduction_ar text not null,
  deduction_en text not null,
  min_late integer not null,
  max_late integer not null,
  percentage numeric not null default 0
);

-- Penalty rules must match src/lib/mock-data.ts penaltyRules.
-- Source of truth: CLAUDE.md § Penalty Rules (Late Arrival).
insert into penalty_rules (id, condition_ar, condition_en, deduction_ar, deduction_en, min_late, max_late, percentage) values
  ('P001', 'تأخر 1-15 دقيقة', 'Late 1-15 min', 'لا خصم (سماح)', 'No penalty (grace)', 1, 15, 0),
  ('P002', 'تأخر 16-30 دقيقة', 'Late 16-30 min', 'تحذير فقط', 'Warning only', 16, 30, 0),
  ('P003', 'تأخر 31-60 دقيقة', 'Late 31-60 min', '5% من الراتب اليومي', '5% of daily salary', 31, 60, 5),
  ('P004', 'تأخر أكثر من 60 دقيقة', 'Late > 60 min', '10% من الراتب اليومي', '10% of daily salary', 61, 9999, 10),
  ('P005', 'غياب بدون عذر', 'Absent without excuse', 'خصم يوم كامل', 'Full day deduction', -1, -1, 100)
on conflict (id) do update set
  condition_ar = excluded.condition_ar,
  condition_en = excluded.condition_en,
  deduction_ar = excluded.deduction_ar,
  deduction_en = excluded.deduction_en,
  min_late = excluded.min_late,
  max_late = excluded.max_late,
  percentage = excluded.percentage;

-- App Settings
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

insert into app_settings (key, value) values
  ('geofence', '{"enabled": true, "radius": 200, "lat": 24.7136, "lng": 46.6753}'::jsonb),
  ('company', '{"nameAr": "نجد قيمز", "nameEn": "NJD Games", "crNumber": "1010XXXXXX"}'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- Row Level Security (RLS)
-- Admin check uses is_super_admin(auth.uid()) RPC from Landing project.
-- Employee identity: employees.id (TEXT) stores auth.uid() as text.
-- ============================================================

alter table employees enable row level security;
alter table attendance enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table employee_requests enable row level security;
alter table attendance_adjustments enable row level security;
alter table salary_advances enable row level security;
alter table pending_invitations enable row level security;
alter table notifications enable row level security;
alter table departments enable row level security;
alter table holidays enable row level security;
alter table penalty_rules enable row level security;
alter table app_settings enable row level security;

-- ── Employees ──
create policy "admins_all_employees" on employees
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "employees_see_self" on employees
  for select using (id = auth.uid()::text);

-- ── Attendance ──
create policy "admins_all_attendance" on attendance
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "employees_own_attendance_select" on attendance
  for select using (employee_id = auth.uid()::text);

create policy "employees_own_attendance_insert" on attendance
  for insert with check (employee_id = auth.uid()::text);

create policy "employees_own_attendance_update" on attendance
  for update using (employee_id = auth.uid()::text)
  with check (employee_id = auth.uid()::text);

-- ── Leave Balances ──
create policy "admins_all_leave_balances" on leave_balances
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "employees_see_own_leave_balances" on leave_balances
  for select using (employee_id = auth.uid()::text);

-- ── Leave Requests ──
create policy "admins_all_leave_requests" on leave_requests
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "employees_own_leave_requests_select" on leave_requests
  for select using (employee_id = auth.uid()::text);

create policy "employees_own_leave_requests_insert" on leave_requests
  for insert with check (employee_id = auth.uid()::text and status = 'pending');

-- ── Employee Requests ──
create policy "admins_all_employee_requests" on employee_requests
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "employees_own_employee_requests_select" on employee_requests
  for select using (employee_id = auth.uid()::text);

create policy "employees_own_employee_requests_insert" on employee_requests
  for insert with check (employee_id = auth.uid()::text and status = 'pending');

-- ── Attendance Adjustments ──
create policy "admins_all_attendance_adjustments" on attendance_adjustments
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "employees_own_adjustments_select" on attendance_adjustments
  for select using (employee_id = auth.uid()::text);

create policy "employees_own_adjustments_insert" on attendance_adjustments
  for insert with check (employee_id = auth.uid()::text and status = 'pending');

-- ── Salary Advances ──
create policy "admins_all_salary_advances" on salary_advances
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "employees_own_advances_select" on salary_advances
  for select using (employee_id = auth.uid()::text);

create policy "employees_own_advances_insert" on salary_advances
  for insert with check (employee_id = auth.uid()::text and status = 'pending');

-- ── Pending Invitations (admin-only) ──
create policy "admins_manage_invitations" on pending_invitations
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ── Notifications ──
create policy "users_see_own_notifications" on notifications
  for select using (user_id = auth.uid()::text);

create policy "users_update_own_notifications" on notifications
  for update using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create policy "admins_all_notifications" on notifications
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ── Departments, Holidays, Penalty Rules (public read, admin write) ──
create policy "public_read_departments" on departments
  for select using (auth.role() = 'authenticated');

create policy "admins_write_departments" on departments
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "public_read_holidays" on holidays
  for select using (auth.role() = 'authenticated');

create policy "admins_write_holidays" on holidays
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "public_read_penalty_rules" on penalty_rules
  for select using (auth.role() = 'authenticated');

create policy "admins_write_penalty_rules" on penalty_rules
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ── App Settings (admin-only write, everyone reads) ──
create policy "public_read_app_settings" on app_settings
  for select using (auth.role() = 'authenticated');

create policy "admins_write_app_settings" on app_settings
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ============================================================
-- Indexes on Foreign Keys + hot-path columns
-- ============================================================

create index if not exists idx_attendance_employee_date on attendance(employee_id, date desc);
create index if not exists idx_attendance_date on attendance(date desc);
create index if not exists idx_leave_balances_employee on leave_balances(employee_id);
create index if not exists idx_leave_requests_employee on leave_requests(employee_id);
create index if not exists idx_leave_requests_status on leave_requests(status);
create index if not exists idx_employee_requests_employee on employee_requests(employee_id);
create index if not exists idx_employee_requests_status on employee_requests(status);
create index if not exists idx_attendance_adjustments_employee on attendance_adjustments(employee_id);
create index if not exists idx_attendance_adjustments_status on attendance_adjustments(status);
create index if not exists idx_salary_advances_employee on salary_advances(employee_id);
create index if not exists idx_salary_advances_status on salary_advances(status);
create index if not exists idx_pending_invitations_email on pending_invitations(lower(email));
create index if not exists idx_pending_invitations_status on pending_invitations(status);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on notifications(user_id) where read = false;
create index if not exists idx_employees_department on employees(department);
create index if not exists idx_employees_email on employees(lower(email));
