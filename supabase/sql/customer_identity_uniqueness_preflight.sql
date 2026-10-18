-- ZIVAMUNTUYO FINANCIAL SERVICES LTD
-- Customer identity uniqueness: review and test in a non-production Supabase project first.
-- This file is intentionally a draft; it is NOT applied to any database.
--
-- Policy:
--   * One customer profile per normalized National ID/passport.
--   * Normalize case, spaces and hyphens for duplicate comparison.
--   * Joint accounts must link additional holders to the same existing customer profile;
--     do not create a duplicate customer record to add a joint holder.
--   * The separate one-individual-account rule must be enforced inside the authoritative
--     account-opening RPC after confirming the actual account_holders ownership schema.

-- PRE-FLIGHT: run this query first. Resolve duplicate identity groups through authorized
-- KYC review before creating the unique index. Never auto-delete or merge customer records.
SELECT
  lower(regexp_replace(btrim(nin_or_passport), '[[:space:]-]+', '', 'g')) AS normalized_identity,
  count(*) AS customer_count,
  array_agg(customer_number ORDER BY customer_number) AS customer_numbers
FROM public.customers
WHERE nullif(regexp_replace(btrim(coalesce(nin_or_passport, '')), '[[:space:]-]+', '', 'g'), '') IS NOT NULL
GROUP BY lower(regexp_replace(btrim(nin_or_passport), '[[:space:]-]+', '', 'g'))
HAVING count(*) > 1
ORDER BY customer_count DESC;

-- AFTER pre-flight returns zero duplicate groups and the schema/permissions are reviewed:
-- CREATE UNIQUE INDEX customers_identity_normalized_uidx
-- ON public.customers (
--   lower(regexp_replace(btrim(nin_or_passport), '[[:space:]-]+', '', 'g'))
-- )
-- WHERE nullif(regexp_replace(btrim(coalesce(nin_or_passport, '')), '[[:space:]-]+', '', 'g'), '') IS NOT NULL;

-- Verify the index definition and test duplicate attempts using test identities only.
-- The UI duplicate check is for usability only. This unique index is the concurrency-safe
-- database guard. Keep SELECT/INSERT policies and customer visibility scoped by RLS.
