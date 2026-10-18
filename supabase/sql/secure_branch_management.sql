-- Secure branch-management RPCs for Zivamuntuyo Financial Services Ltd.
-- Apply this migration in Supabase SQL Editor before using branch create/edit/archive actions.
-- Branch records are archived, never hard-deleted, to preserve financial history.

CREATE OR REPLACE FUNCTION public.admin_create_branch(
  p_branch_code text,
  p_branch_name text,
  p_country_id uuid,
  p_address text DEFAULT NULL,
  p_timezone text DEFAULT 'Africa/Kampala',
  p_is_head_office boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text := upper(pg_catalog.btrim(p_branch_code));
  v_name text := pg_catalog.btrim(p_branch_name);
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_system_admin() THEN
    RAISE EXCEPTION 'Only an active system administrator can create branches'
      USING ERRCODE = '42501';
  END IF;

  IF v_code IS NULL OR v_code !~ '^[A-Z0-9_-]{2,30}$' THEN
    RAISE EXCEPTION 'Branch code must contain 2–30 letters, numbers, underscores or hyphens';
  END IF;
  IF v_name IS NULL OR pg_catalog.length(v_name) < 2 OR pg_catalog.length(v_name) > 120 THEN
    RAISE EXCEPTION 'Branch name must contain 2–120 characters';
  END IF;
  IF p_country_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.countries c WHERE c.id = p_country_id AND c.is_active = true
  ) THEN
    RAISE EXCEPTION 'Choose an active country';
  END IF;
  IF coalesce(p_timezone, 'Africa/Kampala') NOT IN ('Africa/Kampala','Africa/Nairobi','Africa/Kigali') THEN
    RAISE EXCEPTION 'Choose a supported time zone';
  END IF;
  IF v_code IN ('BUHWENJU','BUHWEJU') OR pg_catalog.lower(v_name) IN
    ('buhwenju','buhweju branch','butare branch','rubirizi branch','ntungamo branch') THEN
    RAISE EXCEPTION 'This code or name is reserved for an inactive historical branch record';
  END IF;
  IF EXISTS (SELECT 1 FROM public.branches b WHERE upper(b.branch_code) = v_code) THEN
    RAISE EXCEPTION 'That branch code already exists. Edit the existing record instead of creating a duplicate';
  END IF;
  IF EXISTS (SELECT 1 FROM public.branches b WHERE pg_catalog.lower(b.branch_name) = pg_catalog.lower(v_name)) THEN
    RAISE EXCEPTION 'That branch name already exists. Edit the existing record instead of creating a duplicate';
  END IF;

  IF coalesce(p_is_head_office, false) THEN
    UPDATE public.branches SET is_head_office = false, updated_at = now() WHERE is_head_office = true;
  END IF;

  INSERT INTO public.branches (
    country_id, branch_code, branch_name, address, timezone, is_head_office, is_active
  ) VALUES (
    p_country_id, v_code, v_name, NULLIF(pg_catalog.btrim(p_address), ''),
    coalesce(p_timezone, 'Africa/Kampala'), coalesce(p_is_head_office, false), true
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'branch_code', v_code, 'branch_name', v_name, 'is_active', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_branch(
  p_branch_id uuid,
  p_branch_code text,
  p_branch_name text,
  p_country_id uuid,
  p_address text DEFAULT NULL,
  p_timezone text DEFAULT 'Africa/Kampala',
  p_is_head_office boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text := upper(pg_catalog.btrim(p_branch_code));
  v_name text := pg_catalog.btrim(p_branch_name);
  v_old public.branches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_system_admin() THEN
    RAISE EXCEPTION 'Only an active system administrator can edit branches'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_old FROM public.branches WHERE id = p_branch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Branch record not found'; END IF;

  IF v_code IS NULL OR v_code !~ '^[A-Z0-9_-]{2,30}$' THEN
    RAISE EXCEPTION 'Branch code must contain 2–30 letters, numbers, underscores or hyphens';
  END IF;
  IF v_name IS NULL OR pg_catalog.length(v_name) < 2 OR pg_catalog.length(v_name) > 120 THEN
    RAISE EXCEPTION 'Branch name must contain 2–120 characters';
  END IF;
  IF p_country_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.countries c WHERE c.id = p_country_id AND c.is_active = true
  ) THEN RAISE EXCEPTION 'Choose an active country'; END IF;
  IF coalesce(p_timezone, 'Africa/Kampala') NOT IN ('Africa/Kampala','Africa/Nairobi','Africa/Kigali') THEN
    RAISE EXCEPTION 'Choose a supported time zone';
  END IF;
  IF EXISTS (SELECT 1 FROM public.branches b WHERE upper(b.branch_code) = v_code AND b.id <> p_branch_id) THEN
    RAISE EXCEPTION 'That branch code already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.branches b WHERE pg_catalog.lower(b.branch_name) = pg_catalog.lower(v_name) AND b.id <> p_branch_id) THEN
    RAISE EXCEPTION 'That branch name already exists';
  END IF;
  IF coalesce(p_is_head_office, false) AND NOT v_old.is_active THEN
    RAISE EXCEPTION 'An inactive branch cannot be marked as head office';
  END IF;

  IF coalesce(p_is_head_office, false) THEN
    UPDATE public.branches SET is_head_office = false, updated_at = now()
    WHERE is_head_office = true AND id <> p_branch_id;
  END IF;

  UPDATE public.branches SET
    country_id = p_country_id,
    branch_code = v_code,
    branch_name = v_name,
    address = NULLIF(pg_catalog.btrim(p_address), ''),
    timezone = coalesce(p_timezone, 'Africa/Kampala'),
    is_head_office = coalesce(p_is_head_office, false),
    updated_at = now()
  WHERE id = p_branch_id;

  RETURN jsonb_build_object('id', p_branch_id, 'branch_code', v_code, 'branch_name', v_name, 'is_active', v_old.is_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_branch_active(
  p_branch_id uuid,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_branch public.branches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_system_admin() THEN
    RAISE EXCEPTION 'Only an active system administrator can change branch status'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_branch FROM public.branches WHERE id = p_branch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Branch record not found'; END IF;

  IF coalesce(p_is_active, false) AND (
    upper(v_branch.branch_code) IN ('BUHWENJU','BUHWEJU')
    OR pg_catalog.lower(v_branch.branch_name) IN ('buhwenju','buhweju branch','butare branch','rubirizi branch','ntungamo branch')
  ) THEN
    RAISE EXCEPTION 'This historical branch record must remain inactive; do not reactivate duplicates';
  END IF;
  IF coalesce(p_is_active, false) = false AND v_branch.is_head_office THEN
    RAISE EXCEPTION 'Assign another active head office before archiving the current head office';
  END IF;

  UPDATE public.branches SET
    is_active = coalesce(p_is_active, false),
    is_head_office = CASE WHEN coalesce(p_is_active, false) THEN is_head_office ELSE false END,
    updated_at = now()
  WHERE id = p_branch_id;

  RETURN jsonb_build_object('id', p_branch_id, 'is_active', coalesce(p_is_active, false));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_branch(text,text,uuid,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_branch(uuid,text,text,uuid,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_branch_active(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_branch(text,text,uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_branch(uuid,text,text,uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_branch_active(uuid,boolean) TO authenticated;
