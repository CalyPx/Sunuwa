-- ============================================================
-- Sunuwa Citizen Auth Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Citizens table
CREATE TABLE IF NOT EXISTS public.citizens (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text        NOT NULL,
  ward_number  integer     DEFAULT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;

-- Policies: citizens can only read/write their own row
CREATE POLICY "citizens_select_own" ON public.citizens
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "citizens_insert_own" ON public.citizens
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "citizens_update_own" ON public.citizens
  FOR UPDATE USING (auth.uid() = id);


-- 2. Add citizen_id column to complaints
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS citizen_id uuid REFERENCES public.citizens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS complaints_citizen_id_idx ON public.complaints(citizen_id);


-- 3. Supabase Auth — enable Phone provider
--    Go to: Authentication → Providers → Phone → Enable
--    For demo test numbers:
--      Authentication → Configuration → "Phone" section
--      Add test number: +9779800000000  OTP: 123456


-- 4. (Optional) RLS policy so citizens can see their own complaints
CREATE POLICY "complaints_citizen_select_own" ON public.complaints
  FOR SELECT USING (
    citizen_id = auth.uid()
    OR citizen_id IS NULL   -- keep anonymous complaints readable too
  );
