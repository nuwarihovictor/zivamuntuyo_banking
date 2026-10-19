# Consolidated release tracker — 2026-10-19

## Working branch
`release/consolidated-verification-2026-10-19`

This branch starts from the 64-file security/account-eligibility draft in PR #15 so the application, release scripts, test coverage, Windows field acceptance plan, receipt-printer test page, local attendance import test page, and branding assets can be reviewed together. It is a release-candidate work branch, not production approval.

## Drafts inventoried
- PR #15 `fix/account-eligibility-guards-2026-10-19`: security, account eligibility, receipt/attendance test utilities, release preflight, logo and app updates. Draft; not merged.
- PR #17 `feat/bundled-supabase-cash-hardening-2026-10-19`: cash-posting RPC hardening proposal and staging test matrix. Draft; not merged.
- PR #6 `feature/fingerprint-attendance-foundation`: fingerprint-device integration blueprint and Windows USB connector blueprint. Draft; not merged.

## Read-only live database observations
- Banking Supabase project `hwghiezvghdqxnhcnpwk` reports active/healthy.
- Live migration history includes receipt printing, staff attendance/internal messaging, cash transaction workflow, payroll, dormant-account receipts, and branch-management migrations through `20261018193419`.
- The current live `post_approved_cash_transaction(uuid,uuid)` function has a pinned empty search path and role/approval/branch/account/ledger checks, but the inspected definition does not check `employee_profiles.is_active` and does not write a success audit event.
- The cash-posting draft references columns confirmed in the live schema, including `employee_profiles.is_active`, `ledger_entries.entry_side`, `ledger_accounts.linked_bank_account_id`, and the audit-event columns. This is not sufficient to prove the entire replacement correct.

## Blocking review items before merge
1. Cash posting must enforce configured `role_approval_limits`; verify who may post and whether the role list matches the institution's separation-of-duties rules.
2. Reconcile the cached `bank_accounts.balance` with the posted liability subledger and verify the accounting sign convention against existing journals.
3. Prove concurrency behavior, replay protection, balanced journal legs, and rollback using a disposable staging database. A row lock alone is not evidence that every concurrent path is safe.
4. Review all related RPCs for cash request creation, approval, rejection, listing and receipt access; do not harden only the final posting endpoint.
5. Review the 22 RLS-enabled tables with no policies, SECURITY DEFINER function grants, branch-directory view, duplicate indexes, and overlapping branch policies. Do not add blanket policies.
6. Confirm auth onboarding/admin recovery through supported Supabase Auth flows. Never hard-code credentials or bypass sign-in.
7. Verify the correct company logo source and check it in the browser at mobile and desktop sizes.
8. Test the receipt page on an actual supported thermal/X printer; browser print layout alone does not verify printer compatibility.
9. Fingerprint readers require model-specific SDK/driver integration and a Windows connector; browser-only code cannot promise compatibility with every device. Keep the manual/CSV attendance fallback.
10. Staff chat and attendance require authenticated server-side authorization and privacy tests; local/demo behavior is not proof of production persistence.

## Release gates
- [ ] Run Python and JavaScript/unit tests for the consolidated branch.
- [ ] Run SQL migrations/assertions against a disposable PostgreSQL/Supabase staging environment.
- [ ] Review GitHub Actions results on this exact branch commit.
- [ ] Verify preview login, staff onboarding, and branch access using a dedicated test account.
- [ ] Verify correct logo, receipt output, attendance, and chat.
- [ ] Confirm backup and restore procedure and document rollback SQL.
- [ ] Obtain explicit production approval before applying any migration to the live database.

## Safety boundary
No production migration was applied by this release-preparation work. Do not merge or apply the proposed cash migration merely because Vercel says the web preview is Ready. Vercel deployment status does not validate database migrations or financial accounting.
