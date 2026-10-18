-- Private supporting documents for account opening and existing loan records.
-- Applied to project hwghiezvghdqxnhcnpwk on 2026-10-18.
-- Files are stored under:
--   account-opening/<customer_uuid>/<category>-<timestamp>-<filename>
--   loans/<loan_uuid>/<category>-<timestamp>-<filename>
-- The bucket is private; every object read/write is scoped to staff branch access.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('bank-application-documents','bank-application-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "staff_read_authorized_application_documents" on storage.objects;
create policy "staff_read_authorized_application_documents" on storage.objects
for select to authenticated using (
 bucket_id='bank-application-documents' and (
  (split_part(name,'/',1)='loans'
   and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and exists(select 1 from public.loans l where l.id::text=split_part(name,'/',2)
    and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(l.branch_id) or public.current_employee_has_branch_access(l.branch_id))))
  or
  (split_part(name,'/',1)='account-opening'
   and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and exists(select 1 from public.customers c where c.id::text=split_part(name,'/',2) and ((c.branch_id is not null and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(c.branch_id) or public.current_employee_has_branch_access(c.branch_id)))
    or exists(select 1 from public.account_holders ah join public.bank_accounts ba on ba.id=ah.account_id where ah.customer_id=c.id and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(ba.branch_id) or public.current_employee_has_branch_access(ba.branch_id)))))
 ));

drop policy if exists "staff_upload_authorized_application_documents" on storage.objects;
create policy "staff_upload_authorized_application_documents" on storage.objects
for insert to authenticated with check (
 bucket_id='bank-application-documents' and storage.extension(name) in ('pdf','jpg','jpeg','png') and (
  (split_part(name,'/',1)='loans'
   and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and exists(select 1 from public.loans l where l.id::text=split_part(name,'/',2)
    and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(l.branch_id) or public.current_employee_has_branch_access(l.branch_id))))
  or
  (split_part(name,'/',1)='account-opening'
   and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and exists(select 1 from public.customers c where c.id::text=split_part(name,'/',2) and ((c.branch_id is not null and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(c.branch_id) or public.current_employee_has_branch_access(c.branch_id)))
    or exists(select 1 from public.account_holders ah join public.bank_accounts ba on ba.id=ah.account_id where ah.customer_id=c.id and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(ba.branch_id) or public.current_employee_has_branch_access(ba.branch_id)))))
 ));

drop policy if exists "staff_delete_authorized_application_documents" on storage.objects;
create policy "staff_delete_authorized_application_documents" on storage.objects
for delete to authenticated using (
 bucket_id='bank-application-documents' and (
  (split_part(name,'/',1)='loans'
   and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and exists(select 1 from public.loans l where l.id::text=split_part(name,'/',2)
    and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(l.branch_id) or public.current_employee_has_branch_access(l.branch_id))))
  or
  (split_part(name,'/',1)='account-opening'
   and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and exists(select 1 from public.customers c where c.id::text=split_part(name,'/',2) and ((c.branch_id is not null and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(c.branch_id) or public.current_employee_has_branch_access(c.branch_id)))
    or exists(select 1 from public.account_holders ah join public.bank_accounts ba on ba.id=ah.account_id where ah.customer_id=c.id and (public.is_active_bank_admin() or public.is_active_system_admin() or public.is_active_branch_manager_for(ba.branch_id) or public.current_employee_has_branch_access(ba.branch_id)))))
 ));
