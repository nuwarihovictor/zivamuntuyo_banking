-- Payroll evidence, receipt uniqueness, and posted journal integrity.
create unique index if not exists account_opening_receipt_number_uq on public.account_opening_collections(receipt_number);
create unique index if not exists institution_payroll_reference_uq on public.institution_payroll_batches(payroll_reference);
create unique index if not exists institution_payroll_transaction_reference_uq on public.institution_payroll_items(transaction_reference);

create table if not exists public.institution_payroll_evidence (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null unique references public.institution_payroll_batches(id) on delete restrict,
 payroll_list_object_path text not null,
 withdrawal_slip_object_path text not null,
 signers jsonb not null,
 uploaded_by uuid not null references auth.users(id),
 uploaded_at timestamptz not null default now(),
 constraint payroll_evidence_signers_array check(jsonb_typeof(signers)='array'),
 constraint payroll_evidence_signer_count check(jsonb_array_length(signers) between 2 and 3),
 constraint payroll_evidence_distinct_documents check(payroll_list_object_path<>withdrawal_slip_object_path),
 constraint payroll_evidence_list_path check(payroll_list_object_path like 'institution-payroll/%/payroll-list.%'),
 constraint payroll_evidence_slip_path check(withdrawal_slip_object_path like 'institution-payroll/%/withdrawal-slip.%')
);
alter table public.institution_payroll_evidence enable row level security;
drop policy if exists "Payroll evidence visible to authorized branch staff" on public.institution_payroll_evidence;
create policy "Payroll evidence visible to authorized branch staff" on public.institution_payroll_evidence for select to authenticated using (
 exists(select 1 from public.institution_payroll_batches b where b.id=batch_id
 and public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager','teller')
 and public.current_employee_can_transact_in_branch(b.branch_id)));
