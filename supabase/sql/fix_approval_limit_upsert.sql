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
 if p_role_code in ('general_manager','system_admin') and not p_is_unlimited then raise exception 'The General Manager/System Administrator policy is unlimited by design; restrict access by changing role assignment, not by weakening the executive policy'; end if;
 update public.role_approval_limits
 set max_amount=p_max_amount,is_unlimited=p_is_unlimited,is_active=true,updated_by=auth.uid(),updated_at=now()
 where role_code=p_role_code and action_type=p_action_type and currency_code=upper(p_currency_code)
   and branch_id is not distinct from p_branch_id;
 if not found then
   insert into public.role_approval_limits(role_code,action_type,currency_code,branch_id,max_amount,is_unlimited,is_active,updated_by,updated_at)
   values(p_role_code,p_action_type,upper(p_currency_code),p_branch_id,p_max_amount,p_is_unlimited,true,auth.uid(),now());
 end if;
 insert into public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
 values(auth.uid(),p_branch_id,'role_approval_limit_changed','role_approval_limit',p_role_code||':'||p_action_type,'success',
 jsonb_build_object('role_code',p_role_code,'action_type',p_action_type,'currency_code',upper(p_currency_code),'max_amount',p_max_amount,'is_unlimited',p_is_unlimited,'reason',trim(p_reason)));
end;
$function$;
revoke all on function public.set_role_approval_limit(text,text,text,uuid,numeric,boolean,text) from public,anon;
grant execute on function public.set_role_approval_limit(text,text,text,uuid,numeric,boolean,text) to authenticated;