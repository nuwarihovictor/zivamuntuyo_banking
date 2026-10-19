# SECURITY DEFINER Targeted Review — 2026-10-19

Scope: read-only inspection of selected live function definitions in Supabase project `hwghiezvghdqxnhcnpwk`. No database objects or data were changed. This is a targeted pass, not a complete audit of all 68 routines.

## Workflow validation

The draft migration workflow run `39203789577` completed successfully. It parsed and executed draft migrations against disposable PostgreSQL 17 and passed the existing account/joint-holder/branch-view/grants/search-path assertions. This does not validate all live production functions or prove production transaction flows safe.

## Functions inspected

- `admin_create_branch(...)`: checks authenticated caller and `is_active_system_admin()`; validates branch code/name, active country, supported time zone, reserved historical names, and duplicate code/name. Search path is empty and referenced application objects are schema-qualified.
- `update_staff_profile(...)`: restricted to active system administrators; validates required fields, status/sex values, HTTPS photo URL, active home branch, and role existence. It does not independently validate every optional field or enforce unique employee numbers in the function body; rely on constraints and test those cases.
- `set_role_approval_limit(...)`: requires an active role returned by `current_employee_role_code()` matching general manager/system administrator; validates role/action/currency/amount/reason and writes an audit event. Verify unique constraint/upsert behavior under concurrent edits and confirm only intended executives can invoke it.
- `list_printable_cash_receipts(...)`: checks authentication, active employee profile, allowed roles, date range, posted deposit/withdrawal status, and per-row branch access. No direct cross-branch disclosure path was evident in the inspected query.
- `send_staff_message(...)`: checks authenticated active sender and recipient, disallows self-messaging, bounds message length, and checks access if a branch is supplied. Test cross-branch messaging policy when `p_branch_id` is NULL and confirm whether that behavior matches intended company policy.
- `staff_clock_out(...)`: only accepts `web` self-service clock-out, requires active employee profile, and updates only the caller's open record for the Kampala work date. Fingerprint/admin clock-out is intentionally not supported by this RPC; device integration needs a separate trusted authorization path.
- `current_employee_role_code()` and `current_employee_has_branch_access(uuid)`: both derive access from `auth.uid()` and an active employee profile; branch helper allows system/bank admins, home branch, or explicit branch access.
- `get_customer_account_balance(uuid)`, `get_branch_dashboard_summary(uuid)`, `list_staff_attendance(...)`, `list_staff_timesheets(...)`, and `list_loan_applications(uuid)`: inspected definitions include role gates and/or branch filters. Keep tests for a user with no active profile, a user with access to only one branch, and a caller supplying a different branch ID.

## Findings and next checks

1. No confirmed privilege-escalation defect was established in this targeted sample.
2. The inventory still shows 68 `SECURITY DEFINER` functions executable by `authenticated`; each public RPC should have a documented reason for browser-role execution, narrow grants, and a caller/branch authorization test.
3. `approval_limit_allows(...)` remains the standout helper to restrict from direct browser execution, as already addressed in the draft migration. Before release, verify its expected callers can still invoke it after the privilege change and run approval/review integration tests.
4. The wrapper `create_bank_account_request_with_opening_package(...)` still needs an integration test proving a failure in package collection rolls back the preceding account-request write.
5. Do not apply these draft migrations to production until the remaining audit and non-production integration tests pass and the release is explicitly approved.

## Evidence limits

The review used catalog metadata and selected `pg_get_functiondef` output from the live project. It did not execute financial transactions, alter privileges, change auth settings, inspect every view/trigger/policy, or test real fingerprint/receipt hardware.
