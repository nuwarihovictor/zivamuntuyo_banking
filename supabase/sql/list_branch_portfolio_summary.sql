-- Branch portfolio dashboard: counts by branch and account type, plus loans and transaction activity.
CREATE OR REPLACE FUNCTION public.list_branch_portfolio_summary(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE (
  metric_type text,
  branch_id uuid,
  branch_name text,
  account_type text,
  account_count bigint,
  customer_count bigint,
  staff_count bigint,
  loan_count bigint,
  loan_principal_total numeric,
  transaction_count bigint,
  transaction_amount_total numeric,
  status text
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
    RAISE EXCEPTION 'Insufficient role for branch portfolio summary';
  END IF;
  IF p_branch_id IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;

  RETURN QUERY
  WITH visible_branches AS (
    SELECT b.id,b.branch_name
    FROM public.branches b
    WHERE b.is_active
      AND public.current_employee_can_transact_in_branch(b.id)
      AND (p_branch_id IS NULL OR b.id=p_branch_id)
  ),
  branch_counts AS (
    SELECT vb.id,vb.branch_name,
      (SELECT COUNT(*) FROM public.bank_accounts ba WHERE ba.branch_id=vb.id)::bigint AS accounts,
      (SELECT COUNT(*) FROM public.customers c WHERE c.branch_id=vb.id)::bigint AS customers,
      (SELECT COUNT(*) FROM public.employee_profiles ep WHERE ep.home_branch_id=vb.id AND ep.is_active)::bigint AS staff,
      (SELECT COUNT(*) FROM public.loans l WHERE l.branch_id=vb.id)::bigint AS loans,
      COALESCE((SELECT SUM(l.principal_amount) FROM public.loans l WHERE l.branch_id=vb.id AND lower(COALESCE(l.status,'')) NOT IN ('rejected','cancelled','closed','fully_repaid')),0)::numeric AS principal,
      (SELECT COUNT(*) FROM public.transactions t WHERE t.branch_id=vb.id)::bigint AS tx_count,
      COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.branch_id=vb.id AND lower(COALESCE(t.status,'')) IN ('posted','completed','successful')),0)::numeric AS tx_amount
    FROM visible_branches vb
  )
  SELECT 'branch_summary'::text,bc.id,bc.branch_name,NULL::text,bc.accounts,bc.customers,bc.staff,bc.loans,bc.principal,bc.tx_count,bc.tx_amount,NULL::text
  FROM branch_counts bc
  UNION ALL
  SELECT 'account_type'::text,vb.id,vb.branch_name,COALESCE(at.type_name,'Unclassified'),
         COUNT(ba.id)::bigint,0::bigint,0::bigint,0::bigint,0::numeric,0::bigint,0::numeric,NULL::text
  FROM visible_branches vb
  LEFT JOIN public.bank_accounts ba ON ba.branch_id=vb.id
  LEFT JOIN public.account_types at ON at.id=ba.account_type_id
  GROUP BY vb.id,vb.branch_name,COALESCE(at.type_name,'Unclassified')
  UNION ALL
  SELECT 'loan_status'::text,vb.id,vb.branch_name,'Loans',0::bigint,0::bigint,0::bigint,
         COUNT(l.id)::bigint,COALESCE(SUM(l.principal_amount),0)::numeric,0::bigint,0::numeric,
         COALESCE(l.status,'unspecified')
  FROM visible_branches vb
  JOIN public.loans l ON l.branch_id=vb.id
  GROUP BY vb.id,vb.branch_name,l.status
  ORDER BY 2,1,4,12;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_branch_portfolio_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_branch_portfolio_summary(uuid) TO authenticated;
