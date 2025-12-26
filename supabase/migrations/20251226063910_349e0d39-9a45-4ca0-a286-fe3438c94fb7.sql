-- Add AI assistant settings to doctor table
ALTER TABLE public.doctor
ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS llm_api_base_url text,
ADD COLUMN IF NOT EXISTS llm_api_key text,
ADD COLUMN IF NOT EXISTS llm_model_name text DEFAULT 'deepseek-chat';