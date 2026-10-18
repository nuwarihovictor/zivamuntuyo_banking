# National ID uniqueness and account-opening policy

## Decision recorded
Use the National Identification Number (NIN) as the preferred identity key for Ugandan customers. The existing `customers.nin_or_passport` field also accepts passport numbers, so its normalized value must be unique across customer profiles until the schema separates ID types. Normalize by trimming whitespace, removing internal whitespace/hyphens, and case-folding. Do not use a name or phone number as the identity key.

## Required behavior
1. One verified identity must map to one customer/CIF profile. A customer with an existing profile must be searched and verified, not registered again.
2. A joint account is an ownership relationship involving two or more existing customer profiles. Adding a joint holder must reuse their existing customer/CIF; it must not create a duplicate identity record.
3. The business rule requested is one individual-owned bank account per person, while joint accounts are allowed. Before coding the authoritative database enforcement, confirm how the current schema represents account ownership, primary holder, joint ownership and account statuses. Enforce it inside the database account-opening RPC in a transaction, not only in browser JavaScript.
4. Decide how to treat dormant, frozen, closed, pending and rejected accounts. Recommended starting rule: only pending/approved/open/active individual-owned accounts block another individual account; closed/rejected requests do not. Compliance staff must be able to correct identity errors through an audited process.
5. Passport and NIN are different identifier types. A later schema improvement should use an explicit `identity_type` field and a normalized identity key; until then, uniqueness across the existing shared field may need manual review if a passport string coincides with a NIN.
6. A joint account should not be used to bypass account policy. The server-side RPC must validate that the new ownership type is genuinely joint and that every holder has a verified customer record, with required approvals and audit events.

## Work added
- Customer-registration UI normalizes NIN/passport input and checks existing customer rows before attempting registration. This is only a user-experience pre-check, not the security boundary.
- `supabase/sql/customer_identity_uniqueness_preflight.sql` contains a duplicate preflight query and a commented unique-index statement. It is deliberately not auto-applied because existing duplicates must be reviewed first.
- The account-opening search query has been repaired and JavaScript syntax validation passes.

## Still required before release
- Inspect the real production schema and the full definition of `create_bank_account_request_with_opening_package` in a non-production environment.
- Resolve pre-existing duplicate identity records manually with an auditable KYC decision; never auto-merge or delete financial records.
- Apply the normalized unique index in test after preflight is clean.
- Add transaction-safe server-side individual-account limit checks to the authoritative account-opening RPC, using actual ownership/status columns and a concurrency-safe lock/constraint strategy.
- Test individual account blocked, joint account allowed, duplicate simultaneous requests, branch permissions, closed accounts, pending approvals, and database RLS.
- Confirm legal/compliance requirements for identity collection, retention, correction and access.
