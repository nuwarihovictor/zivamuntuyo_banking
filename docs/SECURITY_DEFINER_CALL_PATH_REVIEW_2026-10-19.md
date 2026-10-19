# SECURITY DEFINER call-path review — 2026-10-19

## Scope

Read-only review of selected live function definitions and direct call paths. No production changes were made.

## Approval-limit helper

`public.approval_limit_allows(text,text,uuid,text,numeric)` is a SECURITY DEFINER function executable by `authenticated` at the time of review. It accepts caller-supplied role, action, branch, currency, and amount and returns whether a configured limit allows that combination. It does not itself identify the caller. Direct browser execution creates an authorization-policy oracle and is not needed for the reviewed call paths.

Observed direct references in function bodies:
- `approve_cash_transaction_request(uuid)`
- `review_loan_application(uuid,text,text)`

Both caller functions perform their own authentication and role/branch checks before using the helper. The draft migration revokes direct execution from `PUBLIC`, `anon`, and `authenticated`, and grants execution to `service_role`. Before applying, confirm the deployed function owner can execute the helper and test both callers end-to-end. SECURITY DEFINER callers normally execute nested calls with the caller function's effective owner privileges, but this must be validated against the actual ownership/grants.

## Posted journal balance checker

`public.check_posted_journal_balance(uuid)` is executable by `authenticated` and has no literal `auth.uid()` call in its SQL body. Its query restricts results using `current_employee_can_transact_in_branch(j.branch_id)` and an allowlist of staff roles. It only returns posted journals whose debit/credit difference exceeds 0.005. Continue review of role-helper definitions, branch-access edge cases, null-branch requests, and whether the function is needed by the browser. The pattern scan alone does not identify a confirmed vulnerability.

## Account-opening wrapper and delegated functions

`public.create_bank_account_request_with_opening_package(uuid,uuid,uuid,text,text)` does not itself call `auth.uid()`; it delegates to:
- `public.create_bank_account_request(uuid,uuid,uuid,text,text)`
- `public.record_account_opening_package_collection(uuid,uuid)`

The first delegated function checks for an authenticated user, an active employee profile, an allowed staff role, branch authorization, active branch and account type, customer existence and branch scope, supported product, and supported currency before creating a pending account request and writing an audit event.

The second delegated function checks authentication, allowed staff role, that the account belongs to the selected customer, permitted account status, branch access, and duplicate collection before recording the package and audit event.

Because the wrapper calls both functions in one PostgreSQL transaction, a raised exception from the later call should roll back the earlier writes when invoked as a normal RPC transaction. This behavior still needs a production-shaped integration test, including a deliberately failed collection step to prove no partial account request remains.

## Search-path observations

The live inventory contained 68 SECURITY DEFINER functions executable by `authenticated`: 18 had `search_path=public, pg_temp`, while 50 had an empty search_path. The draft migration targets the 18 non-empty paths only. Empty search_path routines are not included in that change because their current configuration is more restrictive; inspect their fully qualified references and dependencies separately.

## Remaining audit work

This is a targeted call-path review, not the full 68-function audit. Continue with the remaining routines and their dependencies, review views/triggers and object ownership, test each legitimate client RPC, and rerun the security advisor in a controlled environment. Keep migrations in the draft PR; do not apply to production based only on this review.
