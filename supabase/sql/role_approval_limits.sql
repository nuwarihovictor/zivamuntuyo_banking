-- Configurable role-based approval limits with server-side enforcement.
create table if not exists public.role_approval_limits (
  id uuid primary key default gen_random_uuid(),
  role_code text not null,
  action_type text not null check (action_type in ('cash_transaction','loan','overdraft','account_opening')),
  currency_code char(3) not null default 'UGX' references public.currencies(code),
  branch_id uuid references public.branches(id),
  max_amount numeric(14,2) check (max_amount is null or max_amount >= 0),
  is_unlimited boolean not null default false,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (not (is_unlimited and max_amount is not null))
);
create unique index if not exists role_approval_limits_scope_unique
on public.role_approval_limits(role_code,action_type,currency_code,coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid));
alter table public.role_approval_limits enable row level security;
drop policy if exists "Approval limits visible to authorized staff" on public.role_approval_limits;
create policy "Approval limits visible to authorized staff" on public.role_approval_limits for select to authenticated
using (public.current_employee_role_code() in ('system_admin','general_manager','bank_admin','branch_manager','teller','accountant'));
grant select on public.role_approval_limits to authenticated;
revoke insert,update,delete on public.role_approval_limits from public,anon,authenticated;

-- Starter policy. Branch-manager limits are editable by the General Manager/System Administrator.
insert into public.role_approval_limits(role_code,action_type,currency_code,branch_id,max_amount,is_unlimited)
values
 ('teller','cash_transaction','UGX',null,5000000,false),
 ('branch_manager','cash_transaction','UGX',null,10000000,false),
 ('branch_manager','loan','UGX',null,10000000,false),
 ('branch_manager','overdraft','UGX',null,5000000,false),
 ('branch_manager','account_opening','UGX',null,30000,false),
 ('bank_admin','cash_transaction','UGX',null,10000000,false),
 ('bank_admin','loan','UGX',null,10000000,false),
 ('bank_admin','overdraft','UGX',null,5000000,false),
 ('bank_admin','account_opening','UGX',null,30000,false),
 ('general_manager','cash_transaction','UGX',null,null,true),
 ('general_manager','loan','UGX',null,null,true),
 ('general_manager','overdraft','UGX',null,null,true),
 ('general_manager','account_opening','UGX',null,null,true),
 ('system_admin','cash_transaction','UGX',null,null,true),
 ('system_admin','loan','UGX',null,null,true),
 ('system_admin','overdraft','UGX',null,null,true),
 ('system_admin','account_opening','UGX',null,null,true)
on conflict do nothing;

create or replace function public.approval_limit_allows(
  p_role_code text,p_action_type text,p_branch_id uuid,p_currency_code text,p_amount numeric
) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp
as $function$
declare v_limit public.role_approval_limits%rowtype;
begin
 if p_amount is null or p_amount<0 then return false; end if;
 select * into v_limit from public.role_approval_limits
 where role_code=p_role_code and action_type=p_action_type and currency_code=upper(p_currency_code)
   and is_active and (branch_id=p_branch_id or branch_id is null)
 order by (branch_id is not null) desc limit 1;
 if not found then return false; end if;
 return v_limit.is_unlimited or (v_limit.max_amount is not null and p_amount<=v_limit.max_amount);
end;
$function$;
revoke all on function public.approval_limit_allows(text,text,uuid,text,numeric) from public,anon;
grant execute on function public.approval_limit_allows(text,text,uuid,text,numeric) to authenticated;

