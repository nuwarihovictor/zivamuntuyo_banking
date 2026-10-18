# Full-system integration audit — 18 October 2026

Project: **ZIVAMUNTUYO FINANCIAL SERVICES LTD**  
Repository: `nuwarihovictor/zivamuntuyo_banking`  
Integration branch: `integration/full-system-audit-2026-10`  
Audit approach: inspect repository branches, open feature PR descriptions, release checklist, current app shell and previously read-only Supabase schema. This is a source/release audit, not a financial certification.

## Executive conclusion

The repository contains a substantial single-page banking interface and a broad set of feature branches/drafts. The main blocker is **integration and proof**, not the absence of screens. The project must not be described as production-ready while database migrations, RPC authorization, ledger integrity, browser/device acceptance and a deployment smoke test remain outstanding.

This integration branch is based on `feature/due-date-alerts-account-eligibility`, which includes the newer member/account, loan-servicing design and due-date/account eligibility work together with the release-candidate foundation. It does not merge or close the other PRs automatically; review and merge order remains a repository-owner decision.

## Feature inventory and truth status

| Area | Present in source/design | Still required before claiming complete |
|---|---|---|
| Authentication and staff roles | Supabase email/password shell and role/branch-aware UI patterns | Test session expiry, inactive staff, all RPC permissions, branch isolation, and recovery |
| Branch management | Admin-oriented branch management UI and secure RPC SQL draft | Apply reviewed SQL in test DB; test duplicate/canonical branches and non-admin denial |
| Customers / identity | Member register, identity precheck and account policy draft | Resolve existing duplicate NIN/passport values, add verified DB-level uniqueness safely, test privacy |
| Individual and joint accounts | IND/JNT types and an IND eligibility SQL draft | Joint account currently needs multi-holder UI/RPC and approval guard; test concurrent requests and all account statuses |
| Account registers | Search/filter/export UI; stored vs ledger balance distinction | Verify actual query scope, reconciliation differences, export authorization and Excel compatibility |
| Deposits / withdrawals / receipts | Transaction UI and receipt print layout for posted records | Verify values derive from posted transactions; ledger idempotency/reversals and real printer tests |
| Transfers / accounting / reports | Existing screens and several ledger/report SQL files | Audit all posting paths; prove balanced journals, reversals, trial balance and report-to-ledger reconciliation |
| Loans | Application workflow and client-side schedule preview | Preview is not a posted schedule; authoritative schedule versions, repayments, allocations, arrears, journals, collections and alerts remain unimplemented |
| Loan due-date alerts | Design and schema draft with status legend/escalation | No live schedule/instalment/alert tables verified; no generator, scheduler, notification delivery or tested dashboard |
| Staff chat / VIC LINE | Group inbox, voice-note UI, polling and settings in release source | Test RPC/storage policies; DMs, live calls and closed-app push are not complete; polling requires app open |
| Staff attendance | Attendance foundation and device compatibility documentation | Actual fingerprint device/SDK, trusted connector, device mapping, deduplication and Windows 10/11 hardware tests |
| Payroll / income / expenses / shares | Existing screens and SQL modules | Test permissions, posting, audit trails, totals and accounting reconciliation against test data |
| Windows 10/11 and Android | Responsive browser app; test plan | Manual Chrome/Edge tests on Windows 10 and 11, Chrome on Android; printer and biometric hardware tests |
| Deployment and domain | Vercel project previously configured; deployment was quota-blocked in prior work | Verify current status, environment settings, preview, domain/DNS, auth redirect URLs, logs and rollback |

## Critical risks to close first (P0)

