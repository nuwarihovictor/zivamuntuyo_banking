
-- RPCs for the shareholding and teller charge workflows.
-- Every function authenticates the staff member, validates branch access and records an audit event.
-- Run after shareholding_teller_charges.sql.

create or replace function public.record_account_opening_package_collection(p_customer_id uuid,p_account_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 u uuid:=auth.uid(); role_code text:=public.current_employee_role_code(); b uuid; st text; c uuid;
 receipt text:='AOP-'||to_char(clock_timestamp() at time zone 'Africa/Kampala','YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 sec_receipt text:='SEC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
 share_receipt text:='SHR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
 if u is null then raise exception 'Sign-in required'; end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','teller') then raise exception 'Only teller or authorized supervisory staff can collect account-opening funds'; end if;
 select ba.branch_id,ba.status,ah.customer_id into b,st,c from public.bank_accounts ba join public.account_holders ah on ah.account_id=ba.id and ah.is_primary where ba.id=p_account_id for update of ba;
 if not found or c is distinct from p_customer_id then raise exception 'Account does not belong to selected customer'; end if;
 if st not in ('pending_approval','active') then raise exception 'Only pending or active account requests can be charged'; end if;
 if not public.current_employee_can_transact_in_branch(b) then raise exception 'Branch access denied'; end if;
 if exists(select 1 from public.account_opening_collections where account_id=p_account_id and collection_status='received') then raise exception 'Account-opening package already collected'; end if;
 insert into public.account_opening_collections(customer_id,account_id,branch_id,collected_by,receipt_number) values(p_customer_id,p_account_id,b,u,receipt);
 insert into public.customer_share_transactions(customer_id,branch_id,account_id,share_count,price_per_share,total_amount,source,receipt_number,received_by) values(p_customer_id,b,p_account_id,1,10000,10000,'account_opening_package',share_receipt,u);
 insert into public.account_security_ledger(customer_id,account_id,branch_id,entry_type,amount,receipt_number,recorded_by,notes) values(p_customer_id,p_account_id,b,'opening_reserve',8500,sec_receipt,u,'Restricted security reserve from account-opening package');
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details) values(u,b,'account_opening_package_collected','account_opening_collection',p_account_id::text,'success',jsonb_build_object('amount',30000,'share_amount',10000,'security_reserve',8500,'bundled_opening_costs',11500,'receipt_number',receipt));
 return jsonb_build_object('receipt_number',receipt,'amount',30000,'share_amount',10000,'shares_issued',1,'security_reserve',8500,'bundled_opening_costs',11500,'checkbook_included',true,'transaction_logbook_included',true,'account_opening_form_included',true);
end; $$;

create or replace function public.record_additional_share_purchase(p_customer_id uuid,p_branch_id uuid,p_share_count integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); role_code text:=public.current_employee_role_code(); receipt text:='SHR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)); amount_value numeric(14,2);
begin
 if u is null then raise exception 'Sign-in required'; end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','teller') then raise exception 'Only teller or authorized supervisory staff can record share purchases'; end if;
 if p_share_count is null or p_share_count not between 1 and 100000 then raise exception 'Enter a valid number of shares'; end if;
 if not public.current_employee_can_transact_in_branch(p_branch_id) then raise exception 'Branch access denied'; end if;
 if not exists(select 1 from public.customers where id=p_customer_id and status in ('active','approved')) then raise exception 'Customer must be active or approved'; end if;
 amount_value:=p_share_count*10000;
 insert into public.customer_share_transactions(customer_id,branch_id,share_count,price_per_share,total_amount,source,receipt_number,received_by) values(p_customer_id,p_branch_id,p_share_count,10000,amount_value,'additional_purchase',receipt,u);
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details) values(u,p_branch_id,'share_purchase_recorded','customer_share_transaction',receipt,'success',jsonb_build_object('customer_id',p_customer_id,'share_count',p_share_count,'total_amount',amount_value,'receipt_number',receipt));
 return jsonb_build_object('receipt_number',receipt,'share_count',p_share_count,'total_amount',amount_value,'price_per_share',10000);
end; $$;

