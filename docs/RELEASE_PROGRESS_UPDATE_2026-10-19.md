# Release progress update — 2026-10-19 19:54 UTC

## Verified progress
- Consolidated release candidate PR #18 is open as a draft and is not merged.
- Vercel status check for commit `c1a31f8881806467acd95f66d117cf1941882403` reports success.
- GitHub Actions run 39313986630 (run #442, "Disposable PostgreSQL draft-migration tests") completed with conclusion success. Its disposable PostgreSQL preflight step completed successfully.
- These results validate the workflow's checks only; they do not prove live financial correctness or physical printer/hardware compatibility.

## Remaining live security findings (observed 2026-10-19)
- 22 RLS-enabled tables have no policies; investigate table-by-table, as some may intentionally be accessible only through RPCs.
- `public.branch_directory_public` flagged as SECURITY DEFINER view.
- 68 SECURITY DEFINER functions executable by authenticated users; review authorization checks and intended grants individually.
- Review duplicate/overlapping branch SELECT policies and duplicate indexes separately.

## Branding
- Current `logo.svg` is a custom approximation/wordmark illustration. The browser shows a compact Z icon, so the exact final company logo has not been verified. Replace only after locating an approved source asset.

## Credential administration
- Proposed secure design is documented in `docs/CENTRAL_STAFF_CREDENTIAL_ADMINISTRATION.md`.
- The Settings page currently has approval-limit management but not yet the requested central staff credential management UI/server endpoint.
- Do not clear or disable passwords. Implement invite/reset and email change through a server-side Auth Admin operation with role checks and audit logging.
- Do not expose the Supabase service-role key in browser code or GitHub.

## Remaining production gates
1. Implement and test central credential administration in staging.
2. Establish and test an authorized system-administrator onboarding/recovery process.
3. Verify exact approved company logo.
4. Review role approval limits, ledger sign convention and balance reconciliation, idempotency, concurrency, and audit rollback against real schema in disposable staging.
5. Run RLS/SECURITY DEFINER review; fix each issue intentionally, without blanket grants/policies.
6. Test receipt printing with a real X/thermal printer; test staff chat persistence/privacy and attendance authorization. Fingerprint support needs model-specific SDK/driver testing.
7. Verify backup/restore and rollback procedures.
8. Obtain explicit approval before any production migration.

No live production database changes were made by this progress check.
