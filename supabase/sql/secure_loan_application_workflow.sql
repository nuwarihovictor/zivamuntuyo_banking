-- Secure loan application intake and review workflow.
-- Apply with Supabase migration tooling. Browser roles receive no direct table grants.

create table if not exists public.loan_applications (
 id uuid primary key default gen_random_uuid(),
 application_number text not null unique,
 customer_id uuid not null references public.customers(id),
 branch_id uuid not null references public.branches(id),
 requested_amount numeric(18,2) not null check(requested_amount>0),
 currency_code char(3) not null references public.currencies(code),
 interest_rate_annual numeric(7,4) not null default 18 check(interest_rate_annual between 0 and 100),
 tenure_months integer not null check(tenure_months between 1 and 360),
 loan_purpose text not null check(length(trim(loan_purpose)) between 3 and 2000),
 collateral_description text, guarantor_name text, guarantor_phone text,
 status text not null default 'submitted' check(status in ('submitted','under_review','more_information_required','approved','rejected','cancelled')),
 review_note text, submitted_by uuid not null references auth.users(id), reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists loan_applications_branch_status_created_idx on public.loan_applications(branch_id,status,created_at desc);
create index if not exists loan_applications_customer_idx on public.loan_applications(customer_id,created_at desc);
alter table public.loan_applications enable row level security;
revoke all on public.loan_applications from anon,authenticated;
grant select,insert,update,delete on public.loan_applications to service_role;

create or replace function public.create_loan_application(
 p_customer_id uuid,p_branch_id uuid,p_requested_amount numeric,p_currency_code text,
 p_interest_rate_annual numeric,p_tenure_months integer,p_loan_purpose text,
 p_collateral_description text default null,p_guarantor_name text default null,p_guarantor_phone text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_role text:=public.current_employee_role_code(); v_customer public.customers%rowtype; v_app public.loan_applications%rowtype; v_number text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not (public.is_active_system_admin() or public.is_active_bank_admin() or public.is_active_branch_manager_for(p_branch_id) or (v_role='loan_officer' and public.current_employee_has_branch_access(p_branch_id))) then raise exception 'Not authorized for loan applications in this branch'; end if;
 if not exists(select 1 from public.branches b where b.id=p_branch_id and b.is_active) then raise exception 'Select an active branch'; end if;
 if p_requested_amount is null or p_requested_amount<=0 or p_requested_amount>1000000000000 then raise exception 'Requested amount must be positive'; end if;
 if p_interest_rate_annual is null or p_interest_rate_annual<0 or p_interest_rate_annual>100 then raise exception 'Interest rate must be between 0 and 100 percent'; end if;
 if p_tenure_months is null or p_tenure_months not between 1 and 360 then raise exception 'Tenure must be between 1 and 360 months'; end if;
 if p_currency_code is null or not exists(select 1 from public.currencies c where c.code=upper(p_currency_code)) then raise exception 'Unsupported currency'; end if;
 if p_loan_purpose is null or length(trim(p_loan_purpose)) not between 3 and 2000 then raise exception 'Enter the loan purpose'; end if;
 select * into v_customer from public.customers c where c.id=p_customer_id and c.status in ('active','approved');
 if not found then raise exception 'Customer must be active or approved'; end if;
 if v_customer.branch_id is not null and v_customer.branch_id<>p_branch_id and not (public.is_active_system_admin() or public.is_active_bank_admin()) and not public.current_employee_has_branch_access(v_customer.branch_id) then raise exception 'Customer belongs to another branch'; end if;
 v_number:='LA-'||to_char(clock_timestamp() at time zone 'UTC','YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.loan_applications(application_number,customer_id,branch_id,requested_amount,currency_code,interest_rate_annual,tenure_months,loan_purpose,collateral_description,guarantor_name,guarantor_phone,submitted_by)
 values(v_number,p_customer_id,p_branch_id,round(p_requested_amount,2),upper(p_currency_code),p_interest_rate_annual,p_tenure_months,trim(p_loan_purpose),nullif(trim(p_collateral_description),''),nullif(trim(p_guarantor_name),''),nullif(trim(p_guarantor_phone),''),v_user) returning * into v_app;
 insert into public.audit_events(branch_id,actor_user_id,event_type,entity_type,entity_id,details)
 values(p_branch_id,v_user,'loan_application_submitted','loan_application',v_app.id,jsonb_build_object('application_number',v_number,'requested_amount',v_app.requested_amount,'currency_code',v_app.currency_code));
 return jsonb_build_object('id',v_app.id,'application_number',v_app.application_number,'status',v_app.status);
end $$;
revoke all on function public.create_loan_application(uuid,uuid,numeric,text,numeric,integer,text,text,text,text) from public,anon;
grant execute on function public.create_loan_application(uuid,uuid,numeric,text,numeric,integer,text,text,text,text) to authenticated;

create or replace function public.list_loan_applications(p_branch_id uuid default null)
returns table(id uuid,application_number text,customer_id uuid,customer_name text,branch_id uuid,branch_name text,requested_amount numeric,currency_code text,interest_rate_annual numeric,tenure_months integer,loan_purpose text,collateral_description text,guarantor_name text,guarantor_phone text,status text,review_note text,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare v_role text:=public.current_employee_role_code();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not (public.is_active_system_admin() or public.is_active_bank_admin() or v_role in ('branch_manager','loan_officer','accountant','auditor')) then raise exception 'Role not authorized to view loan applications'; end if;
 return query select la.id,la.application_number,la.customer_id,c.full_name,la.branch_id,b.branch_name,la.requested_amount,la.currency_code::text,la.interest_rate_annual,la.tenure_months,la.loan_purpose,la.collateral_description,la.guarantor_name,la.guarantor_phone,la.status,la.review_note,la.created_at
 from public.loan_applications la join public.customers c on c.id=la.customer_id join public.branches b on b.id=la.branch_id
 where (p_branch_id is null or la.branch_id=p_branch_id)
 and (public.is_active_system_admin() or (public.is_active_bank_admin() and public.current_employee_has_branch_access(la.branch_id)) or public.current_employee_has_branch_access(la.branch_id) or public.is_active_branch_manager_for(la.branch_id))
 order by la.created_at desc limit 500;
end $$;
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
 if not (public.is_active_system_admin() or public.is_active_bank_admin() or public.is_active_branch_manager_for(v_app.branch_id) or (v_role='loan_officer' and public.current_employee_has_branch_access(v_app.branch_id))) then raise exception 'Not authorized to review this application'; end if;
 if v_app.submitted_by=v_user then raise exception 'Cannot review your own application'; end if;
 if v_app.status not in ('submitted','under_review','more_information_required') then raise exception 'Application is already finalized'; end if;
 update public.loan_applications set status=p_decision,review_note=nullif(trim(p_review_note),''),reviewed_by=v_user,reviewed_at=now(),updated_at=now() where id=p_application_id returning * into v_app;
 insert into public.audit_events(branch_id,actor_user_id,event_type,entity_type,entity_id,details)
 values(v_app.branch_id,v_user,'loan_application_reviewed','loan_application',v_app.id,jsonb_build_object('decision',p_decision,'note',nullif(trim(p_review_note),'')));
 return jsonb_build_object('id',v_app.id,'application_number',v_app.application_number,'status',v_app.status);
end $$;
revoke all on function public.review_loan_application(uuid,text,text) from public,anon;
grant execute on function public.review_loan_application(uuid,text,text) to authenticated;

-- Private object policies for loan application files. Account opening and legacy
-- loan policies remain in private_application_documents.sql.
drop policy if exists "staff_read_loan_application_documents" on storage.objects;
create policy "staff_read_loan_application_documents" on storage.objects for select to authenticated
using(bucket_id='bank-application-documents' and split_part(name,'/',1)='loan-applications'
 and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and exists(select 1 from public.loan_applications la where la.id::text=split_part(name,'/',2)
 and (public.is_active_system_admin() or public.is_active_bank_admin() or public.is_active_branch_manager_for(la.branch_id) or public.current_employee_has_branch_access(la.branch_id))));
drop policy if exists "staff_upload_loan_application_documents" on storage.objects;
create policy "staff_upload_loan_application_documents" on storage.objects for insert to authenticated
with check(bucket_id='bank-application-documents' and split_part(name,'/',1)='loan-applications' and storage.extension(name) in ('pdf','jpg','jpeg','png')
 and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and exists(select 1 from public.loan_applications la where la.id::text=split_part(name,'/',2)
 and (public.is_active_system_admin() or public.is_active_bank_admin() or public.is_active_branch_manager_for(la.branch_id) or public.current_employee_has_branch_access(la.branch_id))));
drop policy if exists "staff_delete_loan_application_documents" on storage.objects;
create policy "staff_delete_loan_application_documents" on storage.objects for delete to authenticated
using(bucket_id='bank-application-documents' and split_part(name,'/',1)='loan-applications'
 and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and exists(select 1 from public.loan_applications la where la.id::text=split_part(name,'/',2)
 and (public.is_active_system_admin() or public.is_active_bank_admin() or public.is_active_branch_manager_for(la.branch_id) or public.current_employee_has_branch_access(la.branch_id))));