create or replace function public.record_account_security_top_up(p_account_id uuid,p_amount numeric,p_receipt_number text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); role_code text:=public.current_employee_role_code(); c uuid;b uuid; receipt text:=coalesce(nullif(trim(p_receipt_number),''),'SEC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
 if u is null then raise exception 'Sign-in required'; end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','teller') then raise exception 'Only teller or authorized supervisory staff can record security top-ups'; end if;
 if p_amount is null or p_amount<=0 or p_amount>100000000 then raise exception 'Enter a valid top-up amount'; end if;
 select ah.customer_id,ba.branch_id into c,b from public.bank_accounts ba join public.account_holders ah on ah.account_id=ba.id and ah.is_primary where ba.id=p_account_id;
 if not found then raise exception 'Account not found'; end if;
 if not public.current_employee_can_transact_in_branch(b) then raise exception 'Branch access denied'; end if;
 insert into public.account_security_ledger(customer_id,account_id,branch_id,entry_type,amount,receipt_number,recorded_by,notes) values(c,p_account_id,b,'top_up',round(p_amount,2),receipt,u,'Teller security reserve top-up');
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details) values(u,b,'account_security_topped_up','account_security_ledger',p_account_id::text,'success',jsonb_build_object('amount',round(p_amount,2),'receipt_number',receipt));
 return jsonb_build_object('receipt_number',receipt,'amount',round(p_amount,2));
end; $$;

create or replace function public.apply_monthly_account_security_fee(p_account_id uuid,p_period_month date default date_trunc('month',timezone('Africa/Kampala',now()))::date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); role_code text:=public.current_employee_role_code(); c uuid;b uuid; balance_value numeric(14,2);deducted numeric(14,2);short_value numeric(14,2);period_value date:=date_trunc('month',p_period_month)::date;
begin
 if u is null then raise exception 'Sign-in required'; end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant') then raise exception 'Only authorized finance or management staff can apply monthly security charges'; end if;
 select ah.customer_id,ba.branch_id into c,b from public.bank_accounts ba join public.account_holders ah on ah.account_id=ba.id and ah.is_primary where ba.id=p_account_id;
 if not found then raise exception 'Account not found'; end if;
 if not public.current_employee_can_transact_in_branch(b) then raise exception 'Branch access denied'; end if;
 if exists(select 1 from public.account_security_ledger where account_id=p_account_id and period_month=period_value) then raise exception 'Monthly charge already processed'; end if;
 select coalesce(sum(case when entry_type in ('opening_reserve','top_up') then amount else -amount end),0) into balance_value from public.account_security_ledger where account_id=p_account_id;
 if balance_value<=0 then raise exception 'Security reserve exhausted; teller top-up required'; end if;
 deducted:=least(1000,balance_value);short_value:=1000-deducted;
 insert into public.account_security_ledger(customer_id,account_id,branch_id,entry_type,amount,fee_due,shortfall,period_month,recorded_by,notes) values(c,p_account_id,b,'monthly_deduction',deducted,1000,short_value,period_value,u,case when short_value>0 then 'Partial charge; reserve exhausted and top-up required' else 'Monthly account security charge' end);
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details) values(u,b,'monthly_account_security_fee','account_security_ledger',p_account_id::text,'success',jsonb_build_object('period_month',period_value,'fee_due',1000,'deducted',deducted,'shortfall',short_value));
 return jsonb_build_object('period_month',period_value,'fee_due',1000,'deducted',deducted,'shortfall',short_value,'top_up_required',short_value>0 or balance_value-deducted=0);
end; $$;

create or replace function public.record_loan_processing_fee_collection(p_loan_application_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); role_code text:=public.current_employee_role_code(); c uuid;b uuid;st text;receipt text:='LPF-'||to_char(clock_timestamp() at time zone 'Africa/Kampala','YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
begin
 if u is null then raise exception 'Sign-in required'; end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','teller') then raise exception 'Only teller or authorized supervisory staff can collect loan-processing fees'; end if;
 select customer_id,branch_id,status into c,b,st from public.loan_applications where id=p_loan_application_id;
 if not found then raise exception 'Loan application not found'; end if;
 if st in ('rejected','cancelled') then raise exception 'Cannot collect a fee for a rejected or cancelled application'; end if;
 if not public.current_employee_can_transact_in_branch(b) then raise exception 'Branch access denied'; end if;
 if exists(select 1 from public.loan_processing_fee_collections where loan_application_id=p_loan_application_id and collection_status='received') then raise exception 'Fee already collected'; end if;
 insert into public.loan_processing_fee_collections(loan_application_id,customer_id,branch_id,collected_by,receipt_number) values(p_loan_application_id,c,b,u,receipt);
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details) values(u,b,'loan_processing_fee_collected','loan_processing_fee_collection',p_loan_application_id::text,'success',jsonb_build_object('amount',10000,'receipt_number',receipt));
 return jsonb_build_object('receipt_number',receipt,'amount',10000,'currency_code','UGX','collected_by_teller',true);
