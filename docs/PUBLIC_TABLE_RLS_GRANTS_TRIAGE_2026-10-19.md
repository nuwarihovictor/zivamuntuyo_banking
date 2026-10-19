# Public-table RLS and grants triage — 2026-10-19

## Scope

Read-only query against the connected Supabase project. No live privileges, policies, or data were changed.

## Findings

The scan found 22 public tables with row-level security enabled but no table policies. In PostgreSQL, absent policies ordinarily mean normal roles cannot see or modify rows through RLS-protected access; however, table grants still need least-privilege review. Table owners and roles that bypass RLS are different trust boundaries.

### Two tables with direct browser-role grants

The following tables had table-level privileges for both `anon` and `authenticated`:
- `general_ledger_accounts`
- `ledger_journal_entries`

The checked grants include SELECT, INSERT, UPDATE, and DELETE. Because RLS is enabled and there are no policies, this does not mean normal browser roles can necessarily access rows. Still, broad direct grants are unnecessary exposure for financial ledger tables and should be revoked unless a documented application path needs them. The draft migration `20261019050000_harden_public_branch_directory_and_ledger_grants.sql` proposes revoking direct browser-role privileges on these tables. It has not been applied to production.

### Remaining 20 tables

The other tables in this scan had no direct table-level privileges for `anon` or `authenticated` in the checked ACL context; grants were limited to `postgres` and `service_role`:
- `application_feature_settings`
- `attendance_policies`
- `audit_events`
- `bank_settings`
- `branch_management_settings`
- `country_administrators`
- `employee_security_settings`
- `exchange_rates`
- `ledger_accounts`
- `ledger_entries`
- `ledger_journals`
- `loan_applications`
- `loans`
- `receipt_registry`
- `sql_test`
- `transaction_approval_rules`
- `transaction_approvals`
- `transaction_limits`
- `transactions`
- `transfer_requests`

## Review decisions still required

1. Verify application code and RPCs do not rely on direct browser-role access to the two ledger tables.
2. Confirm the draft revoke migration in a schema-faithful non-production environment and test all legitimate ledger read/report paths.
3. Determine whether `sql_test` is a temporary table that should be removed through a separately reviewed migration; do not delete it automatically.
4. Review policies and grants on all public tables, not only these 22, including tables with policies and any exposed views.
5. Re-run the Supabase security advisor after approved remediation.

## Important limitation

This is an ACL/RLS triage, not a complete access-control certification. It does not analyze every view, function, trigger, ownership relationship, inherited role, or API call path. Do not apply changes to production or enable real-money operations based only on this report.
