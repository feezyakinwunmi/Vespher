-- =====================================================================
-- Company fleet: Vesphe's motorcycles and which rider has each one.
-- Admins register bikes as they're bought, then assign a free bike to a rider
-- (usually right after approving them). Assignments keep a history, so a bike
-- can be returned and given to someone else.
-- =====================================================================

create table if not exists public.company_bikes (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  make text,
  model text,
  year integer,
  color text,
  engine_number text,
  chassis_number text,
  photo_path text,           -- files in the fleet-documents bucket
  papers_path text,
  status text not null default 'available' check (status in ('available', 'assigned', 'maintenance', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bike_assignments (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references public.company_bikes(id) on delete cascade,
  rider_id uuid not null references public.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  assigned_by uuid references public.users(id),
  notes text
);

-- A bike has at most one current rider, and a rider at most one current bike.
create unique index if not exists bike_assignments_one_rider_per_bike on public.bike_assignments (bike_id) where returned_at is null;
create unique index if not exists bike_assignments_one_bike_per_rider on public.bike_assignments (rider_id) where returned_at is null;

alter table public.company_bikes enable row level security;
alter table public.bike_assignments enable row level security;

-- Admins manage the fleet; a rider can see the bike they currently have.
drop policy if exists "company_bikes: admin all" on public.company_bikes;
create policy "company_bikes: admin all" on public.company_bikes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "company_bikes: rider reads own" on public.company_bikes;
create policy "company_bikes: rider reads own" on public.company_bikes
  for select using (exists (
    select 1 from public.bike_assignments a
     where a.bike_id = company_bikes.id and a.rider_id::text = auth.uid()::text and a.returned_at is null
  ));

drop policy if exists "bike_assignments: admin read" on public.bike_assignments;
create policy "bike_assignments: admin read" on public.bike_assignments
  for select using (public.is_admin() or rider_id::text = auth.uid()::text);
-- Assignments are only written through the functions below.

-- ---------------------------------------------------------------------
-- Bike photos and papers: private, admins only
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fleet-documents', 'fleet-documents', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "fleet-documents: admin upload" on storage.objects;
create policy "fleet-documents: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'fleet-documents' and public.is_admin());

drop policy if exists "fleet-documents: admin update" on storage.objects;
create policy "fleet-documents: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'fleet-documents' and public.is_admin());

drop policy if exists "fleet-documents: admin read" on storage.objects;
create policy "fleet-documents: admin read" on storage.objects
  for select to authenticated using (bucket_id = 'fleet-documents' and public.is_admin());

-- ---------------------------------------------------------------------
-- Assign a bike to a rider (returns any bike they already had)
-- ---------------------------------------------------------------------
create or replace function public.admin_assign_bike(p_bike_id uuid, p_rider_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bike record;
  v_role text;
begin
  perform public.require_verified_admin();

  select * into v_bike from company_bikes where id = p_bike_id for update;
  if not found then raise exception 'Bike not found'; end if;
  if v_bike.status in ('maintenance', 'retired') then
    raise exception 'This bike is marked as %, so it can''t be assigned', v_bike.status;
  end if;
  if exists (select 1 from bike_assignments where bike_id = p_bike_id and returned_at is null and rider_id <> p_rider_id) then
    raise exception 'This bike is already with another rider. Return it first.';
  end if;

  select role into v_role from users where id = p_rider_id;
  if v_role is distinct from 'rider' then raise exception 'Only approved riders can be given a bike'; end if;

  -- Return whatever bike this rider had before.
  update company_bikes set status = 'available', updated_at = now()
   where id in (select bike_id from bike_assignments where rider_id = p_rider_id and returned_at is null and bike_id <> p_bike_id);
  update bike_assignments set returned_at = now()
   where rider_id = p_rider_id and returned_at is null and bike_id <> p_bike_id;

  if not exists (select 1 from bike_assignments where bike_id = p_bike_id and rider_id = p_rider_id and returned_at is null) then
    insert into bike_assignments (bike_id, rider_id, assigned_by, notes)
    values (p_bike_id, p_rider_id, auth.uid(), nullif(trim(p_notes), ''));
  end if;

  update company_bikes set status = 'assigned', updated_at = now() where id = p_bike_id;

  -- Keep the rider's profile in step (shown to customers and in rider lists).
  update users
     set vehicle_type = 'motorcycle',
         vehicle_number = v_bike.plate_number,
         vehicle_ownership = 'company',
         updated_at = now()
   where id = p_rider_id;

  insert into notifications (user_id, type, title, message, action_label)
  values (p_rider_id, 'system', 'Your bike is ready',
          'You''ve been assigned the ' || coalesce(nullif(trim(concat_ws(' ', v_bike.color, v_bike.make, v_bike.model)), ''), 'company')
            || ' motorcycle, plate ' || v_bike.plate_number || '. Collect it from the Vesphe office.',
          'Open');
end;
$$;

-- ---------------------------------------------------------------------
-- Take a bike back from its rider
-- ---------------------------------------------------------------------
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
    update users set vehicle_number = null, updated_at = now() where id = v_rider;
  end if;
end;
$$;

revoke all on function public.admin_assign_bike(uuid, uuid, text) from public, anon;
revoke all on function public.admin_return_bike(uuid, text) from public, anon;
grant execute on function public.admin_assign_bike(uuid, uuid, text) to authenticated;
grant execute on function public.admin_return_bike(uuid, text) to authenticated;
