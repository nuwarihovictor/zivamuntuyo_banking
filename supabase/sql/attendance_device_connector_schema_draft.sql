-- DESIGN DRAFT ONLY — DO NOT APPLY TO PRODUCTION UNTIL A DEVICE MODEL IS SELECTED.
-- This is the database-side contract for a trusted vendor connector/Edge Function.
-- It never stores fingerprint templates/images. Only device event metadata is stored.
-- Apply first in a non-production Supabase project, review RLS/advisors, then test with
-- a vendor simulator and real hardware before enabling attendance writes.

CREATE TABLE IF NOT EXISTS public.attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code text NOT NULL UNIQUE CHECK (length(btrim(device_code)) BETWEEN 2 AND 80),
  device_name text NOT NULL CHECK (length(btrim(device_name)) BETWEEN 2 AND 160),
  vendor text NOT NULL CHECK (length(btrim(vendor)) BETWEEN 2 AND 80),
  model text NOT NULL CHECK (length(btrim(model)) BETWEEN 1 AND 120),
  firmware_version text,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  integration_mode text NOT NULL CHECK (integration_mode IN ('vendor_push','vendor_sdk','approved_webhook')),
  is_active boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_device_employee_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.attendance_devices(id) ON DELETE CASCADE,
  device_user_id text NOT NULL CHECK (length(btrim(device_user_id)) BETWEEN 1 AND 120),
  employee_user_id uuid NOT NULL REFERENCES public.employee_profiles(user_id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (device_id, device_user_id)
);
CREATE INDEX IF NOT EXISTS attendance_device_employee_map_employee_idx
  ON public.attendance_device_employee_map(employee_user_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.attendance_device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.attendance_devices(id) ON DELETE RESTRICT,
  external_event_id text NOT NULL CHECK (length(btrim(external_event_id)) BETWEEN 1 AND 180),
  device_user_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('clock_in','clock_out')),
  event_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_digest text,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processed','duplicate','unmapped_user','inactive_employee','inactive_device','invalid_time','unmatched_clock_out','already_clocked_in','error')),
  processing_note text,
  employee_user_id uuid REFERENCES public.employee_profiles(user_id) ON DELETE SET NULL,
  attendance_id uuid REFERENCES public.staff_attendance(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, external_event_id)
);
CREATE INDEX IF NOT EXISTS attendance_device_events_pending_idx
  ON public.attendance_device_events(received_at) WHERE processing_status='received';
CREATE INDEX IF NOT EXISTS attendance_device_events_employee_idx
  ON public.attendance_device_events(employee_user_id,event_at DESC);

ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_device_employee_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_device_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_devices, public.attendance_device_employee_map, public.attendance_device_events FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.attendance_devices, public.attendance_device_employee_map TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.attendance_device_events TO service_role;

