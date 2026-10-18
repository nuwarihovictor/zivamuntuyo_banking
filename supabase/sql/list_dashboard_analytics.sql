-- Secure dashboard analytics for posted banking transactions.
-- Install in Supabase SQL Editor. All values are derived from posted journals;
-- currencies are never combined. Access is restricted to authorized employee branches.
CREATE OR REPLACE FUNCTION public.list_dashboard_analytics(
  p_branch_id uuid DEFAULT NULL,
  p_months integer DEFAULT 12
)
RETURNS TABLE (
  metric_type text,
  period_start date,
  label text,
  currency_code text,
  branch_id uuid,
  branch_name text,
  ledger_type text,
  debit_total numeric,
  credit_total numeric,
  deposit_total numeric,
  withdrawal_total numeric,
  transaction_count bigint,
  deposit_count bigint,
  withdrawal_count bigint
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
    RAISE EXCEPTION 'Insufficient role for dashboard analytics';
  END IF;

  IF p_months IS NULL OR p_months < 1 OR p_months > 24 THEN
    RAISE EXCEPTION 'p_months must be between 1 and 24';
  END IF;

  IF p_branch_id IS NOT NULL
     AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;

  RETURN QUERY
  WITH base_journals AS (
    SELECT
      j.id AS journal_id,
      j.transaction_date,
      date_trunc('month', j.transaction_date)::date AS month_start,
      COALESCE(j.currency_code::text, 'UNKNOWN') AS currency,
      j.request_transaction_type,
      COALESCE(j.requested_amount, 0)::numeric AS requested_amount,
      COALESCE(
        ba.branch_id,
        (SELECT le.branch_id
         FROM public.ledger_entries le
         WHERE le.journal_id = j.id AND le.branch_id IS NOT NULL
         ORDER BY le.id
         LIMIT 1)
      ) AS resolved_branch_id,
      COALESCE(
        (SELECT SUM(le.amount) FROM public.ledger_entries le
         WHERE le.journal_id = j.id AND le.entry_side = 'debit'),
        0
      )::numeric AS journal_debit,
      COALESCE(
        (SELECT SUM(le.amount) FROM public.ledger_entries le
         WHERE le.journal_id = j.id AND le.entry_side = 'credit'),
        0
      )::numeric AS journal_credit
    FROM public.ledger_journals j
    LEFT JOIN public.bank_accounts ba ON ba.id = j.requested_account_id
    WHERE j.status = 'posted'
      AND j.transaction_date >= (date_trunc('month', now()) - make_interval(months => p_months - 1))
      AND j.transaction_date < (date_trunc('month', now()) + interval '1 month')
  ),
  authorized_journals AS (
    SELECT bj.*, b.branch_name
    FROM base_journals bj
    JOIN public.branches b ON b.id = bj.resolved_branch_id
    WHERE public.current_employee_can_transact_in_branch(b.id)
      AND (p_branch_id IS NULL OR b.id = p_branch_id)
  ),
  monthly AS (
    SELECT
      aj.month_start, aj.currency, aj.resolved_branch_id, aj.branch_name,
      SUM(aj.journal_debit)::numeric AS debits,
      SUM(aj.journal_credit)::numeric AS credits,
      SUM(CASE WHEN lower(COALESCE(aj.request_transaction_type,'')) = 'deposit'
               THEN aj.requested_amount ELSE 0 END)::numeric AS deposits,
      SUM(CASE WHEN lower(COALESCE(aj.request_transaction_type,'')) = 'withdrawal'
               THEN aj.requested_amount ELSE 0 END)::numeric AS withdrawals,
      COUNT(*) FILTER (WHERE lower(COALESCE(aj.request_transaction_type,'')) IN ('deposit','withdrawal'))::bigint AS txn_count,
      COUNT(*) FILTER (WHERE lower(COALESCE(aj.request_transaction_type,'')) = 'deposit')::bigint AS dep_count,
      COUNT(*) FILTER (WHERE lower(COALESCE(aj.request_transaction_type,'')) = 'withdrawal')::bigint AS wdr_count
    FROM authorized_journals aj
    GROUP BY aj.month_start, aj.currency, aj.resolved_branch_id, aj.branch_name
  ),
  monthly_currency AS (
    SELECT
      m.month_start, m.currency,
      SUM(m.debits)::numeric AS debits, SUM(m.credits)::numeric AS credits,
      SUM(m.deposits)::numeric AS deposits, SUM(m.withdrawals)::numeric AS withdrawals,
      SUM(m.txn_count)::bigint AS txn_count, SUM(m.dep_count)::bigint AS dep_count,
      SUM(m.wdr_count)::bigint AS wdr_count
    FROM monthly m
    GROUP BY m.month_start, m.currency
  ),
  branch_summary AS (
    SELECT
      aj.resolved_branch_id, aj.branch_name, aj.currency,
      SUM(aj.journal_debit)::numeric AS debits,
      SUM(aj.journal_credit)::numeric AS credits,
      SUM(CASE WHEN lower(COALESCE(aj.request_transaction_type,'')) = 'deposit'
               THEN aj.requested_amount ELSE 0 END)::numeric AS deposits,
      SUM(CASE WHEN lower(COALESCE(aj.request_transaction_type,'')) = 'withdrawal'
               THEN aj.requested_amount ELSE 0 END)::numeric AS withdrawals,
      COUNT(*) FILTER (WHERE lower(COALESCE(aj.request_transaction_type,'')) IN ('deposit','withdrawal'))::bigint AS txn_count,
      COUNT(*) FILTER (WHERE lower(COALESCE(aj.request_transaction_type,'')) = 'deposit')::bigint AS dep_count,
      COUNT(*) FILTER (WHERE lower(COALESCE(aj.request_transaction_type,'')) = 'withdrawal')::bigint AS wdr_count
    FROM authorized_journals aj
    GROUP BY aj.resolved_branch_id, aj.branch_name, aj.currency
  ),
  currency_summary AS (
    SELECT
      aj.currency,
      SUM(CASE WHEN lower(COALESCE(aj.request_transaction_type,'')) = 'deposit'
               THEN aj.requested_amount ELSE 0 END)::numeric AS deposits,
      SUM(CASE WHEN lower(COALESCE(aj.request_transaction_type,'')) = 'withdrawal'
               THEN aj.requested_amount ELSE 0 END)::numeric AS withdrawals,
      COUNT(*) FILTER (WHERE lower(COALESCE(aj.request_transaction_type,'')) IN ('deposit','withdrawal'))::bigint AS txn_count
    FROM authorized_journals aj
    GROUP BY aj.currency
  ),
  account_types AS (
    SELECT
      COALESCE(j.currency_code::text, le.currency_code::text, 'UNKNOWN') AS currency,
      COALESCE(la.ledger_type, 'Unclassified') AS type_name,
      SUM(CASE WHEN le.entry_side = 'debit' THEN le.amount ELSE 0 END)::numeric AS debits,
      SUM(CASE WHEN le.entry_side = 'credit' THEN le.amount ELSE 0 END)::numeric AS credits
    FROM public.ledger_entries le
    JOIN public.ledger_journals j ON j.id = le.journal_id AND j.status = 'posted'
    JOIN public.ledger_accounts la ON la.id = le.ledger_account_id AND la.is_active
    JOIN public.branches b ON b.id = COALESCE(le.branch_id, la.branch_id)
    WHERE j.transaction_date >= (date_trunc('month', now()) - make_interval(months => p_months - 1))
      AND j.transaction_date < (date_trunc('month', now()) + interval '1 month')
      AND public.current_employee_can_transact_in_branch(b.id)
      AND (p_branch_id IS NULL OR b.id = p_branch_id)
    GROUP BY COALESCE(j.currency_code::text, le.currency_code::text, 'UNKNOWN'), COALESCE(la.ledger_type, 'Unclassified')
  )
  SELECT 'monthly'::text, mc.month_start, to_char(mc.month_start, 'Mon YYYY'), mc.currency,
         NULL::uuid, NULL::text, NULL::text, mc.debits, mc.credits, mc.deposits, mc.withdrawals,
         mc.txn_count, mc.dep_count, mc.wdr_count
  FROM monthly_currency mc
  UNION ALL
  SELECT 'branch'::text, NULL::date, bs.branch_name, bs.currency, bs.resolved_branch_id, bs.branch_name,
         NULL::text, bs.debits, bs.credits, bs.deposits, bs.withdrawals, bs.txn_count, bs.dep_count, bs.wdr_count
  FROM branch_summary bs
  UNION ALL
  SELECT 'currency_summary'::text, NULL::date, ats.currency, ats.currency, NULL::uuid, NULL::text,
         NULL::text, 0::numeric, 0::numeric, ats.deposits, ats.withdrawals, ats.txn_count, 0::bigint, 0::bigint
  FROM currency_summary ats
  UNION ALL
  SELECT 'account_type'::text, NULL::date, at.type_name, at.currency, NULL::uuid, NULL::text,
         at.type_name, at.debits, at.credits, 0::numeric, 0::numeric, 0::bigint, 0::bigint, 0::bigint
  FROM account_types at
  ORDER BY 1, 2 NULLS LAST, 4, 3;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_dashboard_analytics(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_dashboard_analytics(uuid, integer) TO authenticated;