create or replace function public.set_role_approval_limit(
 p_role_code text,p_action_type text,p_currency_code text,p_branch_id uuid,
 p_max_amount numeric,p_is_unlimited boolean,p_reason text
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if public.current_employee_role_code() not in ('general_manager','system_admin') then raise exception 'Only the General Manager/System Administrator can change approval limits'; end if;
 if p_role_code not in ('teller','branch_manager','bank_admin','accountant','loan_officer','general_manager','system_admin') then raise exception 'Unknown staff role'; end if;
 if p_action_type not in ('cash_transaction','loan','overdraft','account_opening') then raise exception 'Unknown approval action'; end if;
 if p_currency_code is null or not exists(select 1 from public.currencies where code=upper(p_currency_code) and is_active) then raise exception 'Choose an active currency'; end if;
 if p_is_unlimited and p_max_amount is not null then raise exception 'Unlimited approvals cannot also have a maximum amount'; end if;
 if not p_is_unlimited and (p_max_amount is null or p_max_amount<0) then raise exception 'Enter a non-negative maximum amount'; end if;
 if p_reason is null or length(trim(p_reason))<3 then raise exception 'A reason of at least 3 characters is required'; end if;
 if p_role_code in ('general_manager','system_admin') and not p_is_unlimited then
   raise exception 'The General Manager/System Administrator policy is unlimited by design; restrict access by changing role assignment, not by weakening the executive policy';
 end if;
 insert into public.role_approval_limits(role_code,action_type,currency_code,branch_id,max_amount,is_unlimited,is_active,updated_by,updated_at)
 values(p_role_code,p_action_type,upper(p_currency_code),p_branch_id,p_max_amount,p_is_unlimited,true,auth.uid(),now())
 on conflict (role_code,action_type,currency_code,coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid))
 do update set max_amount=excluded.max_amount,is_unlimited=excluded.is_unlimited,is_active=true,updated_by=auth.uid(),updated_at=now();
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
 values(auth.uid(),p_branch_id,'role_approval_limit_changed','role_approval_limit',p_role_code||':'||p_action_type,'success',
 jsonb_build_object('role_code',p_role_code,'action_type',p_action_type,'currency_code',upper(p_currency_code),'max_amount',p_max_amount,'is_unlimited',p_is_unlimited,'reason',trim(p_reason)));
end;
$function$;
revoke all on function public.set_role_approval_limit(text,text,text,uuid,numeric,boolean,text) from public,anon;
grant execute on function public.set_role_approval_limit(text,text,text,uuid,numeric,boolean,text) to authenticated;

create or replace function public.approve_cash_transaction_request(p_journal_id uuid)
returns table(journal_id uuid,journal_number text,journal_status text)
language plpgsql security definer set search_path=''
as $function$
declare
 v_role text; v_branch uuid; v_status text; v_requester uuid; v_type text; v_amount numeric; v_currency text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.employee_profiles ep where ep.user_id=auth.uid() and ep.is_active=true) then raise exception 'Active employee profile required' using errcode='42501'; end if;
 v_role:=public.current_employee_role_code();
 if v_role is null or v_role not in ('system_admin','general_manager','bank_admin','branch_manager','teller') then raise exception 'Your role cannot approve cash transaction requests' using errcode='42501'; end if;
 select j.status,j.created_by,j.request_transaction_type,b.branch_id,j.requested_amount,b.currency_code
 into v_status,v_requester,v_type,v_branch,v_amount,v_currency
 from public.ledger_journals j join public.bank_accounts b on b.id=j.requested_account_id
 where j.id=p_journal_id for update of j;
 if not found then raise exception 'Cash transaction request not found'; end if;
 if v_status<>'pending_approval' or v_type not in ('deposit','withdrawal') then raise exception 'Only pending cash transaction requests can be approved'; end if;
 if v_requester=auth.uid() then raise exception 'The requester cannot approve their own transaction'; end if;
 if not public.current_employee_can_transact_in_branch(v_branch) then raise exception 'Branch access denied' using errcode='42501'; end if;
 if not public.approval_limit_allows(v_role,'cash_transaction',v_branch,v_currency,v_amount) then raise exception 'This transaction exceeds your configured approval limit. Escalate it to an authorized higher approver.'; end if;
 update public.ledger_journals set approved_by=auth.uid(),approved_at=now() where id=p_journal_id;
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
 values(auth.uid(),v_branch,'cash_transaction_approved','ledger_journal',p_journal_id::text,'success',
 jsonb_build_object('requester_user_id',v_requester,'transaction_type',v_type,'amount',v_amount,'approval_role',v_role));
 return query select j.id,j.journal_number,j.status from public.ledger_journals j where j.id=p_journal_id;
