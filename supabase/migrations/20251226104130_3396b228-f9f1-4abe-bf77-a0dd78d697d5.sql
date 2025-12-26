-- Allow service role (Edge Functions) full access to telegram_sessions
CREATE POLICY "Allow service role manage telegram_sessions"
ON public.telegram_sessions
FOR ALL
USING (true)
WITH CHECK (true);