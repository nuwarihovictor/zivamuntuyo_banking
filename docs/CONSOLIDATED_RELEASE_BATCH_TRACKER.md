# Zivamuntuyo Banking System — consolidated release batch tracker

**Purpose:** execute the remaining work as one coordinated release batch, with code, automated tests, staging evidence, and hardware acceptance tracked together. A checklist or passing unit test is not proof of production readiness.

## Current source-control checkpoint

- Repository: nuwarihovictor/zivamuntuyo_banking
- Working branch: fix/account-eligibility-guards-2026-10-19
- Pull request: [Draft PR #15](https://github.com/nuwarihovictor/zivamuntuyo_banking/pull/15)
- Production changes: **none authorised or performed by this batch**
- Latest code-focused batch commit: `04ecda310de5a8801bb22e50ecc667532f75daa1` (receipt posted-status gate and reprint labels).
- Full disposable PostgreSQL preflight passed for that code commit: [run #39224606015](https://github.com/nuwarihovictor/zivamuntuyo_banking/actions/runs/39224606015). This tracker update itself requires a fresh exact-head CI run before release.
- Release state: **NO-GO until all applicable gates below are evidenced and an authorised release owner approves**

## Consolidated work matrix

| Workstream | Code / automated work | Required evidence before release | State |
|---|---|---|---|
| Code and CI | Consolidated `python scripts/release_preflight.py` runs JavaScript syntax, all Python regressions, SQL parsing, fixture setup, six draft migrations, and five PostgreSQL assertion scripts; database phase requires explicit disposable opt-in + loopback + `banking_test` | Green workflow for exact final SHA, test logs retained | Code-focused batch passed on `04ecda310de5a8801bb22e50ecc667532f75daa1` in run #39224606015; a fresh run is required for the tracker-update commit |
| Banking workflows | Verify account eligibility, individual/joint holder rules, deposits, withdrawals, approval separation, posting idempotency, ledger legs, audit atomicity, branch/currency boundaries | Production-shaped staging tests with synthetic data; debit/credit reconciliation and rollback evidence | Staging not confirmed |
| Reports and accounting | Trial balance summary and CSV export use the authorized `list_trial_balance` RPC and group totals by currency; CSV escaping and formula-injection protections have regression tests | Reconciled report outputs for each test currency and branch in staging | Code/test coverage exists; accounting reconciliation in staging remains unverified |
| Database security | Compare each replaced function with current schema; inspect owner, SECURITY DEFINER search path, execute grants, table grants, RLS policies, and every caller | Approved staging migration run and role/branch negative tests | Not confirmed |
| Customer privacy | Minimise customer-directory fields; avoid displaying full national ID/passport values; preserve honest loading/error/empty states | Regression tests plus role-based staging verification | Code updated; tests need green run |
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
