-- Loan product types, General Manager-controlled rates, and secure application RPCs.
-- Applied to Supabase project hwghiezvghdqxnhcnpwk on 2026-10-18 via execute_sql.
-- Business, agribusiness, motor vehicle, school fees, and Kibanja rates are intentionally
-- NULL until the General Manager configures the approved rate. Do not invent bank pricing.
-- Overdraft is enforced at 5% per month by CHECK constraint, RLS, and trigger.

insert into public.staff_roles(role_code,role_name,description,is_system_role)
values ('general_manager','General Manager','Authorized to configure loan product interest rates and review credit applications.',true)
on conflict (role_code) do update set role_name=excluded.role_name,description=excluded.description,is_system_role=true;

create table if not exists public.loan_product_rates (
 product_code text primary key,
 product_name text not null,
 description text not null,
 rate_percent numeric(7,4),
 rate_period text not null check (rate_period in ('annual','monthly')),
 editable_by_general_manager boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 constraint loan_product_rate_nonnegative check (rate_percent is null or rate_percent between 0 and 100),
 constraint overdraft_rate_locked check (product_code <> 'overdraft' or (rate_percent=5 and rate_period='monthly' and editable_by_general_manager=false))
);
alter table public.loan_product_rates enable row level security;
revoke all on public.loan_product_rates from anon,authenticated;
grant select on public.loan_product_rates to authenticated;
grant update(rate_percent) on public.loan_product_rates to authenticated;

insert into public.loan_product_rates(product_code,product_name,description,rate_percent,rate_period,editable_by_general_manager)
values
 ('business','Business Loan','Working capital, trading and business expansion.',null,'annual',true),
 ('agribusiness','Agribusiness Loan','Crop production, livestock, farm inputs and agricultural value chains.',null,'annual',true),
 ('motor_vehicle','Motor Vehicle Loan','Purchase or refinancing of eligible motor vehicles.',null,'annual',true),
 ('school_fees','School Fees Loan','School fees and approved education-related costs.',null,'annual',true),
 ('kibanja','Kibanja Loan','Land-related purchase or kibanja interests; requires land/collateral review.',null,'annual',true),
 ('overdraft','Overdraft','Overdraft facility; permanently fixed monthly rate.',5,'monthly',false)
on conflict(product_code) do update set
 product_name=excluded.product_name,description=excluded.description,
 rate_percent=case when public.loan_product_rates.product_code='overdraft' then 5 else public.loan_product_rates.rate_percent end,
 rate_period=case when public.loan_product_rates.product_code='overdraft' then 'monthly' else public.loan_product_rates.rate_period end,
 editable_by_general_manager=case when public.loan_product_rates.product_code='overdraft' then false else public.loan_product_rates.editable_by_general_manager end;

drop policy if exists loan_product_rates_staff_read on public.loan_product_rates;
create policy loan_product_rates_staff_read on public.loan_product_rates for select to authenticated
using (auth.uid() is not null and public.current_employee_role_code() is not null);
drop policy if exists loan_product_rates_general_manager_update on public.loan_product_rates;
create policy loan_product_rates_general_manager_update on public.loan_product_rates for update to authenticated
using (public.current_employee_role_code()='general_manager' and product_code<>'overdraft' and editable_by_general_manager)
with check (public.current_employee_role_code()='general_manager' and product_code<>'overdraft' and editable_by_general_manager);

create or replace function public.enforce_loan_product_rate_rules()
returns trigger language plpgsql set search_path=''
as $$
begin
 if tg_op='DELETE' then raise exception 'Loan product rates cannot be deleted'; end if;
 if old.product_code='overdraft' or new.product_code='overdraft' then
  if new.product_code<>'overdraft' or new.rate_percent is distinct from 5::numeric or new.rate_period<>'monthly' or new.editable_by_general_manager then
   raise exception 'Overdraft rate is permanently fixed at 5 percent per month';
  end if;
 end if;
 if tg_op='UPDATE' then
  if old.product_code<>new.product_code then raise exception 'Loan product codes cannot be changed'; end if;
  if (new.rate_percent is distinct from old.rate_percent or new.rate_period is distinct from old.rate_period or new.editable_by_general_manager is distinct from old.editable_by_general_manager) and public.current_employee_role_code()<>'general_manager' then
   raise exception 'Only the General Manager may change loan product rates';
  end if;
 end if;
 new.updated_at=now(); new.updated_by=auth.uid(); return new;
