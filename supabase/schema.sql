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

insert into penalty_rules (id, condition_ar, condition_en, deduction_ar, deduction_en, min_late, max_late, percentage) values
  ('P001', 'تأخر 1-15 دقيقة', 'Late 1-15 min', 'إنذار', 'Warning', 1, 15, 0),
  ('P002', 'تأخر 16-30 دقيقة', 'Late 16-30 min', '5% من الراتب اليومي', '5% of daily salary', 16, 30, 5),
  ('P003', 'تأخر 31-60 دقيقة', 'Late 31-60 min', '10% من الراتب اليومي', '10% of daily salary', 31, 60, 10),
  ('P004', 'تأخر أكثر من 60 دقيقة', 'Late > 60 min', '25% من الراتب اليومي', '25% of daily salary', 61, 9999, 25),
  ('P005', 'غياب بدون عذر', 'Absent without excuse', 'خصم يوم كامل', 'Full day deduction', -1, -1, 100)
on conflict (id) do nothing;

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
-- ============================================================

alter table employees enable row level security;
alter table attendance enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table employee_requests enable row level security;
alter table notifications enable row level security;

-- Employees: admins see all, employees see self
create policy "Admins see all employees" on employees
  for select using (true);

-- Attendance: admins see all, employees see own
create policy "Employees see own attendance" on attendance
  for select using (
    employee_id = auth.jwt()->>'email'
    or exists (select 1 from employees where id = auth.jwt()->>'sub' and department = 'hr')
  );

-- Notifications: users see own
create policy "Users see own notifications" on notifications
  for select using (user_id = auth.jwt()->>'sub');
