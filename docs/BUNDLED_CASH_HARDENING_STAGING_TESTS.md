# Bundled Supabase cash hardening — staging acceptance tests

**Status:** Proposed change on `feat/bundled-supabase-cash-hardening-2026-10-19`. Not applied to the live database.

## Scope of this bundle
- Adds an explicit active-employee-profile requirement to `post_approved_cash_transaction`.
- Keeps the request row, customer account, cash ledger, and customer subledger locked during posting.
- Writes a success audit event in the same database transaction as the ledger posting.
- Explicitly denies function execution to `PUBLIC` and `anon`, while preserving execution for `authenticated`.

## Required staging test matrix
Run with dedicated disposable/staging accounts and staff identities; never use real customer balances for negative tests.

1. **Happy-path deposit:** eligible active staff, correct branch, approved request, active UGX account and configured ledgers. Expect one posted journal, exactly two equal ledger legs, updated balance, and one audit event.
2. **Happy-path withdrawal:** sufficient ledger balance. Expect the mirror debit/credit legs and a reduced balance.
3. **Inactive employee:** disable the test employee profile, then call the RPC. Expect SQLSTATE `42501`; no ledger entries, journal status change, balance change, or audit success event.
4. **Unauthenticated / anon caller:** expect execution denied or authentication failure; no data mutation.
5. **Unapproved request:** expect rejection; no data mutation.
6. **Requester posts own request:** expect rejection; no data mutation.
7. **Approver posts own approval:** expect rejection; no data mutation.
8. **Wrong branch / unauthorized role:** expect rejection; no data mutation.
9. **Inactive account, missing subledger, wrong-currency ledger, wrong-branch cash ledger:** each must reject with no partial posting.
10. **Insufficient withdrawal:** expect rejection and unchanged account balance.
11. **Duplicate/replay:** submit the same journal twice; first eligible call may post, second must fail and must not create extra ledger legs.
12. **Concurrent withdrawals:** two approved withdrawals that individually fit the original balance but exceed it together must not both succeed. Verify the final balance equals the posted ledger subledger.
13. **Accounting invariants:** for every successful journal, total debits equal total credits; account balance equals the customer's posted liability subledger.
14. **Receipt path:** only posted cash journals appear in the printable receipt list; receipt totals and reference match the journal.
15. **Audit rollback:** force a controlled audit insert failure in staging and confirm the entire posting rolls back.

## Before production
- Apply to a fresh staging database first.
- Run the matrix above and record results.
- Review the `branch_directory_public` view, all 22 RLS-enabled tables without policies, the 68 security-definer function grants, duplicate indexes, and overlapping branch policies as one grouped security/performance review.
- Confirm application compatibility and backup/restore procedure.
- Production deployment requires a separate approval and a reviewed rollback plan.

## Important limits
This migration does not resolve all Supabase advisor findings. It hardens one high-risk RPC only. The other cash request/approval/list RPCs, public branch view, and unrelated functions still need individual review before the bundle can be considered complete.
