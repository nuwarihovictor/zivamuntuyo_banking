\set ON_ERROR_STOP on
-- Execute after fixture and both draft migrations are applied.
DO $test$
DECLARE
  v_account uuid;
  v_joint uuid;
  v_status text;
  v_failed boolean;
BEGIN
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','accountant',false);
  INSERT INTO public.employee_profiles(user_id,is_active)
  VALUES ('40000000-0000-0000-0000-000000000001',true);

  SELECT r.account_id INTO v_account
  FROM public.create_bank_account_request(
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001','savings','UGX'
  ) r;
  IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id=v_account AND status='pending_approval') THEN
    RAISE EXCEPTION 'FAIL: individual account request was not created pending';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM * FROM public.create_bank_account_request(
      '30000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001','savings','UGX'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%already has an individual account%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: duplicate individual account was accepted'; END IF;

  v_failed := false;
  BEGIN
    PERFORM * FROM public.create_bank_account_request(
      '30000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001','savings','USD'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Unsupported or inactive currency%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: inactive currency was accepted'; END IF;

  -- Legacy entry point must enforce the same active-currency catalogue.
  v_failed := false;
  BEGIN
    PERFORM * FROM public.open_account_request(
      '30000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001','USD'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Unsupported or inactive currency%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: legacy RPC accepted inactive currency'; END IF;

  v_failed := false;
  BEGIN
    PERFORM * FROM public.create_bank_account_request(
      '30000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002','savings','UGX'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Customer must be active%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: inactive customer was accepted'; END IF;

  SELECT r.account_id INTO v_joint
  FROM public.create_bank_account_request(
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002','savings','UGX'
  ) r;
  PERFORM set_config('test.role','bank_admin',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.approve_account_request(v_joint);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%requires at least two distinct holders%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: joint account approved with one holder'; END IF;

  PERFORM * FROM public.add_pending_joint_account_holder(
    v_joint,'30000000-0000-0000-0000-000000000001'
  );
  SELECT r.account_status INTO v_status FROM public.approve_account_request(v_joint) r;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL: valid two-holder joint account not approved'; END IF;

END
$test$;

-- Assert the invoker view preserves the anonymous branch selector but hides inactive branches.
INSERT INTO public.branches(id,branch_code,branch_name,is_head_office,is_active)
VALUES ('10000000-0000-0000-0000-000000000002','OFF','Inactive Office',false,false);
SET ROLE anon;
DO $anon_test$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.branch_directory_public;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: public branch directory returned % rows, expected 1',n; END IF;
END
$anon_test$;
RESET ROLE;

-- Direct ledger table access must be revoked from browser roles.
DO $acl_test$
BEGIN
  IF has_table_privilege('anon','public.general_ledger_accounts','SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon still has direct ledger account access';
  END IF;
  IF has_table_privilege('authenticated','public.ledger_journal_entries','SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated still has direct journal access';
  END IF;
  IF NOT has_table_privilege('anon','public.branch_directory_public','SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon cannot read public branch directory';
  END IF;
END
$acl_test$;

-- Search-path hardening: pinned catalog/public resolution and pg_temp last.
DO $search_path_test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='record_financial_activity'
      AND p.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']
  ) THEN
    RAISE EXCEPTION 'FAIL: SECURITY DEFINER financial routine search_path was not pinned';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'public.approval_limit_allows(text,text,uuid,text,numeric)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'FAIL: internal approval-limit helper remains callable by authenticated';
  END IF;
  IF NOT has_function_privilege(
       'service_role',
       'public.approval_limit_allows(text,text,uuid,text,numeric)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'FAIL: service_role lost internal approval-limit helper execution';
  END IF;
END
$search_path_test$;
