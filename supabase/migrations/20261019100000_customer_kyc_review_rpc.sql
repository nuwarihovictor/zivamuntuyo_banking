-- Audited, branch-scoped KYC decisions for pending customer records.
-- Draft migration: validate against production-shaped staging before release.
CREATE OR REPLACE FUNCTION public.review_customer_kyc(
  p_customer_id uuid,
  p_decision text,
  p_reason text
)
RETURNS TABLE(reviewed_customer_id uuid, resulting_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_branch_id uuid;
  v_previous_status text;
  v_decision text;
  v_reason text;
  v_new_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_role := public.current_employee_role_code();
  IF v_role IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = auth.uid() AND ep.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('system_admin', 'bank_admin', 'branch_manager') THEN
    RAISE EXCEPTION 'Customer KYC review permission required' USING ERRCODE = '42501';
  END IF;

  v_decision := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_decision, '')));
  IF v_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'KYC decision must be approve or reject' USING ERRCODE = '22023';
  END IF;
  v_reason := pg_catalog.btrim(COALESCE(p_reason, ''));
  IF pg_catalog.char_length(v_reason) < 8 OR pg_catalog.char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'KYC review reason must be 8 to 500 characters' USING ERRCODE = '22023';
  END IF;

  SELECT c.branch_id, c.status
    INTO v_branch_id, v_previous_status
  FROM public.customers c
  WHERE c.id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer record not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_previous_status <> 'pending_review' THEN
    RAISE EXCEPTION 'Only pending_review customers can receive a KYC decision' USING ERRCODE = '55000';
  END IF;
  IF v_role <> 'system_admin'
     AND (v_branch_id IS NULL OR NOT public.current_employee_can_transact_in_branch(v_branch_id)) THEN
    RAISE EXCEPTION 'Customer branch access denied' USING ERRCODE = '42501';
  END IF;

  v_new_status := CASE v_decision WHEN 'approve' THEN 'active' ELSE 'rejected' END;
  UPDATE public.customers
     SET status = v_new_status,
         updated_at = pg_catalog.now()
   WHERE id = p_customer_id;

  INSERT INTO public.audit_events (
    actor_user_id, branch_id, action, entity_type, entity_id, outcome, details
  ) VALUES (
    auth.uid(), v_branch_id,
    CASE v_decision WHEN 'approve' THEN 'customer_kyc_approved' ELSE 'customer_kyc_rejected' END,
    'customer', p_customer_id::text, 'success',
    pg_catalog.jsonb_build_object(
      'decision', v_decision,
      'previous_status', v_previous_status,
      'resulting_status', v_new_status,
      'reason', v_reason
    )
  );

  RETURN QUERY SELECT p_customer_id, v_new_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_customer_kyc(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_customer_kyc(uuid, text, text) TO authenticated, service_role;

-- The browser application requires a signed-in staff account; anonymous direct
-- table access is not part of the customer workflow.
REVOKE ALL ON TABLE public.customers FROM anon;
