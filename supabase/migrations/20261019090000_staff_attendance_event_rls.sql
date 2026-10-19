-- Staff attendance events: self-service clock punches with database-enforced identity and active-staff checks.
CREATE TABLE IF NOT EXISTS public.staff_attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_user_id uuid NOT NULL REFERENCES public.employee_profiles(user_id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('clock_in','clock_out')),
  event_source text NOT NULL DEFAULT 'manual' CHECK (event_source IN ('manual','device')),
  device_identifier text,
  idempotency_key text NOT NULL UNIQUE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_attendance_events_employee_time_idx
  ON public.staff_attendance_events(employee_user_id, occurred_at DESC);

ALTER TABLE public.staff_attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_attendance_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.staff_attendance_events TO authenticated;
GRANT ALL ON TABLE public.staff_attendance_events TO service_role;

DROP POLICY IF EXISTS staff_attendance_active_employee_read ON public.staff_attendance_events;
CREATE POLICY staff_attendance_active_employee_read
  ON public.staff_attendance_events FOR SELECT TO authenticated
  USING (
    employee_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.user_id = (SELECT auth.uid()) AND ep.is_active = true
    )
  );

DROP POLICY IF EXISTS staff_attendance_active_employee_insert ON public.staff_attendance_events;
CREATE POLICY staff_attendance_active_employee_insert
  ON public.staff_attendance_events FOR INSERT TO authenticated
  WITH CHECK (
    employee_user_id = (SELECT auth.uid())
    AND event_source = 'manual'
    AND device_identifier IS NULL
    AND EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.user_id = (SELECT auth.uid()) AND ep.is_active = true
    )
  );

-- Browser staff cannot update or delete historical punches. Trusted device ingestion
-- must use a separately authenticated Windows connector/server and a service role kept server-side.

-- Serialize punch transitions per employee so duplicate clock-ins/outs cannot be
-- recorded concurrently. Use insertion order for workflow state, not device time.
CREATE OR REPLACE FUNCTION public.enforce_staff_attendance_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_active boolean;
  v_last_event text;
BEGIN
  SELECT ep.is_active INTO v_active
  FROM public.employee_profiles ep
  WHERE ep.user_id = NEW.employee_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Active employee profile required for attendance'
      USING ERRCODE = '42501';
  END IF;

  SELECT e.event_type INTO v_last_event
  FROM public.staff_attendance_events e
  WHERE e.employee_user_id = NEW.employee_user_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1;

  IF v_last_event IS NULL AND NEW.event_type <> 'clock_in' THEN
    RAISE EXCEPTION 'First attendance punch must be clock_in'
      USING ERRCODE = '23514';
  ELSIF v_last_event = 'clock_in' AND NEW.event_type <> 'clock_out' THEN
    RAISE EXCEPTION 'Employee is already clocked in'
      USING ERRCODE = '23514';
  ELSIF v_last_event = 'clock_out' AND NEW.event_type <> 'clock_in' THEN
    RAISE EXCEPTION 'Employee must clock in before clock_out'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_staff_attendance_transition() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS staff_attendance_transition_guard ON public.staff_attendance_events;
CREATE TRIGGER staff_attendance_transition_guard
BEFORE INSERT ON public.staff_attendance_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_attendance_transition();
