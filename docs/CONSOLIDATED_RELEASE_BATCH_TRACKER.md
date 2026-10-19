# Zivamuntuyo Banking System — consolidated release batch tracker

**Purpose:** execute the remaining work as one coordinated release batch, with code, automated tests, staging evidence, and hardware acceptance tracked together. A checklist or passing unit test is not proof of production readiness.

## Current source-control checkpoint

- Repository: nuwarihovictor/zivamuntuyo_banking
- Working branch: fix/account-eligibility-guards-2026-10-19
- Pull request: [Draft PR #15](https://github.com/nuwarihovictor/zivamuntuyo_banking/pull/15)
- Production changes: **none authorised or performed by this batch**
- Latest combined code/test batch before this tracker refresh: `23ff9cf5505a4422dd995d7dd299482a7b6ad34f` (customer schema alignment, report integrity checks, audited KYC review RPC and PostgreSQL assertions).
- Earlier baseline passed at [run #39226940646](https://github.com/nuwarihovictor/zivamuntuyo_banking/actions/runs/39226940646), before the KYC review migration was added. The KYC-enabled exact-head preflight is still being verified; any subsequent source or test change requires a fresh run.
- Release state: **NO-GO until all applicable gates below are evidenced and an authorised release owner approves**

## Consolidated work matrix

| Workstream | Code / automated work | Required evidence before release | State |
|---|---|---|---|
| Code and CI | Consolidated `python scripts/release_preflight.py` runs JavaScript syntax, all Python regressions, SQL parsing, fixture setup, seven draft migrations, and six PostgreSQL assertion scripts; database phase requires explicit disposable opt-in + loopback + `banking_test` | Green workflow for exact final SHA, test logs retained | Earlier code-focused batch passed; the current KYC-enabled batch must pass on its exact final SHA |
| Banking workflows | Verify account eligibility, individual/joint holder rules, deposits, withdrawals, approval separation, posting idempotency, ledger legs, audit atomicity, branch/currency boundaries | Production-shaped staging tests with synthetic data; debit/credit reconciliation and rollback evidence | Staging not confirmed |
| Reports and accounting | Trial balance summary and CSV export use the authorized `list_trial_balance` RPC and group totals by currency; CSV escaping and formula-injection protections have regression tests | Reconciled report outputs for each test currency and branch in staging | Code/test coverage exists; accounting reconciliation in staging remains unverified |
| Database security | Compare each replaced function with current schema; inspect owner, SECURITY DEFINER search path, execute grants, table grants, RLS policies, and every caller | Approved staging migration run and role/branch negative tests | Not confirmed |
| Customer privacy and onboarding | Minimise customer-directory fields; match the live schema; use secure references; require branch/creator; default new customers to pending review | Regression tests plus role-based staging verification | Draft code updated; exact-head CI and staging pending |
| KYC review | Approve/reject only pending customers through audited SECURITY DEFINER RPC; require reason; enforce active reviewer and branch access; revoke anon customer-table grants | Disposable SQL assertions, then production-shaped staging tests with real role/branch fixtures | New migration and assertions added; exact-head CI pending |
| Staff chat and attendance | Separate group chat from private messages; block inactive staff; manual punches remain clearly non-biometric | Authenticated multi-user staging tests and event transition/deduplication checks | Automated coverage; staging pending |
| Receipts | UI only offers posted cash receipts; print handler now requires explicit posted status, valid cash type/reference/positive finite amount, and labels repeated print actions in the current transaction list | Real printer make/model, driver, paper width, deposit/withdrawal print evidence on Windows 10 and 11; durable reprint audit across reloads if required | Code guard and regression tests passed; physical printer testing and durable reprint audit remain pending |
| Fingerprint attendance | Build only against vendor-supported device SDK/API; keep privileged keys server-side | Reader make/model, firmware, SDK/driver support and witnessed enrolment/matching tests | Blocked on device details |
| Windows 10/11 | Browser, sign-in/session expiry, branch permissions, zoom, keyboard, reconnect, print workflows | Completed Windows 10/11 field acceptance checklist with machine/browser versions and results | Pending physical testing |
| Deployment and recovery | Verify Vercel deployment uses reviewed SHA and correct environment; confirm no secrets in browser; check monitoring and auth recovery | Staging deployment URL, backup restore drill, recovery contact, security review, approved change window | Not confirmed |

## Batch execution order

1. Make the complete source/test changes on this working branch; avoid piecemeal release or production changes.
2. Run syntax and all regression tests. Fix failures in source or tests only when expected behaviour is grounded in implementation and requirements.
3. Run all migrations in disposable PostgreSQL; then run them in a dedicated production-shaped staging database only after schema/function/grant review.
4. Exercise banking flows with synthetic users and data, including negative authorization cases, concurrency, duplicate submission, audit failure, and ledger reconciliation.
5. Run Windows and printer acceptance; confirm exact fingerprint hardware before writing or enabling a device connector.
6. Verify staging deployment, backup restoration, monitoring and incident/recovery steps.
7. Freeze a reviewed commit SHA and collect evidence. Obtain explicit release approval before production migration, merge, or deployment.

## Safety rules

- Never use production customer data in test fixtures.
- Never put Supabase service-role credentials or other secrets in browser JavaScript or a Windows client.
- Do not treat a disposable PostgreSQL fixture as a full copy of production.
- Do not represent manual attendance as fingerprint-verified.
- Do not print a pending/failed transaction as a completed receipt.
- Do not merge or deploy to production, apply production migrations, or write to production banking data without explicit release approval.
- A missing hardware device or staging environment is a genuine blocker, not a checkbox to mark complete.

## Release decision

**Current decision: NO-GO.** Code work can continue in this batch, but real printer/fingerprint/Windows testing and production-shaped staging evidence cannot be honestly completed without the required environment and hardware. The finished release requires all applicable evidence and explicit approval.


## Combined implementation batch — customer onboarding and accounting integrity

- Read-only production schema inspection confirmed `customers.customer_type`, `identification_type`, `identification_number`, `physical_address`, `branch_id`, and `created_by` are the relevant columns; `customer_type` and `branch_id` are required by the schema / insert policy. The prior UI sent mismatched column names, omitted required fields, attempted to mark customers active immediately, and generated a six-digit customer reference. Draft UI now aligns its insert payload to the current schema, requires a visible active branch, records the authenticated creator, uses cryptographic randomness for the unique customer reference, and submits new customers as `pending_review`.
- Trial balance/report UI now validates currency and numeric fields before calculation or export, handles rejected RPC calls, and displays an accessible stop warning if any currency's debit/credit totals differ. Currency totals remain separate; the notice does not replace independent reconciliation.
- Added regression tests for customer schema alignment and financial-report integrity.
- Production inspection was read-only. No production data, schema, migrations, merge, or deployment were changed by this batch. Exact-head CI and staging verification remain required.

- Follow-up within the same combined batch: customer branch choices are now filtered against the database's system-admin, bank-admin branch-access, and branch-manager checks; the directory shows the customer's KYC status so pending customers are not mislabeled as active. This remains UI guidance only—the database RLS policy is authoritative.

- KYC review is now a complete draft workflow: authorized reviewers can approve/reject only pending records, must provide a reason, and the database function records the decision in audit_events under an empty search_path. The new migration also revokes anonymous direct access to customer records. Disposable PostgreSQL assertions cover approve/reject, repeat-decision denial, cross-branch denial, unauthorized-role denial, audit rows, and anon grants.

- The active Supabase project list currently shows the separate candidate project as inactive, so production-shaped staging has not been performed. No attempt was made to activate or modify it.


## Financial statements added to the combined batch

- The live ledger schema constrains `ledger_type` to asset, liability, equity, income, and expense. The report page now builds per-currency cumulative income-statement and balance-sheet views from the same validated posted-ledger RPC rows, displays reconciliation warnings, and provides a formula-safe CSV summary export.
- These are cumulative posted balances, not date-filtered statutory statements. Review account mappings, opening balances, closing entries, and reconciliations in production-shaped staging before treating them as formal financial statements.

- Reporting limitation explicitly shown in the UI and CSV export: the current `list_trial_balance` RPC returns active ledger accounts and has no date-range parameters. Inactive ledger accounts with historical postings may be excluded; the new statements are provisional cumulative views until the RPC/report scope and account mapping are verified in staging.


## Preview / production configuration isolation

- Added a Vercel build step that generates `app-config.js` from public Supabase environment variables. Preview/local builds refuse the live production Supabase URL and reject secret/service-role keys; when no staging config is supplied, the preview stays disconnected instead of writing to production.
- The canonical production hostname retains the existing public-key fallback so this draft change does not require a production env-var mutation. The build script and environment isolation have dedicated regression tests.
- The Vercel project currently has no environment variables configured, and its separate candidate Supabase project is inactive. A functional staging preview therefore remains blocked until a separate active staging project and Preview environment variables are approved/configured.


## Coordinated implementation batch — receipts, staff chat and attendance

- Added receipt-printing regression tests covering posted cash transaction eligibility, invalid/non-positive amounts, escaped receipt fields, blocked pop-ups, and reprint labeling. The disposable PostgreSQL workflow completed successfully on commit `4b088eda4118b22ee396c50a694f86657d195cc3` (run [#39233515546](https://github.com/nuwarihovictor/zivamuntuyo_banking/actions/runs/39233515546)).
- Reviewed manual attendance transition logic and corrected the latest-event query to explicitly filter by the authenticated employee ID and order by the event occurrence time. This prevents the browser UI from choosing a clock-in/clock-out transition based on another employee's event if the signed-in role has broader read access.
- Added regression tests for staff chat authentication, message length limits, safe message rendering, and attendance employee scoping / manual-source labeling.
- Latest code/test commit: `fda7c9d8afa6b9c829290ef0c881b3065dcbd1fa`. The later correction commit `0105b41e3793b6d8f613050869e86dc52db5629a` passed exact-head CI: 86 Python regression tests, JavaScript syntax checks, all seven draft migrations on disposable PostgreSQL 17, and all six SQL assertion scripts. See run [#39234320707](https://github.com/nuwarihovictor/zivamuntuyo_banking/actions/runs/39234320707). Staging and device acceptance remain unverified.
- These are code and regression-test improvements only. Staff attendance remains manual, chat permissions still depend on database RLS, physical receipt printing remains untested, and staging/Windows/hardware acceptance remains outstanding.


## CI failure diagnosis and next verification checkpoint — 2026-10-19

- The exact-head disposable PostgreSQL workflow for commit `33a3431d55d413e1afb685cc4c0ffe41c6728ac4` failed in the Python regression stage, before the database migration assertions ran. The failure was two test-boundary lookups that incorrectly expected the receipt-print function to appear after the attendance function; the application defines the receipt handler earlier in the file. This is a regression-test slicing defect, not evidence of a failed SQL migration.
- Corrective batch: use the attendance function's own closing boundary and explicitly scope attendance-history reads to the authenticated employee, not only to RLS. A new regression assertion checks this UI-level employee filter.
- Exact-head CI must be rerun after this correction. No production deployment or production database change is authorised by this batch.
