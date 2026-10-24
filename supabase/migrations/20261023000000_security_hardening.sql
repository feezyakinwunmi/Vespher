-- =====================================================================
-- Security hardening: stop clients from writing privileged columns.
--
-- The app writes many tables directly with the anon key + user JWT, so RLS
-- alone decides what a user can change. These BEFORE triggers add a second
-- line of defence for the columns that grant money or privileges:
--   * users.role / users.is_suspended         (privilege escalation)
--   * vendors.is_approved / is_suspended / recipient_code
--   * vendor_wallets balances                 (payouts)
--   * orders payment + money fields           (free "paid" orders)
--   * promotions payment + status             (free promotions)
--   * withdrawals status
--
-- Writes are allowed when they come from:
--   * the service role (edge functions) or a database owner role,
--   * an admin user (users.role = 'admin'),
--   * another trigger (pg_trigger_depth() > 1), e.g. wallet crediting on delivery.
--
-- Columns are compared through to_jsonb(), so a column that does not exist
-- in your schema is simply ignored instead of breaking the migration.
-- Review in a staging project first:  supabase db push  (or paste into SQL editor)
-- =====================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_privileged_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin')
      or public.is_admin();
$$;

-- Returns the subset of `cols` whose values differ between two rows.
create or replace function public.changed_columns(n jsonb, o jsonb, cols text[])
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(c), '{}')
  from unnest(cols) as c
  where (n -> c) is distinct from (o -> c);
$$;

create or replace function public.bypass_guards()
returns boolean
language sql
stable
as $$
  select pg_trigger_depth() > 1 or public.is_privileged_writer();
$$;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
create or replace function public.guard_users()
returns trigger
language plpgsql
as $$
declare
  changed text[];
begin
  if public.bypass_guards() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid() then
      raise exception 'You can only create your own profile' using errcode = '42501';
    end if;
    if new.role is null or new.role not in ('customer', 'vendor', 'rider', 'business') then
      raise exception 'Invalid role' using errcode = '42501';
    end if;
    new.is_suspended := false;
    return new;
  end if;

  changed := public.changed_columns(to_jsonb(new), to_jsonb(old), array['id', 'role', 'is_suspended']);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_users on public.users;
create trigger guard_users
  before insert or update on public.users
  for each row execute function public.guard_users();

-- ---------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------
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
       or (row_json ->> 'recipient_code') is not null then
      raise exception 'New vendors must be approved by an admin' using errcode = '42501';
    end if;
    return new;
  end if;

  changed := public.changed_columns(row_json, to_jsonb(old),
    array['owner_id', 'is_approved', 'is_suspended', 'recipient_code']);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_vendors on public.vendors;
create trigger guard_vendors
  before insert or update on public.vendors
  for each row execute function public.guard_vendors();

-- ---------------------------------------------------------------------
-- vendor_wallets
-- ---------------------------------------------------------------------
create or replace function public.guard_vendor_wallets()
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

  if tg_op = 'DELETE' then
    raise exception 'Not allowed to delete wallets' using errcode = '42501';
  end if;

  row_json := to_jsonb(new);

  if tg_op = 'INSERT' then
    if coalesce((row_json ->> 'balance')::numeric, 0) <> 0
       or coalesce((row_json ->> 'pending_balance')::numeric, 0) <> 0
       or coalesce((row_json ->> 'total_earned')::numeric, 0) <> 0 then
      raise exception 'New wallets must start empty' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.vendors v
      where v.id::text = row_json ->> 'vendor_id' and v.owner_id = auth.uid()
    ) then
      raise exception 'You can only create your own wallet' using errcode = '42501';
    end if;
    return new;
  end if;

  changed := public.changed_columns(row_json, to_jsonb(old),
    array['vendor_id', 'balance', 'pending_balance', 'total_earned', 'total_withdrawn']);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_vendor_wallets on public.vendor_wallets;
create trigger guard_vendor_wallets
  before insert or update or delete on public.vendor_wallets
  for each row execute function public.guard_vendor_wallets();

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------
create or replace function public.guard_orders()
returns trigger
language plpgsql
as $$
declare
  changed text[];
  row_json jsonb;
  subtotal numeric;
  payout numeric;
  commission numeric;
begin
  if public.bypass_guards() then
    return new;
  end if;

  row_json := to_jsonb(new);

  if tg_op = 'INSERT' then
    if (row_json ->> 'customer_id') is distinct from auth.uid()::text then
      raise exception 'Orders must belong to the signed-in customer' using errcode = '42501';
    end if;
    -- Card payments are confirmed by the verify-payment edge function.
    new.payment_status := 'pending';

    subtotal   := coalesce((row_json ->> 'subtotal')::numeric, 0);
    payout     := coalesce((row_json ->> 'vendor_payout')::numeric, 0);
    commission := coalesce((row_json ->> 'platform_commission')::numeric, 0);
    if subtotal < 0 or coalesce((row_json ->> 'total')::numeric, 0) < 0
       or payout < 0 or payout > subtotal or commission < 0 then
      raise exception 'Invalid order amounts' using errcode = '22023';
    end if;
    return new;
  end if;

  changed := public.changed_columns(row_json, to_jsonb(old), array[
    'customer_id', 'vendor_id', 'payment_status', 'payment_reference', 'payment_method',
    'subtotal', 'total',
    'vendor_payout', 'platform_commission', 'platform_net_earnings',
    'refund_status', 'refund_amount', 'refund_reference'
  ]);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_orders on public.orders;
create trigger guard_orders
  before insert or update on public.orders
  for each row execute function public.guard_orders();

-- ---------------------------------------------------------------------
-- promotions
-- ---------------------------------------------------------------------
create or replace function public.guard_promotions()
returns trigger
language plpgsql
as $$
declare
  changed text[];
