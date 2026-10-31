-- =====================================================================
-- Fleet, part 2
-- 1. Riders on company bikes need an assigned bike to go online or accept
--    orders. Taking a bike back switches the rider offline.
-- 2. Bike expenses: fuel, repairs, servicing and parts logged per bike (admin only).
-- 3. Delivery bags: numbered bags assigned to riders, with history.
-- Needs 20261105000000_company_bikes.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. No bike, no orders
-- ---------------------------------------------------------------------
-- True when this rider may work: they ride their own/rented vehicle, or they
-- currently have a company bike.
create or replace function public.rider_has_vehicle(p_rider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from users u
            where u.id = p_rider_id and u.vehicle_ownership in ('personal', 'rented')
         )
      or exists (
           select 1 from bike_assignments a
            where a.rider_id = p_rider_id and a.returned_at is null
         );
$$;

revoke all on function public.rider_has_vehicle(uuid) from public, anon;
grant execute on function public.rider_has_vehicle(uuid) to authenticated;

-- Accepting an order (setting rider_id) needs a vehicle. Admins are exempt.
create or replace function public.guard_rider_vehicle_on_orders()
returns trigger
language plpgsql
as $$
begin
  if public.bypass_guards() then
    return new;
  end if;
  if new.rider_id is not null
     and (old.rider_id is null or old.rider_id::text <> new.rider_id::text)
     and not public.rider_has_vehicle(new.rider_id::text::uuid) then
    raise exception 'You need a Vesphe bike assigned before you can accept orders' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_rider_vehicle_on_orders on public.orders;
create trigger guard_rider_vehicle_on_orders
  before update of rider_id on public.orders
  for each row execute function public.guard_rider_vehicle_on_orders();

-- Going online needs a vehicle too.
create or replace function public.guard_rider_vehicle_on_users()
returns trigger
language plpgsql
as $$
begin
  if public.bypass_guards() then
    return new;
  end if;
  if new.role = 'rider'
     and coalesce(new.is_available, false)
     and not coalesce(old.is_available, false)
     and not public.rider_has_vehicle(new.id) then
    raise exception 'You need a Vesphe bike assigned before you can go online' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_rider_vehicle_on_users on public.users;
create trigger guard_rider_vehicle_on_users
  before update of is_available on public.users
  for each row execute function public.guard_rider_vehicle_on_users();

-- Taking a bike back also switches its rider offline.
create or replace function public.admin_return_bike(p_bike_id uuid, p_new_status text default 'available')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider uuid;
begin
  perform public.require_verified_admin();
  if p_new_status not in ('available', 'maintenance', 'retired') then
    raise exception 'Status must be available, maintenance or retired';
  end if;

  select rider_id into v_rider from bike_assignments where bike_id = p_bike_id and returned_at is null;
  update bike_assignments set returned_at = now() where bike_id = p_bike_id and returned_at is null;
  update company_bikes set status = p_new_status, updated_at = now() where id = p_bike_id;

  if v_rider is not null then
    update users set vehicle_number = null, is_available = false, updated_at = now() where id = v_rider;
    insert into notifications (user_id, type, title, message, action_label)
    values (v_rider, 'system', 'Bike returned',
            'Your Vesphe bike has been returned, so you''re offline for now. You can go online again once a bike is assigned to you.',
            'Open');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Bike expenses (admin only)
