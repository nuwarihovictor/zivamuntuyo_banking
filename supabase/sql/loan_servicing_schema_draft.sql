-- DESIGN DRAFT ONLY — DO NOT RUN AGAINST PRODUCTION.
-- Reviewed against current schema on 2026-10-18:
-- public.loans exists, but no authoritative repayment-schedule/installment/payment tables exist.
-- Before converting to a migration, confirm the approved loan disbursement and journal workflow,
-- choose the institution's payment-allocation waterfall, and add reviewed RLS/RPC policies.
-- This file intentionally does not grant client access or schedule a cron job.

create table if not exists public.loan_schedule_versions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  effective_date date not null,
  first_due_date date not null,
  maturity_date date not null,
  interest_method text not null check (interest_method in ('reducing_equal_installment','reducing_equal_principal','flat')),
  repayment_frequency text not null check (repayment_frequency in ('daily','weekly','fortnightly','monthly','custom')),
  annual_interest_rate numeric(9,6) not null check (annual_interest_rate >= 0 and annual_interest_rate <= 100),
  grace_period_days integer not null default 0 check (grace_period_days between 0 and 365),
  schedule_status text not null default 'draft' check (schedule_status in ('draft','approved','superseded','cancelled')),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (loan_id, version_no),
  check (maturity_date >= first_due_date),
  check ((schedule_status <> 'approved') or (approved_by is not null and approved_at is not null))
);

create table if not exists public.loan_installments (
  id uuid primary key default gen_random_uuid(),
  schedule_version_id uuid not null references public.loan_schedule_versions(id) on delete restrict,
  installment_no integer not null check (installment_no > 0),
  due_date date not null,
  principal_due numeric(20,2) not null default 0 check (principal_due >= 0),
  interest_due numeric(20,2) not null default 0 check (interest_due >= 0),
  fee_due numeric(20,2) not null default 0 check (fee_due >= 0),
  penalty_due numeric(20,2) not null default 0 check (penalty_due >= 0),
  created_at timestamptz not null default now(),
  unique (schedule_version_id, installment_no),
  check (principal_due + interest_due + fee_due + penalty_due > 0)
);

create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  receipt_no text not null unique,
  external_reference text,
  idempotency_key text not null unique,
  value_date date not null,
  received_at timestamptz not null default now(),
  amount numeric(20,2) not null check (amount > 0),
  currency_code char(3) not null references public.currencies(code),
  payment_channel text not null check (payment_channel in ('cash','bank_transfer','mobile_money','account_balance','other')),
  repayment_status text not null default 'pending' check (repayment_status in ('pending','posted','reversed','rejected')),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  posted_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  check ((repayment_status <> 'posted') or posted_at is not null),
  check ((repayment_status <> 'reversed') or (reversed_at is not null and reversal_reason is not null))
);

create table if not exists public.loan_repayment_allocations (
  id uuid primary key default gen_random_uuid(),
  repayment_id uuid not null references public.loan_repayments(id) on delete restrict,
  installment_id uuid not null references public.loan_installments(id) on delete restrict,
  component text not null check (component in ('principal','interest','fee','penalty')),
  amount numeric(20,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (repayment_id, installment_id, component)
);

create table if not exists public.loan_due_alerts (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  installment_id uuid not null references public.loan_installments(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  alert_type text not null check (alert_type in ('upcoming_7d','upcoming_3d','upcoming_1d','due_today','grace_period','overdue','escalation')),
  business_date date not null,
  due_date date not null,
  days_past_due integer not null default 0 check (days_past_due >= 0),
  outstanding_amount numeric(20,2) not null check (outstanding_amount >= 0),
  idempotency_key text not null unique,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','delivered','failed','acknowledged','resolved')),
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists loan_schedule_versions_loan_status_idx
  on public.loan_schedule_versions (loan_id, schedule_status, version_no desc);
create index if not exists loan_installments_schedule_due_idx
  on public.loan_installments (schedule_version_id, due_date);
create index if not exists loan_repayments_loan_status_value_date_idx
  on public.loan_repayments (loan_id, repayment_status, value_date);
create index if not exists loan_due_alerts_recipient_status_idx
  on public.loan_due_alerts (recipient_user_id, delivery_status, business_date);

-- RLS is enabled on every new exposed table. Until reviewed policies and trusted RPCs
-- are added, ordinary client roles cannot read or mutate these records.
alter table public.loan_schedule_versions enable row level security;
alter table public.loan_installments enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.loan_repayment_allocations enable row level security;
alter table public.loan_due_alerts enable row level security;

-- Required before production:
-- 1. Validate schedule versions belong to the same loan as installments and allocations.
-- 2. Create trusted transactional RPCs for schedule approval, repayment posting/allocation,
--    reversals and alert generation; journal every posted financial event.
-- 3. Add branch/role-aware RLS policies and restrict direct writes.
-- 4. Add tests for partial payments, overpayments, duplicate requests, reversal, schedule
--    rescheduling, grace periods, timezone, retries and ledger reconciliation.
-- 5. Only then schedule an Africa/Kampala business-date job. Do not notify customers from
--    unapproved draft schedules or claim delivery without provider confirmation.
