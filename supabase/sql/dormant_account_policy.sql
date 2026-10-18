-- Dormancy policy: 18 months without a posted customer transaction; UGX 22,000 reactivation fee.
create or replace function public.refresh_dormant_accounts(p_branch_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_user uuid:=auth.uid();
  v_role text:=public.current_employee_role_code();
  v_changed integer:=0;
begin
  if v_user is null then raise exception 'Sign-in required'; end if;
  if v_role is null or v_role not in ('system_admin','bank_admin','branch_manager','accountant','teller','general_manager') then
    raise exception 'Your role cannot review dormant accounts';
  end if;
  if p_branch_id is not null and not public.current_employee_can_transact_in_branch(p_branch_id) then
    raise exception 'Branch access denied';
  end if;

  update public.bank_accounts ba
     set status='dormant'
   where ba.status='active'
     and (p_branch_id is null or ba.branch_id=p_branch_id)
     and public.current_employee_can_transact_in_branch(ba.branch_id)
     and coalesce(
       (select max(t.created_at) from public.transactions t
         where t.account_id=ba.id and t.status='posted'),
       ba.opened_at,
       ba.created_at
     ) <= now() - interval '18 months';
  get diagnostics v_changed = row_count;

  insert into public.audit_events(actor_user_id,branch_id,action,entity_type,outcome,details)
  values(v_user,p_branch_id,'dormant_account_review','bank_accounts','success',
    jsonb_build_object('accounts_marked_dormant',v_changed,'inactivity_months',18,'reviewed_at',now()));

  return jsonb_build_object('accounts_marked_dormant',v_changed,'inactivity_months',18,'cutoff_at',now()-interval '18 months');
end;
$function$;

create or replace function public.reactivate_dormant_account(
  p_account_id uuid,
  p_payment_method text,
  p_receipt_reference text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_user uuid:=auth.uid();
  v_role text:=public.current_employee_role_code();
  v_account public.bank_accounts%rowtype;
  v_cash_ledger uuid;
  v_deposit_ledger uuid;
  v_income_ledger uuid;
  v_journal uuid;
  v_branch uuid;
  v_receipt text:=trim(coalesce(p_receipt_reference,''));
  v_tx_ref text;
begin
  if v_user is null then raise exception 'Sign-in required'; end if;
  if v_role is null or v_role not in ('system_admin','bank_admin','branch_manager','accountant','teller') then
    raise exception 'Your role cannot reactivate accounts';
  end if;
  if p_payment_method not in ('cash','account_balance') then
    raise exception 'Choose cash payment or deduction from account balance';
  end if;
  if length(v_receipt)<4 then raise exception 'Enter a receipt or payment reference of at least 4 characters'; end if;

  select * into v_account from public.bank_accounts where id=p_account_id for update;
  if not found then raise exception 'Account was not found'; end if;
  v_branch:=v_account.branch_id;
  if not public.current_employee_can_transact_in_branch(v_branch) then raise exception 'Branch access denied'; end if;
  if v_account.status<>'dormant' then raise exception 'Only a dormant account can be reactivated'; end if;
  if v_account.currency_code<>'UGX' then raise exception 'UGX 22,000 reactivation fee is currently configured for UGX accounts only'; end if;
  if exists(select 1 from public.transactions where transaction_reference=v_receipt) then
    raise exception 'That receipt/reference is already in use; enter a unique reference';
  end if;
  if p_payment_method='account_balance' and coalesce(v_account.balance,0)<22000 then
    raise exception 'Insufficient account balance for the UGX 22,000 reactivation fee. Use teller cash collection or top up the account first.';
  end if;

  select id into v_cash_ledger from public.ledger_accounts where ledger_code='1000' and currency_code='UGX' and is_active and branch_id is null;
  select id into v_deposit_ledger from public.ledger_accounts where ledger_code='2000' and currency_code='UGX' and is_active and branch_id is null;
  select id into v_income_ledger from public.ledger_accounts where ledger_code='4000' and currency_code='UGX' and is_active and branch_id is null;
  if v_cash_ledger is null or v_deposit_ledger is null or v_income_ledger is null then
    raise exception 'Required GL control accounts 1000, 2000 and 4000 are not configured';
  end if;

  if p_payment_method='account_balance' then
    update public.bank_accounts set balance=coalesce(balance,0)-22000 where id=p_account_id;
  end if;
  update public.bank_accounts set status='active' where id=p_account_id;

  insert into public.ledger_journals(journal_number,journal_type,transaction_date,value_date,currency_code,status,description,created_by,posted_by,posted_at,branch_id)
  values('DOR-'||to_char(clock_timestamp() at time zone 'UTC','YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    'fee',now(),timezone('Africa/Kampala',now())::date,'UGX','posted',
    'Dormant account reactivation fee; account '||v_account.account_number||'; receipt '||v_receipt,
    v_user,v_user,now(),v_branch)
  returning id into v_journal;

  insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
  values(v_journal,case when p_payment_method='cash' then v_cash_ledger else v_deposit_ledger end,'debit',22000,'UGX',v_branch,p_account_id,
    case when p_payment_method='cash' then 'Cash received for dormant account reactivation' else 'Reactivation fee deducted from customer balance' end);
  insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
  values(v_journal,v_income_ledger,'credit',22000,'UGX',v_branch,p_account_id,'Dormant account reactivation fee income');

  v_tx_ref:='DORF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  insert into public.transactions(transaction_reference,account_id,branch_id,transaction_type,amount,currency_code,narration,status)
  values(v_tx_ref,p_account_id,v_branch,'dormant_reactivation_fee',22000,'UGX',
    'Dormant account reactivation fee paid by '||p_payment_method||'; receipt '||v_receipt,'posted');

  insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  values(v_user,v_branch,'dormant_account_reactivated','bank_accounts',p_account_id::text,'success',
    jsonb_build_object('account_number',v_account.account_number,'fee_amount',22000,'payment_method',p_payment_method,'receipt_reference',v_receipt,'journal_id',v_journal,'transaction_reference',v_tx_ref));

  return jsonb_build_object('account_id',p_account_id,'account_number',v_account.account_number,'status','active',
    'reactivation_fee',22000,'currency_code','UGX','payment_method',p_payment_method,
    'receipt_reference',v_receipt,'transaction_reference',v_tx_ref,'journal_id',v_journal);
end;
$function$;

revoke all on function public.refresh_dormant_accounts(uuid) from public,anon;
revoke all on function public.reactivate_dormant_account(uuid,text,text) from public,anon;
grant execute on function public.refresh_dormant_accounts(uuid) to authenticated;
grant execute on function public.reactivate_dormant_account(uuid,text,text) to authenticated;