end;
$function$;

create or replace function public.review_loan_application(p_application_id uuid,p_decision text,p_review_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_app public.loan_applications%rowtype; v_user uuid:=auth.uid(); v_role text:=public.current_employee_role_code();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_decision not in ('under_review','more_information_required','approved','rejected') then raise exception 'Invalid review decision'; end if;
 select * into v_app from public.loan_applications where id=p_application_id for update;
 if not found then raise exception 'Loan application not found'; end if;
 if not (v_role in ('general_manager','system_admin','bank_admin') or (v_role in ('branch_manager','loan_officer') and public.current_employee_has_branch_access(v_app.branch_id))) then raise exception 'Not authorized to review this application'; end if;
 if v_app.submitted_by=v_user then raise exception 'The submitter cannot review their own application'; end if;
 if v_app.status not in ('submitted','under_review','more_information_required') then raise exception 'This application is already finalized'; end if;
 if p_decision='approved' and not public.approval_limit_allows(v_role,'loan',v_app.branch_id,v_app.currency_code,v_app.requested_amount) then
   raise exception 'This loan exceeds your configured approval limit. Escalate it to the General Manager or an authorized higher approver.';
 end if;
 update public.loan_applications set status=p_decision,review_note=nullif(trim(p_review_note),''),reviewed_by=v_user,reviewed_at=now(),updated_at=now() where id=p_application_id returning * into v_app;
 insert into public.audit_events(branch_id,actor_user_id,action,entity_type,entity_id,details)
 values(v_app.branch_id,v_user,'loan_application_reviewed','loan_application',v_app.id::text,jsonb_build_object('decision',p_decision,'note',nullif(trim(p_review_note),''),'requested_amount',v_app.requested_amount,'approval_role',v_role));
 return jsonb_build_object('id',v_app.id,'application_number',v_app.application_number,'status',v_app.status);
end;
$function$;

-- General Manager is allowed to approve account opening at any branch.
create or replace function public.approve_account_request(p_account_id uuid)
returns table(account_id uuid,account_number text,account_status text)
language plpgsql security definer set search_path=''
as $function$
declare v_role text; v_branch uuid; v_status text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.employee_profiles ep where ep.user_id=auth.uid() and ep.is_active=true) then raise exception 'Active employee profile required'; end if;
 v_role:=public.current_employee_role_code();
 if v_role is null or v_role not in ('system_admin','general_manager','bank_admin','branch_manager') then raise exception 'Only an authorized administrator or branch manager may approve accounts'; end if;
 select ba.branch_id,ba.status into v_branch,v_status from public.bank_accounts ba where ba.id=p_account_id for update;
 if not found then raise exception 'Account request not found'; end if;
 if not (v_role in ('system_admin','general_manager','bank_admin') or public.is_active_branch_manager_for(v_branch)) then raise exception 'You are not authorized to approve accounts for this branch'; end if;
 if v_status<>'pending_approval' then raise exception 'Only pending account requests can be approved'; end if;
 update public.bank_accounts set status='active',opened_at=coalesce(opened_at,now()),rejection_reason=null,approved_by=auth.uid(),approved_at=now() where id=p_account_id;
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
 values(auth.uid(),v_branch,'account_request_approved','bank_account',p_account_id::text,'success','{}'::jsonb);
 return query select ba.id,ba.account_number,ba.status from public.bank_accounts ba where ba.id=p_account_id;
end;
$function$;
