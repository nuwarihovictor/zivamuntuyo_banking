-- Enforce bank-wide uniqueness for receipt and transaction references.
-- A receipt may not be reused across different collection modules.
create table if not exists public.receipt_registry (
  receipt_reference text primary key,
  source_table text not null,
  source_id uuid not null,
  registered_at timestamptz not null default now(),
  unique(source_table,source_id)
);
alter table public.receipt_registry enable row level security;
revoke all on public.receipt_registry from public, anon, authenticated;

-- Backfill existing receipts. A pre-deployment duplicate scan found no collisions.
insert into public.receipt_registry(receipt_reference,source_table,source_id)
select receipt_number,'account_opening_collections',id from public.account_opening_collections where nullif(trim(receipt_number),'') is not null
union all
select receipt_number,'customer_share_transactions',id from public.customer_share_transactions where nullif(trim(receipt_number),'') is not null
union all
select receipt_number,'account_security_ledger',id from public.account_security_ledger where nullif(trim(receipt_number),'') is not null
union all
select receipt_number,'loan_processing_fee_collections',id from public.loan_processing_fee_collections where nullif(trim(receipt_number),'') is not null
union all
select receipt_number,'stationery_collections',id from public.stationery_collections where nullif(trim(receipt_number),'') is not null
union all
select transaction_reference,'transactions',id from public.transactions where nullif(trim(transaction_reference),'') is not null
on conflict (receipt_reference) do nothing;

create or replace function public.register_unique_receipt_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_reference text;
  v_existing_table text;
  v_existing_id uuid;
begin
  if tg_table_name='transactions' then
    v_reference := nullif(trim(new.transaction_reference),'');
  else
    v_reference := nullif(trim(new.receipt_number),'');
  end if;
  if v_reference is null then return new; end if;

  if tg_op='UPDATE' then
    if tg_table_name='transactions' and new.transaction_reference is distinct from old.transaction_reference then
      raise exception 'Posted transaction references are immutable';
    elsif tg_table_name<>'transactions' and new.receipt_number is distinct from old.receipt_number then
      raise exception 'Issued receipt references are immutable';
    end if;
  end if;

  insert into public.receipt_registry(receipt_reference,source_table,source_id)
  values(v_reference,tg_table_name,new.id)
  on conflict(receipt_reference) do nothing;

  select source_table,source_id into v_existing_table,v_existing_id
  from public.receipt_registry where receipt_reference=v_reference;

  if v_existing_table is distinct from tg_table_name or v_existing_id is distinct from new.id then
    raise exception 'Receipt/reference % has already been issued by %; use a new unique reference',v_reference,v_existing_table;
  end if;
  return new;
end;
$function$;
revoke all on function public.register_unique_receipt_reference() from public,anon,authenticated;

drop trigger if exists trg_unique_receipt_account_opening on public.account_opening_collections;
create trigger trg_unique_receipt_account_opening before insert or update of receipt_number on public.account_opening_collections for each row execute function public.register_unique_receipt_reference();
drop trigger if exists trg_unique_receipt_share_transaction on public.customer_share_transactions;
create trigger trg_unique_receipt_share_transaction before insert or update of receipt_number on public.customer_share_transactions for each row execute function public.register_unique_receipt_reference();
drop trigger if exists trg_unique_receipt_security_ledger on public.account_security_ledger;
create trigger trg_unique_receipt_security_ledger before insert or update of receipt_number on public.account_security_ledger for each row execute function public.register_unique_receipt_reference();
drop trigger if exists trg_unique_receipt_loan_fee on public.loan_processing_fee_collections;
create trigger trg_unique_receipt_loan_fee before insert or update of receipt_number on public.loan_processing_fee_collections for each row execute function public.register_unique_receipt_reference();
drop trigger if exists trg_unique_receipt_stationery on public.stationery_collections;
create trigger trg_unique_receipt_stationery before insert or update of receipt_number on public.stationery_collections for each row execute function public.register_unique_receipt_reference();
drop trigger if exists trg_unique_receipt_transaction on public.transactions;
create trigger trg_unique_receipt_transaction before insert or update of transaction_reference on public.transactions for each row execute function public.register_unique_receipt_reference();