-- DESIGN / MIGRATION DRAFT ONLY — DO NOT RUN AGAINST PRODUCTION WITHOUT REVIEW.
-- Depends on the current public.account_holders, bank_accounts, account_types,
-- customers, employee_profiles, audit_events and branch authorization helpers.
-- Apply only after reviewing create_bank_account_request.sql and testing on a
-- separate Supabase project. This file does not apply itself.

CREATE OR REPLACE FUNCTION public.add_joint_account_holder_to_pending_request(
  p_account_id uuid,
  p_customer_id uuid,
  p_holder_role text DEFAULT 'joint_owner'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_branch_id uuid;
  v_status text;
  v_type_code text;
  v_customer_status text;
  v_holder_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = auth.uid() AND ep.is_active = true
      AND ep.employment_status NOT IN ('suspended','terminated','inactive')
  ) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501';
  END IF;

  v_role := public.current_employee_role_code();
  IF v_role IS NULL OR v_role NOT IN (
    'system_admin','bank_admin','branch_manager','accountant','teller','loan_officer'
  ) THEN
    RAISE EXCEPTION 'Your staff role cannot manage account holders' USING ERRCODE = '42501';
  END IF;
  IF p_holder_role IS DISTINCT FROM 'joint_owner' THEN
    RAISE EXCEPTION 'Only joint_owner may be added through this function' USING ERRCODE = '22023';
  END IF;
  IF p_account_id IS NULL OR p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Account and customer are required' USING ERRCODE = '22023';
  END IF;

  SELECT ba.branch_id, ba.status, at.type_code
    INTO v_branch_id, v_status, v_type_code
  FROM public.bank_accounts ba
  JOIN public.account_types at ON at.id = ba.account_type_id
  WHERE ba.id = p_account_id
  FOR UPDATE OF ba;

  IF NOT FOUND THEN RAISE EXCEPTION 'Account request not found'; END IF;
  IF v_type_code <> 'JNT' THEN
    RAISE EXCEPTION 'Additional holders can only be added to joint accounts';
  END IF;
  IF v_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Holders may only be added before account approval';
  END IF;
  IF NOT public.current_employee_can_transact_in_branch(v_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied' USING ERRCODE = '42501';
  END IF;

  SELECT c.status INTO v_customer_status
  FROM public.customers c
  WHERE c.id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF v_customer_status <> 'active' THEN
    RAISE EXCEPTION 'Only active, approved customers can be joint account holders';
  END IF;

  -- Safe retry: if the same joint_owner was already added by a previous
  -- request that timed out, return the current holder count without duplicating it.
  IF EXISTS (
    SELECT 1 FROM public.account_holders ah
    WHERE ah.account_id = p_account_id
      AND ah.customer_id = p_customer_id
      AND ah.holder_role = 'joint_owner'
  ) THEN
    SELECT count(DISTINCT ah.customer_id)::integer INTO v_holder_count
    FROM public.account_holders ah WHERE ah.account_id = p_account_id;
    RETURN v_holder_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.account_holders ah
    WHERE ah.account_id = p_account_id AND ah.customer_id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'This customer is already a holder on this account';
  END IF;

  INSERT INTO public.account_holders(account_id, customer_id, holder_role, is_primary)
  VALUES (p_account_id, p_customer_id, 'joint_owner', false);

  SELECT count(DISTINCT ah.customer_id)::integer INTO v_holder_count
  FROM public.account_holders ah WHERE ah.account_id = p_account_id;

  INSERT INTO public.audit_events(actor_user_id, branch_id, action, entity_type, entity_id, outcome, details)
  VALUES (
    auth.uid(), v_branch_id, 'joint_account_holder_added', 'bank_account',
    p_account_id::text, 'success',
    jsonb_build_object('customer_id', p_customer_id, 'holder_role', 'joint_owner',
                       'distinct_holder_count', v_holder_count)
  );

  RETURN v_holder_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_joint_account_holder_to_pending_request(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_joint_account_holder_to_pending_request(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_account_request(p_account_id uuid)
RETURNS TABLE(account_id uuid, account_number text, account_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_branch uuid;
  v_status text;
  v_type_code text;
  v_primary_customer uuid;
  v_other_individual_count integer := 0;
  v_joint_holder_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = auth.uid() AND ep.is_active = true
      AND ep.employment_status NOT IN ('suspended','terminated','inactive')
  ) THEN RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501'; END IF;

  v_role := public.current_employee_role_code();
  IF v_role IS NULL OR v_role NOT IN ('system_admin','general_manager','bank_admin','branch_manager') THEN
    RAISE EXCEPTION 'Only an authorized administrator or branch manager may approve accounts' USING ERRCODE = '42501';
  END IF;

  SELECT ba.branch_id, ba.status, at.type_code
    INTO v_branch, v_status, v_type_code
  FROM public.bank_accounts ba
  JOIN public.account_types at ON at.id = ba.account_type_id
  WHERE ba.id = p_account_id
  FOR UPDATE OF ba;

  IF NOT FOUND THEN RAISE EXCEPTION 'Account request not found'; END IF;
  IF NOT (v_role IN ('system_admin','general_manager','bank_admin')
          OR public.is_active_branch_manager_for(v_branch)) THEN
    RAISE EXCEPTION 'You are not authorized to approve accounts for this branch' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only pending account requests can be approved';
  END IF;

  SELECT ah.customer_id INTO v_primary_customer
  FROM public.account_holders ah
  WHERE ah.account_id = p_account_id AND ah.is_primary = true
  ORDER BY ah.added_at
  LIMIT 1;
  IF v_primary_customer IS NULL THEN
    RAISE EXCEPTION 'Account request has no primary holder; approval is blocked';
  END IF;

  IF v_type_code = 'JNT' THEN
    SELECT count(DISTINCT ah.customer_id)::integer INTO v_joint_holder_count
    FROM public.account_holders ah
    WHERE ah.account_id = p_account_id;
    IF v_joint_holder_count < 2 THEN
      RAISE EXCEPTION 'Joint account approval requires at least two distinct customer holders';
    END IF;
  ELSIF v_type_code = 'IND' THEN
    -- Defense in depth for legacy/concurrent requests made before the
    -- serialized account-opening eligibility migration was installed.
    SELECT count(DISTINCT ba.id)::integer INTO v_other_individual_count
    FROM public.account_holders primary_holder
    JOIN public.bank_accounts ba ON ba.id = primary_holder.account_id
    JOIN public.account_types existing_type ON existing_type.id = ba.account_type_id
    WHERE primary_holder.customer_id = v_primary_customer
      AND primary_holder.is_primary = true
      AND existing_type.type_code = 'IND'
      AND ba.id <> p_account_id
      AND ba.status NOT IN ('closed','rejected');
    IF v_other_individual_count > 0 THEN
      RAISE EXCEPTION 'Customer already has an individual account. Approval is blocked.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported account ownership type';
  END IF;

  UPDATE public.bank_accounts
  SET status = 'active',
      opened_at = coalesce(opened_at, now()),
      rejection_reason = null,
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = p_account_id;

  INSERT INTO public.audit_events(actor_user_id, branch_id, action, entity_type, entity_id, outcome, details)
  VALUES (
    auth.uid(), v_branch, 'account_request_approved', 'bank_account',
    p_account_id::text, 'success',
    jsonb_build_object('account_type_code', v_type_code,
                       'distinct_holder_count', CASE WHEN v_type_code='JNT' THEN v_joint_holder_count ELSE 1 END)
  );

  RETURN QUERY SELECT ba.id, ba.account_number, ba.status
  FROM public.bank_accounts ba WHERE ba.id = p_account_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_account_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_account_request(uuid) TO authenticated;

COMMENT ON FUNCTION public.add_joint_account_holder_to_pending_request(uuid, uuid, text) IS
  'Adds a distinct active customer to a pending joint account; requires authorized staff and branch access.';
COMMENT ON FUNCTION public.approve_account_request(uuid) IS
  'Approves only eligible pending accounts; joint accounts require two distinct holders and IND approvals are rechecked.';
