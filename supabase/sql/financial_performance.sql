
-- Zivamuntuyo operational finance tracking.
-- Share purchases are classified as non-withdrawable share capital, not operating income.
-- The initial UGX 30,000 package is split into UGX 10,000 share capital,
-- UGX 8,500 restricted security reserve, and UGX 11,500 bundled opening fees.
-- The bundled fee is not split into separate form/book amounts until a reviewed price allocation exists.

create table if not exists public.financial_activity_ledger (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.branches(id),
 event_date date not null default (timezone('Africa/Kampala',now()))::date,
 category text not null check(category in ('share_capital','account_opening_fees','loan_processing_fee','replacement_cheque_book','replacement_transaction_logbook','account_security_fee','security_reserve','loan_interest_income','late_loan_penalty','other_income','operating_expense')),
 profit_loss_type text not null check(profit_loss_type in ('income','expense','equity','liability')),
 amount numeric(14,2) not null check(amount>0),
 cash_in numeric(14,2) not null default 0 check(cash_in>=0),
 cash_out numeric(14,2) not null default 0 check(cash_out>=0),
 currency_code text not null default 'UGX',
 description text not null,
 receipt_number text,
 customer_id uuid references public.customers(id),
 loan_application_id uuid references public.loan_applications(id),
 source_table text,
 source_id uuid,
 recorded_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 constraint financial_activity_cash_side check(not(cash_in>0 and cash_out>0)),
 constraint financial_activity_source_unique unique(source_table,source_id)
);
create index if not exists financial_activity_branch_date_idx on public.financial_activity_ledger(branch_id,event_date desc);
create index if not exists financial_activity_category_idx on public.financial_activity_ledger(category,event_date desc);
create unique index if not exists financial_activity_receipt_unique on public.financial_activity_ledger(receipt_number) where receipt_number is not null;
alter table public.financial_activity_ledger enable row level security;
drop policy if exists "Finance activity visible within authorized branches" on public.financial_activity_ledger;
create policy "Finance activity visible within authorized branches" on public.financial_activity_ledger for select to authenticated using(
 public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager')
 and public.current_employee_can_transact_in_branch(branch_id)
);
grant select on public.financial_activity_ledger to authenticated;
revoke insert,update,delete on public.financial_activity_ledger from anon,authenticated;

create or replace function public.capture_financial_activity_from_source()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare cat text; pl text; amt numeric(14,2); ci numeric(14,2):=0; co numeric(14,2):=0;
 b uuid; cust uuid; loan_id uuid; receipt text; desc_text text; src_id uuid; curr text:='UGX'; evdate date:=timezone('Africa/Kampala',now())::date; actor uuid;
begin
 if tg_table_name='customer_share_transactions' then
  cat:='share_capital';pl:='equity';amt:=new.total_amount;
  ci:=case when new.source='adjustment' then 0 else new.total_amount end;
  b:=new.branch_id;cust:=new.customer_id;receipt:=new.receipt_number;
  desc_text:=case when new.source='account_opening_package' then 'Share included in account-opening package' when new.source='adjustment' then 'Shareholding adjustment (non-cash)' else 'Non-withdrawable share purchase' end;
  src_id:=new.id;actor:=new.received_by;
 elsif tg_table_name='account_opening_collections' then
  cat:='account_opening_fees';pl:='income';amt:=new.bundled_opening_costs;ci:=new.bundled_opening_costs;b:=new.branch_id;cust:=new.customer_id;receipt:=new.receipt_number;
  desc_text:='Bundled account-opening fees including form and initial cheque/log books';src_id:=new.id;actor:=new.collected_by;
 elsif tg_table_name='account_security_ledger' then
  if new.entry_type='monthly_deduction' then cat:='account_security_fee';pl:='income';amt:=new.amount;ci:=0;desc_text:='Monthly security charge transferred from restricted reserve';
  elsif new.entry_type in ('opening_reserve','top_up') then cat:='security_reserve';pl:='liability';amt:=new.amount;ci:=new.amount;desc_text:=case when new.entry_type='opening_reserve' then 'Restricted opening security reserve' else 'Security reserve top-up' end;
  else return new;end if;
  b:=new.branch_id;cust:=new.customer_id;receipt:=new.receipt_number;src_id:=new.id;actor:=new.recorded_by;
 elsif tg_table_name='loan_processing_fee_collections' then
  cat:='loan_processing_fee';pl:='income';amt:=new.amount;ci:=new.amount;b:=new.branch_id;cust:=new.customer_id;loan_id:=new.loan_application_id;receipt:=new.receipt_number;desc_text:='Loan-processing form fee';src_id:=new.id;actor:=new.collected_by;
 elsif tg_table_name='stationery_collections' then
  cat:=case when new.item_type='replacement_cheque_book' then 'replacement_cheque_book' else 'replacement_transaction_logbook' end;
  pl:='income';amt:=new.amount;ci:=new.amount;b:=new.branch_id;cust:=new.customer_id;receipt:=new.receipt_number;
  desc_text:=case when new.item_type='replacement_cheque_book' then 'Replacement cheque book' else 'Replacement transaction log book' end;src_id:=new.id;actor:=new.collected_by;
 else return new;
 end if;
 insert into public.financial_activity_ledger(branch_id,event_date,category,profit_loss_type,amount,cash_in,cash_out,currency_code,description,receipt_number,customer_id,loan_application_id,source_table,source_id,recorded_by)
 values(b,evdate,cat,pl,amt,ci,co,curr,desc_text,receipt,cust,loan_id,tg_table_name,src_id,actor)
 on conflict(source_table,source_id) do nothing;
 return new;
