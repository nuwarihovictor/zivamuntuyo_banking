-- Minimal isolated PostgreSQL fixture for executing the two draft migrations.
-- This is not a production schema dump; tests cover migration execution and selected guards.
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

CREATE OR REPLACE FUNCTION public.current_employee_role_code() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.role', true), '') $$;
CREATE OR REPLACE FUNCTION public.current_employee_can_transact_in_branch(uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE OR REPLACE FUNCTION public.is_active_branch_manager_for(uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT true $$;

-- Representative routines used to exercise the search_path/ACL hardening migration.
CREATE OR REPLACE FUNCTION public.approval_limit_allows(text,text,uuid,text,numeric)
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp AS $$ SELECT true $$;
GRANT EXECUTE ON FUNCTION public.approval_limit_allows(text,text,uuid,text,numeric)
TO authenticated;
CREATE OR REPLACE FUNCTION public.record_financial_activity(
  uuid,text,numeric,text,text,uuid,uuid,date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$ BEGIN RETURN; END $$;

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
