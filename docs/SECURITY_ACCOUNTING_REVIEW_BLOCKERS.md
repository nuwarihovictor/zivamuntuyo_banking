# Security and accounting review — remaining release blockers

**Scope:** read-only review of production configuration/schema observations plus review of draft branch code/migrations. This document does not authorize production changes. Production database and live data were not modified.

## Security findings to resolve before release

1. **RLS coverage:** a prior read-only inventory found 22 RLS-enabled tables with no policies. Some may intentionally be RPC-only, but each table needs a documented access model, role/caller review, and negative test. Do not assume “RLS enabled” alone proves intended access.
2. **SECURITY DEFINER functions:** the inventory flagged 68 functions executable by authenticated users. Review each function's owner, fully pinned search path, input validation, branch/role enforcement, grants, and all callers. Avoid blanket revokes until each legitimate browser RPC path is mapped.
3. **Ledger table grants:** production inspection found direct `anon`/`authenticated` privileges on `general_ledger_accounts` and `ledger_journal_entries` even though RLS is enabled and no policies were present. The draft hardening migration revokes these privileges; validate every ledger read/write flow against a separate production-shaped database before applying it.
4. **Public branch directory:** draft migration changes `branch_directory_public` to `security_invoker` and grants only minimal columns to `anon`. Test the login/branch-selection flow and confirm no other view or function leaks address or operational data.
5. **Production/draft drift:** live cash RPCs were previously found to lack the draft's active-employee checks, posting audit event, and reapproval rejection. This is a known production security/integrity gap; draft migrations are not live protection until safely tested and approved.
6. **Customer KYC:** the draft review RPC checks active staff, role, branch scope, pending-only transition, reason length, and writes an audit event atomically. Verify table/function grants, audit table permissions, cross-branch denial, inactive reviewer denial, and rollback in disposable PostgreSQL and then staging.
7. **Staff chat/attendance:** test participant privacy for direct messages, active employee checks, RLS on event history, and rejection of spoofed sender IDs. Manual attendance must remain explicitly non-biometric.
8. **Deployment boundary:** preview database configuration is intentionally inert. Do not restore production credentials or point preview at the unrelated school database. Vercel build-rate limits must not be bypassed by paying for an upgrade.

## Accounting and financial integrity checks

- Keep currency totals separate; never net UGX against USD or another currency.
- Require equal total debits and credits for each currency and investigate all differences rather than hiding them.
- Reconcile account balances to posted ledger liabilities/journals per branch, account, currency, and reporting period.
- Verify trial balance date filters and opening/closing balance semantics; the current `list_trial_balance` path was noted as active-account-only rather than date-filtered.
- Document normal-balance/sign conventions and mappings from ledger accounts to assets, liabilities, equity, income, and expenses. Verify profit/loss and balance-sheet equations using independently prepared fixtures.
- Exercise duplicate requests, concurrent posting, failed audit inserts, failed ledger writes, reversals, and rollback; no partial balance, journal, status, or success-audit changes may remain.
- Verify each receipt's reference, transaction type, amount/currency, branch, account, date, and posted status match the committed ledger record. A receipt print action is not proof that a transaction posted.
- Payroll, account-opening, and dormant-reactivation receipts contain distinct formatting and fixed-value logic; review each against approved product/accounting rules before release. Never use test receipts as financial evidence.

## Required evidence and no-go conditions

- Exact-head CI success for the reviewed code and test commit.
- Separate staging at no additional cost with correct schema, grants, RLS, roles, and synthetic data; if unavailable, staging stays blocked.
- Negative access tests and accounting reconciliation across branches/currencies.
- Backup restore evidence, auth recovery, monitoring/audit-retention review, and Windows/browser/printer acceptance.
- Explicit release approval after all applicable evidence is reviewed.

**Current decision: NO-GO.** Continue local/disposable testing only. Do not merge, deploy live, apply production migrations, write production banking data, purchase hardware, or enable paid services.
