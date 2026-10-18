-- Atomically create a pending bank-account request and its primary holder.
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employee_profiles ep WHERE ep.user_id=auth.uid() AND ep.is_active) THEN
    RAISE EXCEPTION 'Active employee profile required';
  END IF;
  SELECT public.current_employee_role_code() INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('system_admin','bank_admin','branch_manager','accountant','teller','loan_officer') THEN
    RAISE EXCEPTION 'Your staff role cannot submit account requests';
  END IF;
  IF p_branch_id IS NULL OR NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id=p_branch_id AND b.is_active) THEN
    RAISE EXCEPTION 'Selected branch is inactive';
  END IF;
  SELECT c.branch_id INTO v_customer_branch FROM public.customers c WHERE c.id=p_customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF v_customer_branch IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(v_customer_branch) THEN
    RAISE EXCEPTION 'Customer is outside your authorized branch scope';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.account_types at WHERE at.id=p_account_type_id AND at.is_active) THEN
    RAISE EXCEPTION 'Choose a valid active account ownership type';
  END IF;
  IF p_product_type NOT IN ('savings','current','fixed_deposit','business','group','other') THEN
    RAISE EXCEPTION 'Unsupported account product';
  END IF;
  IF p_currency_code NOT IN ('UGX','USD','KES','TZS','RWF','BIF','CDF') THEN
    RAISE EXCEPTION 'Unsupported currency';
  END IF;

  v_account_number := 'ZFS-' || upper(substr(replace(v_account_id::text,'-',''),1,12));
  INSERT INTO public.bank_accounts(
    id,account_number,account_type_id,currency_code,branch_id,status,created_by,metadata,balance,product_type
  ) VALUES (
    v_account_id,v_account_number,p_account_type_id,p_currency_code,p_branch_id,
    'pending_approval',auth.uid(),jsonb_build_object('created_via','account_request'),0,p_product_type
  );
  INSERT INTO public.account_holders(account_id,customer_id,holder_role,is_primary)
  VALUES (v_account_id,p_customer_id,'owner',true);

  INSERT INTO public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  VALUES(auth.uid(),p_branch_id,'account_request_created','bank_account',v_account_id::text,'success',
    jsonb_build_object('product_type',p_product_type,'currency_code',p_currency_code,'account_type_id',p_account_type_id));

  RETURN QUERY SELECT v_account_id,v_account_number,'pending_approval'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_bank_account_request(uuid,uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bank_account_request(uuid,uuid,uuid,text,text) TO authenticated;
