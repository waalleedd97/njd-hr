-- ═══════════════════════════════════════════════════════════
-- NJD HR — Missing Tables (6 tables)
-- Run in Supabase SQL Editor (Landing project)
-- Uses auth.users(id) UUID references
-- ═══════════════════════════════════════════════════════════

-- 1. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIME,
  check_out TIME,
  method TEXT DEFAULT 'geofence' CHECK (method IN ('geofence', 'manual', 'biometric')),
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'on-leave', 'half-day')),
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees read own attendance" ON public.attendance FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Employees insert own attendance" ON public.attendance FOR INSERT WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Employees update own attendance" ON public.attendance FOR UPDATE USING (employee_id = auth.uid());
CREATE POLICY "Admins read all attendance" ON public.attendance FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));
CREATE POLICY "Admins update all attendance" ON public.attendance FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));

-- 2. LEAVE BALANCES
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type_key TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  UNIQUE(employee_id, type_key, year)
);
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees read own balances" ON public.leave_balances FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Admins read all balances" ON public.leave_balances FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));
CREATE POLICY "Admins manage balances" ON public.leave_balances FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));

-- 3. EMPLOYEE REQUESTS
CREATE TABLE IF NOT EXISTS public.employee_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type_key TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-review', 'approved', 'rejected')),
  details_ar TEXT,
  details_en TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees read own requests" ON public.employee_requests FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Employees insert own requests" ON public.employee_requests FOR INSERT WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admins read all requests" ON public.employee_requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));
CREATE POLICY "Admins update requests" ON public.employee_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));

-- 4. SALARY ADVANCES
CREATE TABLE IF NOT EXISTS public.salary_advances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  reason_ar TEXT,
  reason_en TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  repayment_months INTEGER NOT NULL DEFAULT 3,
  monthly_deduction NUMERIC NOT NULL DEFAULT 0,
  remaining_balance NUMERIC NOT NULL DEFAULT 0,
  paid_months INTEGER NOT NULL DEFAULT 0,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees read own advances" ON public.salary_advances FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Employees insert own advances" ON public.salary_advances FOR INSERT WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admins read all advances" ON public.salary_advances FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));
CREATE POLICY "Admins update advances" ON public.salary_advances FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));

-- 5. ATTENDANCE ADJUSTMENTS
CREATE TABLE IF NOT EXISTS public.attendance_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  original_in TIME,
  requested_in TIME,
  original_out TIME,
  requested_out TIME,
  reason_ar TEXT,
  reason_en TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.attendance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees read own adjustments" ON public.attendance_adjustments FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Employees insert own adjustments" ON public.attendance_adjustments FOR INSERT WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admins read all adjustments" ON public.attendance_adjustments FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));
CREATE POLICY "Admins update adjustments" ON public.attendance_adjustments FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));

-- 6. PENDING INVITATIONS
CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  department TEXT,
  position_ar TEXT,
  position_en TEXT,
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'expired')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invitations" ON public.pending_invitations FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin'));
CREATE POLICY "Employees read own invitation" ON public.pending_invitations FOR SELECT USING (LOWER(email) = LOWER(auth.jwt()->>'email'));