end; $$;
drop trigger if exists loan_product_rate_guard on public.loan_product_rates;
create trigger loan_product_rate_guard before update or delete on public.loan_product_rates for each row execute function public.enforce_loan_product_rate_rules();

alter table public.loan_applications add column if not exists loan_type text references public.loan_product_rates(product_code);
alter table public.loan_applications add column if not exists interest_rate_period text not null default 'annual' check (interest_rate_period in ('annual','monthly'));
alter table public.loan_applications add column if not exists interest_rate_monthly numeric(7,4);

drop function if exists public.create_loan_application(uuid,uuid,numeric,text,numeric,integer,text,text,text,text);
drop function if exists public.list_loan_applications(uuid);

create or replace function public.create_loan_application(
 p_customer_id uuid,p_branch_id uuid,p_loan_type text,p_requested_amount numeric,p_currency_code text,
 p_tenure_months integer,p_loan_purpose text,p_collateral_description text default null,
 p_guarantor_name text default null,p_guarantor_phone text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid(); v_role text:=public.current_employee_role_code();
 v_customer public.customers%rowtype; v_rate public.loan_product_rates%rowtype;
 v_app public.loan_applications%rowtype; v_number text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not (v_role in ('general_manager','system_admin','bank_admin','branch_manager','loan_officer') and
  (v_role in ('general_manager','system_admin','bank_admin') or public.is_active_branch_manager_for(p_branch_id) or public.current_employee_has_branch_access(p_branch_id))) then
  raise exception 'You are not authorized to submit loan applications for this branch';
 end if;
 if not exists(select 1 from public.branches b where b.id=p_branch_id and b.is_active) then raise exception 'Select an active branch'; end if;
 if p_requested_amount is null or p_requested_amount<=0 or p_requested_amount>1000000000000 then raise exception 'Requested amount must be positive and within permitted input range'; end if;
 if p_tenure_months is null or p_tenure_months not between 1 and 360 then raise exception 'Tenure must be between 1 and 360 months'; end if;
 if p_currency_code is null or not exists(select 1 from public.currencies c where c.code=upper(p_currency_code) and c.is_active) then raise exception 'Choose an active supported currency'; end if;
 if p_loan_purpose is null or length(trim(p_loan_purpose)) not between 3 and 2000 then raise exception 'Enter the loan purpose'; end if;
 select * into v_rate from public.loan_product_rates where product_code=p_loan_type;
 if not found then raise exception 'Choose a valid loan product'; end if;
 if v_rate.rate_percent is null then raise exception 'The General Manager must configure this product interest rate before applications can be submitted'; end if;
 select * into v_customer from public.customers c where c.id=p_customer_id and c.status in ('active','approved');
 if not found then raise exception 'Customer must exist and be active or approved'; end if;
 if v_customer.branch_id is not null and v_customer.branch_id<>p_branch_id and v_role not in ('general_manager','system_admin','bank_admin') and not public.current_employee_has_branch_access(v_customer.branch_id) then raise exception 'Customer belongs to a branch you cannot access'; end if;
 v_number:='LA-'||to_char(clock_timestamp() at time zone 'UTC','YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.loan_applications(application_number,customer_id,branch_id,loan_type,requested_amount,currency_code,interest_rate_annual,interest_rate_monthly,interest_rate_period,tenure_months,loan_purpose,collateral_description,guarantor_name,guarantor_phone,submitted_by)
 values(v_number,p_customer_id,p_branch_id,p_loan_type,round(p_requested_amount,2),upper(p_currency_code),
  case when v_rate.rate_period='annual' then v_rate.rate_percent else 0 end,
  case when v_rate.rate_period='monthly' then v_rate.rate_percent else null end,
  v_rate.rate_period,p_tenure_months,trim(p_loan_purpose),nullif(trim(p_collateral_description),''),nullif(trim(p_guarantor_name),''),nullif(trim(p_guarantor_phone),''),v_user)
 returning * into v_app;
 insert into public.audit_events(branch_id,actor_user_id,action,entity_type,entity_id,details)
 values(p_branch_id,v_user,'loan_application_submitted','loan_application',v_app.id::text,jsonb_build_object('application_number',v_number,'loan_type',v_app.loan_type,'requested_amount',v_app.requested_amount,'currency_code',v_app.currency_code,'rate_percent',v_rate.rate_percent,'rate_period',v_rate.rate_period));
 return jsonb_build_object('id',v_app.id,'application_number',v_app.application_number,'status',v_app.status,'loan_type',v_app.loan_type);
end; $$;
revoke all on function public.create_loan_application(uuid,uuid,text,numeric,text,integer,text,text,text,text) from public,anon;
grant execute on function public.create_loan_application(uuid,uuid,text,numeric,text,integer,text,text,text,text) to authenticated;

create or replace function public.list_loan_applications(p_branch_id uuid default null)
returns table(id uuid,application_number text,customer_id uuid,customer_name text,branch_id uuid,branch_name text,loan_type text,requested_amount numeric,currency_code text,interest_rate_annual numeric,interest_rate_monthly numeric,interest_rate_period text,tenure_months integer,loan_purpose text,collateral_description text,guarantor_name text,guarantor_phone text,status text,review_note text,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare v_role text:=public.current_employee_role_code();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if v_role not in ('general_manager','system_admin','bank_admin','branch_manager','loan_officer','accountant','auditor') then raise exception 'Role is not authorized to view loan applications'; end if;
 return query select la.id,la.application_number,la.customer_id,c.full_name,la.branch_id,b.branch_name,la.loan_type,la.requested_amount,la.currency_code::text,la.interest_rate_annual,la.interest_rate_monthly,la.interest_rate_period,la.tenure_months,la.loan_purpose,la.collateral_description,la.guarantor_name,la.guarantor_phone,la.status,la.review_note,la.created_at
 from public.loan_applications la join public.customers c on c.id=la.customer_id join public.branches b on b.id=la.branch_id
 where (p_branch_id is null or la.branch_id=p_branch_id) and (v_role in ('general_manager','system_admin','bank_admin') or public.current_employee_has_branch_access(la.branch_id) or public.is_active_branch_manager_for(la.branch_id))
 order by la.created_at desc limit 500;
end; $$;
revoke all on function public.list_loan_applications(uuid) from public,anon;
grant execute on function public.list_loan_applications(uuid) to authenticated;

create or replace function public.review_loan_application(p_application_id uuid,p_decision text,p_review_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_app public.loan_applications%rowtype; v_user uuid:=auth.uid(); v_role text:=public.current_employee_role_code();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_decision not in ('under_review','more_information_required','approved','rejected') then raise exception 'Invalid review decision'; end if;
 select * into v_app from public.loan_applications where id=p_application_id for update;
 if not found then raise exception 'Loan application not found'; end if;
 if not (v_role in ('general_manager','system_admin','bank_admin') or (v_role in ('branch_manager','loan_officer') and public.current_employee_has_branch_access(v_app.branch_id))) then raise exception 'Not authorized to review this application'; end if;
 if v_app.submitted_by=v_user then raise exception 'The submitter cannot review their own application'; end if;
 if v_app.status not in ('submitted','under_review','more_information_required') then raise exception 'This application is already finalized'; end if;
 update public.loan_applications set status=p_decision,review_note=nullif(trim(p_review_note),''),reviewed_by=v_user,reviewed_at=now(),updated_at=now() where id=p_application_id returning * into v_app;
 insert into public.audit_events(branch_id,actor_user_id,action,entity_type,entity_id,details)
 values(v_app.branch_id,v_user,'loan_application_reviewed','loan_application',v_app.id::text,jsonb_build_object('decision',p_decision,'note',nullif(trim(p_review_note),'')));
 return jsonb_build_object('id',v_app.id,'application_number',v_app.application_number,'status',v_app.status);
end; $$;
revoke all on function public.review_loan_application(uuid,text,text) from public,anon;
grant execute on function public.review_loan_application(uuid,text,text) to authenticated;
