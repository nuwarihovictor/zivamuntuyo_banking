-- Align stored account balances with the customer liability subledger on teller postings.
create or replace function public.post_approved_cash_transaction(p_journal_id uuid,p_cash_ledger_account_id uuid)
returns table(journal_id uuid,journal_number text,journal_status text,posted_amount numeric)
language plpgsql security definer set search_path=''
as $function$
declare
 v_j public.ledger_journals%rowtype; v_ba public.bank_accounts%rowtype;
 v_customer_ledger public.ledger_accounts%rowtype; v_cash_ledger public.ledger_accounts%rowtype;
 v_role text; v_balance numeric; v_new_balance numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 v_role:=public.current_employee_role_code();
 if v_role is null or v_role not in ('system_admin','general_manager','bank_admin','branch_manager','accountant') then raise exception 'Not authorized to post cash transactions' using errcode='42501'; end if;
 select * into v_j from public.ledger_journals where id=p_journal_id for update;
 if not found then raise exception 'Transaction request not found' using errcode='P0002'; end if;
 if v_j.status<>'pending_approval' or v_j.approved_by is null then raise exception 'Transaction must be approved and pending posting' using errcode='23514'; end if;
 if v_j.created_by=auth.uid() or v_j.approved_by=auth.uid() then raise exception 'Requester or approver cannot post this transaction' using errcode='42501'; end if;
 if v_j.request_transaction_type is null or v_j.request_transaction_type not in ('deposit','withdrawal') or v_j.requested_account_id is null or v_j.requested_amount is null or v_j.requested_amount<=0 then raise exception 'This is not a complete valid cash transaction request' using errcode='22023'; end if;
 if exists(select 1 from public.ledger_entries le where le.journal_id=v_j.id) then raise exception 'Ledger entries already exist for this request; duplicate posting is blocked' using errcode='23505'; end if;
 select * into v_ba from public.bank_accounts where id=v_j.requested_account_id for update;
 if not found or v_ba.status<>'active' then raise exception 'Customer account is not active' using errcode='23514'; end if;
 if not public.current_employee_can_transact_in_branch(v_ba.branch_id) then raise exception 'No transaction access to this branch' using errcode='42501'; end if;
 select * into v_cash_ledger from public.ledger_accounts where id=p_cash_ledger_account_id and is_active=true for update;
 if not found or v_cash_ledger.ledger_type<>'asset' or v_cash_ledger.currency_code<>v_ba.currency_code or (v_cash_ledger.branch_id is not null and v_cash_ledger.branch_id<>v_ba.branch_id) then raise exception 'Select an active asset cash ledger in the same currency and branch' using errcode='22023'; end if;
 select * into v_customer_ledger from public.ledger_accounts where linked_bank_account_id=v_ba.id and is_active=true for update;
 if not found or v_customer_ledger.ledger_type<>'liability' or v_customer_ledger.currency_code<>v_ba.currency_code then raise exception 'Customer liability ledger is not configured. Posting is blocked until accounting setup is completed' using errcode='23514'; end if;
 select coalesce(sum(case when le.entry_side='credit' then le.amount else -le.amount end),0)
 into v_balance from public.ledger_entries le join public.ledger_journals lj on lj.id=le.journal_id
 where le.ledger_account_id=v_customer_ledger.id and lj.status='posted';
 if v_j.request_transaction_type='withdrawal' and v_balance<v_j.requested_amount then raise exception 'Insufficient available balance' using errcode='23514'; end if;
 v_new_balance:=case when v_j.request_transaction_type='deposit' then v_balance+v_j.requested_amount else v_balance-v_j.requested_amount end;
 insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
 values
 (v_j.id,v_cash_ledger.id,case when v_j.request_transaction_type='deposit' then 'debit' else 'credit' end,v_j.requested_amount,v_ba.currency_code,v_ba.branch_id,v_ba.id,'Cash control leg'),
 (v_j.id,v_customer_ledger.id,case when v_j.request_transaction_type='deposit' then 'credit' else 'debit' end,v_j.requested_amount,v_ba.currency_code,v_ba.branch_id,v_ba.id,'Customer account leg');
 -- Keep the operational balance field in sync with the posted customer-liability subledger.
 update public.bank_accounts set balance=v_new_balance where id=v_ba.id;
 update public.ledger_journals set status='posted',posted_by=auth.uid(),posted_at=now()
 where id=v_j.id and status='pending_approval' and approved_by is not null;
 if not found then raise exception 'Transaction state changed before posting; no posting completed' using errcode='23514'; end if;
 return query select lj.id,lj.journal_number,lj.status,v_j.requested_amount from public.ledger_journals lj where lj.id=v_j.id;
