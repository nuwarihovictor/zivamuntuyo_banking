-- Trial balance RPC for Zivamuntuyo Financial Services Ltd.
-- Apply this file in the Supabase SQL Editor for project hwghiezvghdqxnhcnpwk.
-- It only reads posted ledger journals and requires an active authenticated employee
-- with an accounting role and access to each returned branch.

CREATE OR REPLACE FUNCTION public.list_trial_balance(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE (
  ledger_account_id uuid,
  ledger_code text,
  ledger_name text,
  ledger_type text,
  currency_code text,
  branch_id uuid,
  branch_name text,
  debit_total numeric,
  credit_total numeric,
  net_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_role := public.current_employee_role_code();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('system_admin', 'bank_admin', 'branch_manager', 'accountant') THEN
    RAISE EXCEPTION 'Accounting access required' USING ERRCODE = '42501';
  END IF;

  IF p_branch_id IS NOT NULL
     AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    la.id,
    la.ledger_code,
    la.ledger_name,
    la.ledger_type,
    btrim(la.currency_code::text),
    la.branch_id,
    b.branch_name,
    COALESCE(SUM(le.amount) FILTER (WHERE le.entry_side = 'debit'), 0)::numeric,
    COALESCE(SUM(le.amount) FILTER (WHERE le.entry_side = 'credit'), 0)::numeric,
    (COALESCE(SUM(le.amount) FILTER (WHERE le.entry_side = 'debit'), 0)
      - COALESCE(SUM(le.amount) FILTER (WHERE le.entry_side = 'credit'), 0))::numeric
  FROM public.ledger_accounts la
  JOIN public.branches b ON b.id = la.branch_id
  LEFT JOIN public.ledger_entries le
    ON le.ledger_account_id = la.id
   AND le.branch_id = la.branch_id
   AND btrim(le.currency_code::text) = btrim(la.currency_code::text)
  LEFT JOIN public.ledger_journals lj
    ON lj.id = le.journal_id
   AND lj.status = 'posted'
  WHERE la.is_active = true
    AND la.branch_id IS NOT NULL
    AND (p_branch_id IS NULL OR la.branch_id = p_branch_id)
    AND public.current_employee_can_transact_in_branch(la.branch_id)
    AND (le.id IS NULL OR lj.id IS NOT NULL)
  GROUP BY la.id, la.ledger_code, la.ledger_name, la.ledger_type,
           la.currency_code, la.branch_id, b.branch_name
  ORDER BY b.branch_name, btrim(la.currency_code::text), la.ledger_code;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_trial_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_trial_balance(uuid) TO authenticated;
