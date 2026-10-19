# ZIVAMUNTUYO FINANCIAL SERVICES LTD — Banking System

This repository contains the responsive banking application interface, Supabase authentication integration, draft database migrations, and isolated security/regression tests. It is still under development and is **not approved for live banking transactions**.

## Current development scope

- Supabase email/password sign-in and employee profile integration.
- Draft account eligibility and branch/ledger access hardening.
- Staff chat UI and draft row-level-security migration.
- Manual staff attendance punches and draft row-level-security/sequence guards.
- Receipt printing UI for posted cash transactions.
- Disposable PostgreSQL 17 tests and source-level regression tests.
- Baseline Vercel browser security headers.

Features depending on a draft migration are not active in a database until that migration is reviewed and installed through an approved release process. Manual attendance is not fingerprint verification. Receipt printing must be verified with the actual printer and operating system.

## Safe deployment setup

1. In Supabase Project Settings → API / API Keys, copy the project URL and public publishable key (or legacy anon key).
2. Configure the expected public Supabase URL and publishable/anon key in the application using the project's approved configuration approach.
3. **Never** put a Supabase `service_role` key or any secret in browser JavaScript, a public repository, a Vercel client-side variable, or the Windows attendance client.
4. Import the private repository into Vercel. Review the deployment and security headers before sharing the URL with staff.
5. Keep production migrations disabled until reviewed against the actual production schema and validated in a production-shaped staging environment.

## Development checks

Run the source-level regression suite from the repository root:

```bash
node --check app.js
python -m unittest discover -s tests -p 'test_*.py' -v
```

For Windows field testing, use the [Windows 10/11 acceptance checklist](docs/WINDOWS_10_11_FIELD_ACCEPTANCE.md). The checklist records required evidence; it does not mean hardware tests have already passed.

The GitHub Actions workflow creates an isolated PostgreSQL 17 service, parses and applies draft migrations, and runs fixture-level assertions. Fixture tests are not a full copy of production and do not replace staging integration tests.

## Release gates — do not skip

Follow the [staging and release runbook](docs/STAGING_RELEASE_RUNBOOK.md) for the controlled staging, acceptance, go/no-go, and rollback process.


- Compare every draft function replacement with its live production definition and review all callers and grants.
- Test authorization, branch boundaries, approval separation, duplicate posting, ledger balance, failure rollback, and idempotency against a production-shaped schema.
- Complete the SECURITY DEFINER function and RLS/grant audit, then review Supabase security-advisor findings.
- Test staff chat with real authenticated staff accounts and confirm inactive employees are blocked.
- Test receipts on the actual thermal/X printer, paper width, encoding, reprint behavior, and Windows 10/11.
- Confirm fingerprint reader model numbers and vendor-supported Windows 10/11 SDK/driver/API before building the trusted connector.
- Verify backup restoration, monitoring, audit retention, account recovery, and role-based access.
- Obtain an explicit release approval before applying migrations or enabling live financial transactions.

No production database changes are made by the disposable test workflow.
