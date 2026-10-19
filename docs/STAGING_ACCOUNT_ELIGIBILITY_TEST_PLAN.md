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

The migration now uses the exact `IND`/`JNT` codes in the legacy `open_account_request` path. The primary `create_bank_account_request` path still uses code/name matching and should be normalized to exact code checks before production.

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
- `create_bank_account_request` currently detects IND/JNT by code/name regex; change to exact type-code checks before production.
- The new joint-holder RPC and the legacy opening-function replacement need SQL review and staging execution before release.
- The migration preserves existing execute grants for `approve_account_request`; compare ACLs and review SECURITY DEFINER authorization before deployment.
- Keep live financial transactions disabled until account-opening, approvals, ledger posting, permissions, rollback and error handling are verified.
