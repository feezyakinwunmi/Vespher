-- =====================================================================
-- Direct vendor payouts (Paystack split payments). Replaces the vendor wallet:
-- on every card payment the vendor's share settles straight to their bank
-- through their Paystack subaccount; the platform keeps commission + delivery.
-- Run AFTER 20261023000000_security_hardening.sql.
-- =====================================================================

alter table public.vendors add column if not exists paystack_subaccount_code text;

-- Payout account fields are set only by the setup-subaccount edge function
-- (after the bank account is verified), never directly by the app.
create or replace function public.guard_vendors()
returns trigger
language plpgsql
as $$
declare
  changed text[];
  row_json jsonb;
begin
  if public.bypass_guards() then
    return new;
  end if;

  row_json := to_jsonb(new);

  if tg_op = 'INSERT' then
    if (row_json ->> 'owner_id') is distinct from auth.uid()::text then
      raise exception 'You can only create your own vendor profile' using errcode = '42501';
    end if;
    if coalesce((row_json ->> 'is_approved')::boolean, false)
       or coalesce((row_json ->> 'is_suspended')::boolean, false)
       or (row_json ->> 'recipient_code') is not null
       or (row_json ->> 'paystack_subaccount_code') is not null then
      raise exception 'New vendors must be approved by an admin' using errcode = '42501';
    end if;
    return new;
  end if;

  changed := public.changed_columns(row_json, to_jsonb(old), array[
    'owner_id', 'is_approved', 'is_suspended', 'recipient_code',
    'paystack_subaccount_code', 'bank_code', 'account_number', 'account_name'
  ]);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- The old wallet is no longer used by the app. Existing balances still need
-- a final manual payout (Admin → Withdrawals). Check which database triggers
-- still credit vendor_wallets, then disable them, e.g.:
--
--   select event_object_table, trigger_name, action_statement
--     from information_schema.triggers
--    where action_statement ilike '%wallet%';
--
--   select proname from pg_proc where prosrc ilike '%vendor_wallets%';
--
-- The vendor_wallets table itself is kept for history.
-- ---------------------------------------------------------------------
