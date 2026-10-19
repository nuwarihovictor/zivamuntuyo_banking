-- Minimal isolated PostgreSQL fixture for executing the two draft migrations.
-- This is not a production schema dump; tests cover migration execution and selected guards.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;

CREATE TABLE public.branches (
  id uuid PRIMARY KEY, branch_code text, branch_name text,
  is_head_office boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
  address text
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.branches TO authenticated;
CREATE POLICY branches_directory_authenticated_select ON public.branches
  FOR SELECT TO authenticated USING (is_active = true);
CREATE VIEW public.branch_directory_public WITH (security_barrier=true) AS
  SELECT id, branch_code, branch_name, is_head_office
  FROM public.branches WHERE is_active=true;
GRANT SELECT ON public.branch_directory_public TO anon, authenticated;

CREATE TABLE public.general_ledger_accounts (id uuid PRIMARY KEY);
CREATE TABLE public.ledger_journal_entries (id uuid PRIMARY KEY);
ALTER TABLE public.general_ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_journal_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.general_ledger_accounts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_journal_entries TO anon, authenticated;

CREATE TABLE public.employee_profiles (user_id uuid PRIMARY KEY, is_active boolean NOT NULL);
CREATE TABLE public.customers (id uuid PRIMARY KEY, status text NOT NULL, branch_id uuid);
CREATE TABLE public.account_types (id uuid PRIMARY KEY, type_code text NOT NULL, type_name text, is_active boolean NOT NULL);
CREATE TABLE public.currencies (code text PRIMARY KEY, is_active boolean NOT NULL);
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_number text UNIQUE NOT NULL,
  account_type_id uuid NOT NULL, currency_code text NOT NULL, branch_id uuid NOT NULL,
  status text NOT NULL, created_by uuid, metadata jsonb, balance numeric NOT NULL DEFAULT 0,
  product_type text, opened_at timestamptz, rejection_reason text, approved_by uuid, approved_at timestamptz
);
CREATE TABLE public.account_holders (
  account_id uuid NOT NULL, customer_id uuid NOT NULL, holder_role text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false, UNIQUE(account_id, customer_id)
);
CREATE TABLE public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_user_id uuid, branch_id uuid,
  action text, entity_type text, entity_id text, outcome text, details jsonb
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.ledger_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number text NOT NULL UNIQUE,
  journal_type text NOT NULL,
  currency_code text NOT NULL,
  status text NOT NULL,
  description text,
  created_by uuid,
  requested_account_id uuid,
  requested_amount numeric,
  request_transaction_type text,
  approved_by uuid,
  approved_at timestamptz,
  posted_by uuid,
  posted_at timestamptz
);
CREATE TABLE public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linked_bank_account_id uuid,
  ledger_type text NOT NULL,
  currency_code text NOT NULL,
  branch_id uuid,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.ledger_journals(id),
  ledger_account_id uuid NOT NULL REFERENCES public.ledger_accounts(id),
  entry_side text NOT NULL,
  amount numeric NOT NULL,
  currency_code text NOT NULL,
  branch_id uuid,
  customer_account_id uuid,
  description text
);

