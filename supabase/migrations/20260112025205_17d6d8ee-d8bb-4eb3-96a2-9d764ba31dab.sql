-- =============================================================================
-- Security Migration: Fix Patient Data Cross-Doctor Access and Create Safe Doctor View
-- =============================================================================

-- 1. FIX PATIENT DATA EXPOSURE: Drop overly permissive policies and replace with strict ones
-- The current "Doctors can read patients" policy allows any doctor to read ALL patients
-- This violates data isolation between doctors

DROP POLICY IF EXISTS "Doctors can read patients" ON public.patients;
DROP POLICY IF EXISTS "Doctors can update patients" ON public.patients;

-- New strict policy: Doctors can ONLY read patients they have appointments with
CREATE POLICY "Doctors can read own patients only"
ON public.patients FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.patient_id = patients.id
    AND public.is_doctor_owner(a.doctor_id)
  )
);

-- Doctors can only update patients they have appointments with
CREATE POLICY "Doctors can update own patients only"
ON public.patients FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.patient_id = patients.id
    AND public.is_doctor_owner(a.doctor_id)
  )
);

-- 2. CREATE SAFE DOCTOR VIEW: Expose only non-sensitive columns to the client
-- This hides telegram_bot_token, llm_api_key, llm_api_base_url from client queries
-- The view shows configuration status (has_X) without exposing actual credentials

CREATE OR REPLACE VIEW public.doctor_safe AS
SELECT 
  id,
  first_name,
  last_name,
  interface_language,
  work_days,
  work_day_start_time,
  work_day_end_time,
  slot_step_minutes,
  google_calendar_id,
  google_sheet_id,
  telegram_chat_id,
  created_at,
  updated_at,
  user_id,
  ai_enabled,
  llm_model_name,
  -- Configuration status indicators (boolean, not actual values)
  CASE WHEN telegram_bot_token IS NOT NULL AND telegram_bot_token != '' THEN true ELSE false END as has_telegram_token,
  CASE WHEN llm_api_key IS NOT NULL AND llm_api_key != '' THEN true ELSE false END as has_llm_key,
  CASE WHEN llm_api_base_url IS NOT NULL AND llm_api_base_url != '' THEN true ELSE false END as has_llm_base_url
FROM public.doctor;

-- Grant access to authenticated users on the view
GRANT SELECT ON public.doctor_safe TO authenticated;

-- Note: The actual credentials (telegram_bot_token, llm_api_key, llm_api_base_url) 
-- remain in the doctor table and are accessible ONLY via:
-- 1. Edge functions using service role key
-- 2. Direct updates by the doctor owner (for setting new values)
-- The client can read configuration STATUS via doctor_safe view
-- but cannot read the actual secret values