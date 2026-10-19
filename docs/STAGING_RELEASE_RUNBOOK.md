# Staging and release runbook

**Status:** required procedure; not evidence that staging or production has passed.

## Non-negotiable safeguards

- Do not use production customer data in manual tests. Prefer synthetic data in an isolated staging project.
- Never paste a service-role key, database password, Vercel token, or other secret into source control, browser code, chat, or logs.
- Do not apply the draft migrations directly to production. Do not enable live banking transactions until the release owner has reviewed the evidence and explicitly approved release.
- If staging cannot faithfully reproduce production schema, functions, grants, RLS policies, extensions, and auth roles, stop and resolve the difference before applying migrations.
- The workflow that runs disposable PostgreSQL tests is not a production-shaped staging test.

## A. Prepare staging

- [ ] Create a dedicated Supabase staging project and a preview deployment target.
- [ ] Record project ref, current schema version, app commit SHA, migration list, database version, extensions, auth settings, and RLS state.
- [ ] Obtain a schema-only baseline from the authorized database owner; do not copy unredacted production data.
- [ ] Seed synthetic staff for each role and branch, synthetic customers, individual and joint accounts, multiple currencies, and ledger fixtures.
- [ ] Verify backup restoration in a separate isolated environment before testing any destructive operation.
- [ ] Confirm the Vercel preview points only to staging URL and publishable key. Verify no service-role key is shipped to the browser.

## B. Review each draft migration before applying

Review the following files in order, along with every function they replace and all their callers:

1. `supabase/migrations/20261019043000_account_eligibility_guards.sql`
2. `supabase/migrations/20261019050000_harden_public_branch_directory_and_ledger_grants.sql`
3. `supabase/migrations/20261019060000_pin_financial_definer_search_paths.sql`
4. `supabase/migrations/20261019070000_require_active_employee_for_cash_rpcs.sql`
5. `supabase/migrations/20261019080000_staff_chat_active_employee_rls.sql`
6. `supabase/migrations/20261019090000_staff_attendance_event_rls.sql`
7. `supabase/migrations/20261019100000_customer_kyc_review_rpc.sql`

Before applying each migration, capture relevant function definitions, ownership, execute grants, table privileges, policies, and dependencies. Confirm that revoking direct access does not break a legitimate browser RPC path. Apply only to the staging project through the approved database change process.

## C. Banking acceptance tests (staging only)

- [ ] Sign in with active and inactive staff profiles. Inactive users must be denied by the database, not merely hidden by the UI.
- [ ] Verify teller, accountant, branch manager, bank administrator, and system administrator permissions separately.
- [ ] Verify branch A users cannot read or mutate branch B records without explicit cross-branch authorization.
- [ ] Test customer onboarding, pending-review status, audited approve/reject decisions, required reason, inactive-reviewer denial, and cross-branch review denial.
- [ ] Open an account for an active customer using an enabled currency; reject pending/rejected customers, inactive branches, inactive currencies, and unsupported products.
- [ ] Test individual-account duplicate prevention under two concurrent requests.
- [ ] Create a joint account, add a second distinct active holder, then approve. Approval must fail while fewer than two eligible holders exist.
- [ ] Test deposit and withdrawal request, independent approval, posting, and receipt printing.
- [ ] Confirm request creator cannot approve/post their own transaction where separation-of-duties rules apply.
- [ ] Test wrong currency, wrong branch, frozen/inactive account, insufficient funds, duplicate post, stale approval, and concurrent post.
- [ ] Inject a ledger or audit failure and verify the entire transaction rolls back with no partial journal or balance update.
- [ ] Reconcile stored balances against posted ledger liabilities for every test account and currency; investigate every difference.
- [ ] Confirm audit entries identify actor, branch, action, amount/currency, and journal reference as appropriate.
- [ ] Confirm private direct messages remain participant-only and are not exposed by group chat.
- [ ] Confirm staff group chat and attendance deny inactive employees and unauthorized identities.

## D. Device and browser acceptance

- [ ] Run the [Windows 10/11 field checklist](WINDOWS_10_11_FIELD_ACCEPTANCE.md) on actual supported Windows machines.
- [ ] Test supported current Edge and Chrome, zoom, keyboard use, lost connection, expired sessions, and recovery.
- [ ] Record receipt printer manufacturer/model, driver, connection, paper width, and test results. Test posted deposit/withdrawal receipts, clipping, feed/cut, and reprint labeling.
- [ ] Record fingerprint reader manufacturer/model/firmware and vendor SDK/API/driver version. Test enrolment and matching with vendor-supported tooling. Do not label manual punches as biometric.
- [ ] Do not store raw fingerprint images in the browser or put service-role credentials in a local Windows connector.

## E. Go/no-go record

Record the following in the release ticket:

- [ ] Exact reviewed commit SHA and migration checksums.
- [ ] CI run link and result for that exact SHA.
- [ ] Staging project ref and confirmation it is separate from production.
- [ ] Test results, failed cases, reconciliations, and evidence with personal data/secrets removed.
- [ ] Backup and restore evidence, monitoring, audit retention, and incident/recovery contact.
- [ ] Confirmation that Supabase Auth leaked-password protection and security-advisor findings were reviewed.
- [ ] Authorized release approver and approval timestamp.

**No-go conditions:** any failing authorization test, unexplained ledger discrepancy, partial posting/rollback failure, broken private-message isolation, missing backup/restore evidence, unverified migration dependency, or untested live hardware requirement.

## F. Release and rollback planning

Only after explicit release approval, follow the organization’s controlled production change process. Apply migrations in the reviewed order with a verified backup and named operator. Validate schema/function grants and critical financial workflows immediately after each approved change. Do not automatically run a destructive reverse migration; prepare and review a recovery plan for each change in advance. If any financial invariant fails, stop new transactions, preserve logs, reconcile affected journals, and invoke the approved incident process. Do not attempt ad-hoc edits to production balances.
