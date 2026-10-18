-- Shareholding, account-opening package and teller collection schema for Zivamuntuyo.
-- Live SQL RPCs are defined in Supabase and source code is kept in app.js.
create table if not exists public.customer_share_transactions (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
 branch_id uuid not null references public.branches(id), account_id uuid references public.bank_accounts(id),
 share_count integer not null check (share_count > 0), price_per_share numeric(14,2) not null default 10000 check(price_per_share=10000),
 total_amount numeric(14,2) not null check(total_amount>0),
 source text not null check(source in ('account_opening_package','additional_purchase','adjustment')),
 receipt_number text not null unique, received_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists customer_share_transactions_customer_idx on public.customer_share_transactions(customer_id,created_at desc);
create table if not exists public.account_opening_collections (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
 account_id uuid not null unique references public.bank_accounts(id), branch_id uuid not null references public.branches(id),
 collected_by uuid not null references auth.users(id), receipt_number text not null unique,
 amount numeric(14,2) not null default 30000 check(amount=30000), share_amount numeric(14,2) not null default 10000 check(share_amount=10000),
 security_reserve numeric(14,2) not null default 8500 check(security_reserve=8500),
 bundled_opening_costs numeric(14,2) not null default 11500 check(bundled_opening_costs=11500),
 checkbook_included boolean not null default true, transaction_logbook_included boolean not null default true,
 account_opening_form_included boolean not null default true,
 collection_status text not null default 'received' check(collection_status in ('received','reversed')), created_at timestamptz not null default now()
);
create table if not exists public.account_security_ledger (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
 account_id uuid not null references public.bank_accounts(id), branch_id uuid not null references public.branches(id),
 entry_type text not null check(entry_type in ('opening_reserve','monthly_deduction','top_up')),
 amount numeric(14,2) not null check(amount>0), fee_due numeric(14,2), shortfall numeric(14,2), period_month date,
 receipt_number text, recorded_by uuid not null references auth.users(id), notes text, created_at timestamptz not null default now(),
 constraint security_monthly_unique unique(account_id,period_month)
);
create index if not exists account_security_ledger_account_idx on public.account_security_ledger(account_id,created_at desc);
create table if not exists public.loan_processing_fee_collections (
 id uuid primary key default gen_random_uuid(), loan_application_id uuid not null unique references public.loan_applications(id),
 customer_id uuid not null references public.customers(id), branch_id uuid not null references public.branches(id),
 collected_by uuid not null references auth.users(id), receipt_number text not null unique,
 amount numeric(14,2) not null default 10000 check(amount=10000),
 collection_status text not null default 'received' check(collection_status in ('received','reversed')), created_at timestamptz not null default now()
);
create table if not exists public.stationery_collections (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
 branch_id uuid not null references public.branches(id),
 item_type text not null check(item_type in ('replacement_cheque_book','replacement_transaction_logbook')),
 amount numeric(14,2) not null, receipt_number text not null unique, collected_by uuid not null references auth.users(id),
 collection_status text not null default 'received' check(collection_status in ('received','reversed')), created_at timestamptz not null default now(),
 constraint stationery_fixed_price check((item_type='replacement_cheque_book' and amount=2500) or (item_type='replacement_transaction_logbook' and amount=1500))
);
alter table public.customer_share_transactions enable row level security;
alter table public.account_opening_collections enable row level security;
alter table public.account_security_ledger enable row level security;
alter table public.loan_processing_fee_collections enable row level security;
alter table public.stationery_collections enable row level security;
drop policy if exists "Staff can view shares within authorized branches" on public.customer_share_transactions;
create policy "Staff can view shares within authorized branches" on public.customer_share_transactions for select to authenticated using(public.current_employee_can_transact_in_branch(branch_id));
drop policy if exists "Staff can view opening collections within authorized branches" on public.account_opening_collections;
create policy "Staff can view opening collections within authorized branches" on public.account_opening_collections for select to authenticated using(public.current_employee_can_transact_in_branch(branch_id));
drop policy if exists "Staff can view security ledger within authorized branches" on public.account_security_ledger;
create policy "Staff can view security ledger within authorized branches" on public.account_security_ledger for select to authenticated using(public.current_employee_can_transact_in_branch(branch_id));
drop policy if exists "Staff can view loan fees within authorized branches" on public.loan_processing_fee_collections;
create policy "Staff can view loan fees within authorized branches" on public.loan_processing_fee_collections for select to authenticated using(public.current_employee_can_transact_in_branch(branch_id));
drop policy if exists "Staff can view stationery collections within authorized branches" on public.stationery_collections;
create policy "Staff can view stationery collections within authorized branches" on public.stationery_collections for select to authenticated using(public.current_employee_can_transact_in_branch(branch_id));
grant select on public.customer_share_transactions,public.account_opening_collections,public.account_security_ledger,public.loan_processing_fee_collections,public.stationery_collections to authenticated;
revoke insert,update,delete on public.customer_share_transactions,public.account_opening_collections,public.account_security_ledger,public.loan_processing_fee_collections,public.stationery_collections from anon,authenticated;

-- RPCs created in the live database:
-- record_account_opening_package_collection(customer_id, account_id): records UGX 30,000,
-- issues one UGX 10,000 share, and reserves UGX 8,500 for security.
-- record_additional_share_purchase(customer_id, branch_id, share_count): UGX 10,000/share.
-- record_account_security_top_up(account_id, amount, receipt_number): teller top-up.
-- apply_monthly_account_security_fee(account_id, period_month): up to UGX 1,000 monthly.
-- record_loan_processing_fee_collection(application_id): fixed UGX 10,000 fee.
-- record_stationery_collection(customer_id, branch_id, item_type): cheque book UGX 2,500;
-- transaction log book UGX 1,500.
-- get_customer_share_eligibility(customer_id, requested_amount): 1 share per UGX 100,000
-- as a guideline only; shareholding never guarantees approval.