CREATE OR REPLACE FUNCTION public.current_employee_role_code() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.role', true), '') $$;
CREATE OR REPLACE FUNCTION public.current_employee_can_transact_in_branch(uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.allowed_branch_id', true), '')::uuid = $1
$$;
CREATE OR REPLACE FUNCTION public.is_active_branch_manager_for(uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT true $$;

-- Representative routines used to exercise the search_path/ACL hardening migration.
CREATE OR REPLACE FUNCTION public.approval_limit_allows(text,text,uuid,text,numeric)
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT coalesce(nullif(current_setting('test.approval_limit_allowed', true), ''), 'true')::boolean
$$;
GRANT EXECUTE ON FUNCTION public.approval_limit_allows(text,text,uuid,text,numeric)
TO authenticated;
CREATE OR REPLACE FUNCTION public.record_financial_activity(
  uuid,text,numeric,text,text,uuid,uuid,date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$ BEGIN RETURN; END $$;

CREATE OR REPLACE FUNCTION public.create_cash_transaction_request(
  p_account_id uuid, p_transaction_type text, p_amount numeric, p_description text DEFAULT NULL
) RETURNS TABLE(journal_id uuid,journal_number text,journal_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_role text; v_branch uuid; v_currency text; v_status text;
        v_journal_id uuid; v_journal_number text; v_type text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employee_profiles ep WHERE ep.user_id=auth.uid() AND ep.is_active=true) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE='42501';
  END IF;
  v_role := public.current_employee_role_code();
  IF v_role IS NULL OR v_role NOT IN ('system_admin','bank_admin','branch_manager','accountant','teller') THEN
    RAISE EXCEPTION 'You are not authorized to request cash transactions';
  END IF;
  v_type := lower(trim(p_transaction_type));
  IF v_type NOT IN ('deposit','withdrawal') THEN RAISE EXCEPTION 'Transaction type must be deposit or withdrawal'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000000000 THEN RAISE EXCEPTION 'Invalid transaction amount'; END IF;
  SELECT ba.branch_id, ba.currency_code::text, ba.status INTO v_branch,v_currency,v_status
  FROM public.bank_accounts ba WHERE ba.id=p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'Only active accounts can accept transaction requests'; END IF;
  IF NOT public.current_employee_can_transact_in_branch(v_branch) THEN
    RAISE EXCEPTION 'You do not have transaction access to this account branch';
  END IF;
  v_journal_number := 'REQ-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  INSERT INTO public.ledger_journals
    (journal_number,journal_type,currency_code,status,description,created_by,requested_account_id,requested_amount,request_transaction_type)
  VALUES (v_journal_number,v_type,v_currency,'pending_approval',
    left(coalesce(p_description,initcap(v_type)||' request'),500),auth.uid(),p_account_id,p_amount,v_type)
  RETURNING id INTO v_journal_id;
  RETURN QUERY SELECT v_journal_id,v_journal_number,'pending_approval'::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_cash_transaction_request(p_journal_id uuid)
RETURNS TABLE(journal_id uuid,journal_number text,journal_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_role text; v_branch uuid; v_status text; v_requester uuid; v_type text; v_amount numeric; v_currency text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.employee_profiles ep WHERE ep.user_id=auth.uid() AND ep.is_active=true) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE='42501';
  END IF;
  v_role:=public.current_employee_role_code();
  IF v_role IS NULL OR v_role NOT IN ('system_admin','general_manager','bank_admin','branch_manager','teller') THEN
    RAISE EXCEPTION 'Your role cannot approve cash transaction requests' USING ERRCODE='42501';
  END IF;
  SELECT j.status,j.created_by,j.request_transaction_type,b.branch_id,j.requested_amount,b.currency_code
  INTO v_status,v_requester,v_type,v_branch,v_amount,v_currency
  FROM public.ledger_journals j JOIN public.bank_accounts b ON b.id=j.requested_account_id
  WHERE j.id=p_journal_id FOR UPDATE OF j;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cash transaction request not found'; END IF;
  IF v_status<>'pending_approval' OR v_type NOT IN ('deposit','withdrawal') THEN
    RAISE EXCEPTION 'Only pending cash transaction requests can be approved';
  END IF;
  IF v_requester=auth.uid() THEN RAISE EXCEPTION 'The requester cannot approve their own transaction'; END IF;
  IF NOT public.current_employee_can_transact_in_branch(v_branch) THEN
    RAISE EXCEPTION 'Branch access denied' USING ERRCODE='42501';
  END IF;
  IF NOT public.approval_limit_allows(v_role,'cash_transaction',v_branch,v_currency,v_amount) THEN
    RAISE EXCEPTION 'This transaction exceeds your configured approval limit. Escalate it to an authorized higher approver.';
  END IF;
  UPDATE public.ledger_journals SET approved_by=auth.uid(),approved_at=now() WHERE id=p_journal_id;
  INSERT INTO public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  VALUES(auth.uid(),v_branch,'cash_transaction_approved','ledger_journal',p_journal_id::text,'success',
    jsonb_build_object('requester_user_id',v_requester,'transaction_type',v_type,'amount',v_amount,'approval_role',v_role));
  RETURN QUERY SELECT j.id,j.journal_number,j.status FROM public.ledger_journals j WHERE j.id=p_journal_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_approved_cash_transaction(p_journal_id uuid,p_cash_ledger_account_id uuid)
RETURNS TABLE(journal_id uuid,journal_number text,journal_status text,posted_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_j public.ledger_journals%ROWTYPE; v_ba public.bank_accounts%ROWTYPE;
        v_customer_ledger public.ledger_accounts%ROWTYPE; v_cash_ledger public.ledger_accounts%ROWTYPE;
        v_role text; v_balance numeric; v_new_balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employee_profiles ep WHERE ep.user_id=auth.uid() AND ep.is_active=true) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE='42501';
  END IF;
  v_role:=public.current_employee_role_code();
  IF v_role IS NULL OR v_role NOT IN ('system_admin','general_manager','bank_admin','branch_manager','accountant') THEN
    RAISE EXCEPTION 'Not authorized to post cash transactions' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_j FROM public.ledger_journals WHERE id=p_journal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction request not found' USING ERRCODE='P0002'; END IF;
  IF v_j.status<>'pending_approval' OR v_j.approved_by IS NULL THEN
    RAISE EXCEPTION 'Transaction must be approved and pending posting' USING ERRCODE='23514';
  END IF;
  IF v_j.created_by=auth.uid() OR v_j.approved_by=auth.uid() THEN
    RAISE EXCEPTION 'Requester or approver cannot post this transaction' USING ERRCODE='42501';
  END IF;
  IF v_j.request_transaction_type IS NULL OR v_j.request_transaction_type NOT IN ('deposit','withdrawal')
     OR v_j.requested_account_id IS NULL OR v_j.requested_amount IS NULL OR v_j.requested_amount<=0 THEN
    RAISE EXCEPTION 'This is not a complete valid cash transaction request' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.ledger_entries le WHERE le.journal_id=v_j.id) THEN
    RAISE EXCEPTION 'Ledger entries already exist for this request; duplicate posting is blocked' USING ERRCODE='23505';
  END IF;
  SELECT * INTO v_ba FROM public.bank_accounts WHERE id=v_j.requested_account_id FOR UPDATE;
  IF NOT FOUND OR v_ba.status<>'active' THEN RAISE EXCEPTION 'Customer account is not active' USING ERRCODE='23514'; END IF;
  IF NOT public.current_employee_can_transact_in_branch(v_ba.branch_id) THEN
    RAISE EXCEPTION 'No transaction access to this branch' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_cash_ledger FROM public.ledger_accounts
  WHERE id=p_cash_ledger_account_id AND is_active=true FOR UPDATE;
  IF NOT FOUND OR v_cash_ledger.ledger_type<>'asset' OR v_cash_ledger.currency_code<>v_ba.currency_code
     OR (v_cash_ledger.branch_id IS NOT NULL AND v_cash_ledger.branch_id<>v_ba.branch_id) THEN
    RAISE EXCEPTION 'Select an active asset cash ledger in the same currency and branch' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_customer_ledger FROM public.ledger_accounts
  WHERE linked_bank_account_id=v_ba.id AND is_active=true FOR UPDATE;
  IF NOT FOUND OR v_customer_ledger.ledger_type<>'liability' OR v_customer_ledger.currency_code<>v_ba.currency_code THEN
    RAISE EXCEPTION 'Customer liability ledger is not configured. Posting is blocked until accounting setup is completed' USING ERRCODE='23514';
  END IF;
  SELECT coalesce(sum(CASE WHEN le.entry_side='credit' THEN le.amount ELSE -le.amount END),0)
  INTO v_balance FROM public.ledger_entries le JOIN public.ledger_journals lj ON lj.id=le.journal_id
  WHERE le.ledger_account_id=v_customer_ledger.id AND lj.status='posted';
  IF v_j.request_transaction_type='withdrawal' AND v_balance<v_j.requested_amount THEN
    RAISE EXCEPTION 'Insufficient available balance' USING ERRCODE='23514';
  END IF;
  v_new_balance:=CASE WHEN v_j.request_transaction_type='deposit' THEN v_balance+v_j.requested_amount ELSE v_balance-v_j.requested_amount END;
  INSERT INTO public.ledger_entries(journal_id,ledger_account_id,entry_side,amount,currency_code,branch_id,customer_account_id,description)
  VALUES
   (v_j.id,v_cash_ledger.id,CASE WHEN v_j.request_transaction_type='deposit' THEN 'debit' ELSE 'credit' END,
    v_j.requested_amount,v_ba.currency_code,v_ba.branch_id,v_ba.id,'Cash control leg'),
   (v_j.id,v_customer_ledger.id,CASE WHEN v_j.request_transaction_type='deposit' THEN 'credit' ELSE 'debit' END,
    v_j.requested_amount,v_ba.currency_code,v_ba.branch_id,v_ba.id,'Customer account leg');
  UPDATE public.bank_accounts SET balance=v_new_balance WHERE id=v_ba.id;
  UPDATE public.ledger_journals SET status='posted',posted_by=auth.uid(),posted_at=now()
  WHERE id=v_j.id AND status='pending_approval' AND approved_by IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction state changed before posting; no posting completed' USING ERRCODE='23514'; END IF;
  RETURN QUERY SELECT lj.id,lj.journal_number,lj.status,v_j.requested_amount FROM public.ledger_journals lj WHERE lj.id=v_j.id;
END;
$function$;


-- Fault-injection hook for atomic-posting recovery tests. Disabled unless the test
-- session explicitly sets test.fail_customer_leg = 'on'.
CREATE OR REPLACE FUNCTION public.test_fail_customer_ledger_leg()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF current_setting('test.fail_customer_leg', true) = 'on'
     AND NEW.description = 'Customer account leg' THEN
    RAISE EXCEPTION 'Injected failure on customer ledger leg' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER test_fail_customer_ledger_leg_before_insert
BEFORE INSERT ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.test_fail_customer_ledger_leg();

INSERT INTO public.branches(id,branch_code,branch_name,is_head_office,is_active,address)
VALUES ('10000000-0000-0000-0000-000000000001','HQ','Head Office',true,true,'private address');
INSERT INTO public.account_types(id,type_code,type_name,is_active) VALUES
 ('20000000-0000-0000-0000-000000000001','IND','Individual',true),
 ('20000000-0000-0000-0000-000000000002','JNT','Joint',true);
INSERT INTO public.currencies(code,is_active) VALUES ('UGX',true),('USD',false);
INSERT INTO public.customers(id,status,branch_id) VALUES
 ('30000000-0000-0000-0000-000000000001','active','10000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','active','10000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000003','inactive','10000000-0000-0000-0000-000000000001');