-- ---------------------------------------------------------------------
create table if not exists public.bike_expenses (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references public.company_bikes(id) on delete cascade,
  kind text not null check (kind in ('fuel', 'repair', 'service', 'parts', 'other')),
  amount numeric not null check (amount >= 0),
  litres numeric,
  odometer_km integer,
  note text,
  spent_at date not null default current_date,
  recorded_by uuid references public.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists bike_expenses_bike_idx on public.bike_expenses (bike_id, spent_at desc);

alter table public.bike_expenses enable row level security;

drop policy if exists "bike_expenses: admin all" on public.bike_expenses;
create policy "bike_expenses: admin all" on public.bike_expenses
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Delivery bags
-- ---------------------------------------------------------------------
create table if not exists public.delivery_bags (
  id uuid primary key default gen_random_uuid(),
  bag_code text not null unique,
  size text,
  color text,
  status text not null default 'available' check (status in ('available', 'assigned', 'damaged', 'lost', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bag_assignments (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references public.delivery_bags(id) on delete cascade,
  rider_id uuid not null references public.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  assigned_by uuid references public.users(id)
);

create unique index if not exists bag_assignments_one_rider_per_bag on public.bag_assignments (bag_id) where returned_at is null;
create unique index if not exists bag_assignments_one_bag_per_rider on public.bag_assignments (rider_id) where returned_at is null;

alter table public.delivery_bags enable row level security;
alter table public.bag_assignments enable row level security;

drop policy if exists "delivery_bags: admin all" on public.delivery_bags;
create policy "delivery_bags: admin all" on public.delivery_bags
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "delivery_bags: rider reads own" on public.delivery_bags;
create policy "delivery_bags: rider reads own" on public.delivery_bags
  for select using (exists (
    select 1 from public.bag_assignments a
     where a.bag_id = delivery_bags.id and a.rider_id::text = auth.uid()::text and a.returned_at is null
  ));

drop policy if exists "bag_assignments: admin or own read" on public.bag_assignments;
create policy "bag_assignments: admin or own read" on public.bag_assignments
  for select using (public.is_admin() or rider_id::text = auth.uid()::text);

create or replace function public.admin_assign_bag(p_bag_id uuid, p_rider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bag record;
begin
  perform public.require_verified_admin();
  select * into v_bag from delivery_bags where id = p_bag_id for update;
  if not found then raise exception 'Bag not found'; end if;
  if v_bag.status not in ('available', 'assigned') then
    raise exception 'This bag is marked as %, so it can''t be assigned', v_bag.status;
  end if;
  if exists (select 1 from bag_assignments where bag_id = p_bag_id and returned_at is null and rider_id <> p_rider_id) then
    raise exception 'This bag is already with another rider. Take it back first.';
  end if;
  if (select role from users where id = p_rider_id) is distinct from 'rider' then
    raise exception 'Only approved riders can be given a bag';
  end if;

  -- Return any bag this rider had before.
  update delivery_bags set status = 'available', updated_at = now()
   where id in (select bag_id from bag_assignments where rider_id = p_rider_id and returned_at is null and bag_id <> p_bag_id);
  update bag_assignments set returned_at = now()
   where rider_id = p_rider_id and returned_at is null and bag_id <> p_bag_id;

  if not exists (select 1 from bag_assignments where bag_id = p_bag_id and rider_id = p_rider_id and returned_at is null) then
    insert into bag_assignments (bag_id, rider_id, assigned_by) values (p_bag_id, p_rider_id, auth.uid());
  end if;
  update delivery_bags set status = 'assigned', updated_at = now() where id = p_bag_id;

  insert into notifications (user_id, type, title, message, action_label)
  values (p_rider_id, 'system', 'Delivery bag assigned',
          'Delivery bag ' || v_bag.bag_code || ' is now assigned to you. Keep it clean and bring it on every delivery.',
          'Open');
end;
$$;

create or replace function public.admin_return_bag(p_bag_id uuid, p_new_status text default 'available')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_verified_admin();
  if p_new_status not in ('available', 'damaged', 'lost', 'retired') then
    raise exception 'Status must be available, damaged, lost or retired';
  end if;
  update bag_assignments set returned_at = now() where bag_id = p_bag_id and returned_at is null;
  update delivery_bags set status = p_new_status, updated_at = now() where id = p_bag_id;
end;
$$;

revoke all on function public.admin_assign_bag(uuid, uuid) from public, anon;
revoke all on function public.admin_return_bag(uuid, text) from public, anon;
grant execute on function public.admin_assign_bag(uuid, uuid) to authenticated;
grant execute on function public.admin_return_bag(uuid, text) to authenticated;
