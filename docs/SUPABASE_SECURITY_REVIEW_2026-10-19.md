# Supabase security review — 19 October 2026

Project: `hwghiezvghdqxnhcnpwk`  
Method: read-only schema inspection and Supabase security advisor results. No production SQL was applied.

## Advisor findings

The advisor returned the following items at the time of inspection:

1. **One view flagged for default security-definer behavior:** `public.branch_directory_public`. It returns only `id`, `branch_code`, `branch_name`, and `is_head_office` for active branches, and the app uses it to let staff select a branch before signing in. This is intentionally public-facing data, but the view's RLS-bypass behavior must be explicitly reviewed and documented or replaced with a least-privilege public branch-directory endpoint. Do not simply switch it to security-invoker without testing pre-login branch selection; anonymous users currently need this directory.
2. **22 tables had RLS enabled but no RLS policies.** This can be intentional when all access is through carefully authorized RPCs and direct table access should be denied. It is not automatically a defect. For each table, confirm whether direct Data API access is needed; if not, keep direct access denied and test the RPC path. If direct access is needed, add narrow policies rather than a blanket authenticated policy.
3. **68 SECURITY DEFINER functions were executable by authenticated users.** That advisor warning is not proof that all 68 are exploitable; many are intended RPCs. Each exposed function needs a review for:
   - explicit `auth.uid()` / active employee validation;
   - role and branch-scope checks in the function body;
   - a fixed/empty `search_path` and schema-qualified object names;
   - minimal EXECUTE grants (revoke PUBLIC/anon unless explicitly required);
   - maker-checker separation, idempotency and audit logging for financial writes;
   - tests for both authorized and unauthorized callers.
4. **Account opening approval gap:** live `approve_account_request(uuid)` did not check the minimum number of distinct holders for JNT accounts. The live `create_bank_account_request(...)` definition did not include the new serialized IND eligibility guard from the repository draft. Both are release blockers for joint-account/individual-account eligibility until a reviewed migration is applied.
5. **Loan servicing tables and RPCs:** repayment schedules, allocations and due alerts are not yet installed in the live schema. The new dashboard and alert-generator SQL remains a draft.

## Financial integrity snapshot

The read-only diagnostics in `supabase/tests/financial_integrity_diagnostics.sql` returned no rows at the time of the check. The related aggregate checks found zero detected posted-journal imbalance/currency mismatch/missing posting audit fields, zero stored-vs-ledger balance differences, zero customers with multiple open IND accounts, and zero non-closed/non-rejected JNT accounts with fewer than two distinct holders.

This snapshot does not establish that all transaction paths are correct, and it does not mitigate the advisor findings above.

## Required remediation sequence

- [ ] Export a current inventory of all public SECURITY DEFINER functions and their grants.
- [ ] Review the highest-risk financial functions first: transaction request, approve, post, transfer, fees, payroll, share transactions, loan application review and account opening.
- [ ] Add integration tests for unauthorized role, inactive employee, wrong branch, self-approval, duplicate/retry and invalid state for each sensitive RPC.
- [ ] Decide and document whether the public branch directory is an intentional anonymous disclosure; keep its output limited to non-sensitive fields.
- [ ] Review every RLS-enabled/no-policy table and record whether RPC-only access is intentional.
- [ ] Apply changes only in a non-production project, run advisor checks again, test the application, then prepare a separately reviewed production migration.

## Useful advisor references

- [Security-definer view lint](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [Authenticated execution of SECURITY DEFINER functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

**No live security change has been made.** Do not bulk-revoke functions or add broad RLS policies without confirming which app modules depend on them.


## Follow-up live check — 19 October 2026, 04:06 UTC

The read-only financial-integrity diagnostic script was executed against the connected live project. It returned an empty anomaly set for the checks listed in the script. Do not interpret this as a full audit or as permission to enable untested financial features.

The Supabase advisor was queried again and reported:
- 22 tables with RLS enabled and no table policies (RPC-only access may be intentional, but must be verified table by table).
- 1 security-definer view: `public.branch_directory_public`.
- 68 security-definer functions executable by authenticated users. Review their internal authorization and grants individually; do not bulk-revoke them because some are required application RPCs.

The existing attendance schema uses one daily record per employee/date and accepts `fingerprint` as an attendance method, but there is no verified hardware ingestion path. The new `attendance_device_connector_schema_draft.sql` is additive design work only; it has not been applied to production. It records device event metadata, not biometric templates, and restricts the ingestion RPC to `service_role`.

## Next safe database gate

A separate Supabase development branch is needed to test the account, loan servicing, private-message and attendance migrations against the actual PostgreSQL version and constraints. The branch-creation quote returned **US$0.01344 per hour** (about US$0.32 per 24 hours if left running). Do not create it without explicit cost approval. Until staging exists, no production migration is being applied.
