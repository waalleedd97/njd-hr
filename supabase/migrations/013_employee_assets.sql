-- =====================================================================
-- NJD HR — Employee Assets (company-issued equipment register)
-- =====================================================================
-- Tracks items handed out to employees: laptops, phones, vehicles,
-- access cards, SIMs, etc. Each row is one issued asset; status flips
-- to 'returned' when the employee returns it (with returned_at).
--
-- RLS:
--   - Employees can SELECT their own assets only.
--   - Admins (super_admin) full read/write.
-- =====================================================================

create table if not exists employee_assets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,             -- 'laptop' | 'phone' | 'vehicle' | 'sim' | 'access_card' | 'other'
  name_ar text not null,
  name_en text not null,
  serial_number text,
  notes text,
  issued_at date not null default current_date,
  returned_at date,
  status text not null default 'issued', -- 'issued' | 'returned' | 'lost' | 'damaged'
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_employee_assets_employee_id on employee_assets(employee_id);
create index if not exists idx_employee_assets_status on employee_assets(status);

alter table employee_assets enable row level security;

drop policy if exists "employee_assets_self_read" on employee_assets;
create policy "employee_assets_self_read" on employee_assets
  for select using (employee_id = auth.uid() or is_super_admin(auth.uid()));

drop policy if exists "employee_assets_admin_write" on employee_assets;
create policy "employee_assets_admin_write" on employee_assets
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

comment on table employee_assets is
  'Company-issued equipment tracked per-employee. Used by Settings →
   Employees → Assets and by the employee profile dialog.';
