-- Loan product rates, General Manager-only changes, and fixed overdraft policy.
insert into public.staff_roles(role_code,role_name,description,is_system_role)
values ('general_manager','General Manager','Authorises loan interest-rate policy changes and senior lending oversight.',true)
on conflict (role_code) do update set role_name=excluded.role_name,description=excluded.description;

alter table public.loan_product_rates drop constraint if exists loan_product_rates_overdraft_fixed_check;
alter table public.loan_product_rates add constraint loan_product_rates_overdraft_fixed_check
check (product_code <> 'overdraft' or (rate_percent=5.0000 and rate_period='monthly' and editable_by_general_manager=false));

create or replace function public.list_loan_product_rates()
returns table(product_code text,product_name text,description text,rate_percent numeric,rate_period text,editable_by_general_manager boolean,updated_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return query select r.product_code,r.product_name,r.description,r.rate_percent,r.rate_period,r.editable_by_general_manager,r.updated_at
 from public.loan_product_rates r order by r.product_name;
end;
$$;
revoke all on function public.list_loan_product_rates() from public,anon;
grant execute on function public.list_loan_product_rates() to authenticated;

create or replace function public.update_loan_product_rate(p_product_code text,p_interest_rate numeric,p_rate_period text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_product public.loan_product_rates%rowtype; v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if public.current_employee_role_code()<>'general_manager' then raise exception 'Only the General Manager may change loan interest rates'; end if;
 if p_interest_rate is null or p_interest_rate<0 or p_interest_rate>100 then raise exception 'Rate must be between 0 and 100'; end if;
 if p_rate_period not in ('monthly','annual') then raise exception 'Choose monthly or annual'; end if;
 if p_reason is null or length(trim(p_reason))<8 then raise exception 'Provide a reason of at least 8 characters for the rate change'; end if;
 select * into v_product from public.loan_product_rates where product_code=p_product_code for update;
 if not found then raise exception 'Loan product not found'; end if;
 if not v_product.editable_by_general_manager or v_product.product_code='overdraft' then raise exception 'The overdraft rate is fixed at 5 percent per month'; end if;
 update public.loan_product_rates set rate_percent=p_interest_rate,rate_period=p_rate_period,updated_by=v_user,updated_at=now() where product_code=p_product_code;
 insert into public.audit_events(branch_id,actor_user_id,action,entity_type,entity_id,details)
 values(null,v_user,'loan_interest_rate_changed','loan_product_rate',v_product.product_code,
 jsonb_build_object('old_rate',v_product.rate_percent,'old_period',v_product.rate_period,'new_rate',p_interest_rate,'new_period',p_rate_period,'reason',trim(p_reason)));
 return jsonb_build_object('product_code',v_product.product_code,'rate_percent',p_interest_rate,'rate_period',p_rate_period);
end;
$$;
revoke all on function public.update_loan_product_rate(text,numeric,text,text) from public,anon;
grant execute on function public.update_loan_product_rate(text,numeric,text,text) to authenticated;

-- Keep loan application documents private and scoped to the application branch.
drop policy if exists "staff_upload_loan_application_documents" on storage.objects;
create policy "staff_upload_loan_application_documents" on storage.objects for insert to authenticated with check (
 bucket_id='bank-application-documents' and split_part(name,'/',1)='loan-applications'
 and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and storage.extension(name) in ('pdf','jpg','jpeg','png')
 and exists(select 1 from public.loan_applications la where la.id::text=split_part(name,'/',2)
 and (public.is_active_system_admin() or public.is_active_bank_admin() or public.is_active_branch_manager_for(la.branch_id) or public.current_employee_has_branch_access(la.branch_id)))
);
drop policy if exists "staff_read_loan_application_documents" on storage.objects;
create policy "staff_read_loan_application_documents" on storage.objects for select to authenticated using (
 bucket_id='bank-application-documents' and split_part(name,'/',1)='loan-applications'
 and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and exists(select 1 from public.loan_applications la where la.id::text=split_part(name,'/',2)
 and (public.is_active_system_admin() or public.is_active_bank_admin() or public.is_active_branch_manager_for(la.branch_id) or public.current_employee_has_branch_access(la.branch_id)))
);
drop policy if exists "staff_delete_loan_application_documents" on storage.objects;
create policy "staff_delete_loan_application_documents" on storage.objects for delete to authenticated using (
 bucket_id='bank-application-documents' and split_part(name,'/',1)='loan-applications'
 and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and exists(select 1 from public.loan_applications la where la.id::text=split_part(name,'/',2)
 and (public.is_active_system_admin() or public.is_active_bank_admin() or public.is_active_branch_manager_for(la.branch_id) or public.current_employee_has_branch_access(la.branch_id)))
);
