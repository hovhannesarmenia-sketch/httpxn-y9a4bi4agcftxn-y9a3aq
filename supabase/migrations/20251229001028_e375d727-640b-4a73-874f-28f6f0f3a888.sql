-- ===========================================
-- SECURITY FIX: Comprehensive RLS Overhaul
-- ===========================================

-- 1. Add user_id column to doctor table to link with auth.users
ALTER TABLE public.doctor 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_doctor_user_id ON public.doctor(user_id);

-- 2. Create security definer function to get doctor_id for current user
CREATE OR REPLACE FUNCTION public.get_doctor_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.doctor WHERE user_id = _user_id LIMIT 1
$$;

-- 3. Create function to check if user owns a doctor profile
CREATE OR REPLACE FUNCTION public.is_doctor_owner(_doctor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctor 
    WHERE id = _doctor_id AND user_id = auth.uid()
  )
$$;

-- ===========================================
-- FIX DOCTOR TABLE RLS
-- ===========================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated insert doctor" ON public.doctor;
DROP POLICY IF EXISTS "Allow authenticated read doctor" ON public.doctor;
DROP POLICY IF EXISTS "Allow authenticated update doctor" ON public.doctor;

-- New policies: Doctors can only manage their own profile
CREATE POLICY "Doctors can read own profile"
ON public.doctor
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Doctors can update own profile"
ON public.doctor
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can create doctor profile"
ON public.doctor
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ===========================================
-- FIX PATIENTS TABLE RLS
-- ===========================================

-- Drop dangerous anonymous policies
DROP POLICY IF EXISTS "Allow anon insert patients" ON public.patients;
DROP POLICY IF EXISTS "Allow anon read patients" ON public.patients;
DROP POLICY IF EXISTS "Allow anon update patients" ON public.patients;
DROP POLICY IF EXISTS "Allow authenticated manage patients" ON public.patients;
DROP POLICY IF EXISTS "Allow authenticated read patients" ON public.patients;

-- New policies: Only doctors can manage patients (via their appointments)
CREATE POLICY "Doctors can read patients"
ON public.patients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.patient_id = patients.id
    AND public.is_doctor_owner(a.doctor_id)
  )
  OR
  public.get_doctor_id_for_user(auth.uid()) IS NOT NULL
);

CREATE POLICY "Doctors can update patients"
ON public.patients
FOR UPDATE
TO authenticated
USING (
  public.get_doctor_id_for_user(auth.uid()) IS NOT NULL
);

CREATE POLICY "Doctors can insert patients"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_doctor_id_for_user(auth.uid()) IS NOT NULL
);

-- ===========================================
-- FIX APPOINTMENTS TABLE RLS
-- ===========================================

-- Drop dangerous anonymous policies
DROP POLICY IF EXISTS "Allow anon insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow anon read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow anon update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow authenticated manage appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow authenticated read appointments" ON public.appointments;

-- New policies: Doctors can only manage their own appointments
CREATE POLICY "Doctors can read own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (public.is_doctor_owner(doctor_id));

CREATE POLICY "Doctors can insert own appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (public.is_doctor_owner(doctor_id));

CREATE POLICY "Doctors can update own appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (public.is_doctor_owner(doctor_id))
WITH CHECK (public.is_doctor_owner(doctor_id));

CREATE POLICY "Doctors can delete own appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (public.is_doctor_owner(doctor_id));

-- ===========================================
-- FIX SERVICES TABLE RLS
-- ===========================================

DROP POLICY IF EXISTS "Allow authenticated manage services" ON public.services;
DROP POLICY IF EXISTS "Allow authenticated read services" ON public.services;

CREATE POLICY "Doctors can read own services"
ON public.services
FOR SELECT
TO authenticated
USING (public.is_doctor_owner(doctor_id));

CREATE POLICY "Doctors can manage own services"
ON public.services
FOR ALL
TO authenticated
USING (public.is_doctor_owner(doctor_id))
WITH CHECK (public.is_doctor_owner(doctor_id));

-- ===========================================
-- FIX BLOCKED_DAYS TABLE RLS
-- ===========================================

DROP POLICY IF EXISTS "Authenticated users can manage blocked_days" ON public.blocked_days;

CREATE POLICY "Doctors can read own blocked_days"
ON public.blocked_days
FOR SELECT
TO authenticated
USING (public.is_doctor_owner(doctor_id));

CREATE POLICY "Doctors can manage own blocked_days"
ON public.blocked_days
FOR ALL
TO authenticated
USING (public.is_doctor_owner(doctor_id))
WITH CHECK (public.is_doctor_owner(doctor_id));

-- ===========================================
-- FIX REMINDER_LOGS TABLE RLS
-- ===========================================

DROP POLICY IF EXISTS "Allow anon insert reminder_logs" ON public.reminder_logs;
DROP POLICY IF EXISTS "Allow authenticated manage reminder_logs" ON public.reminder_logs;
DROP POLICY IF EXISTS "Allow authenticated read reminder_logs" ON public.reminder_logs;

CREATE POLICY "Doctors can read own reminder_logs"
ON public.reminder_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = reminder_logs.appointment_id
    AND public.is_doctor_owner(a.doctor_id)
  )
);

-- ===========================================
-- TELEGRAM_SESSIONS - Keep service role only
-- ===========================================
-- This table is already restricted to service role, which is correct
-- Edge functions use service role key for Telegram bot operations