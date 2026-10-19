-- Manual web attendance fallback RPCs.
-- DRAFT ONLY: review and apply to a non-production database before use.
-- These functions record method='web'; they do not claim a fingerprint scan.
-- Fingerprint ingestion must use a separate authenticated vendor connector and a
-- dedicated, audited device-event RPC after the exact model/SDK is selected.

CREATE OR REPLACE FUNCTION public.get_my_attendance_status(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(
  attendance_id uuid,
  work_date date,
  branch_id uuid,
  branch_name text,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  clock_in_method text,
  clock_out_method text,
  attendance_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_home_branch uuid;
  v_branch_id uuid;
  v_timezone text;
  v_work_date date;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT ep.home_branch_id INTO v_home_branch
  FROM public.employee_profiles ep
  WHERE ep.user_id=v_user_id AND ep.is_active=true
    AND ep.employment_status NOT IN ('suspended','terminated','inactive');
  IF NOT FOUND THEN RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501'; END IF;

  v_branch_id := coalesce(p_branch_id,v_home_branch);
  IF v_branch_id IS NULL OR NOT public.current_employee_can_transact_in_branch(v_branch_id) THEN
    RAISE EXCEPTION 'Choose a branch you are authorized to access' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(nullif(b.timezone,''),'Africa/Kampala') INTO v_timezone
  FROM public.branches b WHERE b.id=v_branch_id AND b.is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active branch not found'; END IF;
  SELECT coalesce(ap.timezone_name,v_timezone) INTO v_timezone
  FROM public.attendance_policies ap
  WHERE ap.is_active=true AND ap.effective_from <= (now() AT TIME ZONE v_timezone)::date
    AND (ap.branch_id=v_branch_id OR ap.branch_id IS NULL)
  ORDER BY (ap.branch_id=v_branch_id) DESC,ap.effective_from DESC
  LIMIT 1;
  v_timezone := coalesce(v_timezone,'Africa/Kampala');
  v_work_date := (now() AT TIME ZONE v_timezone)::date;

  RETURN QUERY
  SELECT sa.id,sa.work_date,sa.branch_id,b.branch_name::text,sa.clock_in_at,sa.clock_out_at,
         sa.clock_in_method,sa.clock_out_method,sa.status
  FROM public.staff_attendance sa
  JOIN public.branches b ON b.id=sa.branch_id
  WHERE sa.employee_user_id=v_user_id AND sa.branch_id=v_branch_id AND sa.work_date=v_work_date
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clock_in_my_attendance(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(attendance_id uuid,work_date date,clock_in_at timestamptz,attendance_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_home_branch uuid;
  v_branch_id uuid;
  v_timezone text;
  v_work_date date;
  v_local_time time;
  v_clock_in_time time := time '08:30';
  v_grace_minutes integer := 5;
  v_status text;
  v_id uuid;
  v_clock_in_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT ep.home_branch_id INTO v_home_branch
  FROM public.employee_profiles ep
  WHERE ep.user_id=v_user_id AND ep.is_active=true
    AND ep.employment_status NOT IN ('suspended','terminated','inactive');
  IF NOT FOUND THEN RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501'; END IF;
  v_branch_id := coalesce(p_branch_id,v_home_branch);
  IF v_branch_id IS NULL OR NOT public.current_employee_can_transact_in_branch(v_branch_id) THEN
    RAISE EXCEPTION 'Choose a branch you are authorized to access' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(nullif(b.timezone,''),'Africa/Kampala') INTO v_timezone
  FROM public.branches b WHERE b.id=v_branch_id AND b.is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active branch not found'; END IF;
  SELECT coalesce(ap.timezone_name,v_timezone),coalesce(ap.clock_in_time,time '08:30'),
         coalesce(ap.grace_minutes,5)
    INTO v_timezone,v_clock_in_time,v_grace_minutes
  FROM public.attendance_policies ap
  WHERE ap.is_active=true AND ap.effective_from <= (now() AT TIME ZONE v_timezone)::date
    AND (ap.branch_id=v_branch_id OR ap.branch_id IS NULL)
  ORDER BY (ap.branch_id=v_branch_id) DESC,ap.effective_from DESC
  LIMIT 1;
  v_timezone := coalesce(v_timezone,'Africa/Kampala');
  v_work_date := (now() AT TIME ZONE v_timezone)::date;
  v_local_time := (now() AT TIME ZONE v_timezone)::time;

  PERFORM 1 FROM public.staff_attendance sa
  WHERE sa.employee_user_id=v_user_id AND sa.work_date=v_work_date
  FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'An attendance record already exists for today. Use clock-out or ask a supervisor to correct it.'; END IF;

  v_status := CASE WHEN v_local_time > v_clock_in_time + make_interval(mins=>v_grace_minutes) THEN 'late' ELSE 'present' END;
  INSERT INTO public.staff_attendance(employee_user_id,branch_id,work_date,clock_in_at,clock_in_method,status,notes)
  VALUES(v_user_id,v_branch_id,v_work_date,now(),'web',v_status,'Self-service web clock-in; not a fingerprint scan')
  RETURNING id,staff_attendance.clock_in_at INTO v_id,v_clock_in_at;

  INSERT INTO public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  VALUES(v_user_id,v_branch_id,'staff_clock_in','staff_attendance',v_id::text,'success',
         jsonb_build_object('method','web','work_date',v_work_date,'status',v_status));

  RETURN QUERY SELECT v_id,v_work_date,v_clock_in_at,v_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clock_out_my_attendance()
RETURNS TABLE(attendance_id uuid,work_date date,clock_in_at timestamptz,clock_out_at timestamptz,attendance_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_home_branch uuid;
  v_branch_id uuid;
  v_timezone text;
  v_clock_out_time time := time '17:00';
  v_work_date date;
  v_local_time time;
  v_id uuid;
  v_clock_in_at timestamptz;
  v_clock_out_at timestamptz;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT ep.home_branch_id INTO v_home_branch
  FROM public.employee_profiles ep
  WHERE ep.user_id=v_user_id AND ep.is_active=true
    AND ep.employment_status NOT IN ('suspended','terminated','inactive');
  IF NOT FOUND THEN RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501'; END IF;

  SELECT sa.id,sa.branch_id,sa.work_date,sa.clock_in_at,sa.status
    INTO v_id,v_branch_id,v_work_date,v_clock_in_at,v_status
  FROM public.staff_attendance sa
  WHERE sa.employee_user_id=v_user_id AND sa.clock_out_at IS NULL
  ORDER BY sa.clock_in_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No open attendance record was found. Clock in first.'; END IF;
  IF NOT public.current_employee_can_transact_in_branch(v_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(nullif(b.timezone,''),'Africa/Kampala') INTO v_timezone
  FROM public.branches b WHERE b.id=v_branch_id;
  SELECT coalesce(ap.timezone_name,v_timezone),coalesce(ap.clock_out_time,time '17:00')
    INTO v_timezone,v_clock_out_time
  FROM public.attendance_policies ap
  WHERE ap.is_active=true AND ap.effective_from <= v_work_date
    AND (ap.branch_id=v_branch_id OR ap.branch_id IS NULL)
  ORDER BY (ap.branch_id=v_branch_id) DESC,ap.effective_from DESC
  LIMIT 1;
  v_timezone := coalesce(v_timezone,'Africa/Kampala');
  v_local_time := (now() AT TIME ZONE v_timezone)::time;
  IF v_local_time < v_clock_out_time THEN v_status := 'left_early'; END IF;

  UPDATE public.staff_attendance
  SET clock_out_at=now(),clock_out_method='web',status=v_status,
      notes=concat_ws(E'\n',notes,'Self-service web clock-out; not a fingerprint scan'),
      updated_at=now()
  WHERE id=v_id
  RETURNING staff_attendance.clock_out_at INTO v_clock_out_at;

  INSERT INTO public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  VALUES(v_user_id,v_branch_id,'staff_clock_out','staff_attendance',v_id::text,'success',
         jsonb_build_object('method','web','work_date',v_work_date,'status',v_status));

  RETURN QUERY SELECT v_id,v_work_date,v_clock_in_at,v_clock_out_at,v_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_attendance_status(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.clock_in_my_attendance(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.clock_out_my_attendance() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_attendance_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_in_my_attendance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_out_my_attendance() TO authenticated;
