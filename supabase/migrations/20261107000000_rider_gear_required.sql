-- =====================================================================
-- Riders need a Vesphe delivery bag as well as a bike to work.
-- Every order should travel in a Vesphe bag, so vendors only hand food to a
-- rider whose bag code matches the one shown on the order.
-- Needs 20261106000000_fleet_expenses_bags.sql.
-- =====================================================================

-- What a rider is missing before they can work: null when ready,
-- otherwise 'bike', 'bag' or 'bike_and_bag'.
create or replace function public.rider_missing_gear(p_rider_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with g as (
    select public.rider_has_vehicle(p_rider_id) as has_bike,
           exists (select 1 from bag_assignments a where a.rider_id = p_rider_id and a.returned_at is null) as has_bag
  )
  select case
           when has_bike and has_bag then null
           when not has_bike and not has_bag then 'bike_and_bag'
           when not has_bike then 'bike'
           else 'bag'
         end
    from g;
$$;

revoke all on function public.rider_missing_gear(uuid) from public, anon;
grant execute on function public.rider_missing_gear(uuid) to authenticated;

create or replace function public.rider_gear_message(p_missing text)
returns text
language sql
immutable
as $$
  select case p_missing
           when 'bike_and_bag' then 'a Vesphe bike and delivery bag'
           when 'bike' then 'a Vesphe bike'
           else 'a Vesphe delivery bag'
         end;
$$;

-- Accepting an order needs a bike and a bag. Admins are exempt.
create or replace function public.guard_rider_vehicle_on_orders()
returns trigger
language plpgsql
as $$
declare
  v_missing text;
begin
  if public.bypass_guards() then
    return new;
  end if;
  if new.rider_id is not null
     and (old.rider_id is null or old.rider_id::text <> new.rider_id::text) then
    v_missing := public.rider_missing_gear(new.rider_id::text::uuid);
    if v_missing is not null then
      raise exception 'You need % assigned before you can accept orders', public.rider_gear_message(v_missing) using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Going online needs a bike and a bag too.
create or replace function public.guard_rider_vehicle_on_users()
returns trigger
language plpgsql
as $$
declare
  v_missing text;
begin
  if public.bypass_guards() then
    return new;
  end if;
  if new.role = 'rider'
     and coalesce(new.is_available, false)
     and not coalesce(old.is_available, false) then
    v_missing := public.rider_missing_gear(new.id);
    if v_missing is not null then
      raise exception 'You need % assigned before you can go online', public.rider_gear_message(v_missing) using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Taking a bag back also switches its rider offline.
create or replace function public.admin_return_bag(p_bag_id uuid, p_new_status text default 'available')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider uuid;
begin
  perform public.require_verified_admin();
  if p_new_status not in ('available', 'damaged', 'lost', 'retired') then
    raise exception 'Status must be available, damaged, lost or retired';
  end if;
  select rider_id into v_rider from bag_assignments where bag_id = p_bag_id and returned_at is null;
  update bag_assignments set returned_at = now() where bag_id = p_bag_id and returned_at is null;
  update delivery_bags set status = p_new_status, updated_at = now() where id = p_bag_id;

  if v_rider is not null then
    update users set is_available = false, updated_at = now() where id = v_rider;
    insert into notifications (user_id, type, title, message, action_label)
    values (v_rider, 'system', 'Delivery bag returned',
            'Your Vesphe delivery bag has been taken back, so you''re offline for now. You can go online again once a bag is assigned to you.',
            'Open');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Show the rider's bag code and plate to the vendor and customer of an order,
-- so food is only handed to a rider carrying the matching Vesphe bag.
-- ---------------------------------------------------------------------
create or replace function public.order_rider_gear(p_order_id text)
returns table (bag_code text, plate_number text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select o.rider_id, o.customer_id, o.vendor_id into v_order from orders o where o.id::text = p_order_id;
  if not found or v_order.rider_id is null then
    return;
  end if;
  if not (
    public.is_admin()
    or v_order.customer_id::text = auth.uid()::text
    or v_order.rider_id::text = auth.uid()::text
    or exists (select 1 from vendors v where v.id::text = v_order.vendor_id::text and v.owner_id::text = auth.uid()::text)
  ) then
    return;
  end if;

  return query
    select (select b.bag_code from bag_assignments a join delivery_bags b on b.id = a.bag_id
             where a.rider_id::text = v_order.rider_id::text and a.returned_at is null limit 1),
           (select k.plate_number from bike_assignments a join company_bikes k on k.id = a.bike_id
             where a.rider_id::text = v_order.rider_id::text and a.returned_at is null limit 1);
end;
$$;

revoke all on function public.order_rider_gear(text) from public, anon;
grant execute on function public.order_rider_gear(text) to authenticated;
