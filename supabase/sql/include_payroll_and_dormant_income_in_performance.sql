-- Include manually-posted payroll and dormant-account fee journals in management performance reports
-- without posting them to the GL a second time.
create or replace function public.get_financial_performance(
  p_branch_id uuid default null,
  p_start_date date default null,
  p_end_date date default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  role_code text := public.current_employee_role_code();
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if role_code is null or role_code not in ('system_admin','bank_admin','branch_manager','accountant','general_manager') then
    raise exception 'Finance reporting permission required';
  end if;
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'Start date must not be after end date';
  end if;
  if p_branch_id is not null and not public.current_employee_can_transact_in_branch(p_branch_id) then
    raise exception 'Branch access denied';
  end if;

  with activity_rows as (
    select f.branch_id, f.event_date, f.category, f.profit_loss_type,
           f.amount, f.cash_in, f.cash_out
    from public.financial_activity_ledger f
    where public.current_employee_can_transact_in_branch(f.branch_id)
      and (p_branch_id is null or f.branch_id=p_branch_id)
      and (p_start_date is null or f.event_date>=p_start_date)
      and (p_end_date is null or f.event_date<=p_end_date)

    union all

    select b.branch_id, b.payroll_date, 'institutional_payroll_commission'::text,
           'income'::text, b.commission_total, 0::numeric, 0::numeric
    from public.institution_payroll_batches b
    where b.status='posted' and b.commission_total>0
      and public.current_employee_can_transact_in_branch(b.branch_id)
      and (p_branch_id is null or b.branch_id=p_branch_id)
      and (p_start_date is null or b.payroll_date>=p_start_date)
      and (p_end_date is null or b.payroll_date<=p_end_date)
      and not exists (
        select 1 from public.financial_activity_ledger f
        where f.source_table='institution_payroll_batches' and f.source_id=b.id
      )

    union all

    select t.branch_id, (t.created_at at time zone 'Africa/Kampala')::date,
           'dormant_reactivation_fee'::text, 'income'::text, t.amount,
           case when t.narration ilike '%paid by cash%' then t.amount else 0::numeric end,
           0::numeric
    from public.transactions t
    where t.status='posted' and t.transaction_type='dormant_reactivation_fee'
      and public.current_employee_can_transact_in_branch(t.branch_id)
      and (p_branch_id is null or t.branch_id=p_branch_id)
      and (p_start_date is null or (t.created_at at time zone 'Africa/Kampala')::date>=p_start_date)
      and (p_end_date is null or (t.created_at at time zone 'Africa/Kampala')::date<=p_end_date)
      and not exists (
        select 1 from public.financial_activity_ledger f
        where f.source_table='transactions' and f.source_id=t.id
      )
  )
  select jsonb_build_object(
    'period_start',p_start_date,
    'period_end',p_end_date,
    'branch_id',p_branch_id,
    'income_total',coalesce(sum(amount) filter(where profit_loss_type='income'),0),
    'expense_total',coalesce(sum(amount) filter(where profit_loss_type='expense'),0),
    'operating_surplus',coalesce(sum(amount) filter(where profit_loss_type='income'),0)-coalesce(sum(amount) filter(where profit_loss_type='expense'),0),
    'share_capital_total',coalesce(sum(amount) filter(where profit_loss_type='equity'),0),
    'restricted_reserve_total',coalesce(sum(amount) filter(where category='security_reserve'),0)-coalesce(sum(amount) filter(where category='account_security_fee'),0),
    'cash_in_total',coalesce(sum(cash_in),0),
    'cash_out_total',coalesce(sum(cash_out),0),
    'event_count',count(*),
    'by_category',coalesce((
      select jsonb_agg(jsonb_build_object('category',x.category,'profit_loss_type',x.profit_loss_type,'amount',x.total_amount,'cash_in',x.cash_in,'cash_out',x.cash_out,'count',x.n) order by x.category)
      from (
        select category,profit_loss_type,sum(amount) total_amount,sum(cash_in) cash_in,sum(cash_out) cash_out,count(*) n
        from activity_rows group by category,profit_loss_type
      ) x
    ),'[]'::jsonb),
    'monthly_trend',coalesce((
      select jsonb_agg(jsonb_build_object('month',x.month_key,'income',x.income,'expenses',x.expenses,'surplus',x.income-x.expenses,'share_capital',x.share_capital) order by x.month_key)
      from (
        select to_char(date_trunc('month',event_date),'YYYY-MM') month_key,
          coalesce(sum(amount) filter(where profit_loss_type='income'),0) income,
          coalesce(sum(amount) filter(where profit_loss_type='expense'),0) expenses,
          coalesce(sum(amount) filter(where profit_loss_type='equity'),0) share_capital
        from activity_rows group by date_trunc('month',event_date)
      ) x
    ),'[]'::jsonb)
  ) into result
  from activity_rows;

  return result;
end;
$function$;

revoke all on function public.get_financial_performance(uuid,date,date) from public, anon;
grant execute on function public.get_financial_performance(uuid,date,date) to authenticated;