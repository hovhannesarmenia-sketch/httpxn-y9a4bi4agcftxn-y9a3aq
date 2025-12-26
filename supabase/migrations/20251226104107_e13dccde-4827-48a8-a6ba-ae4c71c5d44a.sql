-- Persisted Telegram booking session state per telegram_user_id
CREATE TABLE IF NOT EXISTS public.telegram_sessions (
  telegram_user_id BIGINT PRIMARY KEY,
  step TEXT NOT NULL DEFAULT 'awaiting_language',
  language public.interface_language NULL,
  patient_id UUID NULL REFERENCES public.patients(id) ON DELETE SET NULL,
  service_id UUID NULL REFERENCES public.services(id) ON DELETE SET NULL,
  selected_date TEXT NULL,
  selected_time TEXT NULL,
  duration_minutes INTEGER NULL,
  custom_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS update_telegram_sessions_updated_at ON public.telegram_sessions;
CREATE TRIGGER update_telegram_sessions_updated_at
BEFORE UPDATE ON public.telegram_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_telegram_sessions_step ON public.telegram_sessions(step);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_patient_id ON public.telegram_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_service_id ON public.telegram_sessions(service_id);
