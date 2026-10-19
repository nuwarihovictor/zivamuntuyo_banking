-- DESIGN DRAFT ONLY. Requires loan_servicing_schema_draft.sql to be reviewed and applied
-- in a non-production Supabase project first. This file creates no cron job and
-- sends no customer SMS/email/WhatsApp messages. It creates staff in-app alerts only.
-- Do not run against production until accounting, authorization, RLS and allocation
-- policies have been reviewed and tested.

CREATE OR REPLACE FUNCTION public.list_loan_due_alert_dashboard(
  p_branch_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 250
)
RETURNS TABLE(
  loan_id uuid,
  loan_account_number text,
  customer_id uuid,
  customer_name text,
  branch_id uuid,
  branch_name text,
  installment_id uuid,
  installment_no integer,
  due_date date,
  grace_end_date date,
  business_date date,
  total_due numeric,
  total_paid numeric,
  outstanding_amount numeric,
  days_past_due integer,
  servicing_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = v_user_id AND ep.is_active = true
      AND ep.employment_status NOT IN ('suspended','terminated','inactive')
  ) THEN RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501'; END IF;

  v_role := public.current_employee_role_code();
  IF v_role IS NULL OR v_role NOT IN ('system_admin','general_manager','bank_admin','branch_manager','loan_officer','accountant') THEN
    RAISE EXCEPTION 'Your staff role cannot view loan servicing' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'Limit must be between 1 and 500' USING ERRCODE = '22023';
  END IF;
  IF p_branch_id IS NOT NULL AND NOT (
    v_role IN ('system_admin','general_manager','bank_admin')
    OR public.current_employee_can_transact_in_branch(p_branch_id)
  ) THEN
    RAISE EXCEPTION 'Branch access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH active_schedules AS (
    SELECT ranked.*
    FROM (
      SELECT sv.*,
             row_number() OVER (PARTITION BY sv.loan_id ORDER BY sv.version_no DESC, sv.created_at DESC) AS rn
      FROM public.loan_schedule_versions sv
      WHERE sv.schedule_status = 'approved'
    ) ranked
    WHERE ranked.rn = 1
  ),
  paid AS (
    SELECT a.installment_id, sum(a.amount)::numeric(20,2) AS paid_amount
    FROM public.loan_repayment_allocations a
    JOIN public.loan_repayments r ON r.id = a.repayment_id AND r.repayment_status = 'posted'
    GROUP BY a.installment_id
  ),
  balances AS (
    SELECT l.id AS loan_id, l.loan_account_number::text, l.customer_id,
           c.full_name::text AS customer_name, l.branch_id, b.branch_name::text,
           i.id AS installment_id, i.installment_no, i.due_date,
           (i.due_date + make_interval(days => sv.grace_period_days))::date AS grace_end_date,
           (now() AT TIME ZONE coalesce(nullif(b.timezone,''),'Africa/Kampala'))::date AS business_date,
           (i.principal_due + i.interest_due + i.fee_due + i.penalty_due)::numeric(20,2) AS total_due,
           coalesce(p.paid_amount,0)::numeric(20,2) AS total_paid,
           greatest(0,(i.principal_due + i.interest_due + i.fee_due + i.penalty_due)-coalesce(p.paid_amount,0))::numeric(20,2) AS outstanding_amount
    FROM public.loans l
    JOIN active_schedules sv ON sv.loan_id = l.id
    JOIN public.loan_installments i ON i.schedule_version_id = sv.id
    LEFT JOIN paid p ON p.installment_id = i.id
    LEFT JOIN public.customers c ON c.id = l.customer_id
    LEFT JOIN public.branches b ON b.id = l.branch_id
    WHERE (p_branch_id IS NULL OR l.branch_id = p_branch_id)
      AND (
        v_role IN ('system_admin','general_manager','bank_admin')
        OR (l.branch_id IS NOT NULL AND public.current_employee_can_transact_in_branch(l.branch_id))
      )
  )
  SELECT b.loan_id,b.loan_account_number,b.customer_id,b.customer_name,b.branch_id,b.branch_name,
         b.installment_id,b.installment_no,b.due_date,b.grace_end_date,b.business_date,
         b.total_due,b.total_paid,b.outstanding_amount,
         greatest(0,(b.business_date-b.due_date))::integer AS days_past_due,
         CASE
           WHEN b.outstanding_amount <= 0 THEN 'settled'
           WHEN b.due_date > b.business_date THEN 'upcoming'
           WHEN b.due_date = b.business_date THEN 'due_today'
           WHEN b.business_date <= b.grace_end_date THEN 'grace_period'
           ELSE 'overdue'
         END::text AS servicing_status
  FROM balances b
  WHERE b.outstanding_amount > 0
  ORDER BY b.due_date ASC, b.loan_account_number, b.installment_no
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_loan_due_alert_dashboard(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_loan_due_alert_dashboard(uuid, integer) TO authenticated;

-- Trusted scheduler function. It derives unpaid balances from approved schedules
-- and posted repayment allocations. The idempotency key prevents duplicate alert
-- rows for a given instalment/recipient/type/business date.
CREATE OR REPLACE FUNCTION public.generate_loan_due_alerts(p_business_date date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_business_date date := coalesce(p_business_date,(now() AT TIME ZONE 'Africa/Kampala')::date);
  v_created integer := 0;
BEGIN
  WITH active_schedules AS (
    SELECT ranked.*
    FROM (
      SELECT sv.*,
             row_number() OVER (PARTITION BY sv.loan_id ORDER BY sv.version_no DESC, sv.created_at DESC) AS rn
      FROM public.loan_schedule_versions sv
      WHERE sv.schedule_status = 'approved'
    ) ranked
    WHERE ranked.rn = 1
  ),
  paid AS (
    SELECT a.installment_id, sum(a.amount)::numeric(20,2) AS paid_amount
    FROM public.loan_repayment_allocations a
    JOIN public.loan_repayments r ON r.id = a.repayment_id AND r.repayment_status = 'posted'
    GROUP BY a.installment_id
  ),
  balances AS (
    SELECT l.id AS loan_id,l.branch_id,i.id AS installment_id,i.due_date,
           (i.due_date + make_interval(days => sv.grace_period_days))::date AS grace_end_date,
           greatest(0,(i.principal_due+i.interest_due+i.fee_due+i.penalty_due)-coalesce(p.paid_amount,0))::numeric(20,2) AS outstanding_amount,
           greatest(0,(v_business_date-i.due_date))::integer AS dpd,
           CASE
             WHEN i.due_date-v_business_date=7 THEN 'upcoming_7d'
             WHEN i.due_date-v_business_date=3 THEN 'upcoming_3d'
             WHEN i.due_date-v_business_date=1 THEN 'upcoming_1d'
             WHEN i.due_date=v_business_date THEN 'due_today'
             WHEN v_business_date>i.due_date AND v_business_date<=i.due_date+sv.grace_period_days THEN 'grace_period'
             WHEN v_business_date>i.due_date+sv.grace_period_days AND greatest(0,(v_business_date-i.due_date)) IN (1,7,30,60,90) THEN 'escalation'
             WHEN v_business_date>i.due_date+sv.grace_period_days THEN 'overdue'
             ELSE NULL
           END AS alert_type
    FROM public.loans l
    JOIN active_schedules sv ON sv.loan_id=l.id
    JOIN public.loan_installments i ON i.schedule_version_id=sv.id
    LEFT JOIN paid p ON p.installment_id=i.id
  ),
  recipients AS (
    SELECT DISTINCT ep.user_id AS recipient_user_id, b.id AS branch_id
    FROM public.branches b
    JOIN public.employee_profiles ep ON ep.is_active=true
      AND ep.employment_status NOT IN ('suspended','terminated','inactive')
    JOIN public.staff_roles sr ON sr.id=ep.role_id
      AND sr.role_code IN ('loan_officer','branch_manager','bank_admin','system_admin','general_manager')
    WHERE ep.home_branch_id=b.id
       OR EXISTS (
         SELECT 1 FROM public.employee_branch_access eba
         WHERE eba.employee_user_id=ep.user_id AND eba.branch_id=b.id
       )
  ),
  pending AS (
    SELECT bal.*,r.recipient_user_id,
           'loan-due:'||bal.installment_id::text||':'||r.recipient_user_id::text||':'||
           bal.alert_type||':'||v_business_date::text||':'||
           CASE WHEN bal.alert_type='escalation' THEN bal.dpd::text ELSE '0' END AS idem_key
    FROM balances bal
    JOIN recipients r ON r.branch_id=bal.branch_id
    WHERE bal.outstanding_amount>0 AND bal.alert_type IS NOT NULL
  ),
  inserted AS (
    INSERT INTO public.loan_due_alerts(
      loan_id,installment_id,recipient_user_id,alert_type,business_date,due_date,
      days_past_due,outstanding_amount,idempotency_key,delivery_status
    )
    SELECT loan_id,installment_id,recipient_user_id,alert_type,v_business_date,due_date,
           dpd,outstanding_amount,idem_key,'pending'
    FROM pending
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_created FROM inserted;
  RETURN v_created;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_loan_due_alerts(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_loan_due_alerts(date) TO service_role;

COMMENT ON FUNCTION public.list_loan_due_alert_dashboard(uuid, integer) IS
  'Lists unpaid instalments from approved schedule versions with branch-aware authorization; requires the reviewed servicing schema.';
COMMENT ON FUNCTION public.generate_loan_due_alerts(date) IS
  'Creates idempotent in-app alerts for staff. Requires a trusted scheduler and reviewed servicing schema; no external messages are sent.';
