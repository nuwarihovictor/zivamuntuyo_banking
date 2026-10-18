-- Manager-controlled attendance schedules with audit trail.
CREATE TABLE IF NOT EXISTS public.attendance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NULL REFERENCES public.branches(id),
  working_days text[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  clock_in_time time NOT NULL DEFAULT '08:30',
  clock_out_time time NOT NULL DEFAULT '17:00',
  break_start_time time NULL DEFAULT '13:00',
  break_end_time time NULL DEFAULT '14:00',
  unpaid_break_minutes integer NOT NULL DEFAULT 60 CHECK (unpaid_break_minutes BETWEEN 0 AND 240),
  grace_minutes integer NOT NULL DEFAULT 5 CHECK (grace_minutes BETWEEN 0 AND 180),
  overtime_requires_approval boolean NOT NULL DEFAULT true,
  timezone_name text NOT NULL DEFAULT 'Africa/Kampala',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_policy_days_valid CHECK (
    working_days <@ ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']::text[]
    AND cardinality(working_days) > 0
  ),
  CONSTRAINT attendance_policy_times_valid CHECK (clock_out_time > clock_in_time),
  CONSTRAINT attendance_policy_break_valid CHECK (
    (break_start_time IS NULL AND break_end_time IS NULL)
    OR (break_start_time IS NOT NULL AND break_end_time IS NOT NULL
        AND break_end_time > break_start_time
        AND break_start_time >= clock_in_time
        AND break_end_time <= clock_out_time)
  ),
  CONSTRAINT attendance_policy_timezone_valid CHECK (timezone_name IN ('Africa/Kampala','UTC'))
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_policies_global_effective_date
  ON public.attendance_policies (effective_from) WHERE branch_id IS NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_policies_branch_effective_date
  ON public.attendance_policies (branch_id, effective_from) WHERE branch_id IS NOT NULL AND is_active;

ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.attendance_policies FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_attendance_policy(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, branch_id uuid, working_days text[], clock_in_time time,
  clock_out_time time, break_start_time time, break_end_time time,
  unpaid_break_minutes integer, grace_minutes integer,
  overtime_requires_approval boolean, timezone_name text, effective_from date,
  updated_at timestamptz, updated_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT public.current_employee_role_code() INTO v_role;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Active employee profile required'; END IF;
  IF p_branch_id IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;
  IF p_branch_id IS NULL AND v_role NOT IN ('system_admin','bank_admin','branch_manager','accountant') THEN
    RAISE EXCEPTION 'Insufficient role to view attendance policy';
  END IF;
  RETURN QUERY
  SELECT ap.id, ap.branch_id, ap.working_days, ap.clock_in_time, ap.clock_out_time,
         ap.break_start_time, ap.break_end_time, ap.unpaid_break_minutes,
         ap.grace_minutes, ap.overtime_requires_approval, ap.timezone_name,
         ap.effective_from, ap.updated_at, ap.updated_by
  FROM public.attendance_policies ap
  WHERE ap.is_active
    AND ap.effective_from <= CURRENT_DATE
    AND (ap.branch_id = p_branch_id OR (p_branch_id IS NULL AND ap.branch_id IS NULL))
  ORDER BY ap.effective_from DESC, ap.updated_at DESC
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_attendance_policy(
  p_branch_id uuid,
  p_working_days text[],
  p_clock_in_time time,
  p_clock_out_time time,
  p_break_start_time time,
  p_break_end_time time,
  p_unpaid_break_minutes integer,
  p_grace_minutes integer,
  p_overtime_requires_approval boolean,
  p_timezone_name text,
  p_effective_from date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_id uuid;
  v_days text[] := ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT public.current_employee_role_code() INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('system_admin','bank_admin','branch_manager') THEN
    RAISE EXCEPTION 'Only administrators and branch managers may change attendance policies';
  END IF;
  IF p_branch_id IS NULL AND v_role NOT IN ('system_admin','bank_admin') THEN
    RAISE EXCEPTION 'Only system or bank administrators may change the global policy';
  END IF;
  IF p_branch_id IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;
  IF p_working_days IS NULL OR cardinality(p_working_days) = 0
     OR NOT (p_working_days <@ v_days) THEN
    RAISE EXCEPTION 'Select at least one valid working day';
  END IF;
  IF p_clock_in_time IS NULL OR p_clock_out_time IS NULL OR p_clock_out_time <= p_clock_in_time THEN
    RAISE EXCEPTION 'Clock-out must be later than clock-in';
  END IF;
  IF p_unpaid_break_minutes IS NULL OR p_unpaid_break_minutes < 0 OR p_unpaid_break_minutes > 240
     OR p_grace_minutes IS NULL OR p_grace_minutes < 0 OR p_grace_minutes > 180 THEN
    RAISE EXCEPTION 'Break or grace minutes are outside permitted limits';
  END IF;
  IF (p_break_start_time IS NULL) <> (p_break_end_time IS NULL) THEN
    RAISE EXCEPTION 'Provide both break start and break end, or leave both empty';
  END IF;
  IF p_break_start_time IS NOT NULL AND (
    p_break_end_time <= p_break_start_time OR p_break_start_time < p_clock_in_time
    OR p_break_end_time > p_clock_out_time
  ) THEN RAISE EXCEPTION 'Break times must fall within the scheduled shift'; END IF;
  IF p_timezone_name NOT IN ('Africa/Kampala','UTC') THEN
    RAISE EXCEPTION 'Unsupported timezone';
  END IF;

  UPDATE public.attendance_policies
     SET is_active = false, updated_by = auth.uid(), updated_at = now()
   WHERE is_active
     AND branch_id IS NOT DISTINCT FROM p_branch_id
     AND effective_from >= COALESCE(p_effective_from,CURRENT_DATE);

  INSERT INTO public.attendance_policies (
    branch_id, working_days, clock_in_time, clock_out_time, break_start_time,
    break_end_time, unpaid_break_minutes, grace_minutes, overtime_requires_approval,
    timezone_name, effective_from, is_active, created_by, updated_by
  ) VALUES (
    p_branch_id, p_working_days, p_clock_in_time, p_clock_out_time, p_break_start_time,
    p_break_end_time, p_unpaid_break_minutes, p_grace_minutes, p_overtime_requires_approval,
    p_timezone_name, COALESCE(p_effective_from,CURRENT_DATE), true, auth.uid(), auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_events (
    actor_user_id, branch_id, action, entity_type, entity_id, outcome, details
  ) VALUES (
    auth.uid(), p_branch_id, 'attendance_policy_saved', 'attendance_policy', v_id::text, 'success',
    jsonb_build_object('working_days',p_working_days,'clock_in_time',p_clock_in_time,
      'clock_out_time',p_clock_out_time,'break_start_time',p_break_start_time,
      'break_end_time',p_break_end_time,'unpaid_break_minutes',p_unpaid_break_minutes,
      'grace_minutes',p_grace_minutes,'overtime_requires_approval',p_overtime_requires_approval,
      'timezone_name',p_timezone_name,'effective_from',p_effective_from)
  );
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_attendance_policy(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_attendance_policy(uuid,text[],time,time,time,time,integer,integer,boolean,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_policy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_attendance_policy(uuid,text[],time,time,time,time,integer,integer,boolean,text,date) TO authenticated;
