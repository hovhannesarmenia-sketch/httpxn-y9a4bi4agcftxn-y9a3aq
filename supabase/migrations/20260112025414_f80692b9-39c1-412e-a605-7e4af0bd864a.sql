-- Fix Security Definer View issue by setting security_invoker = true
-- This ensures the view respects RLS policies of the querying user, not the view owner

DROP VIEW IF EXISTS public.doctor_safe;

CREATE VIEW public.doctor_safe 
WITH (security_invoker = true)
AS
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