-- =====================================================================
-- Dish details, Vesphe Pro subscriptions and admin-set Pro pricing.
-- Safe to run more than once. Run AFTER 20261023000000_security_hardening.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dish details used by the ingredient check and recommendations
-- ---------------------------------------------------------------------
alter table public.products add column if not exists ingredients text[] not null default '{}';
alter table public.products add column if not exists allergens   text[] not null default '{}';
alter table public.products add column if not exists health_tags text[] not null default '{}';
alter table public.products add column if not exists meal_times  text[] not null default '{}';

-- ---------------------------------------------------------------------
-- 2. Pro pricing, editable by admins in Admin → Settings → Vesphe Pro
-- ---------------------------------------------------------------------
alter table public.platform_settings add column if not exists pro_monthly_price         integer not null default 1500;
alter table public.platform_settings add column if not exists pro_yearly_price          integer not null default 15000;
alter table public.platform_settings add column if not exists free_recommendation_limit integer not null default 3;

-- ---------------------------------------------------------------------
-- 3. Subscriptions
--    Customers create a pending row; the price is filled in by the database
--    from platform_settings, and only the verify-payment edge function
--    (service role) can activate it after Paystack confirms the payment.
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  plan              text not null check (plan in ('monthly', 'yearly')),
  status            text not null default 'pending' check (status in ('pending', 'active', 'expired', 'failed')),
  amount            integer not null default 0,
  payment_reference text unique,
  payment_status    text not null default 'pending',
  starts_at         timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status, expires_at desc);

alter table public.subscriptions enable row level security;

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

drop policy if exists "subscriptions: read own or admin" on public.subscriptions;
create policy "subscriptions: read own or admin" on public.subscriptions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "subscriptions: create own" on public.subscriptions;
create policy "subscriptions: create own" on public.subscriptions
  for insert with check (auth.uid() = user_id);
-- No update/delete policies: activation happens only through verify-payment.

create or replace function public.price_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  monthly integer;
  yearly  integer;
begin
  select pro_monthly_price, pro_yearly_price
    into monthly, yearly
    from public.platform_settings
   order by id
   limit 1;

  new.amount := case new.plan
    when 'yearly' then coalesce(yearly, 15000)
    else coalesce(monthly, 1500)
  end;

  if coalesce(auth.role(), '') <> 'service_role' then
    new.status         := 'pending';
    new.payment_status := 'pending';
    new.starts_at      := null;
    new.expires_at     := null;
  end if;
  return new;
end;
$$;

drop trigger if exists price_subscription on public.subscriptions;
create trigger price_subscription
  before insert on public.subscriptions
  for each row execute function public.price_subscription();

-- True when the user has an active, unexpired subscription.
create or replace function public.is_pro(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
     where user_id = uid
       and status = 'active'
       and expires_at > now()
  );
$$;

grant execute on function public.is_pro(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Google sign-up: profiles start without a phone number (the app asks
--    for it in the Profile setup checklist).
-- ---------------------------------------------------------------------
alter table public.users alter column phone drop not null;
