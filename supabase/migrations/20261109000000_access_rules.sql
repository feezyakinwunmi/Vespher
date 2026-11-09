-- =====================================================================
-- Row-level security for users, vendors, orders, wallets, promotions,
-- withdrawals, addresses and notifications.
--
-- Without this, anyone holding the app's public key can read these tables.
-- Edge functions use the service role and SECURITY DEFINER functions run as
-- the owner, so neither is affected.
--
-- IF SOMETHING BREAKS after running this, turn a table back off with:
--   alter table public.<table> disable row level security;
-- =====================================================================

-- Clear any older policies on these tables: one permissive leftover would
-- otherwise keep the table open once RLS is on.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('users', 'vendors', 'orders', 'vendor_wallets', 'promotions', 'withdrawals', 'addresses', 'notifications')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, so policies can look across tables safely)
-- ---------------------------------------------------------------------
create or replace function public.is_rider()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and role = 'rider');
$$;

create or replace function public.owns_vendor(p_vendor_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vendors where id::text = p_vendor_id and owner_id::text = auth.uid()::text);
$$;

-- Who may see another person's profile: themselves, admins, anyone signed in for
-- a vendor owner, and the people who share an order with them.
create or replace function public.can_view_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = p_user_id
      or public.is_admin()
      or (auth.uid() is not null and exists (select 1 from vendors v where v.owner_id::text = p_user_id::text))
      or exists (
           select 1 from orders o
            where (o.customer_id::text = auth.uid()::text and o.rider_id::text = p_user_id::text)
               or (o.rider_id::text = auth.uid()::text and o.customer_id::text = p_user_id::text)
         )
      or exists (
           select 1 from orders o join vendors v on v.id::text = o.vendor_id::text
            where v.owner_id::text = auth.uid()::text
              and (o.customer_id::text = p_user_id::text or o.rider_id::text = p_user_id::text)
         )
      or (public.is_rider() and exists (
           select 1 from orders o
            where o.customer_id::text = p_user_id::text and o.rider_id is null and o.status in ('preparing', 'ready')
         ));
$$;

grant execute on function public.is_rider() to anon, authenticated;
grant execute on function public.owns_vendor(text) to anon, authenticated;
grant execute on function public.can_view_user(uuid) to anon, authenticated;

-- Signup duplicate check, now that strangers can't read the users table.
create or replace function public.account_exists(p_email text, p_phone text)
returns text language sql stable security definer set search_path = public as $$
  select case
           when exists (select 1 from users where email = p_email) then 'email'
           when exists (select 1 from users where phone = p_phone) then 'phone'
         end;
$$;
grant execute on function public.account_exists(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
alter table public.users enable row level security;

drop policy if exists "users: read" on public.users;
create policy "users: read" on public.users for select using (public.can_view_user(id));

drop policy if exists "users: create own" on public.users;
create policy "users: create own" on public.users for insert with check (id = auth.uid());

drop policy if exists "users: update own or admin" on public.users;
create policy "users: update own or admin" on public.users
  for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- vendors: the shop directory is public; only the owner or an admin can change it
-- ---------------------------------------------------------------------
alter table public.vendors enable row level security;

drop policy if exists "vendors: read" on public.vendors;
create policy "vendors: read" on public.vendors for select using (true);

drop policy if exists "vendors: create own" on public.vendors;
create policy "vendors: create own" on public.vendors for insert with check (owner_id::text = auth.uid()::text);

drop policy if exists "vendors: update owner or admin" on public.vendors;
create policy "vendors: update owner or admin" on public.vendors
  for update using (owner_id::text = auth.uid()::text or public.is_admin())
  with check (owner_id::text = auth.uid()::text or public.is_admin());

drop policy if exists "vendors: admin delete" on public.vendors;
create policy "vendors: admin delete" on public.vendors for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------
alter table public.orders enable row level security;

drop policy if exists "orders: read" on public.orders;
create policy "orders: read" on public.orders for select using (
  public.is_admin()
  or customer_id::text = auth.uid()::text
  or rider_id::text = auth.uid()::text
  or public.owns_vendor(vendor_id::text)
  or (rider_id is null and status in ('preparing', 'ready') and public.is_rider())
);

drop policy if exists "orders: customer creates" on public.orders;
create policy "orders: customer creates" on public.orders
  for insert with check (customer_id::text = auth.uid()::text);

-- A rider may also claim an unassigned order (the "with check" makes them its rider).
drop policy if exists "orders: update" on public.orders;
create policy "orders: update" on public.orders for update using (
  public.is_admin()
  or customer_id::text = auth.uid()::text
  or rider_id::text = auth.uid()::text
  or public.owns_vendor(vendor_id::text)
  or (rider_id is null and public.is_rider())
) with check (
  public.is_admin()
  or customer_id::text = auth.uid()::text
  or rider_id::text = auth.uid()::text
  or public.owns_vendor(vendor_id::text)
);

drop policy if exists "orders: admin delete" on public.orders;
create policy "orders: admin delete" on public.orders for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- vendor_wallets, withdrawals: owner and admins only
-- ---------------------------------------------------------------------
alter table public.vendor_wallets enable row level security;

drop policy if exists "vendor_wallets: owner or admin" on public.vendor_wallets;
create policy "vendor_wallets: owner or admin" on public.vendor_wallets
  for all using (public.owns_vendor(vendor_id::text) or public.is_admin())
  with check (public.owns_vendor(vendor_id::text) or public.is_admin());

alter table public.withdrawals enable row level security;

drop policy if exists "withdrawals: own or admin" on public.withdrawals;
create policy "withdrawals: own or admin" on public.withdrawals
  for all using (user_id::text = auth.uid()::text or public.is_admin())
  with check (user_id::text = auth.uid()::text or public.is_admin());

-- ---------------------------------------------------------------------
-- promotions: live ones are public; the vendor and admins manage the rest
-- ---------------------------------------------------------------------
alter table public.promotions enable row level security;

drop policy if exists "promotions: read" on public.promotions;
create policy "promotions: read" on public.promotions for select using (
  status = 'active' or public.owns_vendor(vendor_id::text) or public.is_admin()
);

drop policy if exists "promotions: manage" on public.promotions;
create policy "promotions: manage" on public.promotions
  for all using (public.owns_vendor(vendor_id::text) or public.is_admin())
  with check (public.owns_vendor(vendor_id::text) or public.is_admin());

-- ---------------------------------------------------------------------
-- addresses, notifications: private to their owner
-- ---------------------------------------------------------------------
alter table public.addresses enable row level security;

drop policy if exists "addresses: own or admin" on public.addresses;
create policy "addresses: own or admin" on public.addresses
  for all using (user_id::text = auth.uid()::text or public.is_admin())
  with check (user_id::text = auth.uid()::text or public.is_admin());

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications
  for select using (user_id::text = auth.uid()::text or public.is_admin());

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own" on public.notifications
  for update using (user_id::text = auth.uid()::text) with check (user_id::text = auth.uid()::text);

drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own" on public.notifications
  for delete using (user_id::text = auth.uid()::text);

-- Order triggers and admin announcements write notifications for other people.
drop policy if exists "notifications: insert" on public.notifications;
create policy "notifications: insert" on public.notifications
  for insert to authenticated with check (true);
