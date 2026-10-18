# Zivamuntuyo Banking — deployment readiness register

Project: ZIVAMUNTUYO FINANCIAL SERVICES LTD
Release branch: release/deployment-readiness-2026
Production target: Vercel project zivamuntuyo_banking

This is the source checklist for the next coordinated release. A feature is not production-ready just because its UI or SQL draft exists.

## Included in the release candidate branch
- [x] VIC LINE platform 2026 branding and responsive chat UI.
- [x] VIC LINE sound choices, volume, test tone, local appearance/density preferences and optional browser notification permission UI.
- [x] Bank-wide and active-branch conversation list, intended to display 10+ channels where available.
- [x] 30-second foreground polling for bank-wide/branch messages and voice notes.
- [x] Draft SQL for secure group chat RPCs and private voice-note storage/metadata.
- [x] Posted deposit and withdrawal receipt printing, including 80 mm layout.
- [x] Fingerprint attendance architecture and Windows device compatibility documentation.
- [x] Consolidated release acceptance checklist and static JavaScript syntax workflow.

## Important remaining implementation work

### P0 — financial safety and release integrity
- [ ] Audit database policies and all transaction RPCs for authentication, role checks, branch scope, idempotency, balance consistency, and audit trail.
- [ ] Verify account balances and transaction reports are derived from posted ledger entries only; test reversals and duplicate submissions.
- [ ] Review every SQL migration against the actual Supabase schema before applying anything.
- [ ] Test login, sign-out, expired sessions, inactive staff, role restrictions, branch restrictions and recovery paths.
- [ ] Confirm production environment variables and Supabase project are correct; never expose service-role keys in browser code.
- [ ] Run end-to-end smoke tests against a non-production/test database before any production deployment.

### P1 — VIC LINE
- [ ] Review and apply supabase/sql/secure_staff_chat.sql and supabase/sql/staff_voice_notes.sql in a test Supabase project; fix schema/policy issues revealed by execution.
- [ ] Verify storage object paths and table metadata stay consistent; clean up orphaned uploads; test signed playback URLs and expiry.
- [ ] Add and test one-to-one private staff conversations. The current inbox is bank-wide and branch group channels; it is not yet a full Instagram-style DM system.
- [ ] Test messages and voice notes across two authorized staff accounts, including branch isolation and inactive users.
- [ ] Verify polling does not duplicate alerts, miss new messages, or alert for the sender's own messages.
- [ ] Test audio formats, microphone denial, stop/discard/re-record, 120-second limit, 3 MB limit, mobile browsers, and storage failure.
- [ ] Decide whether live voice calls are in scope for the first release. Current implementation is design-only; do not advertise calls as available.
- [ ] Consider push notifications only if background/closed-app delivery is required; current polling requires the app to remain open.

### P1 — receipt printing
- [ ] Confirm the record being printed is the actual posted ledger transaction and values cannot be changed by manipulating client-side HTML.
- [ ] Test deposits and withdrawals, pop-up blocking, long values, currency formatting, and duplicate print attempts.
- [ ] Test an actual 80 mm thermal printer plus standard Windows printing.

### P1 — attendance and fingerprints
- [ ] Confirm required attendance rules and correction approval workflow.
- [ ] Select exact fingerprint terminal/reader model and vendor SDK; do not buy hardware based on generic compatibility claims.
- [ ] Test vendor drivers/SDK on clean Windows 10 and Windows 11 machines.
- [ ] Implement a trusted device connector or documented vendor API adapter, device-to-branch registration, employee mapping, duplicate-event protection, and audited correction flow.
- [ ] Keep fingerprint templates/raw biometric data out of the browser and avoid central biometric storage unless separately approved.
- [ ] Until the real hardware adapter passes tests, label fingerprint attendance as planned/not available; do not simulate a scan.

### P1 — application completeness
- [ ] Walk every existing module: accounts, deposits, withdrawals, transfers, approvals, ledger, expenses/income, reports, branches, staff/roles and attendance.
- [ ] Confirm each create/update action handles loading, success, validation errors, server errors and retry without duplicate financial posting.
- [ ] Test data export/backup and a documented recovery procedure.
- [ ] Verify mobile responsive behavior and keyboard/accessibility basics.



