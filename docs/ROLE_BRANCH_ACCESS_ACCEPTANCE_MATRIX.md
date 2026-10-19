# Role and branch access acceptance matrix

**Status:** test plan only — not evidence of a passed security test.  
**Environment:** dedicated staging or disposable PostgreSQL with synthetic data only.  
**Release rule:** do not run these tests against production; do not enable live cash posting until results are recorded and reviewed.

## Purpose

Verify that access is enforced by database authorization, not merely by hidden UI controls. Run each positive and negative case with separately provisioned test identities. Never share credentials between identities.

## Required test fixtures

- Branches: Butare head office, Rubirizi, Buhwenju, and Ntungamo.
- Synthetic customers and accounts assigned to known branches.
- At least one active employee per permitted role and branch.
- One inactive employee, one authenticated user with no employee profile, and one unauthenticated session.
- A synthetic pending cash request and a separate approved request; do not use real money.
- A test-only audit log view or query that can verify which writes occurred.

## Acceptance matrix

| ID | Identity / condition | Attempt | Expected result |
|---|---|---|---|
| RBAC-01 | Active employee with permitted branch access | Open an allowed branch workspace | Allowed; context identifies the authorized branch |
| RBAC-02 | Active employee assigned only to Rubirizi | Open Ntungamo workspace | Denied by server/database; no branch context or data leaked |
| RBAC-03 | Active employee with read-only/report role | Invoke a cash-creation or posting RPC directly | Denied unless the role's explicit policy permits that action |
| RBAC-04 | Inactive employee profile | Read protected customer data and call cash RPC | Denied; no data or financial changes |
| RBAC-05 | Authenticated user without an employee profile | Call employee-only RPC | Denied |
| RBAC-06 | Unauthenticated session | Read private customer/account data or call protected RPC | Denied |
| RBAC-07 | Active employee authorized in one branch | Submit a customer/account/request ID belonging only to another branch | Denied; no cross-branch writes |
| RBAC-08 | Ordinary authenticated browser session | Read/write general ledger tables directly, bypassing the UI | Denied; approved RPC paths remain functional |
| RBAC-09 | Staff member not a direct-message participant | Read another pair's private message | Denied |
| RBAC-10 | Active employee using group chat | Read/send within the allowed staff chat scope | Allowed only according to the documented group-chat policy |
| RBAC-11 | Inactive employee or spoofed sender ID | Insert a staff-chat message or attendance event as another user | Denied; sender identity comes from trusted session context |
| RBAC-12 | Authorized reviewer in wrong branch or inactive reviewer | Approve/reject a pending KYC case | Denied; no status change or audit entry |
| RBAC-13 | Requester attempts to approve their own cash request | Approve request | Denied; request remains pending |
| RBAC-14 | Already approved/posted request | Approve or post again | Denied/idempotent according to documented contract; no duplicate ledger legs |
| RBAC-15 | Any denied action | Inspect balances, journal, request status, and audit history | No partial write; no success audit event for the denied action |
| RBAC-16 | Authorized branch manager | Read branch reports and attempt to read another branch's detailed records | Own-branch access only unless explicitly granted consolidated-report permission |

## Execution and evidence

For every case, record:
1. Test ID, environment identifier, commit SHA, migration version, and test identity role.
2. Exact RPC/table operation attempted (never record passwords or secret tokens).
3. Observed allow/deny result and sanitized error.
4. Before/after counts or hashes for affected synthetic records, balances, journal legs, and audit events.
5. Pass/fail, tester, timestamp, and any linked automated test run.

A UI message alone is insufficient for a negative test. Verify that the database operation was denied and that no underlying data changed. For failed financial operations, confirm the transaction, both ledger legs, account balance, request status, and audit event remain atomic.

## Stop conditions

Stop and report a blocker if a cross-branch read/write succeeds, an inactive identity can access protected operations, a denied action changes data, a duplicate posting creates additional ledger entries, or private messages are visible to non-participants.

## Current evidence boundary

The current branch contains draft access-control migrations and disposable PostgreSQL regression checks. Those checks are not production-shaped staging evidence. No production migration or write is authorized by this document.