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
  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
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

-- Exercise the transaction RPC flow using isolated fixture copies of the live function bodies.
DO $transaction_test$
DECLARE
  v_account uuid := '50000000-0000-0000-0000-000000000001';
  v_cash uuid := '60000000-0000-0000-0000-000000000001';
  v_customer_ledger uuid := '60000000-0000-0000-0000-000000000002';
  v_deposit uuid;
  v_withdrawal uuid;
  v_limit_request uuid;
  v_self_request uuid;
  v_branch_request uuid;
  v_failed boolean;
  v_entries integer;
  v_balance numeric;
  v_status text;
BEGIN
  INSERT INTO public.employee_profiles(user_id,is_active) VALUES
    ('40000000-0000-0000-0000-000000000002',true),
    ('40000000-0000-0000-0000-000000000003',true)
  ON CONFLICT (user_id) DO UPDATE SET is_active=true;

  INSERT INTO public.bank_accounts(
    id,account_number,account_type_id,currency_code,branch_id,status,created_by,balance
  ) VALUES (
    v_account,'TXNTEST001','20000000-0000-0000-0000-000000000001','UGX',
    '10000000-0000-0000-0000-000000000001','active',
    '40000000-0000-0000-0000-000000000001',0
  );
  INSERT INTO public.ledger_accounts(id,ledger_type,currency_code,branch_id,is_active)
  VALUES(v_cash,'asset','UGX','10000000-0000-0000-0000-000000000001',true);
  INSERT INTO public.ledger_accounts(id,linked_bank_account_id,ledger_type,currency_code,branch_id,is_active)
  VALUES(v_customer_ledger,v_account,'liability','UGX','10000000-0000-0000-0000-000000000001',true);

  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.approval_limit_allowed','true',false);
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','teller',false);
  SELECT r.journal_id INTO v_deposit
  FROM public.create_cash_transaction_request(v_account,'deposit',100,'CI deposit') r;

  -- The requester cannot approve their own request.
  PERFORM set_config('test.role','bank_admin',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.approve_cash_transaction_request(v_deposit);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%requester cannot approve their own transaction%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: self-approval was accepted'; END IF;

  -- A separate approver can approve when within the configured limit.
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000002',false);
  PERFORM * FROM public.approve_cash_transaction_request(v_deposit);

  -- A third employee posts; requester and approver cannot post.
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000003',false);
  SELECT r.journal_status INTO v_status
  FROM public.post_approved_cash_transaction(v_deposit,v_cash) r;
  IF v_status <> 'posted' THEN RAISE EXCEPTION 'FAIL: approved deposit did not post'; END IF;
  SELECT count(*) INTO v_entries FROM public.ledger_entries WHERE journal_id=v_deposit;
  IF v_entries <> 2 THEN RAISE EXCEPTION 'FAIL: deposit posted % ledger entries, expected 2',v_entries; END IF;
  IF (SELECT balance FROM public.bank_accounts WHERE id=v_account) <> 100 THEN
    RAISE EXCEPTION 'FAIL: stored account balance did not update after deposit';
  END IF;
  IF (SELECT sum(amount) FILTER (WHERE entry_side='debit') FROM public.ledger_entries WHERE journal_id=v_deposit)
     <> (SELECT sum(amount) FILTER (WHERE entry_side='credit') FROM public.ledger_entries WHERE journal_id=v_deposit) THEN
    RAISE EXCEPTION 'FAIL: posted deposit journal is not balanced';
  END IF;

  -- Duplicate posting must fail and leave the two original entries unchanged.
  v_failed := false;
  BEGIN
    PERFORM * FROM public.post_approved_cash_transaction(v_deposit,v_cash);
  EXCEPTION WHEN OTHERS THEN v_failed := true;
  END;
  SELECT count(*) INTO v_entries FROM public.ledger_entries WHERE journal_id=v_deposit;
  IF NOT v_failed OR v_entries <> 2 THEN RAISE EXCEPTION 'FAIL: duplicate posting created additional entries'; END IF;

  -- A withdrawal larger than the posted customer balance must not post.
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','teller',false);
  SELECT r.journal_id INTO v_withdrawal
  FROM public.create_cash_transaction_request(v_account,'withdrawal',101,'CI overdraw attempt') r;
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000002',false);
  PERFORM set_config('test.role','bank_admin',false);
  PERFORM * FROM public.approve_cash_transaction_request(v_withdrawal);
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000003',false);
  PERFORM set_config('test.role','accountant',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.post_approved_cash_transaction(v_withdrawal,v_cash);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Insufficient available balance%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: withdrawal exceeding available balance was posted'; END IF;
  SELECT count(*) INTO v_entries FROM public.ledger_entries WHERE journal_id=v_withdrawal;
  SELECT status INTO v_status FROM public.ledger_journals WHERE id=v_withdrawal;
  IF v_entries <> 0 OR v_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'FAIL: failed withdrawal left partial posting state';
  END IF;

  -- Approval limits are enforced by the server-side helper.
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','teller',false);
  SELECT r.journal_id INTO v_limit_request
  FROM public.create_cash_transaction_request(v_account,'deposit',50,'CI limit attempt') r;
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000002',false);
  PERFORM set_config('test.role','bank_admin',false);
  PERFORM set_config('test.approval_limit_allowed','false',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.approve_cash_transaction_request(v_limit_request);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%exceeds your configured approval limit%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: over-limit transaction was approved'; END IF;
  PERFORM set_config('test.approval_limit_allowed','true',false);

  -- Branch-scoped request must be rejected if the staff member lacks branch access.
  INSERT INTO public.branches(id,branch_code,branch_name,is_head_office,is_active)
  VALUES('10000000-0000-0000-0000-000000000003','BR2','Second Branch',false,true);
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','teller',false);
  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000003',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.create_cash_transaction_request(v_account,'deposit',10,'CI branch denial');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%transaction access to this account branch%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: cross-branch transaction request was accepted'; END IF;
END
$transaction_test$;


-- Failure recovery: force an error after the first row of the two-leg posting
-- statement. The function call must leave no ledger entry, balance change, or
-- posted status behind. This tests the isolated fixture copy, not live production RPCs.
DO $failure_recovery_test$
DECLARE
  v_journal uuid;
  v_entries integer;
  v_balance numeric;
  v_status text;
  v_failed boolean := false;
BEGIN
  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','teller',false);
  SELECT r.journal_id INTO v_journal
  FROM public.create_cash_transaction_request(
    '50000000-0000-0000-0000-000000000001','deposit',25,'CI injected posting failure'
  ) r;

  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000002',false);
  PERFORM set_config('test.role','bank_admin',false);
  PERFORM set_config('test.approval_limit_allowed','true',false);
  PERFORM * FROM public.approve_cash_transaction_request(v_journal);

  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000003',false);
  PERFORM set_config('test.role','accountant',false);
  PERFORM set_config('test.fail_customer_leg','on',false);
  BEGIN
    PERFORM * FROM public.post_approved_cash_transaction(
      v_journal,'60000000-0000-0000-0000-000000000001'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Injected failure on customer ledger leg%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  PERFORM set_config('test.fail_customer_leg','off',false);

  SELECT count(*) INTO v_entries FROM public.ledger_entries WHERE journal_id=v_journal;
  SELECT balance INTO v_balance FROM public.bank_accounts
    WHERE id='50000000-0000-0000-0000-000000000001';
  SELECT status INTO v_status FROM public.ledger_journals WHERE id=v_journal;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: injected posting error was not observed'; END IF;
  IF v_entries <> 0 THEN RAISE EXCEPTION 'FAIL: failed posting left % ledger entries',v_entries; END IF;
  IF v_balance <> 100 THEN RAISE EXCEPTION 'FAIL: failed posting changed account balance to %',v_balance; END IF;
  IF v_status <> 'pending_approval' THEN RAISE EXCEPTION 'FAIL: failed posting changed journal status to %',v_status; END IF;
END
$failure_recovery_test$;



-- Active-employment gate for cash transaction request and posting.
DO $active_employee_cash_rpc_test$
DECLARE
  v_failed boolean := false;
  v_journal uuid;
  v_cash uuid := '60000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.employee_profiles(user_id,is_active)
  VALUES ('40000000-0000-0000-0000-000000000004',false)
  ON CONFLICT (user_id) DO UPDATE SET is_active=false;
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000004',false);
  PERFORM set_config('test.role','teller',false);
  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
  BEGIN
    PERFORM * FROM public.create_cash_transaction_request(
      '50000000-0000-0000-0000-000000000001','deposit',10,'inactive employee request'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Active employee profile required%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: inactive employee created cash request'; END IF;

  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','teller',false);
  SELECT r.journal_id INTO v_journal FROM public.create_cash_transaction_request(
    '50000000-0000-0000-0000-000000000001','deposit',10,'inactive employee posting denial'
  ) r;
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000002',false);
  PERFORM set_config('test.role','bank_admin',false);
  PERFORM set_config('test.approval_limit_allowed','true',false);
  PERFORM * FROM public.approve_cash_transaction_request(v_journal);
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000004',false);
  PERFORM set_config('test.role','accountant',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.post_approved_cash_transaction(v_journal,v_cash);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Active employee profile required%' THEN v_failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: inactive employee posted cash transaction'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE journal_id=v_journal) THEN
    RAISE EXCEPTION 'FAIL: inactive employee posting denial left ledger entries';
  END IF;
END
$active_employee_cash_rpc_test$;


-- Requester and approver must not post their own cash request.
DO $cash_separation_of_duties_test$
DECLARE
  v_journal uuid;
  v_failed boolean;
  v_status text;
  v_entries integer;
  v_cash uuid := '60000000-0000-0000-0000-000000000001';
BEGIN
  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','teller',false);
  SELECT r.journal_id INTO v_journal
  FROM public.create_cash_transaction_request(
    '50000000-0000-0000-0000-000000000001','deposit',5,'CI separation of duties'
  ) r;

  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000002',false);
  PERFORM set_config('test.role','bank_admin',false);
  PERFORM set_config('test.approval_limit_allowed','true',false);
  PERFORM * FROM public.approve_cash_transaction_request(v_journal);

  -- The requester cannot post.
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000001',false);
  PERFORM set_config('test.role','accountant',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.post_approved_cash_transaction(v_journal,v_cash);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Requester or approver cannot post this transaction%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: requester posted their own cash request'; END IF;

  -- The approver cannot post either.
  PERFORM set_config('test.user_id','40000000-0000-0000-0000-000000000002',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.post_approved_cash_transaction(v_journal,v_cash);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Requester or approver cannot post this transaction%' THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: approver posted the transaction they approved'; END IF;

  SELECT status INTO v_status FROM public.ledger_journals WHERE id=v_journal;
  SELECT count(*) INTO v_entries FROM public.ledger_entries WHERE journal_id=v_journal;
  IF v_status <> 'pending_approval' OR v_entries <> 0 THEN
    RAISE EXCEPTION 'FAIL: separation-of-duties denials changed posting state';
  END IF;
END
$cash_separation_of_duties_test$;


-- Verify browser-facing cash RPC grants are narrow and intentional.
DO $cash_rpc_acl_test$
DECLARE
  v_signature text;
  v_proc_oid oid;
  v_public_execute boolean;
  v_anon_execute boolean;
  v_auth_execute boolean;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.create_cash_transaction_request(uuid,text,numeric,text)',
    'public.post_approved_cash_transaction(uuid,uuid)'
  ]
  LOOP
    v_proc_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_proc_oid IS NULL THEN
      RAISE EXCEPTION 'FAIL: expected cash RPC missing: %', v_signature;
    END IF;

    SELECT
      coalesce(bool_or(x.grantee = 0 AND x.privilege_type = 'EXECUTE'),false),
      coalesce(bool_or(x.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='anon') AND x.privilege_type = 'EXECUTE'),false),
      coalesce(bool_or(x.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated') AND x.privilege_type = 'EXECUTE'),false)
    INTO v_public_execute,v_anon_execute,v_auth_execute
    FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x
    WHERE p.oid=v_proc_oid;

    IF v_public_execute OR v_anon_execute THEN
      RAISE EXCEPTION 'FAIL: public or anon can execute %', v_signature;
    END IF;
    IF NOT v_auth_execute THEN
      RAISE EXCEPTION 'FAIL: authenticated staff cannot execute %', v_signature;
    END IF;
  END LOOP;
END
$cash_rpc_acl_test$;
