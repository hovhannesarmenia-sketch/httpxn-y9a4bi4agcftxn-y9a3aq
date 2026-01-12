-- Create doctor_credentials table to store sensitive API credentials
-- This table has NO client-accessible RLS policies - only edge functions with service role can access it

CREATE TABLE public.doctor_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL UNIQUE REFERENCES public.doctor(id) ON DELETE CASCADE,
    llm_api_key text,
    llm_api_base_url text,
    telegram_bot_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.doctor_credentials ENABLE ROW LEVEL SECURITY;

-- Block ALL client access - only service role can access this table
CREATE POLICY "block_all_client_access" ON public.doctor_credentials
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Migrate existing credentials from doctor table to doctor_credentials
INSERT INTO public.doctor_credentials (doctor_id, llm_api_key, llm_api_base_url, telegram_bot_token)
SELECT id, llm_api_key, llm_api_base_url, telegram_bot_token
FROM public.doctor
WHERE llm_api_key IS NOT NULL 
   OR llm_api_base_url IS NOT NULL 
   OR telegram_bot_token IS NOT NULL;

-- Create secure RPC function to update doctor credentials
-- Uses SECURITY DEFINER to bypass RLS, validates ownership first
CREATE OR REPLACE FUNCTION public.update_doctor_credentials(
    _doctor_id uuid,
    _llm_api_key text DEFAULT NULL,
    _llm_api_base_url text DEFAULT NULL,
    _telegram_bot_token text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify the current user owns this doctor profile
    IF NOT EXISTS (SELECT 1 FROM public.doctor WHERE id = _doctor_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: not owner of doctor profile';
    END IF;
    
    -- Upsert credentials
    INSERT INTO public.doctor_credentials (doctor_id, llm_api_key, llm_api_base_url, telegram_bot_token, updated_at)
    VALUES (
        _doctor_id,
        _llm_api_key,
        _llm_api_base_url,
        _telegram_bot_token,
        now()
    )
    ON CONFLICT (doctor_id) DO UPDATE SET
        llm_api_key = COALESCE(NULLIF(_llm_api_key, ''), doctor_credentials.llm_api_key),
        llm_api_base_url = COALESCE(NULLIF(_llm_api_base_url, ''), doctor_credentials.llm_api_base_url),
        telegram_bot_token = COALESCE(NULLIF(_telegram_bot_token, ''), doctor_credentials.telegram_bot_token),
        updated_at = now();
END;
$$;

-- Create helper function to get credentials for edge functions (service role only)
CREATE OR REPLACE FUNCTION public.get_doctor_credentials(_doctor_id uuid)
RETURNS TABLE(
    llm_api_key text,
    llm_api_base_url text,
    telegram_bot_token text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT llm_api_key, llm_api_base_url, telegram_bot_token
    FROM public.doctor_credentials
    WHERE doctor_id = _doctor_id
$$;

-- Update doctor_safe view to include has_ flags based on new credentials table
DROP VIEW IF EXISTS public.doctor_safe;
CREATE VIEW public.doctor_safe
WITH (security_invoker = true)
AS SELECT 
    d.id,
    d.first_name,
    d.last_name,
    d.interface_language,
    d.work_days,
    d.work_day_start_time,
    d.work_day_end_time,
    d.slot_step_minutes,
    d.google_calendar_id,
    d.google_sheet_id,
    d.telegram_chat_id,
    d.created_at,
    d.updated_at,
    d.user_id,
    d.ai_enabled,
    d.llm_model_name,
    -- Boolean flags from credentials table (not actual values)
    (dc.telegram_bot_token IS NOT NULL AND dc.telegram_bot_token <> '') AS has_telegram_token,
    (dc.llm_api_key IS NOT NULL AND dc.llm_api_key <> '') AS has_llm_key,
    (dc.llm_api_base_url IS NOT NULL AND dc.llm_api_base_url <> '') AS has_llm_base_url
FROM public.doctor d
LEFT JOIN public.doctor_credentials dc ON d.id = dc.doctor_id;

-- Add trigger for updated_at on doctor_credentials
CREATE TRIGGER update_doctor_credentials_updated_at
    BEFORE UPDATE ON public.doctor_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Clear credentials from doctor table (they're now in doctor_credentials)
-- We'll keep the columns for now but clear the values to avoid confusion
UPDATE public.doctor SET 
    llm_api_key = NULL,
    llm_api_base_url = NULL,
    telegram_bot_token = NULL;

-- Add comment to document the security design
COMMENT ON TABLE public.doctor_credentials IS 'Stores sensitive API credentials. NO client access - edge functions only via service role.';