end;
$function$;

-- Payroll moves money between institution and employee customer-liability subledgers.
-- The commission is credited to a separate income account; all legs balance in one journal.
create or replace function public.process_institution_payroll(p_branch_id uuid,p_institution_account_id uuid,p_payroll_reference text,p_payroll_date date,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
 v_user uuid:=auth.uid(); v_role text:=public.current_employee_role_code(); v_source public.bank_accounts%rowtype;
 v_count integer; v_gross numeric(14,2); v_commission numeric(14,2); v_net numeric(14,2);
 v_batch_id uuid; v_journal_id uuid; v_source_ledger uuid; v_income_ledger uuid; v_employee_ledger uuid;
 v_item jsonb; v_account_id uuid; v_gross_item numeric(14,2); v_employee_name text; v_employee_ref text; v_tx_ref text;
begin
 if v_user is null then raise exception 'Sign-in required'; end if;
 if v_role is null or v_role not in ('system_admin','general_manager','bank_admin','branch_manager','accountant','teller') then raise exception 'Your role cannot process institutional payroll'; end if;
 if not public.current_employee_can_transact_in_branch(p_branch_id) then raise exception 'Branch access denied'; end if;
 if p_payroll_reference is null or length(trim(p_payroll_reference))<4 then raise exception 'Enter a payroll reference of at least 4 characters'; end if;
 if p_payroll_date is null or p_payroll_date>timezone('Africa/Kampala',now())::date then raise exception 'Payroll date cannot be in the future'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>2000 then raise exception 'Payroll must contain between 1 and 2,000 employees'; end if;
 if exists(select 1 from public.institution_payroll_batches where payroll_reference=trim(p_payroll_reference)) then raise exception 'This payroll reference has already been processed'; end if;
 select * into v_source from public.bank_accounts where id=p_institution_account_id and branch_id=p_branch_id for update;
 if not found or v_source.status<>'active' then raise exception 'Institution account must be active and belong to the selected branch'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where coalesce(x->>'account_id','')='' or coalesce(x->>'employee_name','')='' or coalesce(x->>'gross_salary','') !~ '^([0-9]+)([.][0-9]{1,2})?$') then raise exception 'Each payroll row needs an employee name, account ID, and valid salary amount'; end if;
 if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct (x->>'account_id')) from jsonb_array_elements(p_items) x) then raise exception 'Duplicate employee accounts are not allowed'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'account_id')::uuid=p_institution_account_id) then raise exception 'Institution funding account cannot be an employee salary account'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'gross_salary')::numeric<=1000) then raise exception 'Each gross salary must exceed UGX 1,000'; end if;
 select count(*),sum((x->>'gross_salary')::numeric),count(*)*1000,sum((x->>'gross_salary')::numeric)-count(*)*1000 into v_count,v_gross,v_commission,v_net from jsonb_array_elements(p_items) x;
 v_gross:=round(v_gross,2); v_commission:=round(v_commission,2); v_net:=round(v_net,2);
 if coalesce(v_source.balance,0)<v_gross then raise exception 'Insufficient institution account funds. Required UGX %, available UGX %',v_gross,coalesce(v_source.balance,0); end if;
 perform 1 from public.bank_accounts ba join (select distinct (x->>'account_id')::uuid id from jsonb_array_elements(p_items) x) r on r.id=ba.id order by ba.id for update of ba;
 if (select count(*) from public.bank_accounts ba join (select distinct (x->>'account_id')::uuid id from jsonb_array_elements(p_items) x) r on r.id=ba.id where ba.status='active' and ba.currency_code='UGX' and ba.branch_id=p_branch_id)<>v_count then raise exception 'Every employee account must exist, be active, use UGX, and belong to this branch'; end if;
 select id into v_source_ledger from public.ledger_accounts where linked_bank_account_id=p_institution_account_id and ledger_type='liability' and currency_code='UGX' and is_active for update;
 if v_source_ledger is null then raise exception 'Institution account liability subledger is not configured; payroll cannot be posted'; end if;
 if (select count(*) from public.bank_accounts ba join (select distinct (x->>'account_id')::uuid id from jsonb_array_elements(p_items) x) r on r.id=ba.id join public.ledger_accounts la on la.linked_bank_account_id=ba.id and la.ledger_type='liability' and la.currency_code='UGX' and la.is_active)<>v_count then raise exception 'One or more employee accounts lack an active UGX customer-liability subledger'; end if;
 select id into v_income_ledger from public.ledger_accounts where ledger_code='4400' and currency_code='UGX' and is_active and branch_id is null;
 if v_income_ledger is null then raise exception 'GL account 4400 (institutional payroll commission income) is not configured'; end if;
 insert into public.institution_payroll_batches(payroll_reference,branch_id,institution_account_id,payroll_date,employee_count,gross_total,commission_total,net_total,created_by)
 values(trim(p_payroll_reference),p_branch_id,p_institution_account_id,p_payroll_date,v_count,v_gross,v_commission,v_net,v_user) returning id into v_batch_id;
 update public.bank_accounts set balance=coalesce(balance,0)-v_gross where id=p_institution_account_id;
 insert into public.ledger_journals(journal_number,journal_type,transaction_date,value_date,currency_code,status,description,created_by,posted_by,posted_at,branch_id)
 values('PAY-'||to_char(clock_timestamp() at time zone 'UTC','YYYYMMDDHH24MISS')||'-'||upper(substr(replace(v_batch_id::text,'-',''),1,8)),'fee',now(),p_payroll_date,'UGX','posted','Institution payroll '||trim(p_payroll_reference)||'; employee count '||v_count,v_user,v_user,now(),p_branch_id) returning id into v_journal_id;
 insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
 values(v_journal_id,v_source_ledger,'debit',v_gross,'UGX',p_branch_id,p_institution_account_id,'Gross payroll debit from institution account');
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_account_id:=(v_item->>'account_id')::uuid; v_gross_item:=round((v_item->>'gross_salary')::numeric,2); v_employee_name:=trim(v_item->>'employee_name'); v_employee_ref:=nullif(trim(v_item->>'employee_reference'),''); v_tx_ref:='SAL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
   select id into v_employee_ledger from public.ledger_accounts where linked_bank_account_id=v_account_id and ledger_type='liability' and currency_code='UGX' and is_active for update;
   if v_employee_ledger is null then raise exception 'Employee customer-liability subledger is missing; payroll transaction rolled back'; end if;
   update public.bank_accounts set balance=coalesce(balance,0)+(v_gross_item-1000) where id=v_account_id;
   insert into public.institution_payroll_items(batch_id,employee_account_id,employee_reference,employee_name,gross_salary,commission_amount,net_salary,transaction_reference)
   values(v_batch_id,v_account_id,v_employee_ref,v_employee_name,v_gross_item,1000,v_gross_item-1000,v_tx_ref);
   insert into public.transactions(transaction_reference,account_id,branch_id,transaction_type,amount,currency_code,narration,status)
   values('SALD-'||substr(v_tx_ref,5),p_institution_account_id,p_branch_id,'salary_debit',v_gross_item,'UGX','Institution payroll '||trim(p_payroll_reference)||' gross salary batch debit','posted');
   insert into public.transactions(transaction_reference,account_id,branch_id,transaction_type,amount,currency_code,narration,status)
   values(v_tx_ref,v_account_id,p_branch_id,'salary_credit',v_gross_item-1000,'UGX','Salary credit less UGX 1,000 institutional payroll commission','posted');
   insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
   values(v_journal_id,v_employee_ledger,'credit',v_gross_item-1000,'UGX',p_branch_id,v_account_id,'Net salary credited to '||v_employee_name);
 end loop;
 insert into public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,description)
 values(v_journal_id,v_income_ledger,'credit',v_commission,'UGX',p_branch_id,'Institutional payroll commissions at UGX 1,000 per employee');
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
 values(v_user,p_branch_id,'institution_payroll_processed','institution_payroll_batch',v_batch_id::text,'success',jsonb_build_object('payroll_reference',trim(p_payroll_reference),'employee_count',v_count,'gross_total',v_gross,'commission_total',v_commission,'net_total',v_net,'journal_id',v_journal_id));
 return jsonb_build_object('batch_id',v_batch_id,'payroll_reference',trim(p_payroll_reference),'payroll_date',p_payroll_date,'employee_count',v_count,'gross_total',v_gross,'commission_per_employee',1000,'commission_total',v_commission,'net_total',v_net,'journal_id',v_journal_id,'status','posted');
end;
$function$;
