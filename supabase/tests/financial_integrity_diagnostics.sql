-- READ-ONLY financial-integrity diagnostics.
-- Run against a non-production database first. This script does not modify records.
-- It returns only anomaly categories/counts. No rows returned means no anomalies
-- were detected by these specific checks; it is not a full audit or certification.

WITH posted_journals AS (
  SELECT j.id, j.currency_code,
         count(e.id)::integer AS entry_count,
         coalesce(sum(e.amount) FILTER (WHERE e.entry_side='debit'),0) AS debits,
         coalesce(sum(e.amount) FILTER (WHERE e.entry_side='credit'),0) AS credits,
         count(DISTINCT e.currency_code)::integer AS entry_currency_count,
         coalesce(bool_and(e.currency_code=j.currency_code),true) AS currency_matches,
         j.posted_by,j.posted_at
  FROM public.ledger_journals j
  LEFT JOIN public.ledger_entries e ON e.journal_id=j.id
  WHERE j.status='posted'
  GROUP BY j.id,j.currency_code,j.posted_by,j.posted_at
),
account_ledger AS (
  SELECT la.linked_bank_account_id AS account_id,
         sum(CASE WHEN le.entry_side='credit' THEN le.amount ELSE -le.amount END) AS ledger_balance
  FROM public.ledger_accounts la
  JOIN public.ledger_entries le ON le.ledger_account_id=la.id
  JOIN public.ledger_journals j ON j.id=le.journal_id AND j.status='posted'
  WHERE la.ledger_type='liability' AND la.linked_bank_account_id IS NOT NULL
  GROUP BY la.linked_bank_account_id
),
individual_accounts AS (
  SELECT ah.customer_id,count(DISTINCT ba.id)::integer AS account_count
  FROM public.account_holders ah
  JOIN public.bank_accounts ba ON ba.id=ah.account_id
  JOIN public.account_types at ON at.id=ba.account_type_id AND at.type_code='IND'
  WHERE ah.is_primary=true AND ba.status NOT IN ('closed','rejected')
  GROUP BY ah.customer_id
),
joint_accounts AS (
  SELECT ba.id,ba.status,count(DISTINCT ah.customer_id)::integer AS holder_count
  FROM public.bank_accounts ba
  JOIN public.account_types at ON at.id=ba.account_type_id AND at.type_code='JNT'
  LEFT JOIN public.account_holders ah ON ah.account_id=ba.id
  WHERE ba.status NOT IN ('closed','rejected')
  GROUP BY ba.id,ba.status
),
anomalies AS (
  SELECT 'posted_journal_without_entries'::text AS issue,count(*)::bigint AS issue_count FROM posted_journals WHERE entry_count=0
  UNION ALL SELECT 'posted_journal_unbalanced',count(*) FROM posted_journals WHERE entry_count>0 AND abs(debits-credits)>0.005
  UNION ALL SELECT 'posted_journal_currency_mismatch',count(*) FROM posted_journals WHERE entry_currency_count>1 OR NOT currency_matches
  UNION ALL SELECT 'posted_journal_missing_posting_audit',count(*) FROM posted_journals WHERE posted_by IS NULL OR posted_at IS NULL
  UNION ALL SELECT 'stored_account_balance_differs_from_ledger',count(*) FROM public.bank_accounts ba
    JOIN account_ledger al ON al.account_id=ba.id WHERE abs(coalesce(ba.balance,0)-coalesce(al.ledger_balance,0))>0.01
  UNION ALL SELECT 'nonzero_account_without_posted_liability_ledger',count(*) FROM public.bank_accounts ba
    LEFT JOIN account_ledger al ON al.account_id=ba.id
    WHERE ba.status NOT IN ('closed','rejected') AND al.account_id IS NULL AND coalesce(ba.balance,0)<>0
  UNION ALL SELECT 'customer_with_multiple_open_individual_accounts',count(*) FROM individual_accounts WHERE account_count>1
  UNION ALL SELECT 'joint_account_with_fewer_than_two_holders',count(*) FROM joint_accounts WHERE holder_count<2
)
SELECT issue,issue_count
FROM anomalies
WHERE issue_count>0
ORDER BY issue;
