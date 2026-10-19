# Security test evidence log

Use this log only for a dedicated staging database or disposable PostgreSQL fixture populated with synthetic data. Do not test permissions by changing production staff roles or real customer records.

## Run metadata

- Date/time (UTC):
- Tester:
- Repository commit SHA:
- Migration version:
- Environment name/identifier (do not include secrets):
- Database is confirmed non-production: YES / NO
- Synthetic fixtures only: YES / NO
- Backup/restore procedure verified for staging: YES / NO
- CI run URL:
- Overall result: NOT RUN / PASS / FAIL / BLOCKED

If either environment confirmation is NO or unknown, stop. Do not run financial or access-control probes.

## Per-case evidence

| Test ID | Role and branch fixture | Operation attempted | Expected result | Observed result | Data unchanged verified? | Pass / Fail / Blocked | Evidence link |
|---|---|---|---|---|---|---|---|
| RBAC-01 | | | | | | NOT RUN | |
| RBAC-02 | | | | | | NOT RUN | |
| RBAC-03 | | | | | | NOT RUN | |
| RBAC-04 | | | | | | NOT RUN | |
| RBAC-05 | | | | | | NOT RUN | |
| RBAC-06 | | | | | | NOT RUN | |
| RBAC-07 | | | | | | NOT RUN | |
| RBAC-08 | | | | | | NOT RUN | |
| RBAC-09 | | | | | | NOT RUN | |
| RBAC-10 | | | | | | NOT RUN | |
| RBAC-11 | | | | | | NOT RUN | |
| RBAC-12 | | | | | | NOT RUN | |
| RBAC-13 | | | | | | NOT RUN | |
| RBAC-14 | | | | | | NOT RUN | |
| RBAC-15 | | | | | | NOT RUN | |
| RBAC-16 | | | | | | NOT RUN | |

## Required review before release

- [ ] Every denied action was rejected by the database, not just by UI logic.
- [ ] Cross-branch access attempts returned no protected records.
- [ ] Inactive and profile-less identities were denied.
- [ ] Unauthorized direct table access was denied while intended RPC flows still worked.
- [ ] Private messages remained participant-scoped.
- [ ] Failed cash operations left no partial journal, ledger legs, balance update, status transition, or success audit event.
- [ ] Duplicate posting was rejected without a second ledger entry pair.
- [ ] All monetary checks were run using synthetic data and one currency per comparison.
- [ ] All failed or blocked cases have an owner and follow-up issue.
- [ ] Exact-head CI result and staging evidence were reviewed by the release owner.

## Blocker policy

Any successful cross-branch access, inactive-user access, partial financial write, unauthorized direct ledger access, or duplicate posting is a release blocker. Do not apply draft migrations to production as a workaround. Capture sanitized evidence, stop the test, and repair the draft on the working branch.

**Current status:** template only. No staging evidence is recorded by this file. Production changes are not authorized.
