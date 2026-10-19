# Central staff credential administration — proposed implementation

## Goal
Add a **Security & Access Management** panel under Settings for the General Manager and System Administrator. It should manage staff identities across all branches from one controlled interface.

## Current architecture
The branch network is represented in one Supabase project and one authentication system, with branch access controlled by staff roles and branch permissions. It is not safe to assume every branch has a separate database or separate database password. The application uses staff email/password sign-in through Supabase Auth.

## Required functionality
- List staff account status and assigned branch/role using authorized server-side data.
- Invite/onboard staff by work email; set employee number, role and branch permissions.
- Trigger a secure password-reset email for an existing staff member.
- Change a staff login email only after re-authentication/confirmation and audit logging.
- Disable/revoke access for terminated or compromised staff, with session revocation where supported.
- Enforce separation of duties: a General Manager may manage staff within delegated scope; System Administrator may manage institution-wide identities. Neither role can read a user's existing password.
- Require a reason for sensitive actions and write immutable audit events.
- Show the affected staff member and branch before confirmation; protect against accidental bulk changes.
- Provide a documented break-glass account recovery procedure with strong MFA and independent audit trail.

## Prohibited implementation patterns
- Do not delete passwords, blank passwords, turn off authentication, or allow shared branch passwords.
- Do not store plaintext passwords in application tables, logs, source code, browser storage, or audit details.
- Do not expose the Supabase service-role key to the browser or commit it to GitHub.
- Do not provide an unauthenticated endpoint that can create admins or reset arbitrary users.
- Do not let an administrator change their own role or remove the last active system administrator through this screen.
- Do not apply untested SQL/RPC changes directly to the live banking database.

## Backend design
Use a Supabase Edge Function or another trusted server-side endpoint with JWT verification enabled. The function must:
1. Verify the caller's access token and active employee profile.
2. Check the caller's role and scope from database state, not client-supplied role text.
3. Validate requested staff ID, branch, email and action.
4. Use the Supabase Auth Admin API only server-side, with the service-role secret stored as a server secret.
5. Prefer invite and password-reset links over assigning or revealing passwords.
6. Re-check branch/role authorization for each request, log the actor, target user, action, reason and outcome, and return no secrets.
7. Rate-limit sensitive actions and use generic errors where necessary to prevent account enumeration.

## Acceptance tests
- Unauthenticated caller and inactive employee are denied.
- Teller, accountant, branch manager and ordinary staff cannot access institution-wide credential administration.
- Authorized admin can initiate reset for a staff user and the target receives a reset/invite email; no password is returned.
- Unauthorized branch changes are rejected.
- Duplicate/invalid email and unknown user errors do not disclose account existence to unauthorized callers.
- Deactivation and role/branch changes are audited and take effect on subsequent authorization checks; session revocation behavior is verified.
- Last active system administrator cannot be accidentally removed.
- No service-role secret appears in client assets, build output, Git history or logs.
- Recovery flow tested with a dedicated staging tenant and a backup administrator.

## Release state
This document records the required design and tests only. It does not claim the UI or server endpoint is implemented, and it does not change any live credentials. Implementation must be added to the consolidated release branch, reviewed, and tested in staging before production.
