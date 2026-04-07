-- ═══════════════════════════════════════════════════════════
-- Daily Reports table + Storage bucket
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Daily Reports table
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, report_date)
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own reports
CREATE POLICY "Users manage own reports" ON public.daily_reports
  FOR ALL USING (auth.uid() = user_id);

-- Admins can read all reports
CREATE POLICY "Admins read all reports" ON public.daily_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin')
  );

-- Storage bucket for report attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-reports', 'daily-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "Users upload own report files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'daily-reports' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all report files
CREATE POLICY "Admins read all report files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'daily-reports'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role_name = 'super_admin')
  );

-- Add location_required column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_required BOOLEAN DEFAULT true;
