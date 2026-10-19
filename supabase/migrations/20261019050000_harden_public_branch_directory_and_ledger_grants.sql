-- Draft security hardening only. Do not apply to production without staging tests.
-- PostgreSQL 17 supports security_invoker views.
--
-- The public branch selector intentionally exposes only active branch labels.
-- Make it honor caller privileges/RLS rather than running with view-owner rights.
-- The anonymous policy and column-level grants expose only the same minimal
-- directory fields; anonymous users do not receive address, country, timezone,
-- or other branch-table columns.
ALTER VIEW public.branch_directory_public
  SET (security_invoker = true, security_barrier = true);

GRANT SELECT (id, branch_code, branch_name, is_head_office, is_active)
  ON public.branches TO anon;

DROP POLICY IF EXISTS branches_public_directory_anon_select ON public.branches;
CREATE POLICY branches_public_directory_anon_select
  ON public.branches
  FOR SELECT
  TO anon
  USING (is_active = true);

-- These financial tables have RLS enabled but no table policies. The live
-- database currently grants anon/authenticated direct table privileges, which
-- do not permit row access under the current no-policy RLS state but are
-- unnecessary for a safe RPC-only design. Remove direct access and use audited
-- SECURITY DEFINER RPCs for authorized operations. Re-check app usage in staging.
REVOKE ALL PRIVILEGES ON TABLE public.general_ledger_accounts
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ledger_journal_entries
  FROM PUBLIC, anon, authenticated;

-- This is a draft only. Validate the branch-selector login flow, all ledger
-- RPCs, and privilege behavior on a separate PostgreSQL database before release.
