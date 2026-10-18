-- Distinguish the financial product held by a bank account from the account holder's legal/ownership type.
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'savings';

ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_product_type_check;
ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_product_type_check
  CHECK (product_type IN ('savings','current','fixed_deposit','business','group','other'));

CREATE INDEX IF NOT EXISTS bank_accounts_branch_product_type_idx
  ON public.bank_accounts (branch_id, product_type);
