# Zivamuntuyo Banking — remaining work and release sequence (2026)

This plan coordinates the open draft pull requests. It is not a claim that the app is production-ready.

## Implemented in source / awaiting review
- [ ] PR #4 — VIC LINE group chat UI, notification tones/settings, branch/bank-wide inbox and voice-note UI.
- [ ] PR #5 — receipt printing for posted deposits and withdrawals.
- [ ] PR #6 — fingerprint attendance integration foundation and Windows 10/11 compatibility plan.
- [ ] PR #7 — coordinated release candidate, validation workflow and release checklist.
- [ ] PR #8 — spreadsheet-style member and account registers, filters and Excel-compatible CSV export.
- All drafts require review and appropriate merge order. PR #8 targets the release branch so it can be incorporated before the release candidate is merged to main.

## Priority 0 — before any production release
1. Confirm the release branch is current with main and review all changes as one release.
2. Audit all transaction RPCs, database policies and role/branch checks. Confirm idempotency, maker-checker approval, posted-ledger balance integrity, reversal handling and audit trails.
3. Review every draft SQL file against the actual Supabase schema in a non-production project; apply and test migrations there first.
4. Test login/logout, expired sessions, inactive employees, least privilege, branch restrictions and account/customer privacy.
5. Verify the production Supabase project and Vercel environment variables; never expose a service-role key in browser code.

## Priority 1 — functional acceptance
- Member register: verify names, CIF, NIN/passport, phone, email, address and status against authorized test records; confirm one member can have multiple linked accounts.
- Account register: verify branch, product, currency, status, stored balance, posted-ledger balance and reconciliation difference. Investigate any mismatch; do not label stored values as audited balances.
- Exports: confirm CSV opens in Excel/Google Sheets, only filtered rows are exported, spreadsheet formula injection is neutralized, and staff understand the privacy implications.
- VIC LINE: apply/test group chat and private voice-note SQL; validate sender identity, channel/branch access, upload path consistency, signed URL expiry, notification duplication, tone controls and mobile microphone behavior. One-to-one direct-message UI/operations remain unfinished until tested.
- Receipts: print posted deposit and withdrawal receipts on the actual 80 mm printer and a standard Windows printer; verify amounts/references come from posted transactions and test popup blocking.
- Attendance: select the actual reader/terminal and test its vendor driver/SDK on clean Windows 10 and Windows 11 computers. Until that happens, fingerprint attendance is a planned foundation, not a working scanner.
- Complete the module walk-through for deposits, withdrawals, transfers, approvals, ledger, expenses/income, reports, branches, staff, attendance and payroll.

## Priority 2 — features to explicitly defer unless separately completed
- Live voice calls: design only; not available.
- Push notifications while the app/browser is closed: not available; VIC LINE polling requires the app to remain open.
- Fingerprint scanning and biometric attendance ingestion: not available until real hardware integration and device tests pass.
- One-to-one direct messages: group channels are implemented in the draft, but the direct-message UI and complete send/read workflow need to be finished and security-tested.
- Cross-device synchronization of VIC LINE preferences: settings currently live in the browser profile.

## Release sequence when Vercel permits
1. Confirm Vercel quota/limit has cleared; inspect the current deployment and environment configuration.
2. Review and merge PR #8 into `release/deployment-readiness-2026` only after member/account UI and data-access checks pass.
3. Finish and validate the other feature PRs; merge only code that passes its release gates into the release branch.
4. Review/apply SQL to a test Supabase project; run financial, access-control and data-integrity tests.
5. Confirm GitHub Actions passes on the exact release commit and run manual tests in Chrome/Edge on Windows 10/11 and Chrome on Android.
6. Deploy a Vercel preview first; smoke-test sign-in, member/account lookup, deposits, withdrawals, receipts, branch access and staff chat.
7. Back up production data and prepare a rollback. Apply approved production migrations in the documented order, then deploy production.
8. Immediately smoke-test production, inspect logs, verify key financial totals and record the deployed commit/migration versions. Roll back if a critical check fails.

## Current status
The new member/account register code passes the JavaScript syntax check and the GitHub Actions static validation workflow on its latest tested commit. This does not replace live database, browser, privacy, financial, or printer tests. No Vercel deployment or production database migration is claimed.


## New requirement — National ID and account eligibility
- [ ] Use one normalized NIN/passport identity per customer/CIF; reuse the existing customer profile for joint accounts.
- [ ] Review duplicate-identity preflight results before enabling the normalized unique index; resolve any collisions with an auditable KYC review.
- [ ] Enforce the requested one-individual-account-per-person rule inside the authoritative account-opening database RPC, while permitting valid joint accounts. Do not rely on browser-only checks.
- [ ] Confirm how pending, active, dormant, frozen, rejected and closed accounts affect eligibility, then test concurrency and bypass attempts.
- Policy/design: `docs/national-id-and-account-opening-policy.md`; SQL preflight draft: `supabase/sql/customer_identity_uniqueness_preflight.sql`.


## Loan servicing and arrears management — newly researched scope
- [x] Add a browser-side repayment schedule preview calculator (flat, reducing-balance equal instalments, reducing-balance equal principal). Preview only; not a booking or accounting workflow.
- [x] Document loan lifecycle, due-date monitoring, grace periods, arrears/DPD, collections, prepayments, rescheduling, collateral/guarantors, reporting, accounting controls and acceptance tests.
- [x] Draft a proposed schema design without applying it to the database.
- [ ] Verify current loan database schema and authoritative RPCs; extend existing tables rather than creating duplicates.
- [ ] Implement server/database-generated and versioned repayment schedules, due-date dashboard and automated business-date arrears calculation.
- [ ] Implement payment capture, allocation, receipts, reversals, balanced journal posting and idempotency with maker-checker.
- [ ] Implement collection work queues, reminders, rescheduling/settlement, collateral and guarantor tracking, write-off and portfolio-at-risk reports.
- [ ] Validate formulas against independently calculated cases and reconcile loan schedules to the posted ledger; obtain credit manager/accountant and compliance sign-off.
- Design: `docs/LOAN_SERVICING_AND_ARREARS_DESIGN.md`; schema proposal: `docs/LOAN_SERVICING_SCHEMA_DRAFT.md`.



## Integration pass — 18 October 2026
- [x] Create a coordinated integration branch based on the newest account-eligibility/loan-servicing feature branch, retaining the release-candidate foundations.
- [x] Add a consolidated system audit, feature-truth matrix, priority gates and recommended merge/deployment order in `docs/FULL_SYSTEM_INTEGRATION_AUDIT_2026-10-18.md`.
- [x] Add a dependency-free static release guard and run it from GitHub Actions alongside JavaScript syntax checks.
- [x] Update project setup/readiness notes to state clearly which capabilities are drafts versus production-tested.
- [x] Restore mobile browser zoom for accessibility.
- [ ] Review the integration PR and wait for its GitHub Actions result.
- [ ] Run test-project SQL migrations and role/branch security tests; no live schema changes are included in this pass.
- [ ] Implement and test joint-account multiple-holder UI/RPC and approval guard.
- [ ] Implement trusted loan schedule/repayment/alert lifecycle and reconcile it to accounting journals.
- [ ] Complete browser, Android, Windows, printer and selected fingerprint device acceptance.
- [ ] Verify current Vercel quota, preview deployment, domain, production environment and rollback readiness before release.

The integration pass improves project coordination and automated static checks. It does not mark the release gates above as passed.
