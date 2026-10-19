-- Draft safety migration: serialize account opening and enforce joint-holder minimum.
-- Apply to a staging Supabase project first. Do NOT run directly on production before review.
-- Assumes account_types.type_code/type_name identify Individual and Joint account ownership.
-- The checks are deliberately fail-closed for joint products only when the account type
-- is identifiable by its code/name; verify seeded type codes in staging before deployment.

CREATE OR REPLACE FUNCTION public.create_bank_account_request(
  p_customer_id uuid,
  p_branch_id uuid,
  p_account_type_id uuid,
  p_product_type text,
  p_currency_code text
)
RETURNS TABLE(account_id uuid, account_number text, account_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_account_id uuid := gen_random_uuid();
  v_account_number text;
  v_customer_branch uuid;
  v_type_label text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employee_profiles ep WHERE ep.user_id=auth.uid() AND ep.is_active) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE='42501';
  END IF;
  SELECT public.current_employee_role_code() INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('system_admin','bank_admin','branch_manager','accountant','teller','loan_officer') THEN
    RAISE EXCEPTION 'Your staff role cannot submit account requests' USING ERRCODE='42501';
  END IF;
  IF p_customer_id IS NULL OR p_branch_id IS NULL OR p_account_type_id IS NULL THEN
    RAISE EXCEPTION 'Customer, branch, and account type are required';
  END IF;

  -- Serializes simultaneous account requests for the same customer.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_id::text, 0));

  IF NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id=p_branch_id AND b.is_active) THEN
    RAISE EXCEPTION 'Selected branch is inactive';
  END IF;
  SELECT c.branch_id INTO v_customer_branch FROM public.customers c WHERE c.id=p_customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF v_customer_branch IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(v_customer_branch) THEN
    RAISE EXCEPTION 'Customer is outside your authorized branch scope' USING ERRCODE='42501';
  END IF;
  SELECT lower(coalesce(at.type_code,'') || ' ' || coalesce(at.type_name,'')) INTO v_type_label
  FROM public.account_types at WHERE at.id=p_account_type_id AND at.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose a valid active account ownership type'; END IF;

  -- Do not silently treat unknown account-type labels as individual or joint.
  IF v_type_label ~ '(individual|\mind\M|\bind\M)' THEN
    IF EXISTS (
      SELECT 1
      FROM public.bank_accounts ba
      JOIN public.account_types existing_type ON existing_type.id=ba.account_type_id
      JOIN public.account_holders ah ON ah.account_id=ba.id
      WHERE ah.customer_id=p_customer_id
        AND lower(coalesce(existing_type.type_code,'') || ' ' || coalesce(existing_type.type_name,'')) ~ '(individual|\mind\M|\bind\M)'
        AND ba.status IN ('pending_approval','active','dormant','frozen')
    ) THEN
      RAISE EXCEPTION 'This customer already has an individual account; choose a joint account type if another holder is intended';
    END IF;
  END IF;

  IF p_product_type IS NULL OR p_product_type NOT IN ('savings','current','fixed_deposit','business','group','other') THEN
    RAISE EXCEPTION 'Unsupported account product';
  END IF;
  IF p_currency_code IS NULL OR upper(p_currency_code) NOT IN ('UGX','USD','KES','TZS','RWF','BIF','CDF') THEN
    RAISE EXCEPTION 'Unsupported currency';
  END IF;

  v_account_number := 'ZFS-' || upper(substr(replace(v_account_id::text,'-',''),1,12));
  INSERT INTO public.bank_accounts(
    id,account_number,account_type_id,currency_code,branch_id,status,created_by,metadata,balance,product_type
  ) VALUES (
    v_account_id,v_account_number,p_account_type_id,upper(p_currency_code),p_branch_id,
    'pending_approval',auth.uid(),jsonb_build_object('created_via','account_request'),0,p_product_type
  );
  INSERT INTO public.account_holders(account_id,customer_id,holder_role,is_primary)
  VALUES (v_account_id,p_customer_id,'owner',true);

  INSERT INTO public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  VALUES(auth.uid(),p_branch_id,'account_request_created','bank_account',v_account_id::text,'success',
    jsonb_build_object('product_type',p_product_type,'currency_code',upper(p_currency_code),'account_type_id',p_account_type_id));

  RETURN QUERY SELECT v_account_id,v_account_number,'pending_approval'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_bank_account_request(uuid,uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bank_account_request(uuid,uuid,uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_account_request(p_account_id uuid)
RETURNS TABLE(account_id uuid,account_number text,account_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_branch uuid;
  v_status text;
  v_type_label text;
  v_holder_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.employee_profiles ep WHERE ep.user_id=auth.uid() AND ep.is_active=true) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE='42501';
  END IF;
  v_role:=public.current_employee_role_code();
  IF v_role IS NULL OR v_role NOT IN ('system_admin','general_manager','bank_admin','branch_manager') THEN
    RAISE EXCEPTION 'Only an authorized administrator or branch manager may approve accounts' USING ERRCODE='42501';
  END IF;

  SELECT ba.branch_id,ba.status,lower(coalesce(at.type_code,'') || ' ' || coalesce(at.type_name,''))
    INTO v_branch,v_status,v_type_label
  FROM public.bank_accounts ba
  JOIN public.account_types at ON at.id=ba.account_type_id
  WHERE ba.id=p_account_id
  FOR UPDATE OF ba;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account request not found'; END IF;
  IF NOT (v_role IN ('system_admin','general_manager','bank_admin') OR public.is_active_branch_manager_for(v_branch)) THEN
    RAISE EXCEPTION 'You are not authorized to approve accounts for this branch' USING ERRCODE='42501';
  END IF;
  IF v_status<>'pending_approval' THEN RAISE EXCEPTION 'Only pending account requests can be approved'; END IF;

  IF v_type_label ~ '(joint|\mjnt\M)' THEN
    SELECT count(DISTINCT ah.customer_id)::integer INTO v_holder_count
    FROM public.account_holders ah
    WHERE ah.account_id=p_account_id
      AND ah.holder_role IN ('owner','joint_owner','beneficial_owner');
    IF coalesce(v_holder_count,0) < 2 THEN
      RAISE EXCEPTION 'A joint account requires at least two distinct holders before approval';
    END IF;
  END IF;

  UPDATE public.bank_accounts
  SET status='active',opened_at=coalesce(opened_at,now()),rejection_reason=null,approved_by=auth.uid(),approved_at=now()
  WHERE id=p_account_id;
  INSERT INTO public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  VALUES(auth.uid(),v_branch,'account_request_approved','bank_account',p_account_id::text,'success',
    jsonb_build_object('account_type_label',v_type_label,'holder_count',CASE WHEN v_type_label ~ '(joint|\mjnt\M)' THEN v_holder_count ELSE NULL END));
  RETURN QUERY SELECT ba.id,ba.account_number,ba.status FROM public.bank_accounts ba WHERE ba.id=p_account_id;
END;
$function$;

-- Preserve existing caller grants on approve_account_request; review actual ACLs before changing them.