end; $$;

drop trigger if exists capture_finance_share_purchase on public.customer_share_transactions;
create trigger capture_finance_share_purchase after insert on public.customer_share_transactions for each row execute function public.capture_financial_activity_from_source();
drop trigger if exists capture_finance_account_opening on public.account_opening_collections;
create trigger capture_finance_account_opening after insert on public.account_opening_collections for each row execute function public.capture_financial_activity_from_source();
drop trigger if exists capture_finance_security_ledger on public.account_security_ledger;
create trigger capture_finance_security_ledger after insert on public.account_security_ledger for each row execute function public.capture_financial_activity_from_source();
drop trigger if exists capture_finance_loan_fee on public.loan_processing_fee_collections;
create trigger capture_finance_loan_fee after insert on public.loan_processing_fee_collections for each row execute function public.capture_financial_activity_from_source();
drop trigger if exists capture_finance_stationery on public.stationery_collections;
create trigger capture_finance_stationery after insert on public.stationery_collections for each row execute function public.capture_financial_activity_from_source();
revoke all on function public.capture_financial_activity_from_source() from public,anon,authenticated;

create or replace function public.record_financial_activity(p_branch_id uuid,p_category text,p_amount numeric,p_description text,p_receipt_number text default null,p_customer_id uuid default null,p_loan_application_id uuid default null,p_event_date date default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); role_code text:=public.current_employee_role_code(); pl text;ci numeric(14,2):=0;co numeric(14,2):=0; rec text:=nullif(trim(p_receipt_number),''); new_id uuid; evdate date:=coalesce(p_event_date,timezone('Africa/Kampala',now())::date);
begin
 if u is null then raise exception 'Sign-in required';end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','teller','general_manager') then raise exception 'Finance permission required';end if;
 if not public.current_employee_can_transact_in_branch(p_branch_id) then raise exception 'Branch access denied';end if;
 if p_amount is null or p_amount<=0 or p_amount>100000000000 then raise exception 'Enter a positive valid amount';end if;
 if p_description is null or length(trim(p_description))<4 then raise exception 'Provide a clear description';end if;
 if p_category not in ('loan_interest_income','late_loan_penalty','other_income','operating_expense') then raise exception 'Unsupported manual finance category';end if;
 if p_category='operating_expense' and role_code not in ('system_admin','bank_admin','branch_manager','accountant','general_manager') then raise exception 'Only finance or management staff may record expenses';end if;
 if p_loan_application_id is not null and not exists(select 1 from public.loan_applications l where l.id=p_loan_application_id and l.branch_id=p_branch_id) then raise exception 'Loan application not found in selected branch';end if;
 if p_customer_id is not null and not exists(select 1 from public.customers c where c.id=p_customer_id and c.status in ('active','approved')) then raise exception 'Customer must be active or approved';end if;
 pl:=case when p_category='operating_expense' then 'expense' else 'income' end;
 if pl='expense' then co:=round(p_amount,2);else ci:=round(p_amount,2);end if;
 insert into public.financial_activity_ledger(branch_id,event_date,category,profit_loss_type,amount,cash_in,cash_out,description,receipt_number,customer_id,loan_application_id,source_table,recorded_by)
 values(p_branch_id,evdate,p_category,pl,round(p_amount,2),ci,co,trim(p_description),rec,p_customer_id,p_loan_application_id,'manual',u) returning id into new_id;
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
 values(u,p_branch_id,'financial_activity_recorded','financial_activity_ledger',new_id::text,'success',jsonb_build_object('category',p_category,'amount',round(p_amount,2),'description',trim(p_description),'receipt_number',rec,'profit_loss_type',pl));
 return jsonb_build_object('id',new_id,'category',p_category,'amount',round(p_amount,2),'profit_loss_type',pl,'receipt_number',rec,'event_date',evdate);
