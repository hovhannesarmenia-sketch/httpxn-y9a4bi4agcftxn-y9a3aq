-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums for the system
CREATE TYPE interface_language AS ENUM ('ARM', 'RU');
CREATE TYPE appointment_status AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED_BY_DOCTOR');
CREATE TYPE reminder_type AS ENUM ('BEFORE_24H', 'BEFORE_2H');
CREATE TYPE day_of_week AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- Doctor settings table (single row for MVP)
CREATE TABLE public.doctor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  interface_language interface_language DEFAULT 'ARM',
  work_days day_of_week[] DEFAULT ARRAY['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']::day_of_week[],
  work_day_start_time TIME DEFAULT '09:00',
  work_day_end_time TIME DEFAULT '18:00',
  slot_step_minutes INTEGER DEFAULT 15 CHECK (slot_step_minutes IN (15, 30)),
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  google_calendar_id TEXT,
  google_sheet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES public.doctor(id) ON DELETE CASCADE,
  name_arm VARCHAR(200) NOT NULL,
  name_ru VARCHAR(200) NOT NULL,
  default_duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (default_duration_minutes IN (30, 60, 90)),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id BIGINT UNIQUE NOT NULL,
  phone_number VARCHAR(50),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  language interface_language DEFAULT 'ARM',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table with overlap prevention
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES public.doctor(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  custom_reason TEXT,
  start_date_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes IN (30, 60, 90)),
  status appointment_status DEFAULT 'PENDING',
  rejection_reason TEXT,
  google_calendar_event_id TEXT,
  source VARCHAR(50) DEFAULT 'Telegram',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient overlap checking
CREATE INDEX idx_appointments_datetime_status ON public.appointments(doctor_id, start_date_time, duration_minutes, status);
CREATE INDEX idx_appointments_status ON public.appointments(status);

-- Reminder log to prevent duplicate sends
CREATE TABLE public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type reminder_type NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id, reminder_type)
);

-- Function to check for overlapping appointments
CREATE OR REPLACE FUNCTION check_appointment_overlap()
RETURNS TRIGGER AS $$
DECLARE
  new_end_time TIMESTAMPTZ;
  overlap_count INTEGER;
BEGIN
  -- Only check for CONFIRMED appointments
  IF NEW.status != 'CONFIRMED' THEN
    RETURN NEW;
  END IF;

  new_end_time := NEW.start_date_time + (NEW.duration_minutes || ' minutes')::INTERVAL;
  
  SELECT COUNT(*) INTO overlap_count
  FROM public.appointments a
  WHERE a.id != NEW.id
    AND a.doctor_id = NEW.doctor_id
    AND a.status = 'CONFIRMED'
    AND (
      (NEW.start_date_time >= a.start_date_time AND NEW.start_date_time < a.start_date_time + (a.duration_minutes || ' minutes')::INTERVAL)
      OR (new_end_time > a.start_date_time AND new_end_time <= a.start_date_time + (a.duration_minutes || ' minutes')::INTERVAL)
      OR (NEW.start_date_time <= a.start_date_time AND new_end_time >= a.start_date_time + (a.duration_minutes || ' minutes')::INTERVAL)
    );
  
  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Appointment overlaps with existing confirmed appointment';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_appointment_overlap
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION check_appointment_overlap();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_doctor_updated_at BEFORE UPDATE ON public.doctor FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.doctor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- For MVP, allow authenticated users to manage doctor data
CREATE POLICY "Allow authenticated read doctor" ON public.doctor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update doctor" ON public.doctor FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert doctor" ON public.doctor FOR INSERT TO authenticated WITH CHECK (true);

-- Services policies
CREATE POLICY "Allow authenticated read services" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage services" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Patients policies (public read for webhook access, authenticated full access)
CREATE POLICY "Allow authenticated read patients" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage patients" ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read patients" ON public.patients FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert patients" ON public.patients FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update patients" ON public.patients FOR UPDATE TO anon USING (true);

-- Appointments policies
CREATE POLICY "Allow authenticated read appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage appointments" ON public.appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read appointments" ON public.appointments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert appointments" ON public.appointments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update appointments" ON public.appointments FOR UPDATE TO anon USING (true);

-- Reminder logs policies
CREATE POLICY "Allow authenticated read reminder_logs" ON public.reminder_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated manage reminder_logs" ON public.reminder_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon insert reminder_logs" ON public.reminder_logs FOR INSERT TO anon WITH CHECK (true);

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;