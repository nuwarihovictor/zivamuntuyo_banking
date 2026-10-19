# Zero-cost operating policy

**Owner requirement (2026-10-19): no subscriptions and no unapproved payments for ZIVAMUNTUYO FINANCIAL SERVICES LTD banking software.**

This policy applies to development, testing, deployment, storage, messaging, biometric attendance, receipt printing, monitoring, backups, domains, and any external service or integration.

## Mandatory controls

1. **No paid-plan upgrades or subscriptions.** Use existing free tiers or free/open-source/local tools only.
2. **No chargeable cloud resources without explicit approval.** Do not create Supabase branches/projects, paid databases, hosted runners, storage, queues, monitoring, or other metered resources unless the owner has reviewed the exact cost and explicitly approves it. Under the current requirement, the default is do not create them.
3. **No automatic billing assumptions.** Before using a provider, verify its current plan, usage limits, overage behavior, and billing settings. A free tier is not proof that every action is free.
4. **No purchasing or activating trials.** Do not enter payment details, start a paid trial, enable a paid add-on, or purchase a domain/hardware/SDK on the owner's behalf.
5. **Prefer local, disposable test environments.** Use the repository's disposable PostgreSQL CI workflow and local free tools where practical. Keep synthetic test data separate from production.
6. **No production shortcuts to save money.** Never connect preview/test software to production or an unrelated database. If safe staging cannot be achieved within the zero-cost constraint, record the blocker and continue with safe offline/fixture testing.
7. **No secret leakage.** Do not put service-role keys, database passwords, or other secrets into browser code, commits, test fixtures, or public logs.
8. **Record constraints honestly.** Mark features that require paid hosting, a domain, a vendor SDK, hardware, or unavailable free capacity as blocked/limited. Do not silently replace them with a paid option.
9. **No release without evidence.** Passing disposable tests is not production acceptance. Keep production migration, merge, and deployment behind the existing explicit approval and release gates.

## Current known constraints

- Vercel project is currently on the Hobby plan; confirm plan/billing details in the owner's dashboard before relying on any specific limit.
- The latest cross-branch cash-integrity assertions passed in GitHub Actions on commit `57294af83f2722e57819526128139187e7e81a0d`.
- No dedicated banking staging database is available. Do not create a chargeable Supabase development branch under this policy.
- Vercel Preview Supabase settings remain inert; do not connect preview to the production banking database or the unrelated school-management database.
- Physical receipt-printer and fingerprint-reader acceptance still require compatible hardware. Do not purchase devices or paid SDKs without explicit approval.
- A custom domain may require a one-time purchase/renewal fee; do not buy one under the current no-payment requirement. Continue with a provider-supplied free subdomain if available.

## Decision rule

If a proposed step might incur any fee, recurring charge, usage overage, renewal, or paid dependency, **stop before taking that step**. Explain the exact limitation and continue with the best safe no-cost alternative. No payment is authorized by a general instruction to “proceed.”