end; $$;
revoke all on function public.record_financial_activity(uuid,text,numeric,text,text,uuid,uuid,date) from public,anon;
grant execute on function public.record_financial_activity(uuid,text,numeric,text,text,uuid,uuid,date) to authenticated;

create or replace function public.get_financial_performance(p_branch_id uuid default null,p_start_date date default null,p_end_date date default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare role_code text:=public.current_employee_role_code(); result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign-in required';end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','general_manager') then raise exception 'Finance reporting permission required';end if;
 if p_start_date is not null and p_end_date is not null and p_start_date>p_end_date then raise exception 'Start date must not be after end date';end if;
 if p_branch_id is not null and not public.current_employee_can_transact_in_branch(p_branch_id) then raise exception 'Branch access denied';end if;
 select jsonb_build_object(
  'period_start',p_start_date,'period_end',p_end_date,'branch_id',p_branch_id,
  'income_total',coalesce(sum(amount) filter(where profit_loss_type='income'),0),
  'expense_total',coalesce(sum(amount) filter(where profit_loss_type='expense'),0),
  'operating_surplus',coalesce(sum(amount) filter(where profit_loss_type='income'),0)-coalesce(sum(amount) filter(where profit_loss_type='expense'),0),
  'share_capital_total',coalesce(sum(amount) filter(where profit_loss_type='equity'),0),
  'restricted_reserve_total',coalesce(sum(amount) filter(where category='security_reserve'),0)-coalesce(sum(amount) filter(where category='account_security_fee'),0),
  'cash_in_total',coalesce(sum(cash_in),0),'cash_out_total',coalesce(sum(cash_out),0),'event_count',count(*),
  'by_category',coalesce((select jsonb_agg(jsonb_build_object('category',x.category,'profit_loss_type',x.profit_loss_type,'amount',x.total_amount,'cash_in',x.cash_in,'cash_out',x.cash_out,'count',x.n) order by x.category) from (select category,profit_loss_type,sum(amount) total_amount,sum(cash_in) cash_in,sum(cash_out) cash_out,count(*) n from public.financial_activity_ledger where public.current_employee_can_transact_in_branch(branch_id) and (p_branch_id is null or branch_id=p_branch_id) and (p_start_date is null or event_date>=p_start_date) and (p_end_date is null or event_date<=p_end_date) group by category,profit_loss_type) x),'[]'::jsonb),
  'monthly_trend',coalesce((select jsonb_agg(jsonb_build_object('month',x.month_key,'income',x.income,'expenses',x.expenses,'surplus',x.income-x.expenses,'share_capital',x.share_capital) order by x.month_key) from (select to_char(date_trunc('month',event_date),'YYYY-MM') as month_key,coalesce(sum(amount) filter(where profit_loss_type='income'),0) income,coalesce(sum(amount) filter(where profit_loss_type='expense'),0) expenses,coalesce(sum(amount) filter(where profit_loss_type='equity'),0) share_capital from public.financial_activity_ledger where (p_branch_id is null or branch_id=p_branch_id) and (p_start_date is null or event_date>=p_start_date) and (p_end_date is null or event_date<=p_end_date) group by date_trunc('month',event_date)) x),'[]'::jsonb)
 ) into result from public.financial_activity_ledger f
 where public.current_employee_can_transact_in_branch(f.branch_id) and (p_branch_id is null or f.branch_id=p_branch_id) and (p_start_date is null or f.event_date>=p_start_date) and (p_end_date is null or f.event_date<=p_end_date);
 return result;
end; $$;
revoke all on function public.get_financial_performance(uuid,date,date) from public,anon;
grant execute on function public.get_financial_performance(uuid,date,date) to authenticated;
