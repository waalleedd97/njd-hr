-- ═══════════════════════════════════════════════════════════
-- Leave Requests — Supabase as single source of truth
-- Run this in the Supabase SQL Editor (Landing project)
-- ═══════════════════════════════════════════════════════════

-- Drop the old leave_requests table if it exists (from schema.sql)
DROP TABLE IF EXISTS public.leave_requests CASCADE;

-- Create the new leave_requests table
CREATE TABLE public.leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('annual', 'sick', 'unpaid', 'marriage', 'paternity')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Employees can read their own requests
CREATE POLICY "Employees read own leave requests"
  ON public.leave_requests FOR SELECT
  USING (employee_id = auth.uid());

-- Employees can insert their own requests
CREATE POLICY "Employees insert own leave requests"
  ON public.leave_requests FOR INSERT
  WITH CHECK (employee_id = auth.uid());

-- Super admins can read all requests
CREATE POLICY "Admins read all leave requests"
  ON public.leave_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin')
  );

-- Super admins can update request status (approve/reject)
CREATE POLICY "Admins update leave requests"
  ON public.leave_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin')
  );
