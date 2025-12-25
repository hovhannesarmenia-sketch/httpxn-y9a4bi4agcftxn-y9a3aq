-- Fix function search path security warnings
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;