1. **Never rely on client-side balances or eligibility rules.** Database functions and posted ledger entries must be authoritative.
2. **Financial writes must be atomic and idempotent.** Repeat submission, timeout/retry, reversal, and concurrent posting tests must not duplicate money movement.
3. **Maker-checker and branch scope must be enforced in trusted database code**, not merely hidden buttons.
4. **Review every SQL draft against the live schema in a separate test project.** This audit does not authorize applying SQL to production.
5. **Customer identity and joint ownership must be enforced server-side.** One customer may hold one individual account and any permitted joint accounts, but not multiple individual accounts. Joint accounts require at least two valid holders before approval.
6. **Receipts must be evidence of a posted transaction**, not a way to create or modify one.
7. **No invented loan arrears.** Due/overdue labels must be derived from approved schedules and posted/allocated repayments using the agreed business date and grace-period policy.
8. **Do not simulate fingerprint scanning.** Store no raw fingerprint templates in browser code; use a tested vendor SDK/terminal adapter.
9. **Keep secret keys server-side.** Browser code may use only the Supabase publishable/legacy anon key with correctly configured RLS and RPC permissions.

## Integration and validation changes in this branch

- Add a dependency-free release guard to check required app files, local asset references, branding, core navigation/auth shell, and obvious accidental secret-key exposure.
- Extend GitHub Actions to run JavaScript syntax checks and the release guard on pull requests and the integration/release branches.
- Maintain the release checklist and feature truth table so design-only features cannot be misreported as available.

These automated checks are static guardrails; they do not prove database authorization, financial correctness, successful deployment or hardware compatibility.

## Recommended sequence

### Gate 1 — consolidate and statically validate
- Review this integration branch against main and each feature PR.
- Run GitHub Actions on the exact candidate commit.
- Review any code conflicts instead of blindly merging branch heads.

### Gate 2 — test database first
- Create/confirm a non-production Supabase test project with representative anonymized data.
- Apply migrations in dependency order only after reviewing schema assumptions and grants/RLS.
- Test account eligibility and multi-holder joint-account approval.
- Test deposit, withdrawal, transfer, fee, repayment and reversal flows for balanced journals and idempotency.
- Review Supabase security advisors and test authorized/unauthorized branch access.

### Gate 3 — operational acceptance
- Test customer/account filters and exports with confidential sample records.
- Test receipt print on intended 80 mm printer and ordinary Windows printer.
- Test VIC LINE with two staff users across same/different branches, including voice-note upload and expiry.
- Test normal attendance first; fingerprint adapter remains deferred until exact device/SDK is chosen and tested.
- Test Chrome and Edge on Windows 10/11 and Chrome on Android.

### Gate 4 — preview then production
- Confirm Vercel deployment limits/status and project/team target.
- Verify environment variables without exposing secrets; confirm Supabase auth redirect URLs and custom domain.
- Deploy preview and smoke-test sign-in, member lookup, account opening, deposit/withdrawal, receipt, reports, chat and branch restrictions.
- Back up production data, document rollback, and obtain explicit release approval before production migration/deployment.

## Definition of done

A feature is complete only when the UI, trusted database operation, permissions, audit trail, failure/retry path, automated checks and relevant manual acceptance tests agree. A screen, draft SQL file, successful syntax check or preview calculator alone does not meet this standard.

## Current release status

**NOT READY FOR PRODUCTION.** This branch adds integration documentation and static validation; it does not apply Supabase SQL, merge all PRs, connect fingerprint hardware, implement loan repayment posting, or deploy to Vercel. Those limits are intentional and visible so financial data is not put at risk by an unverified “all done” claim.


## Live deployment observation — 18 October 2026

- The Vercel project `zivamuntuyo_banking` has an existing deployment in **READY** state from branch `feature/due-date-alerts-account-eligibility` (commit `548df359db42bbb1fb1226d37a821151de5fdba7`). Its preview URL returned HTTP 200 when fetched; this confirms the HTML is served, not that login or banking operations have passed end-to-end tests.
- Existing preview: https://zivamuntuyobanking-axxjzwgfu-infonuwarihovictor-1047s-projects.vercel.app
- The project alias `zivamuntuyobanking.vercel.app` is registered and verified in Vercel. It is a Vercel subdomain, not a separately purchased custom domain.
- The Vercel status check on the integration PR commit reported a deployment rate-limit error (“retry in 24 hours”). The GitHub Actions static validation workflow itself completed successfully.
- The integration PR commit has **not** been confirmed deployed. Do not confuse the existing feature-branch preview with this integration branch or with production.
