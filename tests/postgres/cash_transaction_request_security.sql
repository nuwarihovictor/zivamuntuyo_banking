\set ON_ERROR_STOP on
-- Disposable fixture authorization tests for the draft cash-request RPC.
INSERT INTO public.employee_profiles(user_id,is_active)
VALUES ('40000000-0000-0000-0000-000000000015',true),
       ('40000000-0000-0000-0000-000000000016',false)
ON CONFLICT (user_id) DO UPDATE SET is_active=EXCLUDED.is_active;

INSERT INTO public.bank_accounts
  (id,account_number,account_type_id,currency_code,branch_id,status,balance)
VALUES ('59900000-0000-0000-0000-000000000001','TEST-CASH-REQ-SECURITY-001','20000000-0000-0000-0000-000000000001',
        'UGX','10000000-0000-0000-0000-000000000001','active',0)
ON CONFLICT (account_number) DO UPDATE SET status='active';

SELECT id AS test_bank_account_id FROM public.bank_accounts WHERE account_number='TEST-CASH-REQ-SECURITY-001' \gset

SET ROLE authenticated;
SELECT set_config('test.role','teller',false);
SELECT set_config('test.user_id','40000000-0000-0000-0000-000000000015',false);
SELECT set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);

DO $authorized_active_employee$
DECLARE v_id uuid; v_status text;
BEGIN
  SELECT r.journal_id,r.journal_status INTO v_id,v_status
  FROM public.create_cash_transaction_request(
    '59900000-0000-0000-0000-000000000001',
    'deposit',12500,'fixture security test'
  ) r;
  IF v_id IS NULL OR v_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'FAIL: active teller could not create pending cash request';
  END IF;
END
$authorized_active_employee$;

SELECT set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000099',false);
DO $branch_scope_denied$
BEGIN
  BEGIN
    PERFORM * FROM public.create_cash_transaction_request(
      '59900000-0000-0000-0000-000000000001',
      'deposit',500,'denied branch-scope attempt'
    );
    RAISE EXCEPTION 'FAIL: cash request outside employee branch was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$branch_scope_denied$;

SELECT set_config('test.user_id','40000000-0000-0000-0000-000000000016',false);
SELECT set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
DO $inactive_employee_denied$
BEGIN
  BEGIN
    PERFORM * FROM public.create_cash_transaction_request(
      '59900000-0000-0000-0000-000000000001',
      'deposit',500,'denied inactive-employee attempt'
    );
    RAISE EXCEPTION 'FAIL: inactive employee created a cash request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$inactive_employee_denied$;

RESET ROLE;
DO $denied_attempts_are_not_persisted$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.ledger_journals
  WHERE description IN ('denied branch-scope attempt','denied inactive-employee attempt');
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: denied attempts created % journal rows',n;
  END IF;
END
$denied_attempts_are_not_persisted$;
