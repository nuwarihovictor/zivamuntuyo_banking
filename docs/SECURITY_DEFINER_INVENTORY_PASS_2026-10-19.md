# SECURITY DEFINER inventory pass — 2026-10-19

## Scope and safety

This is a read-only metadata and source-pattern scan of the connected Supabase production project. No database changes were made. It is an initial triage aid, not a completed authorization review; pattern matching cannot prove that a function is secure or insecure.

## Current inventory

A read-only query of `public` found 68 SECURITY DEFINER functions executable by `authenticated`. None of these 68 were executable by `anon` in the checked privilege context. This does not remove the need to inspect every function: authenticated callers still need appropriate identity, role, branch, input, and data-scope guards.

Function configuration scan:
- 50 functions have an empty search_path setting.
- 18 functions use `search_path = public, pg_temp`.
- 0 in this filtered set lacked a function-level search_path setting.

The draft migration `20261019060000_pin_financial_definer_search_paths.sql` targets those 18 routines only. It has not been applied to production. It must remain draft until tested against a schema-faithful non-production database and its callers are reviewed.

## Triage findings from source-pattern scan

Three function definitions did not contain a literal `auth.uid()` reference:
- `approval_limit_allows(text,text,uuid,text,numeric)`: internal policy helper that evaluates a caller-supplied role/action/branch/currency/amount. It must not be exposed as a browser-callable authorization endpoint. The draft migration revokes browser-role execution and grants it to `service_role`; verify the complete caller graph before applying.
- `check_posted_journal_balance(uuid)`: contains branch-access and role checks in its query; review its full return-data scope and branch-null behavior.
- `create_bank_account_request_with_opening_package(uuid,uuid,uuid,text,text)`: delegates to other privileged functions; verify that the delegated path authenticates and authorizes before any writes.

Two function definitions did not match the initial simple text scan for common auth/role guard names:
- `approval_limit_allows(text,text,uuid,text,numeric)`
- `create_bank_account_request_with_opening_package(uuid,uuid,uuid,text,text)`

These are triage flags, not final vulnerability conclusions. Review overloads, nested calls, trigger paths, ownership, grants, and side effects before changing permissions.

## Next review steps

1. Inspect every SECURITY DEFINER function individually, including overloads, to document: intended callers, auth identity check, role/permission check, branch scope, input validation, affected tables, audit trail, and whether direct EXECUTE is required.
2. Trace every caller of `approval_limit_allows` and confirm internal calls continue to work after the proposed browser-role revocation.
3. Review `check_posted_journal_balance` for branch filtering, role restrictions, and whether any caller can request an unbounded result.
4. Review `create_bank_account_request_with_opening_package` and its delegated functions for end-to-end authorization before writes.
5. Review the remaining 22 public tables with RLS enabled but no policies individually; determine direct grants, API exposure, and whether access should be revoked or a least-privilege policy added.
6. Re-run the security advisor and production-shaped integration tests in a controlled non-production environment before any release.

## Release gate

Do not apply draft migrations to production, change live privileges, or enable real-money operations based on this scan alone. The current disposable PostgreSQL fixture is useful regression coverage but is not a complete copy of the production schema and does not directly execute the live RPC definitions.
