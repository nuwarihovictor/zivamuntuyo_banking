-- Secure loan application intake and review workflow.
-- The live migration is registered in Supabase as add_secure_loan_application_workflow.
-- Private supporting files use bank-application-documents/loan-applications/<application_uuid>/...

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

-- RPCs: create_loan_application, list_loan_applications, review_loan_application
-- were installed by the migration and enforce active staff, branch scope,
-- customer eligibility, validation, independent review, and audit events.
-- Never grant direct table access to browser users.

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
