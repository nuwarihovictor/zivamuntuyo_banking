-- Draft hardening for SECURITY DEFINER routines that use unqualified public objects.
-- The live public schema has CREATE revoked from PUBLIC, anon, and authenticated.
-- Pin catalog resolution first and put pg_temp last to prevent temporary-object shadowing.
-- Review/test this migration in a disposable DB before production; no live change is implied.
DO $migration$
DECLARE
  v_proc record;
BEGIN
  FOR v_proc IN
    SELECT p.proname, pg_catalog.oidvectortypes(p.proargtypes) AS argument_types
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname = ANY (ARRAY[
        'apply_monthly_account_security_fee',
        'approval_limit_allows',
        'attach_institution_payroll_evidence',
        'check_posted_journal_balance',
        'create_bank_account_request_with_opening_package',
        'get_customer_share_eligibility',
        'get_financial_performance',
        'get_journal_reconciliation',
        'process_institution_payroll',
        'reactivate_dormant_account',
        'record_account_opening_package_collection',
        'record_account_security_top_up',
        'record_additional_share_purchase',
        'record_loan_processing_fee_collection',
        'record_stationery_collection',
        'refresh_dormant_accounts',
        'set_role_approval_limit'
      ])
      AND p.prosecdef
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER FUNCTION public.%I(%s) SET search_path = pg_catalog, public, pg_temp',
      v_proc.proname, v_proc.argument_types
    );
  END LOOP;
END
$migration$;

-- This routine uses schema-qualified application objects and built-ins only.
-- An empty search_path prevents shadowing without changing its accounting logic.
ALTER FUNCTION public.record_financial_activity(uuid,text,numeric,text,text,uuid,uuid,date)
  SET search_path = '';

-- This is an internal policy helper; callers should use the authorized transaction RPCs.
-- SECURITY DEFINER routines owned by postgres can still call it internally.
REVOKE ALL ON FUNCTION public.approval_limit_allows(text,text,uuid,text,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approval_limit_allows(text,text,uuid,text,numeric)
  TO service_role;
