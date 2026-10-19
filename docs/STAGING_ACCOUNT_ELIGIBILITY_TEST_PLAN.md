# Staging test plan — account eligibility guards

This migration is a **draft for staging review only**. Do not apply it to production until account type labels and existing function grants have been verified against the live schema and a staging restore.

## Preconditions

1. Restore a recent database backup to a non-production Supabase project.
2. Inspect `public.account_types` and confirm the exact type_code/type_name values used for individual and joint ownership. The migration currently detects labels containing `individual`/IND and `joint`/JNT. Update detection to exact codes once confirmed.
3. Inspect the existing execute grants on `approve_account_request(uuid)` and compare them before/after migration.
4. Confirm the application’s account-opening UX has a supported way to add the second holder to a joint account before approval. The current request function creates only the primary holder, so a joint account should remain pending until the second holder is added through an authorized flow.

## Required tests

- [ ] Valid individual request: succeeds once and remains pending approval.
- [ ] Same customer submits a second individual request: rejected.
- [ ] Two simultaneous individual requests for the same customer: only one succeeds.
- [ ] Existing closed/rejected individual account does not block a new request.
- [ ] Joint request with one holder: approval is rejected.
- [ ] Joint request with two distinct eligible holders: approval succeeds for an authorized approver.
- [ ] Two holder rows for the same customer do not satisfy the two-holder minimum.
- [ ] Inactive employee and unauthenticated caller are rejected.
- [ ] Teller/accountant cannot approve an account.
- [ ] Branch manager cannot approve an account outside their authorized branch.
- [ ] Bank admin/general manager/system admin follows the existing intended cross-branch policy.
- [ ] Inactive branch, inactive account type, invalid product and unsupported currency are rejected.
- [ ] A failed request leaves no partial account or holder rows.
- [ ] Audit event is written only for a successful approval.
- [ ] Existing UI branch selector and account opening continue to work.

## Important review notes

- Advisory locks serialize requests only when all paths use this function; other account-creation paths must be audited too.
- The IND/JNT label matching is intentionally a provisional guard. Exact seeded codes must be confirmed before release.
- The migration does not change approval function grants; compare existing ACLs and review SECURITY DEFINER authorization before deployment.
- Run Supabase security advisors and application CI after staging tests pass.
