-- Make account request creation and UGX 30,000 package collection one atomic database transaction.
-- If any allocation, receipt, trigger or ledger posting fails, the entire RPC rolls back.
create or replace function public.create_bank_account_request_with_opening_package(
  p_customer_id uuid,
  p_branch_id uuid,
  p_account_type_id uuid,
  p_product_type text,
  p_currency_code text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_request record;
  v_package jsonb;
begin
  select * into v_request
  from public.create_bank_account_request(
    p_customer_id,
    p_branch_id,
    p_account_type_id,
    p_product_type,
    p_currency_code
  );

  if v_request.account_id is null then
    raise exception 'Account request could not be created';
  end if;

  v_package := public.record_account_opening_package_collection(
    p_customer_id,
    v_request.account_id
  );

  return jsonb_build_object(
    'account_id', v_request.account_id,
    'account_number', v_request.account_number,
    'account_status', v_request.account_status,
    'receipt_number', v_package->>'receipt_number',
    'amount', (v_package->>'amount')::numeric,
    'share_amount', (v_package->>'share_amount')::numeric,
    'shares_issued', (v_package->>'shares_issued')::integer,
    'security_reserve', (v_package->>'security_reserve')::numeric,
    'bundled_opening_costs', (v_package->>'bundled_opening_costs')::numeric,
    'checkbook_included', (v_package->>'checkbook_included')::boolean,
    'transaction_logbook_included', (v_package->>'transaction_logbook_included')::boolean,
    'account_opening_form_included', (v_package->>'account_opening_form_included')::boolean,
    'collection_status', 'received'
  );
end;
$function$;

revoke all on function public.create_bank_account_request_with_opening_package(uuid,uuid,uuid,text,text) from public, anon;
grant execute on function public.create_bank_account_request_with_opening_package(uuid,uuid,uuid,text,text) to authenticated;