### P1 — member and account register (new)
- [ ] Verify the spreadsheet-style customer register shows authorized CIF, legal name, NIN/passport, phone, email, address, status and registration date.
- [ ] Verify account register shows account number, linked member, CIF, contact/address, branch, product, currency, stored balance, posted-ledger balance, reconciliation difference and status.
- [ ] Verify search and status filters work across the full loaded dataset and the table scrolls horizontally on phone screens.
- [ ] Verify CSV exports open correctly in Excel and Google Sheets, export only currently filtered rows, and neutralize spreadsheet-formula injection.
- [ ] Confirm exported member/account data requires a confirmation and is handled as confidential financial information.
- [ ] Confirm one customer may have multiple accounts and the account-to-member relationship is accurate; test with authorized sample records.
- [ ] Verify member/account lists remain limited by Supabase row-level security and branch authorization.
- [ ] Investigate reconciliation differences before production; stored balances must not be presented as audited balances.

## Release gates — must all pass before production
- [ ] Static syntax workflow passes on the exact release commit.
- [ ] SQL reviewed and applied in test; database permission tests pass.
- [ ] No known critical/high severity security or financial correctness defects.
- [ ] Manual end-to-end tests pass on Chrome and Edge on Windows 10 and Windows 11, plus Chrome on Android.
- [ ] Receipt printer test passes on the intended hardware.
- [ ] If fingerprint attendance is promised for launch, real reader/terminal tests pass; otherwise it remains clearly marked as a later phase.
- [ ] If live calls are promised for launch, call signalling, STUN/TURN, permission, reconnect, authorization and cross-network tests pass; otherwise leave it out of the release claim.
- [ ] Vercel environment variables and domain configuration reviewed; preview deployment smoke-tested first.
- [ ] Production deployment is approved only after preview verification and a rollback plan.

## Deployment sequence when Vercel permits
1. Confirm the Vercel deployment quota/limit has cleared and inspect the latest deployment state.
2. Finish review of the release branch and its pull request; resolve conflicts with current main.
3. Apply reviewed SQL migrations to a test Supabase project and run authorization/financial tests.
4. Run the static workflow and browser/device acceptance tests.
5. Deploy a Vercel preview, test sign-in and critical workflows, and confirm logs show no blocking errors.
6. Merge only the validated release; deploy production, smoke-test immediately, and keep the previous working deployment available for rollback.
7. Apply production migrations only in the approved sequence with a backup/recovery plan.
8. Record release commit, migration versions, test results and any deferred features.

## Current truth about readiness
The release candidate is not production-ready yet. The new code is on a GitHub release branch, not live in Vercel. SQL files are drafts and have not been applied to the live Supabase database. Browser/device/printer/fingerprint tests have not been completed. Do not represent fingerprint scanning, one-to-one direct messages, live calling, or push delivery as available until their release gates pass.

### Loan servicing and due-date management
- [x] Loan application intake and supporting document workflow exists in the candidate UI.
- [x] Added non-posting repayment schedule calculator preview; three illustrative monthly methods.
- [x] Added loan servicing design and schema draft documentation.
- [ ] No claim of complete loan servicing until authoritative schedules, due-date dashboard, repayments, allocation, arrears, collections, ledger integration and audit controls pass acceptance tests.


## Integration branch update — 18 October 2026
The coordinated audit branch `integration/full-system-audit-2026-10` is based on `feature/due-date-alerts-account-eligibility`, which carries the newer loan-servicing and account-eligibility work together with the release-candidate UI foundations. See `docs/FULL_SYSTEM_INTEGRATION_AUDIT_2026-10-18.md` for the consolidated status matrix.

New static CI checks validate core files, navigation shell, local asset references, responsive CSS presence and obvious accidental secret-key exposure. These checks are not a substitute for database security tests or browser/device acceptance. The audit branch does not apply SQL, merge itself, or deploy to Vercel.

**Still release-blocking:** server-side individual/joint account eligibility and complete joint-holder approval; tested RLS/RPC/ledger integrity; authoritative loan schedules, repayments, arrears and reminders; real fingerprint-device integration if required for launch; receipt/chat testing; Windows 10/11 and Android acceptance; and verified Vercel preview/domain/rollback.
