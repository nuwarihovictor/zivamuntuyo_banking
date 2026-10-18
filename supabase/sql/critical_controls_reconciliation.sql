-- Critical workflow controls: branch directory visibility, receipt uniqueness, and journal reconciliation.
-- Transaction posting remains branch-authorized; this policy only makes active branch directory
-- information visible to authenticated staff so the Branches page can render reliably.
drop policy if exists branches_directory_authenticated_select on public.branches;
create policy branches_directory_authenticated_select
on public.branches for select to authenticated
using (is_active = true);

-- An account-opening package must never issue the same official receipt number twice.
create unique index if not exists account_opening_collections_receipt_number_uidx
on public.account_opening_collections(receipt_number);

-- Read-only reconciliation endpoint for finance and management. It does not post or alter money.
create or replace function public.get_journal_reconciliation(
  p_branch_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_only_unbalanced boolean default false
) returns table(
  journal_id uuid,
  journal_number text,
  transaction_date timestamptz,
  value_date date,
  currency_code char(3),
  journal_status text,
  debit_total numeric,
  credit_total numeric,
  difference numeric,
  is_balanced boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_role text := public.current_employee_role_code();
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if v_role is null or v_role not in ('system_admin','bank_admin','branch_manager','accountant','general_manager') then
    raise exception 'Only finance and management roles can view journal reconciliation';
  end if;
  if p_branch_id is null or not public.current_employee_can_transact_in_branch(p_branch_id) then
    raise exception 'Branch access denied';
  end if;
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'Start date cannot be after end date';
  end if;
  return query
  select j.id,j.journal_number,j.transaction_date,j.value_date,j.currency_code,j.status,
         coalesce(sum(e.amount) filter(where e.entry_side='debit'),0)::numeric as debit_total,
         coalesce(sum(e.amount) filter(where e.entry_side='credit'),0)::numeric as credit_total,
         (coalesce(sum(e.amount) filter(where e.entry_side='debit'),0)
          - coalesce(sum(e.amount) filter(where e.entry_side='credit'),0))::numeric as difference,
         (coalesce(sum(e.amount) filter(where e.entry_side='debit'),0)
          = coalesce(sum(e.amount) filter(where e.entry_side='credit'),0)) as is_balanced
  from public.ledger_journals j
  left join public.ledger_entries e on e.journal_id=j.id
  where j.branch_id=p_branch_id
    and (p_start_date is null or j.value_date>=p_start_date)
    and (p_end_date is null or j.value_date<=p_end_date)
  group by j.id,j.journal_number,j.transaction_date,j.value_date,j.currency_code,j.status
  having not p_only_unbalanced
      or coalesce(sum(e.amount) filter(where e.entry_side='debit'),0)
         <> coalesce(sum(e.amount) filter(where e.entry_side='credit'),0)
  order by j.transaction_date desc,j.journal_number;
end;
$function$;
revoke all on function public.get_journal_reconciliation(uuid,date,date,boolean) from public,anon;
grant execute on function public.get_journal_reconciliation(uuid,date,date,boolean) to authenticated;
