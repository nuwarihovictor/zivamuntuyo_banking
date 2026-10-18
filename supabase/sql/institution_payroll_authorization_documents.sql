-- Institutional payroll authorization and document evidence.
-- Store file bytes in a PRIVATE Supabase Storage bucket; this migration stores paths and audit metadata.
create table if not exists public.institution_payroll_signatories (
 id uuid primary key default gen_random_uuid(),
 institution_account_id uuid not null references public.bank_accounts(id) on delete restrict,
 signatory_name text not null check(length(trim(signatory_name))>=2),
 position_title text not null check(length(trim(position_title))>=2),
 employee_reference text,
 signature_specimen_object_path text,
 is_active boolean not null default true,
 valid_from date not null default timezone('Africa/Kampala',now())::date,
 valid_until date,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check(valid_until is null or valid_until>=valid_from)
);
create index if not exists institution_payroll_signatories_account_idx on public.institution_payroll_signatories(institution_account_id,is_active);
create table if not exists public.institution_payroll_authorizations (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.institution_payroll_batches(id) on delete restrict,
 signatory_id uuid not null references public.institution_payroll_signatories(id) on delete restrict,
 signed_document_object_path text not null,
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 verification_notes text,
 created_at timestamptz not null default now(),
 unique(batch_id,signatory_id),
 check ((verified_by is null and verified_at is null) or (verified_by is not null and verified_at is not null))
);
create table if not exists public.institution_payroll_documents (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.institution_payroll_batches(id) on delete restrict,
 document_type text not null check(document_type in ('signed_employee_salary_list','signed_withdrawal_slip','salary_advance_authorization','other_supporting_document')),
 object_path text not null,
 original_filename text not null,
 content_type text not null,
 file_size_bytes bigint not null check(file_size_bytes>0 and file_size_bytes<=20971520),
 sha256_hex text check(sha256_hex is null or sha256_hex ~ '^[0-9a-fA-F]{64}$'),
 uploaded_by uuid not null references auth.users(id),
 uploaded_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_status text not null default 'pending' check(review_status in ('pending','accepted','rejected')),
 review_notes text,
 unique(batch_id,document_type,object_path),
 check ((review_status='pending' and reviewed_by is null and reviewed_at is null) or (review_status<>'pending' and reviewed_by is not null and reviewed_at is not null))
);
create index if not exists institution_payroll_documents_batch_idx on public.institution_payroll_documents(batch_id,document_type,uploaded_at);
alter table public.institution_payroll_signatories enable row level security;
alter table public.institution_payroll_authorizations enable row level security;
alter table public.institution_payroll_documents enable row level security;
drop policy if exists "Authorized staff can view institution payroll signatories" on public.institution_payroll_signatories;
create policy "Authorized staff can view institution payroll signatories" on public.institution_payroll_signatories for select to authenticated using (exists(select 1 from public.bank_accounts ba where ba.id=institution_account_id and public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager','teller') and public.current_employee_can_transact_in_branch(ba.branch_id)));
drop policy if exists "Authorized staff can view payroll authorizations" on public.institution_payroll_authorizations;
create policy "Authorized staff can view payroll authorizations" on public.institution_payroll_authorizations for select to authenticated using (exists(select 1 from public.institution_payroll_batches b where b.id=batch_id and public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager','teller') and public.current_employee_can_transact_in_branch(b.branch_id)));
drop policy if exists "Authorized staff can view payroll documents" on public.institution_payroll_documents;
create policy "Authorized staff can view payroll documents" on public.institution_payroll_documents for select to authenticated using (exists(select 1 from public.institution_payroll_batches b where b.id=batch_id and public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager','teller') and public.current_employee_can_transact_in_branch(b.branch_id)));
grant select on public.institution_payroll_signatories,public.institution_payroll_authorizations,public.institution_payroll_documents to authenticated;
revoke insert,update,delete on public.institution_payroll_signatories,public.institution_payroll_authorizations,public.institution_payroll_documents from anon,authenticated;
