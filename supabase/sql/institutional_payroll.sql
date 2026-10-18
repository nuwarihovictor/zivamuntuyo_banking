-- Institutional payroll: batch records, flat UGX 1,000 per-person commission, and atomic salary credits.
create table if not exists public.institution_payroll_batches (
  id uuid primary key default gen_random_uuid(),
  payroll_reference text not null unique,
  branch_id uuid not null references public.branches(id),
  institution_account_id uuid not null references public.bank_accounts(id),
  payroll_date date not null default timezone('Africa/Kampala',now())::date,
  currency_code char(3) not null default 'UGX' references public.currencies(code),
  employee_count integer not null default 0 check (employee_count >= 0),
  gross_total numeric(14,2) not null default 0 check (gross_total >= 0),
  commission_total numeric(14,2) not null default 0 check (commission_total >= 0),
  net_total numeric(14,2) not null default 0 check (net_total >= 0),
  status text not null default 'posted' check (status in ('posted','reversed')),
  created_by uuid not null references auth.users(id),
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint payroll_totals_balance check (gross_total = commission_total + net_total)
);
create table if not exists public.institution_payroll_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.institution_payroll_batches(id) on delete restrict,
  employee_account_id uuid not null references public.bank_accounts(id),
  employee_reference text,
  employee_name text not null,
  gross_salary numeric(14,2) not null check (gross_salary > 1000),
  commission_amount numeric(14,2) not null default 1000 check (commission_amount = 1000),
  net_salary numeric(14,2) not null check (net_salary = gross_salary - commission_amount),
  transaction_reference text not null unique,
  created_at timestamptz not null default now(),
  unique(batch_id, employee_account_id)
);
create index if not exists institution_payroll_branch_date_idx
  on public.institution_payroll_batches(branch_id,payroll_date desc);
create index if not exists institution_payroll_items_batch_idx
  on public.institution_payroll_items(batch_id);
alter table public.institution_payroll_batches enable row level security;
alter table public.institution_payroll_items enable row level security;
drop policy if exists "Payroll batches visible to authorized branch staff" on public.institution_payroll_batches;
create policy "Payroll batches visible to authorized branch staff"
on public.institution_payroll_batches for select to authenticated
using (public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager','teller')
  and public.current_employee_can_transact_in_branch(branch_id));
drop policy if exists "Payroll items visible to authorized branch staff" on public.institution_payroll_items;
create policy "Payroll items visible to authorized branch staff"
on public.institution_payroll_items for select to authenticated
using (exists(select 1 from public.institution_payroll_batches b
  where b.id=batch_id and public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager','teller')
    and public.current_employee_can_transact_in_branch(b.branch_id)));
grant select on public.institution_payroll_batches, public.institution_payroll_items to authenticated;
revoke insert,update,delete on public.institution_payroll_batches, public.institution_payroll_items from anon,authenticated;

