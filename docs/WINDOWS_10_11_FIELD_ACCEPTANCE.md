# Windows 10/11 field acceptance checklist

## Purpose
Use this checklist before staff rely on the banking application from Windows 10 or Windows 11 computers. This is a test plan, not evidence that a device or release has already passed.

## Test environment
- [ ] Record Windows edition, version/build, update level, CPU architecture, browser name/version, screen resolution, and whether the machine is shared.
- [ ] Use a non-production test account and a staging database with synthetic customer/account data.
- [ ] Confirm the deployed commit and environment; do not use production customer data for acceptance tests.
- [ ] Confirm the operator's role, active status, assigned branch, and allowed actions.

## Browser and authentication
- [ ] Open the app in current supported Edge and Chrome releases on Windows 10 and Windows 11.
- [ ] Confirm sign-in, sign-out, expired-session behavior, and recovery from a lost connection.
- [ ] Confirm inactive employees cannot use protected modules or invoke protected RPCs.
- [ ] Confirm a user from one branch cannot request, approve, post, or inspect restricted records belonging to another branch.
- [ ] Verify keyboard-only navigation, readable zoom at 125% and 150%, and clear error messages.
- [ ] Confirm no service-role/secret key is present in browser source, network responses, local storage, or logs.

## Financial transaction safety (staging only)
- [ ] Test deposit and withdrawal request → independent approval → posting.
- [ ] Confirm requester cannot approve or post their own request where separation-of-duties rules apply.
- [ ] Confirm pending/unapproved, rejected, already-posted, inactive-account, wrong-currency, and wrong-branch cases are rejected.
- [ ] Test duplicate clicks and concurrent posting attempts; only one valid posting may occur.
- [ ] Force a ledger-leg failure and confirm the entire transaction rolls back without a partial journal or balance change.
- [ ] Reconcile journal debit/credit totals and the account balance before and after every test.

## Receipt printer
- [ ] Record exact printer make/model, driver version, connection type (USB/network/Bluetooth), and paper width (for example, 58 mm or 80 mm).
- [ ] Print a posted deposit receipt and a posted withdrawal receipt from both Windows versions.
- [ ] Verify organization name, transaction reference, date/time, branch, amount, transaction direction, and currency.
- [ ] Check paper clipping, wrapping, non-ASCII characters, feed/cut behavior, and printer-disconnected errors.
- [ ] Confirm pending or failed transactions cannot be printed as completed receipts.
- [ ] Define who may reprint and how duplicate/reprint copies are labelled.

## Attendance and fingerprint hardware
- [ ] Record the exact reader/terminal manufacturer, model, firmware, driver and SDK/API version, licensing, and Windows 10/11 support.
- [ ] Verify vendor-supported enrolment and matching. Do not store raw fingerprint images in the browser or treat a typed staff ID as biometric verification.
- [ ] Test device authentication, employee/device mapping, duplicate events, wrong device IDs, offline buffering, clock drift, and connector restart recovery.
- [ ] Confirm events are sent through an authenticated server endpoint; never embed the Supabase service-role key in the Windows connector.
- [ ] Until real hardware passes these tests, label attendance as manual and not fingerprint-verified.

## Backup, support and release evidence
- [ ] Demonstrate backup restoration in a separate test environment and verify restored record counts and ledger balances.
- [ ] Confirm audit logs, monitoring, account recovery, and a named incident contact.
- [ ] Attach screenshots/logs with secrets and personal data removed, test date, tester, device details, and pass/fail result.
- [ ] Obtain authorized release approval before applying migrations or enabling live transactions.

## Current known limitations
- Windows 10/11 field acceptance has not been recorded by this checklist itself.
- Fingerprint hardware models are not yet confirmed or connected.
- Actual thermal printer testing remains outstanding.
- Disposable PostgreSQL tests do not substitute for a production-shaped staging test.
