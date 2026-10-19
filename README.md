# ZIVAMUNTUYO FINANCIAL SERVICES LTD — Banking System

Responsive browser-based banking application source, with Supabase authentication/data access and a single-page JavaScript interface. The source includes banking modules and feature foundations, but **the repository is not by itself proof of a production-ready core banking system**.

## Current release status

- Main application files: `index.html`, `styles.css`, `app.js`.
- Backend: Supabase project integration using a browser-safe publishable key.
- Automated checks: JavaScript syntax validation and a dependency-free static release guard in GitHub Actions.
- Compatibility target: current Chrome/Edge on Windows 10 and Windows 11, plus Chrome on Android; hardware-dependent features still require real device tests.
- Current release gate: **not approved for production** until database/RPC security, accounting integrity, test-project migrations, browser acceptance and deployment smoke tests pass.

See:
- [Full-system integration audit](docs/FULL_SYSTEM_INTEGRATION_AUDIT_2026-10-18.md)
- [Remaining work plan](docs/REMAINING_WORK_PLAN_2026.md)
- [Deployment readiness register](docs/DEPLOYMENT_READINESS_2026.md)
- [Release acceptance tests](docs/RELEASE_ACCEPTANCE_TESTS.md)
- [Read-only financial integrity diagnostics](supabase/tests/financial_integrity_diagnostics.sql)
- [Supabase security review](docs/SUPABASE_SECURITY_REVIEW_2026-10-19.md)
- [Loan servicing design](docs/LOAN_SERVICING_AND_ARREARS_DESIGN.md)
- [Loan servicing schema draft](docs/LOAN_SERVICING_SCHEMA_DRAFT.md)
- [Fingerprint attendance compatibility](docs/attendance-device-compatibility.md)
- [Manual attendance clock RPC draft](supabase/sql/staff_attendance_clock_rpc_draft.sql)

## Local development

1. Download or clone this repository.
2. Open `index.html` in a modern browser for a static UI check, or serve the folder using a local static web server for a more representative test.
3. Use a **dedicated non-production Supabase project** for development and testing.
4. Confirm the Supabase URL and publishable/legacy anon key are correct in `app.js`. Never put a Supabase secret or service-role key in browser code.
5. Configure authentication redirect URLs and RLS/RPC permissions in Supabase before signing in with test users.
6. Run the automated static checks locally with Node.js 22:
   ```bash
   node --check app.js
   node --check scripts/validate-release.mjs
   node scripts/validate-release.mjs
   ```

## Database safety

Files under `supabase/sql/` are not automatically applied just because they are committed. Review each SQL file against the current schema, apply it to a separate test project, test authorization and data integrity, and only then prepare a reviewed production migration. Never run an unreviewed draft directly against production.

For any live-money operation, the database must be authoritative for authentication, role and branch scope, idempotency, maker-checker approval, double-entry journal posting, balance updates, reversals and audit logs. UI totals or preview calculations are not substitutes for posted ledger entries.

## Features that still require real integration/testing

- Loan due-date dashboard and draft schedule/repayment/alert schema are present in this integration branch; trusted repayment posting/allocation, ledger integration, schema validation, and scheduled alert generation remain pending.
- Joint-account holder UI and draft server-side approval guard are present in this integration branch; database migration, concurrency and authorization tests are still required before live use.
- Real fingerprint reader/terminal connector, vendor SDK, Windows driver validation and audited attendance ingestion.
- Private one-to-one staff messaging UI and draft send/read RPCs are present in this integration branch; RPC installation/authorization tests remain pending. Live voice calls and push notifications when the browser is closed are not implemented.
- Actual 80 mm thermal printer validation and full Chrome/Edge/Android acceptance.
- Vercel preview deployment, environment review, custom-domain configuration, production approval and rollback drill.

Do not represent a design, preview calculator, UI control or draft SQL file as a working production feature until its database operation and acceptance tests pass.


## Integration branch update — 19 October 2026

The current review branch includes the joint-account holder interface, VIC LINE private-message interface, database-backed loan due-date dashboard, and draft SQL contracts. The release guard checks these expected interfaces. The latest earlier CI run failed because its checked-out commit still used an outdated receipt assertion; the assertion has since been corrected in the branch. A fresh workflow run must pass before this branch is considered release-ready. No live Supabase migration or production deployment has been performed.