create or replace function public.process_institution_payroll(
  p_branch_id uuid,
  p_institution_account_id uuid,
  p_payroll_reference text,
  p_payroll_date date,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_employee_role_code();
  v_source public.bank_accounts%rowtype;
  v_count integer;
  v_gross numeric(14,2);
  v_commission numeric(14,2);
  v_net numeric(14,2);
  v_batch_id uuid;
  v_journal_id uuid;
  v_cash_account uuid;
  v_deposit_account uuid;
  v_income_account uuid;
  v_item jsonb;
  v_account_id uuid;
  v_gross_item numeric(14,2);
  v_employee_name text;
  v_employee_ref text;
  v_tx_ref text;
  v_duplicate_count integer;
begin
  if v_user is null then raise exception 'Sign-in required'; end if;
  if v_role not in ('system_admin','bank_admin','branch_manager','accountant','teller') then
    raise exception 'Your role cannot process institutional payroll';
  end if;
  if not public.current_employee_can_transact_in_branch(p_branch_id) then
    raise exception 'Branch access denied';
  end if;
  if p_payroll_reference is null or length(trim(p_payroll_reference)) < 4 then
    raise exception 'Enter an institutional payroll reference of at least 4 characters';
  end if;
  if p_payroll_date is null or p_payroll_date > timezone('Africa/Kampala',now())::date then
    raise exception 'Payroll date cannot be in the future';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 2000 then
    raise exception 'Payroll must contain between 1 and 2,000 employees';
  end if;
  if exists(select 1 from public.institution_payroll_batches where payroll_reference=trim(p_payroll_reference)) then
    raise exception 'This payroll reference has already been processed';
  end if;

  select * into v_source from public.bank_accounts
   where id=p_institution_account_id and branch_id=p_branch_id
   for update;
  if not found or v_source.status <> 'active' then
    raise exception 'Institution account must be active and belong to the selected branch';
  end if;
  if not public.current_employee_can_transact_in_branch(v_source.branch_id) then
    raise exception 'Institution account branch access denied';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) x
    where coalesce(x->>'account_id','') = ''
       or coalesce(x->>'employee_name','') = ''
       or coalesce(x->>'gross_salary','') !~ '^([0-9]+)([.][0-9]{1,2})?$'
  ) then raise exception 'Each payroll row needs an employee name, account ID, and valid salary amount'; end if;

  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct (x->>'account_id')) from jsonb_array_elements(p_items) x) then
    raise exception 'Duplicate employee accounts are not allowed in one payroll';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'account_id')::uuid=p_institution_account_id) then
    raise exception 'Institution funding account cannot also be an employee salary account';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'gross_salary')::numeric <= 1000) then
    raise exception 'Each gross salary must exceed UGX 1,000 so the net salary remains positive';
  end if;

  select count(*),sum((x->>'gross_salary')::numeric),count(*)*1000,
         sum((x->>'gross_salary')::numeric)-count(*)*1000
    into v_count,v_gross,v_commission,v_net
    from jsonb_array_elements(p_items) x;
  v_gross:=round(v_gross,2); v_commission:=round(v_commission,2); v_net:=round(v_net,2);
  if coalesce(v_source.balance,0) < v_gross then
    raise exception 'Insufficient funds in the institution account. Required UGX %, available UGX %',v_gross,coalesce(v_source.balance,0);
  end if;

  -- Lock recipient accounts in a stable order and validate all before changing any balance.
  perform 1 from public.bank_accounts ba
   join (select distinct (x->>'account_id')::uuid id from jsonb_array_elements(p_items) x) r on r.id=ba.id
   order by ba.id for update of ba;
  if (select count(*) from public.bank_accounts ba
      join (select distinct (x->>'account_id')::uuid id from jsonb_array_elements(p_items) x) r on r.id=ba.id
      where ba.status='active' and ba.currency_code='UGX' and ba.branch_id=p_branch_id) <> v_count then
    raise exception 'Every employee account must exist, be active, use UGX, and belong to the selected branch';
  end if;

  select id into v_deposit_account from public.ledger_accounts
   where ledger_code='2000' and currency_code='UGX' and is_active and branch_id is null;
  select id into v_income_account from public.ledger_accounts
   where ledger_code='4000' and currency_code='UGX' and is_active and branch_id is null;
  if v_deposit_account is null or v_income_account is null then
    raise exception 'General-ledger accounts 2000 (customer deposits) and 4000 (commission income) must be configured';
  end if;

  insert into public.institution_payroll_batches
   (payroll_reference,branch_id,institution_account_id,payroll_date,employee_count,gross_total,commission_total,net_total,created_by)
  values(trim(p_payroll_reference),p_branch_id,p_institution_account_id,p_payroll_date,v_count,v_gross,v_commission,v_net,v_user)
  returning id into v_batch_id;

  update public.bank_accounts set balance=coalesce(balance,0)-v_gross where id=p_institution_account_id;

  insert into public.ledger_journals
   (journal_number,journal_type,transaction_date,value_date,currency_code,status,description,created_by,posted_by,posted_at,branch_id)
  values('PAY-'||to_char(clock_timestamp() at time zone 'UTC','YYYYMMDDHH24MISS')||'-'||upper(substr(replace(v_batch_id::text,'-',''),1,8)),
   'fee',now(),p_payroll_date,'UGX','posted','Institution payroll '||trim(p_payroll_reference)||'; employee count '||v_count,v_user,v_user,now(),p_branch_id)
  returning id into v_journal_id;

  insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
  values(v_journal_id,v_deposit_account,'debit',v_gross,'UGX',p_branch_id,p_institution_account_id,'Gross payroll debit from institution account');

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_account_id := (v_item->>'account_id')::uuid;
    v_gross_item := round((v_item->>'gross_salary')::numeric,2);
    v_employee_name := trim(v_item->>'employee_name');
    v_employee_ref := nullif(trim(v_item->>'employee_reference'),'');
    v_tx_ref := 'SAL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));

    update public.bank_accounts set balance=coalesce(balance,0)+(v_gross_item-1000) where id=v_account_id;
    insert into public.institution_payroll_items(batch_id,employee_account_id,employee_reference,employee_name,gross_salary,commission_amount,net_salary,transaction_reference)
    values(v_batch_id,v_account_id,v_employee_ref,v_employee_name,v_gross_item,1000,v_gross_item-1000,v_tx_ref);

    insert into public.transactions(transaction_reference,account_id,branch_id,transaction_type,amount,currency_code,narration,status)
    values('SALD-'||substr(v_tx_ref,5),p_institution_account_id,p_branch_id,'salary_debit',v_gross_item,'UGX','Institution payroll '||trim(p_payroll_reference)||' gross salary batch debit','posted');
    insert into public.transactions(transaction_reference,account_id,branch_id,transaction_type,amount,currency_code,narration,status)
    values(v_tx_ref,v_account_id,p_branch_id,'salary_credit',v_gross_item-1000,'UGX','Salary credit less UGX 1,000 institutional payroll commission','posted');

    insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
    values(v_journal_id,v_deposit_account,'credit',v_gross_item-1000,'UGX',p_branch_id,v_account_id,'Net salary credited to '||v_employee_name);
  end loop;

  insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,description)
  values(v_journal_id,v_income_account,'credit',v_commission,'UGX',p_branch_id,'Institutional payroll commissions at UGX 1,000 per employee');

  insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  values(v_user,p_branch_id,'institution_payroll_processed','institution_payroll_batch',v_batch_id::text,'success',
   jsonb_build_object('payroll_reference',trim(p_payroll_reference),'employee_count',v_count,'gross_total',v_gross,'commission_total',v_commission,'net_total',v_net,'journal_id',v_journal_id));

  return jsonb_build_object('batch_id',v_batch_id,'payroll_reference',trim(p_payroll_reference),'payroll_date',p_payroll_date,
    'employee_count',v_count,'gross_total',v_gross,'commission_per_employee',1000,'commission_total',v_commission,
    'net_total',v_net,'journal_id',v_journal_id,'status','posted');
end;
$function$;
revoke all on function public.process_institution_payroll(uuid,uuid,text,date,jsonb) from public,anon;
grant execute on function public.process_institution_payroll(uuid,uuid,text,date,jsonb) to authenticated;
