# Staging test plan — account eligibility guards

This migration is a **draft for staging review only**. Do not apply it to production until the SQL has been applied and tested on a separate staging project, function ACLs have been reviewed, and the UI has been verified.

## Confirmed account types

The current database seed values are:
- `BUS` — Business Account
- `FIX` — Fixed Deposit Account
- `GRP` — Group Account
- `IND` — Individual Account
- `INS` — Institutional Account
- `JNT` — Joint Account

The migration uses exact `IND`/`JNT` type codes in both account-opening paths. Both `create_bank_account_request` and the legacy `open_account_request` now validate currency against the active `public.currencies` catalogue rather than relying on a hard-coded list or a three-letter format check alone.

## Preconditions

1. Restore a recent database backup to a non-production Supabase project.
2. Apply the draft migration only to that staging project.
3. Inspect function execute grants before and after migration, especially `approve_account_request(uuid)`, `open_account_request(uuid,uuid,uuid,text)`, `create_bank_account_request(uuid,uuid,uuid,text,text)`, and `add_pending_joint_account_holder(uuid,uuid)`.
4. Confirm the deployed client’s account-opening flow and receipt/opening-package path. `create_bank_account_request_with_opening_package` delegates to the canonical create function, but the UI must be regression-tested.
5. Confirm whether the legacy account-opening function’s generated account-number format and default `product_type` are relied on by reports or the UI.

## Required tests

- [ ] Valid individual request through `create_bank_account_request`: succeeds once and remains pending approval.
- [ ] Valid individual request through legacy `open_account_request`: succeeds once and remains pending approval.
- [ ] Second individual request for the same customer through either entry point: rejected.
- [ ] Two concurrent IND requests through the same entry point and mixed entry points: only one succeeds.
- [ ] Existing closed/rejected individual account does not block a new request.
- [ ] Joint request with one holder: approval is rejected.
- [ ] Add a second distinct active customer using `add_pending_joint_account_holder`; approval succeeds for an authorized approver.
- [ ] Adding the same customer twice is rejected.
- [ ] Adding a holder to an IND/non-joint or already-approved account is rejected.
- [ ] A customer outside the caller's authorized branch scope cannot be added.
- [ ] Inactive employee and unauthenticated caller are rejected.
- [ ] Teller/accountant cannot approve an account.
- [ ] Branch manager cannot approve an account outside their authorized branch.
- [ ] Bank admin/general manager/system admin follows the existing intended cross-branch policy.
- [ ] Inactive branch, inactive account type, invalid product and unsupported currency are rejected.
- [ ] A failed request leaves no partial account or holder rows.
- [ ] Audit event is written for successful request, holder addition and approval only.
- [ ] Existing UI branch selector, account opening, opening-package receipt, and account approval continue to work.
- [ ] The account-number format remains compatible with the existing client and reports.
- [ ] Run repository CI and Supabase security advisors after staging tests pass.

## Important review notes

- The migration is not deployed to Supabase and has not been run against a staging database yet.
- Advisory locks serialize requests only when all relevant creation paths use compatible locks; test both paths under concurrency.
- Currency availability is validated against the active currency catalogue. This avoids accepting a code such as USD when it is not configured in the current database.
- The new joint-holder RPC and the legacy opening-function replacement need SQL review and staging execution before release.
- Branch-scope checks in both legacy account opening and joint-holder addition use `current_employee_can_transact_in_branch` to align customer scope with transaction access policy.
- The migration preserves existing execute grants for `approve_account_request`; compare ACLs and review SECURITY DEFINER authorization before deployment.
- Keep live financial transactions disabled until account-opening, approvals, ledger posting, permissions, rollback and error handling are verified.

## No-cost read-only validation performed on 2026-10-19

- Verified account-type codes in the connected database: `BUS`, `FIX`, `GRP`, `IND`, `INS`, `JNT`.
- Verified the `account_holders` role constraint permits `owner`, `joint_owner`, `authorized_signatory`, and `beneficial_owner`.
- Verified `bank_accounts` has the expected status and product-type checks, a currency foreign key, and a default product type of `savings`.
- Verified current live RPC ACLs read-only: `authenticated` can execute the three existing SECURITY DEFINER account RPCs (`create_bank_account_request`, `open_account_request`, `approve_account_request`). The proposed `add_pending_joint_account_holder` function does not exist in the live database yet.
- Performed a static source check of the draft migration after switching IND/JNT guards to exact type codes. The static checks passed, but this is not equivalent to PostgreSQL parsing or execution.
- GitHub Actions has not reported a run for the latest draft commit. No staging branch was created because the user declined additional paid Supabase compute.