-- Only the trusted server connector may execute this RPC. Do not grant to authenticated users.
CREATE OR REPLACE FUNCTION public.ingest_staff_attendance_device_event(
  p_device_code text,
  p_external_event_id text,
  p_device_user_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_payload_digest text DEFAULT NULL
)
RETURNS TABLE(event_id uuid, attendance_id uuid, result_code text, result_note text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_device public.attendance_devices%ROWTYPE;
  v_employee public.employee_profiles%ROWTYPE;
  v_map public.attendance_device_employee_map%ROWTYPE;
  v_event_id uuid;
  v_attendance_id uuid;
  v_work_date date;
  v_local_time time;
  v_timezone text := 'Africa/Kampala';
  v_status text := 'present';
  v_policy public.attendance_policies%ROWTYPE;
  v_existing public.staff_attendance%ROWTYPE;
BEGIN
  IF p_device_code IS NULL OR length(btrim(p_device_code)) NOT BETWEEN 2 AND 80
     OR p_external_event_id IS NULL OR length(btrim(p_external_event_id)) NOT BETWEEN 1 AND 180
     OR p_device_user_id IS NULL OR length(btrim(p_device_user_id)) NOT BETWEEN 1 AND 120
     OR p_event_type IS NULL OR p_event_type NOT IN ('clock_in','clock_out') OR p_event_at IS NULL
     OR p_event_at > now() + interval '10 minutes'
     OR p_event_at < now() - interval '45 days' THEN
    RAISE EXCEPTION 'Invalid attendance device event' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_device FROM public.attendance_devices
  WHERE device_code=btrim(p_device_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown attendance device' USING ERRCODE='42501'; END IF;
  IF NOT v_device.is_active THEN
    INSERT INTO public.attendance_device_events(device_id,external_event_id,device_user_id,event_type,event_at,payload_digest,processing_status,processing_note)
    VALUES(v_device.id,btrim(p_external_event_id),btrim(p_device_user_id),p_event_type,p_event_at,p_payload_digest,'inactive_device','Device is disabled')
    ON CONFLICT(device_id,external_event_id) DO NOTHING
    RETURNING id INTO v_event_id;
    RETURN QUERY SELECT v_event_id,NULL::uuid,'inactive_device'::text,'Device is disabled'::text; RETURN;
  END IF;

  INSERT INTO public.attendance_device_events(device_id,external_event_id,device_user_id,event_type,event_at,payload_digest)
  VALUES(v_device.id,btrim(p_external_event_id),btrim(p_device_user_id),p_event_type,p_event_at,p_payload_digest)
  ON CONFLICT(device_id,external_event_id) DO NOTHING
  RETURNING id INTO v_event_id;
  IF v_event_id IS NULL THEN
    SELECT id,attendance_id INTO v_event_id,v_attendance_id
    FROM public.attendance_device_events
    WHERE device_id=v_device.id AND external_event_id=btrim(p_external_event_id);
    RETURN QUERY SELECT v_event_id,v_attendance_id,'duplicate'::text,'Previously received device event; no second attendance action'::text; RETURN;
  END IF;

  SELECT * INTO v_map FROM public.attendance_device_employee_map
  WHERE device_id=v_device.id AND device_user_id=btrim(p_device_user_id) AND is_active=true;
  IF NOT FOUND THEN
    UPDATE public.attendance_device_events SET processing_status='unmapped_user',processing_note='Device user ID has no active employee mapping' WHERE id=v_event_id;
    RETURN QUERY SELECT v_event_id,NULL::uuid,'unmapped_user'::text,'Device user ID has no active employee mapping'::text; RETURN;
  END IF;
  SELECT * INTO v_employee FROM public.employee_profiles
  WHERE user_id=v_map.employee_user_id;
  IF NOT FOUND OR NOT v_employee.is_active OR v_employee.employment_status IN ('suspended','terminated','inactive') THEN
    UPDATE public.attendance_device_events SET processing_status='inactive_employee',employee_user_id=v_map.employee_user_id,processing_note='Mapped employee is not active' WHERE id=v_event_id;
    RETURN QUERY SELECT v_event_id,NULL::uuid,'inactive_employee'::text,'Mapped employee is not active'::text; RETURN;
  END IF;
  IF coalesce(v_employee.home_branch_id<>v_device.branch_id,true)
     AND NOT EXISTS(SELECT 1 FROM public.employee_branch_access eba WHERE eba.employee_user_id=v_employee.user_id AND eba.branch_id=v_device.branch_id) THEN
    UPDATE public.attendance_device_events SET processing_status='error',employee_user_id=v_employee.user_id,processing_note='Employee is not authorized for the device branch' WHERE id=v_event_id;
    RETURN QUERY SELECT v_event_id,NULL::uuid,'branch_access_denied'::text,'Employee is not authorized for the device branch'::text; RETURN;
  END IF;

  SELECT coalesce(nullif(b.timezone,''),'Africa/Kampala') INTO v_timezone
  FROM public.branches b WHERE b.id=v_device.branch_id;
  IF v_timezone NOT IN ('Africa/Kampala','UTC') THEN v_timezone := 'Africa/Kampala'; END IF;
  v_work_date := (p_event_at AT TIME ZONE v_timezone)::date;
  v_local_time := (p_event_at AT TIME ZONE v_timezone)::time;
  SELECT * INTO v_policy FROM public.attendance_policies
  WHERE is_active=true AND effective_from<=v_work_date
    AND (branch_id=v_device.branch_id OR branch_id IS NULL)
  ORDER BY (branch_id IS NOT NULL) DESC,effective_from DESC,created_at DESC LIMIT 1;

  IF p_event_type='clock_in' THEN
    IF FOUND AND v_local_time > (v_policy.clock_in_time + make_interval(mins=>v_policy.grace_minutes)) THEN v_status:='late'; END IF;
    INSERT INTO public.staff_attendance(employee_user_id,branch_id,work_date,clock_in_at,clock_in_method,status,notes)
    VALUES(v_employee.user_id,v_device.branch_id,v_work_date,p_event_at,'fingerprint',v_status,'Device: '||v_device.device_code)
    ON CONFLICT(employee_user_id,work_date) DO NOTHING
    RETURNING id INTO v_attendance_id;
    IF v_attendance_id IS NULL THEN
      SELECT id INTO v_attendance_id FROM public.staff_attendance WHERE employee_user_id=v_employee.user_id AND work_date=v_work_date;
      UPDATE public.attendance_device_events SET processing_status='already_clocked_in',employee_user_id=v_employee.user_id,attendance_id=v_attendance_id,processing_note='Daily attendance record already exists; original clock-in retained' WHERE id=v_event_id;
      RETURN QUERY SELECT v_event_id,v_attendance_id,'already_clocked_in'::text,'Daily attendance record already exists; original clock-in retained'::text; RETURN;
    END IF;
  ELSE
    SELECT * INTO v_existing FROM public.staff_attendance
    WHERE employee_user_id=v_employee.user_id AND work_date=v_work_date FOR UPDATE;
    IF NOT FOUND OR v_existing.clock_out_at IS NOT NULL THEN
      UPDATE public.attendance_device_events SET processing_status='unmatched_clock_out',employee_user_id=v_employee.user_id,processing_note='No open daily attendance record for this clock-out' WHERE id=v_event_id;
      RETURN QUERY SELECT v_event_id,NULL::uuid,'unmatched_clock_out'::text,'No open daily attendance record for this clock-out'::text; RETURN;
    END IF;
    v_attendance_id:=v_existing.id;
    UPDATE public.staff_attendance SET clock_out_at=p_event_at,clock_out_method='fingerprint',
      status=CASE WHEN status='present' AND v_policy.clock_out_time IS NOT NULL AND v_local_time<v_policy.clock_out_time THEN 'left_early' ELSE status END,
      updated_at=now()
    WHERE id=v_attendance_id;
  END IF;

  UPDATE public.attendance_devices SET last_seen_at=now(),updated_at=now() WHERE id=v_device.id;
  UPDATE public.attendance_device_events SET processing_status='processed',employee_user_id=v_employee.user_id,attendance_id=v_attendance_id WHERE id=v_event_id;
  RETURN QUERY SELECT v_event_id,v_attendance_id,'processed'::text,'Attendance event accepted'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.ingest_staff_attendance_device_event(text,text,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_staff_attendance_device_event(text,text,text,text,timestamptz,text) TO service_role;

COMMENT ON FUNCTION public.ingest_staff_attendance_device_event(text,text,text,text,timestamptz,text) IS
'Trusted connector-only attendance ingestion. Requires authenticated vendor/device transport upstream; stores no fingerprint templates.';
