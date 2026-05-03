-- =====================================================================
-- NJD HR — Settings Persistence (Branches + Custom Roles + Compliance)
-- =====================================================================
-- Adds three new tables to back the previously-static Settings tabs:
--   1. branches              — multi-location company branches
--   2. custom_roles          — admin-defined RBAC roles + permission sets
--   3. compliance_items      — Saudi labor-law compliance checklist
--
-- All three follow the same RLS pattern: authenticated read, super_admin write.
-- =====================================================================


-- -------- 1. Branches -------------------------------------------------

create table if not exists branches (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  city_ar text not null,
  city_en text not null,
  is_main boolean default false,
  employee_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table branches enable row level security;

drop policy if exists "branches_read_all" on branches;
create policy "branches_read_all" on branches
  for select using (auth.role() = 'authenticated');

drop policy if exists "branches_admin_write" on branches;
create policy "branches_admin_write" on branches
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));


-- -------- 2. Custom Roles ---------------------------------------------

create table if not exists custom_roles (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  permissions jsonb not null default '[]'::jsonb,
  user_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table custom_roles enable row level security;

drop policy if exists "custom_roles_read_all" on custom_roles;
create policy "custom_roles_read_all" on custom_roles
  for select using (auth.role() = 'authenticated');

drop policy if exists "custom_roles_admin_write" on custom_roles;
create policy "custom_roles_admin_write" on custom_roles
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));


-- -------- 3. Compliance Items -----------------------------------------

create table if not exists compliance_items (
  id text primary key,
  title_ar text not null,
  title_en text not null,
  desc_ar text,
  desc_en text,
  compliant boolean default false,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table compliance_items enable row level security;

drop policy if exists "compliance_read_all" on compliance_items;
create policy "compliance_read_all" on compliance_items
  for select using (auth.role() = 'authenticated');

drop policy if exists "compliance_admin_write" on compliance_items;
create policy "compliance_admin_write" on compliance_items
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));


-- -------- Seed initial data (idempotent via on conflict) --------------

insert into branches (id, name_ar, name_en, city_ar, city_en, is_main, employee_count)
values ('BR001', 'المقر الرئيسي', 'Headquarters', 'الرياض', 'Riyadh', true, 1)
on conflict (id) do nothing;

insert into custom_roles (id, name_ar, name_en, permissions, user_count) values
  ('R001', 'مدير النظام', 'System Admin', '["all"]'::jsonb, 1),
  ('R002', 'مدير الموارد البشرية', 'HR Manager', '["employees","attendance","leaves","payroll","requests","reports"]'::jsonb, 0),
  ('R003', 'مشرف', 'Supervisor', '["attendance","leaves","requests"]'::jsonb, 0),
  ('R004', 'موظف', 'Employee', '["self-service"]'::jsonb, 0)
on conflict (id) do nothing;

insert into compliance_items (id, title_ar, title_en, desc_ar, desc_en, compliant) values
  ('C001', 'عقود العمل', 'Employment Contracts', 'جميع الموظفين لديهم عقود عمل موقعة ومحدثة', 'All employees have signed and updated contracts', true),
  ('C002', 'تسجيل التأمينات الاجتماعية', 'GOSI Registration', 'جميع الموظفين مسجلين في نظام التأمينات الاجتماعية', 'All employees registered in GOSI system', true),
  ('C003', 'نسبة السعودة', 'Saudization (Nitaqat)', 'الشركة في النطاق الأخضر المرتفع', 'Company in high green zone', true),
  ('C004', 'حماية الأجور', 'Wage Protection (WPS)', 'تحويل الرواتب عبر نظام حماية الأجور', 'Salaries transferred via WPS system', true),
  ('C005', 'ساعات العمل', 'Working Hours', 'الالتزام بحد أقصى 48 ساعة عمل أسبوعياً', 'Maximum 48 working hours per week observed', true),
  ('C006', 'الإجازات السنوية', 'Annual Leave', 'توفير 21 يوم إجازة سنوية كحد أدنى', 'Minimum 21 days annual leave provided', true),
  ('C007', 'سياسة نهاية الخدمة', 'End of Service Policy', 'حساب مكافأة نهاية الخدمة وفق نظام العمل', 'End of service benefits calculated per labor law', true),
  ('C008', 'التأمين الطبي', 'Medical Insurance', 'توفير تأمين طبي لجميع الموظفين وعائلاتهم', 'Medical insurance for all employees and families', false),
  ('C009', 'سياسة التحرش', 'Anti-Harassment Policy', 'وجود سياسة مكتوبة لمنع التحرش في بيئة العمل', 'Written anti-harassment workplace policy', true),
  ('C010', 'السلامة المهنية', 'Occupational Safety', 'الالتزام بمعايير السلامة والصحة المهنية', 'Compliance with OHS standards', false)
on conflict (id) do nothing;
