# Production read-only security audit — 2026-10-19

## Scope and safety

A read-only metadata review was performed against the Supabase project configured by this repository on 2026-10-19. Queries inspected function definitions and grants, migration history, view options, table privileges, and Supabase security-advisor findings. No SQL writes, migrations, data changes, or deployments were performed.

These observations describe the database at the time of review; re-check before release because production may change.

## Confirmed observations

1. **Cash request RPC:** `public.create_cash_transaction_request(uuid,text,numeric,text)` is SECURITY DEFINER with an empty search path and checks role, account status, branch access, and amount. Its current production body did **not** contain an active-employee-profile check.
2. **Cash posting RPC:** `public.post_approved_cash_transaction(uuid,uuid)` is SECURITY DEFINER with an empty search path. It already blocks posting by the requester or approver, checks pending/approved state, blocks duplicate ledger entries, checks active account and branch access, validates ledger type/currency/branch, checks withdrawal balance, writes two ledger legs, updates the operational account balance, and marks the journal posted. Its current production body did **not** contain an active-employee-profile check or a `cash_transaction_posted` audit event.
3. **Journal reference compatibility:** production creates request references using `gen_random_bytes(3)`. The draft migration was adjusted to preserve this existing generator rather than introduce an unnecessary change.
4. **Direct financial-table privileges:** the read-only privilege check reported browser-role table privileges on `public.general_ledger_accounts` and `public.ledger_journal_entries`, while both tables had RLS enabled and no policies in the advisor findings. The draft hardening migration revokes direct browser-role access. Confirm every application screen uses authorized RPCs before releasing that revocation.
5. **Public branch directory view:** production view options showed `security_barrier=true` but did not show `security_invoker=true`. The draft migration sets both options and limits anonymous access to the minimal active-branch directory. Validate the anonymous branch-selector workflow against staging before release.
6. **Approval-limit helper:** production currently allows authenticated users to execute `public.approval_limit_allows(text,text,uuid,text,numeric)`. A caller search found references in `approve_cash_transaction_request` and `review_loan_application`, both SECURITY DEFINER functions with pinned empty search paths. The draft migration revokes direct browser-role execution and grants the helper to `service_role`; validate both caller paths in staging before release.
7. **Advisor findings:** Supabase reported 22 tables with RLS enabled and no policies, one branch-directory view warning, and 68 SECURITY DEFINER functions callable by authenticated users. These are review signals, not proof that every finding is exploitable: many functions are intentional RPCs, and RLS without policies can intentionally deny direct access. Review each exposed function against an explicit caller/role allowlist.

## Release gates

- Apply draft migrations only to a dedicated staging project/database after backup and recovery arrangements are verified.
- Compare the migration definitions with freshly fetched production definitions immediately before staging.
- Run end-to-end tests for account opening, cash request, approval, posting, withdrawals, branch boundaries, and account/ledger reconciliation.
- Verify failed postings roll back both ledger legs, account balance, journal status, and audit event atomically.
- Verify that authenticated direct table access is denied while authorized RPC workflows still work.
- Verify the public branch selector works anonymously and reveals only approved public fields.
- Review all authenticated-callable SECURITY DEFINER functions and explicitly justify each public RPC.
- Validate printer hardware, biometric hardware, Windows 10/11, and Android separately; fixture CI does not replace device acceptance tests.
- Do not merge or deploy this draft, or apply its migrations to production, without explicit release approval.

## Current branch verification

The disposable PostgreSQL workflow most recently passed on commit `cb765c0b1183691f32144aed878cd60fd36fcb72`. Further compatibility and test changes after that commit require a fresh passing run before being treated as verified.
