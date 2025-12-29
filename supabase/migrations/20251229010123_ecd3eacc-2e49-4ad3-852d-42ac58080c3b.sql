-- 1) TELEGRAM_SESSIONS TABLE: Only service role can access
-- Enable RLS if not already enabled
ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing broad policy
DROP POLICY IF EXISTS "Allow service role manage telegram_sessions" ON public.telegram_sessions;
DROP POLICY IF EXISTS "Allow public read telegram_sessions" ON public.telegram_sessions;

-- Create a policy that blocks all normal client access (authenticated users see nothing)
-- Edge functions using SERVICE ROLE key bypass RLS entirely, so Telegram bot still works
CREATE POLICY "block_client_access_telegram_sessions"
ON public.telegram_sessions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Also block anon role explicitly
CREATE POLICY "block_anon_access_telegram_sessions"
ON public.telegram_sessions
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2) DOCTOR TABLE: Add restrictive policy to deny anonymous access
-- Force RLS so all policies must pass
ALTER TABLE public.doctor FORCE ROW LEVEL SECURITY;

-- Add restrictive policy that requires authentication
CREATE POLICY "deny_anon_access_to_doctor"
ON public.doctor
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);