end; $$;

create or replace function public.record_stationery_collection(p_customer_id uuid,p_branch_id uuid,p_item_type text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();role_code text:=public.current_employee_role_code();price numeric(14,2);receipt text:='STN-'||to_char(clock_timestamp() at time zone 'Africa/Kampala','YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
begin
 if u is null then raise exception 'Sign-in required'; end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','teller') then raise exception 'Only teller or authorized supervisory staff can record stationery collections'; end if;
 if not public.current_employee_can_transact_in_branch(p_branch_id) then raise exception 'Branch access denied'; end if;
 if not exists(select 1 from public.customers where id=p_customer_id and status in ('active','approved')) then raise exception 'Customer must be active or approved'; end if;
 if p_item_type='replacement_cheque_book' then price:=2500;elsif p_item_type='replacement_transaction_logbook' then price:=1500;else raise exception 'Choose a supported replacement item';end if;
 insert into public.stationery_collections(customer_id,branch_id,item_type,amount,receipt_number,collected_by) values(p_customer_id,p_branch_id,p_item_type,price,receipt,u);
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details) values(u,p_branch_id,'replacement_stationery_collected','stationery_collection',receipt,'success',jsonb_build_object('customer_id',p_customer_id,'item_type',p_item_type,'amount',price,'receipt_number',receipt));
 return jsonb_build_object('receipt_number',receipt,'item_type',p_item_type,'amount',price,'currency_code','UGX');
end; $$;

create or replace function public.get_customer_share_eligibility(p_customer_id uuid,p_requested_amount numeric default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();role_code text:=public.current_employee_role_code();customer_branch uuid;owned integer;share_value numeric(14,2);required integer;
begin
 if u is null then raise exception 'Sign-in required';end if;
 if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','teller','loan_officer','general_manager') then raise exception 'Your role cannot view share eligibility';end if;
 select branch_id into customer_branch from public.customers where id=p_customer_id and status in ('active','approved');
 if not found then raise exception 'Customer must be active or approved';end if;
 if customer_branch is not null and not public.current_employee_can_transact_in_branch(customer_branch) and role_code not in ('system_admin','bank_admin','general_manager') then raise exception 'Customer outside authorized branch';end if;
 select coalesce(sum(share_count),0)::integer,coalesce(sum(total_amount),0) into owned,share_value from public.customer_share_transactions where customer_id=p_customer_id;
 required:=case when coalesce(p_requested_amount,0)<=0 then 0 else ceil(p_requested_amount/100000.0)::integer end;
 return jsonb_build_object('customer_id',p_customer_id,'shares_owned',owned,'share_value_ugx',share_value,'share_price_ugx',10000,'requested_amount_ugx',greatest(coalesce(p_requested_amount,0),0),'shares_suggested_for_amount',required,'additional_shares_suggested',greatest(required-owned,0),'note','Shareholding is one factor in credit assessment and does not guarantee approval.');
end; $$;

revoke all on function public.record_account_opening_package_collection(uuid,uuid) from public,anon;
revoke all on function public.record_additional_share_purchase(uuid,uuid,integer) from public,anon;
revoke all on function public.record_account_security_top_up(uuid,numeric,text) from public,anon;
revoke all on function public.apply_monthly_account_security_fee(uuid,date) from public,anon;
revoke all on function public.record_loan_processing_fee_collection(uuid) from public,anon;
revoke all on function public.record_stationery_collection(uuid,uuid,text) from public,anon;
revoke all on function public.get_customer_share_eligibility(uuid,numeric) from public,anon;
grant execute on function public.record_account_opening_package_collection(uuid,uuid) to authenticated;
grant execute on function public.record_additional_share_purchase(uuid,uuid,integer) to authenticated;
grant execute on function public.record_account_security_top_up(uuid,numeric,text) to authenticated;
grant execute on function public.apply_monthly_account_security_fee(uuid,date) to authenticated;
grant execute on function public.record_loan_processing_fee_collection(uuid) to authenticated;
grant execute on function public.record_stationery_collection(uuid,uuid,text) to authenticated;
grant execute on function public.get_customer_share_eligibility(uuid,numeric) to authenticated;
