-- Require an active employee profile for cash transaction request and posting RPCs.
-- Draft only: run in disposable PostgreSQL/staging until full review and UI integration pass.
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
    upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,6));
  INSERT INTO public.ledger_journals
    (journal_number,journal_type,currency_code,status,description,created_by,requested_account_id,requested_amount,request_transaction_type)
  VALUES (v_journal_number,v_type,v_currency,'pending_approval',
    left(coalesce(p_description,initcap(v_type)||' request'),500),auth.uid(),p_account_id,p_amount,v_type)
  RETURNING id INTO v_journal_id;
  RETURN QUERY SELECT v_journal_id,v_journal_number,'pending_approval'::text;
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
  INSERT INTO public.audit_events(actor_user_id,branch_id,action,entity_type,entity_id,outcome,details)
  VALUES (
    auth.uid(),v_ba.branch_id,'cash_transaction_posted','ledger_journal',v_j.id::text,'success',
    jsonb_build_object(
      'journal_number',v_j.journal_number,
      'transaction_type',v_j.request_transaction_type,
      'amount',v_j.requested_amount,
      'currency_code',v_ba.currency_code,
      'requester_user_id',v_j.created_by,
      'approver_user_id',v_j.approved_by
    )
  );
  RETURN QUERY SELECT lj.id,lj.journal_number,lj.status,v_j.requested_amount FROM public.ledger_journals lj WHERE lj.id=v_j.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_cash_transaction_request(uuid,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_cash_transaction_request(uuid,text,numeric,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.post_approved_cash_transaction(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_approved_cash_transaction(uuid,uuid) TO authenticated, service_role;