These checks were read-only. No customer, account, transaction, or production schema data was changed.


## Additional no-cost review on 2026-10-19

- Compared the draft currency allowlist with the live currency catalogue and found USD was not configured although the earlier hard-coded list accepted it. Updated the draft to require a matching active row in `public.currencies`.
- Tightened customer-branch checks in the legacy account-opening and joint-holder paths to use the transaction-scope helper instead of the broader branch-access helper.
- These are source-level corrections only. The migration remains unapplied and must still be parsed/executed against a non-production PostgreSQL database before it can be considered validated.


## Project-wide security blockers observed during read-only advisor check (2026-10-19)

The current Supabase security advisor still reports the following findings. These are not fixed by this account-eligibility draft:

- **ERROR:** `public.branch_directory_public` is a SECURITY DEFINER view. Review whether it should use `security_invoker = true` or be removed from exposed access, after checking the intended branch-directory use.
- **WARN:** 68 SECURITY DEFINER functions are executable by `authenticated`. Review each function's authorization checks and intended caller; do not blanket-revoke grants because some are intentional RPC endpoints.
- **INFO:** 22 public tables have RLS enabled but no policies. Confirm whether access is intentionally mediated only through narrowly authorized RPCs; otherwise add table-specific policies. Do not create broad generic policies.
- **WARN:** Supabase leaked-password protection is disabled. This is an Auth project setting that needs an authorized administrator to enable after checking the desired sign-in policy.

The advisor was read-only. No settings, policies, grants, views, or live database objects were changed. These findings should be tracked and resolved before the system is used for live financial transactions.


## Additional validation work — 19 October 2026

- The canonical `create_bank_account_request` path now also rejects customers whose status is not `active`, matching the legacy account-opening path.
- Added a no-dependency Python unittest file at `tests/test_account_eligibility_migration.py`. From the repository root, run:
  `python -m unittest discover -s tests -p 'test_*.py' -v`
- These tests are static source assertions only. They are intended as a cheap regression guard and do not prove the migration parses or executes correctly in PostgreSQL.
- No GitHub Actions workflow was added, to avoid creating automated runner usage or costs without confirming the repository's billing configuration.


## Targeted financial-RPC review — 19 October 2026

Read-only inspection of four live SECURITY DEFINER RPC definitions found the following. This is source inspection only; no database objects were changed.

| RPC | Observed controls | Follow-up |
| --- | --- | --- |
| `create_cash_transaction_request` | Authenticated caller, role allowlist, positive bounded amount, active account, branch transaction access | Confirm helper role checks also enforce active employment; consider explicit audit event for request creation |
| `approve_cash_transaction_request` | Active employee, role allowlist, row lock, pending-status/type checks, no self-approval, branch scope, approval limit, audit event | Verify role/limit combinations with negative tests for each role and amount boundary |
| `post_approved_cash_transaction` | Role allowlist, approved/pending status, requester/approver separation, duplicate-posting block, active account, branch scope, matching cash/customer ledgers, withdrawal balance check | Review the full posting function and ledger invariants with database integration tests |
| `record_financial_activity` | Auth, role allowlist, branch scope, amount cap, receipt reference, category restrictions, customer/loan checks, audit event | **Hardening candidate:** its current SECURITY DEFINER setting uses `search_path = public, pg_temp`, unlike the account-opening draft's empty search path. Review and fully qualify object references before changing it. |

Do not change production function definitions or grants as part of this source-only review. A follow-up migration for any financial RPC must preserve its signature, return shape, grants, and current accounting behavior and must be tested outside production first.


## Follow-up source validation — 19 October 2026

- Closed a source-level gap found during review: the legacy `open_account_request` previously checked only that the currency looked like a three-letter code, while the canonical request path checked that the currency was active in `public.currencies`. The legacy path now applies the same active-catalogue check.
- Updated `tests/test_account_eligibility_migration.py` to assert that both account-opening paths validate the currency catalogue.
- Rechecked source-level invariants after the change: all SECURITY DEFINER functions in this draft pin an empty search path; both account-opening paths have active-currency checks; the new joint-holder RPC is revoked from `PUBLIC` and `anon` and granted to `authenticated`.
- These are source checks only. No PostgreSQL runtime test has been run; no GitHub Actions run is available for the latest commit. Do not treat these checks as SQL execution validation or a release approval.
