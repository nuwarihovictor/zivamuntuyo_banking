-- Zivamuntuyo accounting integrity review
-- Read-only diagnostics. Run in Supabase SQL Editor as an authorized administrator.
-- Do not run these as a substitute for controlled, approved test transactions.

-- 1) Every posted journal must have equal debit and credit totals.
select j.id, j.journal_number, j.branch_id, j.currency_code,
       coalesce(sum(e.amount) filter (where e.entry_side='debit'),0) as debit_total,
       coalesce(sum(e.amount) filter (where e.entry_side='credit'),0) as credit_total,
       coalesce(sum(e.amount) filter (where e.entry_side='debit'),0)
       - coalesce(sum(e.amount) filter (where e.entry_side='credit'),0) as difference
from public.ledger_journals j
left join public.ledger_entries e on e.journal_id=j.id
where j.status='posted'
group by j.id,j.journal_number,j.branch_id,j.currency_code
having coalesce(sum(e.amount) filter (where e.entry_side='debit'),0)
    <> coalesce(sum(e.amount) filter (where e.entry_side='credit'),0)
    or count(e.id)=0
order by j.created_at desc;

-- 2) Duplicate transaction receipt/reference values must be investigated.
select transaction_reference, count(*) as occurrences
from public.transactions
group by transaction_reference
having count(*) > 1
order by occurrences desc, transaction_reference;

-- 3) Confirm payroll batch header totals agree with the employee rows.
select b.id, b.payroll_reference, b.employee_count,
       count(i.id) as item_count,
       b.gross_total, coalesce(sum(i.gross_salary),0) as item_gross,
       b.commission_total, coalesce(sum(i.commission_amount),0) as item_commission,
       b.net_total, coalesce(sum(i.net_salary),0) as item_net
from public.institution_payroll_batches b
left join public.institution_payroll_items i on i.batch_id=b.id
group by b.id,b.payroll_reference,b.employee_count,b.gross_total,b.commission_total,b.net_total
having b.employee_count <> count(i.id)
    or b.gross_total <> coalesce(sum(i.gross_salary),0)
    or b.commission_total <> coalesce(sum(i.commission_amount),0)
    or b.net_total <> coalesce(sum(i.net_salary),0)
order by b.payroll_date desc;

-- 4) Check posted payroll journals for the expected balancing totals.
-- Journal description includes the unique payroll reference.
select b.id as batch_id, b.payroll_reference, j.id as journal_id,
       coalesce(sum(e.amount) filter (where e.entry_side='debit'),0) as debit_total,
       coalesce(sum(e.amount) filter (where e.entry_side='credit'),0) as credit_total
from public.institution_payroll_batches b
left join public.ledger_journals j
  on j.status='posted' and j.description like '%' || b.payroll_reference || '%'
left join public.ledger_entries e on e.journal_id=j.id
group by b.id,b.payroll_reference,j.id
having j.id is null
    or coalesce(sum(e.amount) filter (where e.entry_side='debit'),0)
       <> coalesce(sum(e.amount) filter (where e.entry_side='credit'),0)
order by b.payroll_date desc;

-- 5) Identify payroll batches missing archived signatory evidence.
select b.id, b.payroll_reference, b.payroll_date, b.status
from public.institution_payroll_batches b
left join public.institution_payroll_evidence ev on ev.batch_id=b.id
where ev.batch_id is null
order by b.payroll_date desc;

-- Expected result for each diagnostic query: zero rows.
-- Empty results are only meaningful for the data currently in the database.
-- Before launch, run an approved end-to-end test in a dedicated test branch:
-- unique receipt, account balance before/after, ledger debit=credit, evidence access,
-- and duplicate/replay rejection. Never create fake production transactions.
