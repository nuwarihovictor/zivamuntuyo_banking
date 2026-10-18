-- Read-only transaction monitor. Posting and approvals remain separate controlled workflows.
CREATE OR REPLACE FUNCTION public.list_transaction_monitoring(
  p_branch_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  journal_id uuid,
  transaction_reference text,
  transaction_date timestamptz,
  branch_id uuid,
  branch_name text,
  account_number text,
  transaction_type text,
  amount numeric,
  currency_code text,
  status text,
  created_by uuid,
  approved_by uuid,
  posted_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.current_employee_role_code() INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('system_admin','bank_admin','branch_manager','accountant') THEN
    RAISE EXCEPTION 'Insufficient role for transaction monitoring';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 200';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('pending_approval','approved','posted','rejected') THEN
    RAISE EXCEPTION 'Unsupported transaction status';
  END IF;

  IF p_branch_id IS NOT NULL
     AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;

  RETURN QUERY
  SELECT
    j.id,
    COALESCE(j.journal_number, j.id::text),
    j.transaction_date,
    b.id,
    b.branch_name,
    ba.account_number,
    j.request_transaction_type,
    j.requested_amount,
    j.currency_code::text,
    j.status,
    j.created_by,
    j.approved_by,
    j.posted_by
  FROM public.ledger_journals j
  LEFT JOIN public.bank_accounts ba ON ba.id = j.requested_account_id
  JOIN public.branches b
    ON b.id = COALESCE(
      ba.branch_id,
      (SELECT le.branch_id
       FROM public.ledger_entries le
       WHERE le.journal_id = j.id AND le.branch_id IS NOT NULL
       ORDER BY le.id
       LIMIT 1)
    )
  WHERE public.current_employee_can_transact_in_branch(b.id)
    AND (p_branch_id IS NULL OR b.id = p_branch_id)
    AND (p_status IS NULL OR j.status = p_status)
  ORDER BY j.transaction_date DESC NULLS LAST, j.created_at DESC
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_transaction_monitoring(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_transaction_monitoring(uuid, text, integer) TO authenticated;
