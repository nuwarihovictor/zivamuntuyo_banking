-- Read-only timesheet summary derived from recorded attendance events and effective policy.
CREATE OR REPLACE FUNCTION public.list_staff_timesheets(
  p_from_date date DEFAULT CURRENT_DATE - 30,
  p_to_date date DEFAULT CURRENT_DATE,
  p_branch_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  attendance_id uuid,
  employee_user_id uuid,
  employee_name text,
  employee_number text,
  branch_id uuid,
  branch_name text,
  work_date date,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  attendance_status text,
  clock_in_method text,
  clock_out_method text,
  scheduled_minutes integer,
  worked_minutes integer,
  late_minutes integer,
  early_departure_minutes integer,
  overtime_minutes integer,
  missing_punch boolean,
  policy_timezone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT public.current_employee_role_code() INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('system_admin','bank_admin','branch_manager','accountant') THEN
    RAISE EXCEPTION 'Insufficient role for timesheet access';
  END IF;
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_to_date < p_from_date OR p_to_date > p_from_date + 366 THEN
    RAISE EXCEPTION 'Select a valid date range of up to 367 days';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN RAISE EXCEPTION 'p_limit must be between 1 and 500'; END IF;
  IF p_branch_id IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT sa.id, sa.employee_user_id, ep.full_name, ep.employee_number,
      sa.branch_id, b.branch_name, sa.work_date, sa.clock_in_at, sa.clock_out_at,
      sa.status, sa.clock_in_method, sa.clock_out_method,
      COALESCE(ap.clock_in_time, '08:30'::time) AS scheduled_in,
      COALESCE(ap.clock_out_time, '17:00'::time) AS scheduled_out,
      COALESCE(ap.unpaid_break_minutes, 60) AS unpaid_break,
      COALESCE(ap.grace_minutes, 5) AS grace,
      COALESCE(ap.timezone_name, b.timezone, 'Africa/Kampala') AS tz
    FROM public.staff_attendance sa
    JOIN public.employee_profiles ep ON ep.user_id = sa.employee_user_id
    JOIN public.branches b ON b.id = sa.branch_id
    LEFT JOIN LATERAL (
      SELECT p.clock_in_time,p.clock_out_time,p.unpaid_break_minutes,p.grace_minutes,p.timezone_name
      FROM public.attendance_policies p
      WHERE p.is_active AND p.effective_from <= sa.work_date
        AND (p.branch_id = sa.branch_id OR p.branch_id IS NULL)
      ORDER BY (p.branch_id IS NOT NULL) DESC, p.effective_from DESC, p.updated_at DESC
      LIMIT 1
    ) ap ON true
    WHERE sa.work_date BETWEEN p_from_date AND p_to_date
      AND public.current_employee_can_transact_in_branch(sa.branch_id)
      AND (p_branch_id IS NULL OR sa.branch_id = p_branch_id)
  ),
  calc AS (
    SELECT base.*,
      GREATEST(0, (extract(epoch FROM (scheduled_out - scheduled_in))/60)::integer - unpaid_break) AS sched_mins,
      CASE WHEN clock_in_at IS NOT NULL AND clock_out_at IS NOT NULL
        THEN GREATEST(0, (extract(epoch FROM (clock_out_at-clock_in_at))/60)::integer - unpaid_break)
        ELSE NULL END AS actual_mins,
      CASE WHEN clock_in_at IS NOT NULL
        THEN GREATEST(0, (extract(epoch FROM ((clock_in_at AT TIME ZONE tz)::time - scheduled_in))/60)::integer - grace)
        ELSE NULL END AS late_mins,
      CASE WHEN clock_out_at IS NOT NULL
        THEN GREATEST(0, (extract(epoch FROM (scheduled_out - (clock_out_at AT TIME ZONE tz)::time))/60)::integer)
        ELSE NULL END AS early_mins
    FROM base
  )
  SELECT calc.id, calc.employee_user_id, calc.full_name, calc.employee_number,
    calc.branch_id, calc.branch_name, calc.work_date, calc.clock_in_at, calc.clock_out_at,
    calc.status, calc.clock_in_method, calc.clock_out_method,
    calc.sched_mins, calc.actual_mins, calc.late_mins, calc.early_mins,
    CASE WHEN calc.actual_mins IS NULL THEN NULL ELSE GREATEST(0,calc.actual_mins-calc.sched_mins) END,
    (calc.clock_in_at IS NULL OR calc.clock_out_at IS NULL), calc.tz
  FROM calc
  ORDER BY calc.work_date DESC, calc.branch_name, calc.full_name
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_staff_timesheets(date,date,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_staff_timesheets(date,date,uuid,integer) TO authenticated;