grant select on public.institution_payroll_evidence to authenticated;
revoke insert,update,delete on public.institution_payroll_evidence from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('institution-payroll-evidence','institution-payroll-evidence',false,15728640,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['application/pdf','image/jpeg','image/png'];
drop policy if exists "Authorized staff can read payroll evidence files" on storage.objects;
create policy "Authorized staff can read payroll evidence files" on storage.objects for select to authenticated using (
 bucket_id='institution-payroll-evidence' and (storage.foldername(name))[1]='institution-payroll'
 and exists(select 1 from public.institution_payroll_batches b where b.id::text=(storage.foldername(name))[2]
 and public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager','teller')
 and public.current_employee_can_transact_in_branch(b.branch_id)));
drop policy if exists "Authorized staff can upload payroll evidence files" on storage.objects;
create policy "Authorized staff can upload payroll evidence files" on storage.objects for insert to authenticated with check (
 bucket_id='institution-payroll-evidence' and (storage.foldername(name))[1]='institution-payroll'
 and exists(select 1 from public.institution_payroll_batches b where b.id::text=(storage.foldername(name))[2]
 and public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','teller')
 and public.current_employee_can_transact_in_branch(b.branch_id)));

create or replace function public.attach_institution_payroll_evidence(p_batch_id uuid,p_payroll_list_object_path text,p_withdrawal_slip_object_path text,p_signers jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_user uuid:=auth.uid(); v_role text:=public.current_employee_role_code(); v_batch public.institution_payroll_batches%rowtype;
 v_list text:=trim(coalesce(p_payroll_list_object_path,'')); v_slip text:=trim(coalesce(p_withdrawal_slip_object_path,'')); v_count integer;
begin
 if v_user is null then raise exception 'Sign-in required'; end if;
 if v_role is null or v_role not in ('system_admin','bank_admin','branch_manager','accountant','teller') then raise exception 'Your role cannot attach payroll evidence'; end if;
 select * into v_batch from public.institution_payroll_batches where id=p_batch_id for update;
 if not found then raise exception 'Payroll batch not found'; end if;
 if not public.current_employee_can_transact_in_branch(v_batch.branch_id) then raise exception 'Branch access denied'; end if;
 if v_batch.status<>'posted' then raise exception 'Evidence can only be attached to a posted payroll batch'; end if;
 if jsonb_typeof(p_signers)<>'array' then raise exception 'Provide two or three responsible signers'; end if;
 v_count:=jsonb_array_length(p_signers);
 if v_count<2 or v_count>3 then raise exception 'At least two and no more than three responsible signers are required'; end if;
 if exists(select 1 from jsonb_array_elements(p_signers) s where length(trim(coalesce(s->>'name','')))<2 or length(trim(coalesce(s->>'role','')))<2 or coalesce((s->>'signed')::boolean,false) is not true) then raise exception 'Each signer must have a name, role, and confirmed signature on the physical documents'; end if;
 if v_list !~ ('^institution-payroll/'||p_batch_id::text||'/payroll-list[.](pdf|jpg|jpeg|png)$') or v_slip !~ ('^institution-payroll/'||p_batch_id::text||'/withdrawal-slip[.](pdf|jpg|jpeg|png)$') then raise exception 'Use this payroll batch folder and payroll-list/withdrawal-slip filenames for both scans'; end if;
 insert into public.institution_payroll_evidence(batch_id,payroll_list_object_path,withdrawal_slip_object_path,signers,uploaded_by)
 values(p_batch_id,v_list,v_slip,p_signers,v_user) on conflict(batch_id) do update set payroll_list_object_path=excluded.payroll_list_object_path,withdrawal_slip_object_path=excluded.withdrawal_slip_object_path,signers=excluded.signers,uploaded_by=excluded.uploaded_by,uploaded_at=now();
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details) values(v_user,v_batch.branch_id,'institution_payroll_evidence_attached','institution_payroll_batch',p_batch_id::text,'success',jsonb_build_object('payroll_reference',v_batch.payroll_reference,'signer_count',v_count,'payroll_list_object_path',v_list,'withdrawal_slip_object_path',v_slip));
 return jsonb_build_object('batch_id',p_batch_id,'payroll_reference',v_batch.payroll_reference,'signer_count',v_count,'evidence_attached',true,'uploaded_at',now());
end;$function$;
revoke all on function public.attach_institution_payroll_evidence(uuid,text,text,jsonb) from public,anon;
grant execute on function public.attach_institution_payroll_evidence(uuid,text,text,jsonb) to authenticated;

create or replace function public.check_posted_journal_balance(p_branch_id uuid default null)
returns table(journal_id uuid,journal_number text,branch_id uuid,total_debits numeric,total_credits numeric,difference numeric)
language sql stable security definer set search_path=public,pg_temp as $function$
 select j.id,j.journal_number,j.branch_id,
 coalesce(sum(e.amount) filter(where e.entry_side='debit'),0)::numeric,
 coalesce(sum(e.amount) filter(where e.entry_side='credit'),0)::numeric,
 (coalesce(sum(e.amount) filter(where e.entry_side='debit'),0)-coalesce(sum(e.amount) filter(where e.entry_side='credit'),0))::numeric
 from public.ledger_journals j left join public.ledger_entries e on e.journal_id=j.id
 where j.status='posted' and (p_branch_id is null or j.branch_id=p_branch_id)
 and public.current_employee_can_transact_in_branch(j.branch_id)
 and public.current_employee_role_code() in ('system_admin','bank_admin','branch_manager','accountant','general_manager')
 group by j.id,j.journal_number,j.branch_id
 having abs(coalesce(sum(e.amount) filter(where e.entry_side='debit'),0)-coalesce(sum(e.amount) filter(where e.entry_side='credit'),0))>0.005
$function$;
revoke all on function public.check_posted_journal_balance(uuid) from public,anon;
grant execute on function public.check_posted_journal_balance(uuid) to authenticated;
