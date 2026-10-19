-- Bundled cash-posting hardening.
-- This migration is intentionally proposed on a development branch only.
-- Apply to staging first; do not run directly against production.
create or replace function public.post_approved_cash_transaction(
  p_journal_id uuid,
  p_cash_ledger_account_id uuid
)
returns table(journal_id uuid, journal_number text, journal_status text, posted_amount numeric)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_j public.ledger_journals%rowtype;
  v_ba public.bank_accounts%rowtype;
  v_customer_ledger public.ledger_accounts%rowtype;
  v_cash_ledger public.ledger_accounts%rowtype;
  v_role text;
  v_balance numeric;
  v_new_balance numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  -- A valid role alone is not sufficient: terminated/inactive staff must not post.
  if not exists (
    select 1 from public.employee_profiles ep
    where ep.user_id=auth.uid() and ep.is_active=true
  ) then
    raise exception 'Active employee profile required' using errcode='42501';
  end if;

  v_role := public.current_employee_role_code();
  if v_role is null or v_role not in
     ('system_admin','general_manager','bank_admin','branch_manager','accountant') then
    raise exception 'Not authorized to post cash transactions' using errcode='42501';
  end if;

  select * into v_j
  from public.ledger_journals
  where id=p_journal_id
  for update;
  if not found then
    raise exception 'Transaction request not found' using errcode='P0002';
  end if;

  if v_j.status <> 'pending_approval' or v_j.approved_by is null then
    raise exception 'Transaction must be approved and pending posting' using errcode='23514';
  end if;
  if v_j.created_by=auth.uid() or v_j.approved_by=auth.uid() then
    raise exception 'Requester or approver cannot post this transaction' using errcode='42501';
  end if;
  if v_j.request_transaction_type is null
     or v_j.request_transaction_type not in ('deposit','withdrawal')
     or v_j.requested_account_id is null
     or v_j.requested_amount is null
     or v_j.requested_amount <= 0 then
    raise exception 'This is not a complete valid cash transaction request' using errcode='22023';
  end if;
  if exists(select 1 from public.ledger_entries le where le.journal_id=v_j.id) then
    raise exception 'Ledger entries already exist for this request; duplicate posting is blocked'
      using errcode='23505';
  end if;

  select * into v_ba
  from public.bank_accounts
  where id=v_j.requested_account_id
  for update;
  if not found or v_ba.status <> 'active' then
    raise exception 'Customer account is not active' using errcode='23514';
  end if;
  if not public.current_employee_can_transact_in_branch(v_ba.branch_id) then
    raise exception 'No transaction access to this branch' using errcode='42501';
  end if;

  select * into v_cash_ledger
  from public.ledger_accounts
  where id=p_cash_ledger_account_id and is_active=true
  for update;
  if not found
     or v_cash_ledger.ledger_type <> 'asset'
     or v_cash_ledger.currency_code <> v_ba.currency_code
     or (v_cash_ledger.branch_id is not null and v_cash_ledger.branch_id <> v_ba.branch_id) then
    raise exception 'Select an active asset cash ledger in the same currency and branch' using errcode='22023';
  end if;

  select * into v_customer_ledger
  from public.ledger_accounts
  where linked_bank_account_id=v_ba.id and is_active=true
  for update;
  if not found
     or v_customer_ledger.ledger_type <> 'liability'
     or v_customer_ledger.currency_code <> v_ba.currency_code then
    raise exception 'Customer liability ledger is not configured. Posting is blocked until accounting setup is completed'
      using errcode='23514';
  end if;

  -- The account row is locked above, serializing postings to this customer account.
  select coalesce(sum(case when le.entry_side='credit' then le.amount else -le.amount end),0)
    into v_balance
  from public.ledger_entries le
  join public.ledger_journals lj on lj.id=le.journal_id
  where le.ledger_account_id=v_customer_ledger.id and lj.status='posted';

  if v_j.request_transaction_type='withdrawal' and v_balance < v_j.requested_amount then
    raise exception 'Insufficient available balance' using errcode='23514';
  end if;

  v_new_balance := case
    when v_j.request_transaction_type='deposit' then v_balance+v_j.requested_amount
    else v_balance-v_j.requested_amount
  end;

  insert into public.ledger_entries
    (journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
  values
    (v_j.id,v_cash_ledger.id,
     case when v_j.request_transaction_type='deposit' then 'debit' else 'credit' end,
     v_j.requested_amount,v_ba.currency_code,v_ba.branch_id,v_ba.id,'Cash control leg'),
    (v_j.id,v_customer_ledger.id,
     case when v_j.request_transaction_type='deposit' then 'credit' else 'debit' end,
     v_j.requested_amount,v_ba.currency_code,v_ba.branch_id,v_ba.id,'Customer account leg');

  update public.bank_accounts set balance=v_new_balance where id=v_ba.id;

  update public.ledger_journals
  set status='posted',posted_by=auth.uid(),posted_at=now()
  where id=v_j.id and status='pending_approval' and approved_by is not null;
  if not found then
    raise exception 'Transaction state changed before posting; no posting completed' using errcode='23514';
  end if;

  insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  values(auth.uid(),v_ba.branch_id,'cash_transaction_posted','ledger_journal',v_j.id::text,'success',
    jsonb_build_object('transaction_type',v_j.request_transaction_type,
      'amount',v_j.requested_amount,'currency_code',v_ba.currency_code,
      'account_id',v_ba.id,'journal_number',v_j.journal_number));

  return query
  select lj.id,lj.journal_number,lj.status,v_j.requested_amount
  from public.ledger_journals lj where lj.id=v_j.id;
end;
$function$;

-- Preserve intended application access; never grant this posting function to anon.
revoke all on function public.post_approved_cash_transaction(uuid, uuid) from public, anon;
grant execute on function public.post_approved_cash_transaction(uuid, uuid) to authenticated;
