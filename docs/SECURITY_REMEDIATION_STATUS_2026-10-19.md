# Security remediation and disposable test status — 2026-10-19

## Environment and safety

- All schema inspection in the connected Supabase project was read-only.
- No production schema, privileges, authentication settings, customer records, or transactions were changed.
- A GitHub Actions workflow provisions an ephemeral PostgreSQL 17 service and destroys it at the end of the run. It does not connect to Supabase or create a paid Supabase branch.
- The minimal fixture is a migration/guard regression harness, not a complete clone of the production database.

## Verified disposable CI results

Run 9 (commit `7703e1f7915ea76a8b013e27b476e9ef731dd369`) completed successfully:
- Python static regression tests passed.
- PostgreSQL SQL parsing passed.
- Both account/branch/ledger draft migrations executed successfully against the disposable fixture.
- Assertions passed for individual-account duplicate rejection, inactive currency/customer rejection, joint-account holder minimum, active-only public branch directory, and ledger direct-table ACL revocation.

A follow-up test was added for inactive-currency rejection through the legacy `open_account_request` RPC. A third draft migration and tests were then added to pin selected SECURITY DEFINER search paths and remove direct authenticated access to the internal approval-limit helper. The latest run must pass before these newer additions are considered verified: [GitHub Actions](https://github.com/nuwarihovictor/zivamuntuyo_banking/actions).

## Security findings and changes prepared

### Branch directory and ledger grants

The draft `20261019050000_harden_public_branch_directory_and_ledger_grants.sql`:
- Converts `branch_directory_public` to an invoker-security, security-barrier view.
- Grants anonymous users only the columns required to display active branches and adds an active-only RLS policy.
- Revokes direct browser-role privileges from `general_ledger_accounts` and `ledger_journal_entries`.

These changes are exercised in the disposable fixture. Production effects remain untested and the migration has not been applied to production.

### SECURITY DEFINER search paths

Read-only metadata review found 18 authenticated-executable SECURITY DEFINER routines with `search_path = public, pg_temp`. The new draft `20261019060000_pin_financial_definer_search_paths.sql` pins their resolution order to `pg_catalog, public, pg_temp`; this places built-ins first and the temporary schema last. Read-only schema ACL checks confirmed that `PUBLIC`, `anon`, and `authenticated` cannot create objects in the live `public` schema.

The internal helper `approval_limit_allows(text,text,uuid,text,numeric)` was found to be directly executable by `authenticated`. The draft migration revokes direct execution from browser roles and grants it to `service_role`; authorized SECURITY DEFINER callers owned by postgres can still call the helper internally. This assumption is covered by the disposable test fixture but must be validated against the complete production call graph before applying.

Functions in the draft list:
- `apply_monthly_account_security_fee`
- `approval_limit_allows`
- `attach_institution_payroll_evidence`
- `check_posted_journal_balance`
- `create_bank_account_request_with_opening_package`
- `get_customer_share_eligibility`
- `get_financial_performance`
- `get_journal_reconciliation`
- `process_institution_payroll`
- `reactivate_dormant_account`
- `record_account_opening_package_collection`
- `record_account_security_top_up`
- `record_additional_share_purchase`
- `record_financial_activity`
- `record_loan_processing_fee_collection`
- `record_stationery_collection`
- `refresh_dormant_accounts`
- `set_role_approval_limit`

This is a targeted search-path hardening pass, **not** a completed function-by-function authorization audit of all 68 routines.

## Still open release gates

1. Run transaction integration tests against a schema faithful to the real transaction tables and RPCs: approval limits, self-approval denial, branch-scope denial, duplicate posting/idempotency, withdrawal balance checks, audit completeness, and ledger balance invariants.
2. Complete the function-by-function authorization/execute-ACL review of all 68 authenticated-executable SECURITY DEFINER routines, including overloads and call paths.
3. Review all 22 RLS-enabled/no-policy tables individually. Most have no direct browser-role grants; the two identified ledger tables are addressed by a draft revocation, but the remaining tables still need an explicit access rationale.
4. Enable leaked-password protection through Supabase Auth settings after confirming the organization’s sign-in policy. This is not a SQL migration and has not been changed.
5. Re-run the Supabase security advisor after the approved non-production migrations and verify branch selection, account opening, transaction approval, and posting through the actual application.

## Transaction scenario coverage added to the disposable harness

The fixture now contains isolated test versions of the three inspected cash-transaction RPCs and minimal ledger tables. The added assertions exercise:
- Requester self-approval denial.
- Approval by a separate authorized user.
- Posting by a third user.
- Two-entry balanced deposit posting and stored balance update.
- Duplicate-post retry rejection without extra ledger entries.
- Insufficient-funds withdrawal rejection with no partial ledger entries.
- Approval-limit denial.
- Cross-branch transaction request denial.

**Important:** these are fixture-adapted copies of the inspected live RPC logic, not direct executions of the live database functions or a complete clone of production. Passing tests prove the scenario harness and the represented rules work in the disposable database; production-shaped integration tests against a schema-faithful non-production database remain required before a release.

## Release decision

Keep PR #15 in draft. Do not apply these migrations to production or enable live transaction processing until the latest CI run passes and the remaining release gates have evidence.


## Latest draft CI result — 2026-10-19 06:08 UTC

GitHub Actions run 151 on commit `b7e8f0ac28db90a4225b521f1e11ede9ea6bb423` completed successfully in the disposable PostgreSQL 17 workflow. The job passed the new `node --check app.js` step, Python regression tests, migration parsing and fixture application, account/branch/ledger assertions, opening-wrapper rollback assertions, staff-chat RLS tests, and staff-attendance transition/RLS tests. This validates the current disposable test harness only; it does not validate the draft functions against the production schema or prove Windows hardware readiness. Vercel still reports a build-rate-limit status, which is separate from this passing GitHub Actions run.
