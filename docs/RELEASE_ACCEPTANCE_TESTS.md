# Release acceptance tests — Zivamuntuyo Banking

This checklist is a test plan, not a claim that the tests have already passed. Use only anonymized/synthetic data in a non-production Supabase project until all gates are reviewed.

## 1. Identity, login and authorization

- [ ] Signed-out user cannot see bank data or invoke protected RPCs.
- [ ] Inactive/terminated/suspended staff cannot sign in or continue sensitive actions with an existing session.
- [ ] A teller cannot approve an account/loan or post outside their role.
- [ ] Staff from branch A cannot read, export, approve or post branch B records without explicit access.
- [ ] Bank-wide roles and branch-scoped roles are tested separately.
- [ ] Auth expiry, refresh, sign-out and back-button behavior do not expose protected pages.
- [ ] Public browser assets contain no Supabase service-role/secret keys.

## 2. Account eligibility and joint holders

- [ ] First IND account request succeeds for an eligible active customer.
- [ ] Second IND request is rejected by the database even when two requests are submitted concurrently.
- [ ] JNT request accepts a primary holder and at least one different active customer.
- [ ] Duplicate customer IDs and inactive/pending-review customers are rejected.
- [ ] A failed second-holder RPC can be retried without creating a second account or duplicate holder.
- [ ] JNT approval fails when only one distinct holder exists.
- [ ] JNT approval succeeds with two or more distinct holders and authorized approver.
- [ ] IND approval rechecks for a pre-existing individual account.
- [ ] Closed/rejected account policy and dormant/frozen eligibility are explicitly tested and approved.
- [ ] Cross-branch customer selection follows the institution's approved branch policy.

## 3. Teller collection, transaction and receipt safety

- [ ] Account-opening receipt only prints when the server returns a positive recorded amount, receipt number and confirmed collection status.
- [ ] Receipt total equals the server-recorded allocation total; any difference is surfaced and reconciled.
- [ ] Refresh/retry after a network timeout does not duplicate the collection.
- [ ] Deposit/withdrawal receipt is only offered for a posted transaction, never for a pending request.
- [ ] Repeat-click, network retry and duplicate idempotency-key tests do not move money twice.
- [ ] Unauthorized, over-limit, wrong-currency and wrong-branch transactions are rejected.
- [ ] Reversals create compensating entries and preserve the original journal; posted entries are not deleted/edited.
- [ ] All journal lines balance by currency and posted financial reports reconcile to the ledger.
- [ ] Receipt prints correctly on the intended 80 mm printer and standard Windows printer.

## 4. Loan servicing and due-date alerts

- [ ] Only an approved schedule for the correct loan can be used for servicing.
- [ ] Schedule versions preserve prior paid history during rescheduling.
- [ ] Full, partial, late, early and split payments allocate according to the approved waterfall.
- [ ] An allocation cannot exceed an instalment component due or be assigned to a different loan.
- [ ] Duplicate repayment idempotency keys do not create a second payment.
- [ ] Reversal restores the outstanding amount and creates a compensating accounting journal.
- [ ] Due status uses the branch business timezone and agreed grace-period policy.
- [ ] Due today, 7/3/1 day reminders, grace period, overdue DPD and escalation dates are tested around midnight and weekends/holidays.
- [ ] Alert generator retries do not duplicate alerts; failures are visible and recoverable.
- [ ] Staff recipients are limited to active employees authorized for the relevant branch.
- [ ] No customer SMS/email/WhatsApp is reported as delivered without provider confirmation.
- [ ] Dashboard totals match the installment and posted-allocation records.

## 5. VIC LINE messaging

- [ ] Team/branch messages remain distinct from private direct messages.
- [ ] Direct-message list returns only the signed-in user's own conversations.
- [ ] Sender cannot send to self, inactive staff, or an unauthorized recipient.
- [ ] Read receipt can only be set by the recipient.
- [ ] Message text is escaped in the browser; scripts/HTML in a message do not execute.
- [ ] Voice notes are size/type checked, use signed URLs, and are not publicly readable.
- [ ] Polling/refresh does not duplicate messages; notification permissions are respected.
- [ ] Two users in the same branch and different branches are tested.
- [ ] Browser-closed push and live calls are not advertised until separately implemented and verified.

## 6. Attendance and biometric connector

- [ ] Manual clock-in/out and supervisor corrections are explicitly labeled by method.
- [ ] Device events map through a configured device user ID to an active employee; names from a device are not trusted.
- [ ] Duplicate device events, replayed payloads, offline buffering, clock drift and service restart are tested.
- [ ] Connector rejects unauthenticated requests and binds to loopback or an approved restricted interface.
- [ ] No raw fingerprint images/templates are stored in browser local storage.
- [ ] Exact model, firmware, SDK license and Windows 10/11 drivers are recorded.
- [ ] Actual device integration is tested on Windows 10 and Windows 11 with real hardware before enabling production attendance.

## 7. Compatibility and operations

- [ ] Chrome and Edge on Windows 10.
- [ ] Chrome and Edge on Windows 11.
- [ ] Chrome on Android; layout, form inputs, file upload, zoom, table scrolling and receipt printing.
- [ ] Offline/network loss: user sees failure state and can retry without duplicating financial actions.
- [ ] Supabase backup/restore and rollback are rehearsed in staging.
- [ ] Vercel preview is built from the exact reviewed integration commit.
- [ ] Auth redirect URLs, environment variables, domain verification and security headers are reviewed.
- [ ] Release rollback path and incident contact are documented.

## Required evidence for sign-off

For each test, record test date, tester, environment, commit SHA, test data IDs (never personal data), expected result, actual result and any defect. A green static CI run alone is not acceptance evidence.
