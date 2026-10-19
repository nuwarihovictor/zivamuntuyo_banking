\set ON_ERROR_STOP on
-- Runs only against the disposable fixture after all draft migrations.
-- The shared fixture and prior assertions already create branch IDs 1 and 2.
INSERT INTO public.employee_profiles(user_id,is_active)
VALUES
 ('40000000-0000-0000-0000-000000000011',true),
 ('40000000-0000-0000-0000-000000000012',true);
INSERT INTO public.customers(id,status,branch_id)
VALUES
 ('50000000-0000-0000-0000-000000000001','pending_review','10000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000002','pending_review','10000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000003','pending_review','10000000-0000-0000-0000-000000000001');

SELECT set_config('test.user_id','40000000-0000-0000-0000-000000000011',false);
SELECT set_config('test.role','branch_manager',false);
SELECT set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $test$
DECLARE
  v_status text;
  v_failed boolean := false;
BEGIN
  SELECT resulting_status INTO v_status
  FROM public.review_customer_kyc(
    '50000000-0000-0000-0000-000000000001','approve','Identity documents verified'
  );
  IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL: KYC approval did not activate customer'; END IF;

  SELECT resulting_status INTO v_status
  FROM public.review_customer_kyc(
    '50000000-0000-0000-0000-000000000002','reject','Identification does not match'
  );
  IF v_status <> 'rejected' THEN RAISE EXCEPTION 'FAIL: KYC rejection did not reject customer'; END IF;

  v_failed := false;
  BEGIN
    PERFORM * FROM public.review_customer_kyc(
      '50000000-0000-0000-0000-000000000002','approve','Try to approve rejected'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Only pending_review customers%' THEN v_failed := true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: terminal KYC status was changed'; END IF;

  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000002',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.review_customer_kyc(
      '50000000-0000-0000-0000-000000000003','approve','Identity documents verified'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Customer branch access denied%' THEN v_failed := true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: cross-branch KYC review was accepted'; END IF;

  PERFORM set_config('test.role','teller',false);
  PERFORM set_config('test.allowed_branch_id','10000000-0000-0000-0000-000000000001',false);
  v_failed := false;
  BEGIN
    PERFORM * FROM public.review_customer_kyc(
      '50000000-0000-0000-0000-000000000003','approve','Identity documents verified'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Customer KYC review permission required%' THEN v_failed := true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: unauthorized KYC reviewer was accepted'; END IF;
END
$test$;
RESET ROLE;

DO $test$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id='50000000-0000-0000-0000-000000000001' AND status='active') THEN
    RAISE EXCEPTION 'FAIL: approved customer status not persisted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id='50000000-0000-0000-0000-000000000002' AND status='rejected') THEN
    RAISE EXCEPTION 'FAIL: rejected customer status not persisted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id='50000000-0000-0000-0000-000000000003' AND status='pending_review') THEN
    RAISE EXCEPTION 'FAIL: denied KYC attempts changed customer status';
  END IF;
  IF (SELECT count(*) FROM public.audit_events WHERE entity_type='customer' AND action IN ('customer_kyc_approved','customer_kyc_rejected')) <> 2 THEN
    RAISE EXCEPTION 'FAIL: KYC decision audit events missing or duplicated';
  END IF;
  IF has_table_privilege('anon','public.customers','SELECT') OR has_table_privilege('anon','public.customers','INSERT') OR has_table_privilege('anon','public.customers','UPDATE') THEN
    RAISE EXCEPTION 'FAIL: anonymous customer table access remains granted';
  END IF;
END
$test$;
