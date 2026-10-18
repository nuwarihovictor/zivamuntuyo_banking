CREATE OR REPLACE FUNCTION public.update_staff_profile(
  p_user_id uuid,
  p_full_name text,
  p_employee_number text,
  p_work_email text,
  p_phone_number text,
  p_home_branch_id uuid,
  p_role_id uuid,
  p_sex text,
  p_date_of_birth date,
  p_national_id text,
  p_photo_url text,
  p_employment_status text,
  p_job_title text,
  p_start_date date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_system_admin() THEN
    RAISE EXCEPTION 'Only an active system administrator can edit staff profiles';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Select a staff member'; END IF;
  IF p_full_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Enter the employee full name';
  END IF;
  IF p_employee_number IS NULL OR pg_catalog.length(pg_catalog.btrim(p_employee_number)) < 1 THEN
    RAISE EXCEPTION 'Employee ID is required';
  END IF;
  IF p_sex IS NOT NULL AND p_sex NOT IN ('female','male','other','prefer_not_to_say') THEN
    RAISE EXCEPTION 'Invalid sex selection';
  END IF;
  IF p_employment_status NOT IN ('active','probation','on_leave','suspended','terminated','inactive') THEN
    RAISE EXCEPTION 'Invalid employment status';
  END IF;
  IF p_photo_url IS NOT NULL AND p_photo_url !~ '^https://' THEN
    RAISE EXCEPTION 'Photo URL must use HTTPS';
  END IF;
  IF p_home_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches b WHERE b.id=p_home_branch_id AND b.is_active
  ) THEN RAISE EXCEPTION 'Choose an active branch'; END IF;
  IF p_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_roles r WHERE r.id=p_role_id
  ) THEN RAISE EXCEPTION 'Choose a valid staff role'; END IF;

  UPDATE public.employee_profiles
  SET full_name=pg_catalog.btrim(p_full_name),
      employee_number=pg_catalog.btrim(p_employee_number),
      work_email=NULLIF(pg_catalog.btrim(p_work_email),''),
      phone_number=NULLIF(pg_catalog.btrim(p_phone_number),''),
      home_branch_id=p_home_branch_id,
      role_id=p_role_id,
      sex=p_sex,
      date_of_birth=p_date_of_birth,
      national_id=CASE WHEN p_national_id IS NULL THEN national_id ELSE NULLIF(pg_catalog.btrim(p_national_id),'') END,
      photo_url=NULLIF(pg_catalog.btrim(p_photo_url),''),
      employment_status=p_employment_status,
      job_title=NULLIF(pg_catalog.btrim(p_job_title),''),
      start_date=p_start_date,
      is_active=(p_employment_status IN ('active','probation','on_leave')),
      updated_at=pg_catalog.now()
  WHERE user_id=p_user_id
  RETURNING user_id INTO v_updated;

  IF v_updated IS NULL THEN RAISE EXCEPTION 'Staff profile was not found or is not editable'; END IF;
  RETURN pg_catalog.jsonb_build_object('success',true,'user_id',v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.update_staff_profile(uuid,text,text,text,text,uuid,uuid,text,date,text,text,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_profile(uuid,text,text,text,text,uuid,uuid,text,date,text,text,text,text,date) TO authenticated;
