-- Isolated fixture-only test for account-opening wrapper transaction atomicity.
-- These routines are representative test doubles, not live production definitions.
CREATE TABLE public.account_opening_collections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL,
  account_id uuid NOT NULL,
  collection_status text NOT NULL DEFAULT 'received'
);

CREATE OR REPLACE FUNCTION public.record_account_opening_package_collection(
  p_customer_id uuid, p_account_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.account_opening_collections(customer_id, account_id)
  VALUES (p_customer_id, p_account_id);
  IF current_setting('test.fail_opening_package', true) = 'on' THEN
    RAISE EXCEPTION 'Injected account-opening package collection failure';
  END IF;
  RETURN jsonb_build_object('receipt_number','TEST-RECEIPT','amount',30000);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_bank_account_request_with_opening_package(
  p_customer_id uuid, p_branch_id uuid, p_account_type_id uuid,
  p_product_type text, p_currency_code text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_request record;
  v_package jsonb;
BEGIN
  SELECT * INTO v_request
  FROM public.create_bank_account_request(
    p_customer_id, p_branch_id, p_account_type_id, p_product_type, p_currency_code
  );
  IF v_request.account_id IS NULL THEN
    RAISE EXCEPTION 'Account request could not be created';
  END IF;
  v_package := public.record_account_opening_package_collection(p_customer_id, v_request.account_id);
  RETURN jsonb_build_object(
    'account_id', v_request.account_id,
    'account_number', v_request.account_number,
    'account_status', v_request.account_status,
    'receipt_number', v_package->>'receipt_number'
  );
END;
$function$;

DO $opening_wrapper_atomicity_test$
DECLARE
  v_accounts_before integer;
  v_holders_before integer;
  v_audits_before integer;
  v_collections_before integer;
  v_accounts_after integer;
  v_holders_after integer;
  v_audits_after integer;
  v_collections_after integer;
  v_failed boolean := false;
BEGIN
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','accountant',false);
  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.fail_opening_package','on',false);

  SELECT count(*) INTO v_accounts_before FROM public.bank_accounts;
  SELECT count(*) INTO v_holders_before FROM public.account_holders;
  SELECT count(*) INTO v_audits_before FROM public.audit_events;
  SELECT count(*) INTO v_collections_before FROM public.account_opening_collections;

  BEGIN
    PERFORM public.create_bank_account_request_with_opening_package(
      '30000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'savings','UGX'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Injected account-opening package collection failure%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;
  PERFORM set_config('test.fail_opening_package','off',false);

  SELECT count(*) INTO v_accounts_after FROM public.bank_accounts;
  SELECT count(*) INTO v_holders_after FROM public.account_holders;
  SELECT count(*) INTO v_audits_after FROM public.audit_events;
  SELECT count(*) INTO v_collections_after FROM public.account_opening_collections;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'FAIL: injected account-opening collection failure was not observed';
  END IF;
  IF v_accounts_after <> v_accounts_before
     OR v_holders_after <> v_holders_before
     OR v_audits_after <> v_audits_before
     OR v_collections_after <> v_collections_before THEN
    RAISE EXCEPTION
      'FAIL: wrapper left partial state (accounts %/% holders %/% audits %/% collections %/%)',
      v_accounts_before,v_accounts_after,v_holders_before,v_holders_after,
      v_audits_before,v_audits_after,v_collections_before,v_collections_after;
  END IF;
END;
$opening_wrapper_atomicity_test$;