begin
  if public.bypass_guards() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.payment_status := 'pending';
    new.status := 'pending_payment';
    return new;
  end if;

  changed := public.changed_columns(to_jsonb(new), to_jsonb(old), array[
    'vendor_id', 'payment_status', 'payment_reference', 'payment_amount',
    'cost_per_day', 'days_count', 'status'
  ]);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_promotions on public.promotions;
create trigger guard_promotions
  before insert or update on public.promotions
  for each row execute function public.guard_promotions();

-- ---------------------------------------------------------------------
-- withdrawals (vendor payouts are created by the payout edge function)
-- ---------------------------------------------------------------------
create or replace function public.guard_withdrawals()
returns trigger
language plpgsql
as $$
declare
  changed text[];
begin
  if public.bypass_guards() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Withdrawals must belong to the signed-in user' using errcode = '42501';
    end if;
    new.status := 'pending';
    return new;
  end if;

  changed := public.changed_columns(to_jsonb(new), to_jsonb(old),
    array['user_id', 'amount', 'status', 'reference', 'account_number', 'bank_name']);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_withdrawals on public.withdrawals;
create trigger guard_withdrawals
  before insert or update on public.withdrawals
  for each row execute function public.guard_withdrawals();

-- ---------------------------------------------------------------------
-- customer_rewards (earned rewards are granted by triggers/admins only)
-- ---------------------------------------------------------------------
create or replace function public.guard_customer_rewards()
returns trigger
language plpgsql
as $$
declare
  changed text[];
  n jsonb;
  o jsonb;
begin
  if public.bypass_guards() then
    return new;
  end if;

  n := to_jsonb(new);

  if tg_op = 'INSERT' then
    if (n ->> 'customer_id') is distinct from auth.uid()::text then
      raise exception 'You can only create your own rewards record' using errcode = '42501';
    end if;
    if coalesce((n ->> 'free_delivery_earned')::numeric, 0) <> 0
       or coalesce((n ->> 'free_delivery_used')::numeric, 0) <> 0
       or coalesce((n ->> 'referral_count')::numeric, 0) <> 0
       or coalesce((n ->> 'total_orders')::numeric, 0) <> 0 then
      raise exception 'Rewards must start at zero' using errcode = '42501';
    end if;
    return new;
  end if;

  o := to_jsonb(old);
  changed := public.changed_columns(n, o, array[
    'customer_id', 'free_delivery_earned', 'referral_count', 'total_orders',
    'free_delivery_expires_at', 'referral_code'
  ]);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  -- Customers may only consume rewards, never restore them.
  if coalesce((n ->> 'free_delivery_used')::numeric, 0) < coalesce((o ->> 'free_delivery_used')::numeric, 0) then
    raise exception 'Not allowed to change: free_delivery_used' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_customer_rewards on public.customer_rewards;
create trigger guard_customer_rewards
  before insert or update on public.customer_rewards
  for each row execute function public.guard_customer_rewards();

-- ---------------------------------------------------------------------
-- referrals (completed by the order trigger; clients may only claim a reward)
-- ---------------------------------------------------------------------
create or replace function public.guard_referrals()
returns trigger
language plpgsql
as $$
declare
  changed text[];
  n jsonb;
begin
  if public.bypass_guards() then
    return new;
  end if;

  n := to_jsonb(new);

  if tg_op = 'INSERT' then
    if coalesce(n ->> 'status', 'pending') <> 'pending'
       or coalesce((n ->> 'referrer_reward_claimed')::boolean, false) then
      raise exception 'New referrals must be pending' using errcode = '42501';
    end if;
    return new;
  end if;

  changed := public.changed_columns(n, to_jsonb(old), array[
    'referrer_id', 'referred_id', 'status', 'bonus_expires_at'
  ]);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  if (n ->> 'referrer_id') is distinct from auth.uid()::text
     or not coalesce((n ->> 'referrer_reward_claimed')::boolean, false) then
    raise exception 'Only the referrer can claim a referral reward' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_referrals on public.referrals;
create trigger guard_referrals
  before insert or update on public.referrals
  for each row execute function public.guard_referrals();

-- ---------------------------------------------------------------------
-- products (menu items need admin approval; edits to reviewed content
-- such as ingredients or allergens send an item back for review)
-- ---------------------------------------------------------------------
create or replace function public.guard_products()
returns trigger
language plpgsql
as $$
begin
  if public.bypass_guards() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approval_status := 'pending';
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status
     and new.approval_status <> 'pending' then
    raise exception 'Only admins can approve or reject menu items' using errcode = '42501';
  end if;

  if array_length(public.changed_columns(to_jsonb(new), to_jsonb(old), array[
       'name', 'description', 'price', 'category', 'image_url',
       'ingredients', 'allergens', 'health_tags'
     ]), 1) > 0 then
    new.approval_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_products on public.products;
create trigger guard_products
  before insert or update on public.products
  for each row execute function public.guard_products();

-- ---------------------------------------------------------------------
-- Make sure RLS is on for the sensitive tables. This does not create
-- policies; if a table had RLS disabled, add policies before enabling
-- or the app will lose access to it. Uncomment after checking:
--   select relname, relrowsecurity from pg_class
--   where relname in ('users','vendors','vendor_wallets','orders','promotions','withdrawals');
-- ---------------------------------------------------------------------
-- alter table public.users          enable row level security;
-- alter table public.vendors        enable row level security;
-- alter table public.vendor_wallets enable row level security;
-- alter table public.orders         enable row level security;
-- alter table public.promotions     enable row level security;
-- alter table public.withdrawals    enable row level security;
