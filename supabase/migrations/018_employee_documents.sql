-- =====================================================================
-- NJD HR — Employee Official Documents
-- =====================================================================
-- One row per (employee, doc_type): CV, degree certificate, IBAN
-- certificate, national ID / iqama, passport (non-Saudis), Qiwa work
-- contract, national address. Files live in the private
-- 'employee-documents' storage bucket under {employee_id}/{doc_type}/.
--
-- RLS:
--   - Employees can SELECT their own documents.
--   - Admins (super_admin) full read/write (they upload on behalf of
--     employees from the employee detail page).
-- =====================================================================

create table if not exists employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'cv', 'degree', 'iban', 'national_id', 'passport', 'qiwa_contract', 'national_address'
  )),
  file_name text not null,
  file_path text not null,
  file_size integer,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (employee_id, doc_type)
);

create index if not exists idx_employee_documents_employee_id on employee_documents(employee_id);

alter table employee_documents enable row level security;

drop policy if exists "employee_documents_self_read" on employee_documents;
create policy "employee_documents_self_read" on employee_documents
  for select using (employee_id = auth.uid() or is_super_admin(auth.uid()));

drop policy if exists "employee_documents_admin_write" on employee_documents;
create policy "employee_documents_admin_write" on employee_documents
  for all using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

comment on table employee_documents is
  'Official HR documents per employee (CV, degree, IBAN cert, ID/iqama,
   passport, Qiwa contract, national address). One file per doc_type;
   re-uploading replaces the row and the storage object.';

-- ── Storage bucket (private) ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do nothing;

-- Admins manage all document files
drop policy if exists "employee_documents_admin_storage" on storage.objects;
create policy "employee_documents_admin_storage" on storage.objects
  for all using (
    bucket_id = 'employee-documents'
    and exists (select 1 from public.user_roles where user_id = auth.uid() and role_name = 'super_admin')
  )
  with check (
    bucket_id = 'employee-documents'
    and exists (select 1 from public.user_roles where user_id = auth.uid() and role_name = 'super_admin')
  );

-- Employees can read files in their own folder
drop policy if exists "employee_documents_self_storage_read" on storage.objects;
create policy "employee_documents_self_storage_read" on storage.objects
  for select using (
    bucket_id = 'employee-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
