-- =====================================================================
-- Rider applications: people apply in the app, an admin approves them.
--
-- 1. Full vehicle / identity / guarantor details on rider_applications.
-- 2. Nobody can make themselves a rider: the role is only granted by
--    admin_review_rider_application(). (Before this, the users insert guard
--    accepted role = 'rider' straight from the app.)
-- 3. Row-level security: applicants see and submit their own applications.
-- 4. Review function records who reviewed, when, and why it was rejected,
--    and sets up the rider's payout bank account on approval.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Application details
-- ---------------------------------------------------------------------
alter table public.rider_applications
  add column if not exists date_of_birth date,
  add column if not exists selfie_url text,
  add column if not exists city text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_year integer,
  add column if not exists vehicle_color text,
  add column if not exists vehicle_owner_name text,
  add column if not exists vehicle_owner_phone text,
  add column if not exists vehicle_photo_url text,
  add column if not exists vehicle_papers_url text,
  add column if not exists license_expiry date,
  add column if not exists id_type text,
  add column if not exists id_number text,
  add column if not exists guarantor_name text,
  add column if not exists guarantor_phone text,
  add column if not exists guarantor_relationship text,
  add column if not exists guarantor_address text,
  add column if not exists bank_code text,
  add column if not exists rejection_reason text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

-- One open application per person.
create unique index if not exists rider_applications_one_pending
  on public.rider_applications (user_id)
  where status = 'pending';

-- ---------------------------------------------------------------------
-- 2. Users insert guard: rider is granted by an admin, never self-assigned
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
    -- 'business' signs up in the logistics app; riders apply and are approved.
    if new.role is null or new.role not in ('customer', 'vendor', 'business') then
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

-- ---------------------------------------------------------------------
-- 3. Row-level security
-- ---------------------------------------------------------------------
alter table public.rider_applications enable row level security;

drop policy if exists "rider_applications: own read" on public.rider_applications;
create policy "rider_applications: own read" on public.rider_applications
  for select using (user_id::text = auth.uid()::text or public.is_admin());

drop policy if exists "rider_applications: own submit" on public.rider_applications;
create policy "rider_applications: own submit" on public.rider_applications
  for insert with check (
    user_id::text = auth.uid()::text
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and rejection_reason is null
  );

-- Reviews go through admin_review_rider_application(); admins may also fix typos.
drop policy if exists "rider_applications: admin update" on public.rider_applications;
create policy "rider_applications: admin update" on public.rider_applications
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. Review
-- ---------------------------------------------------------------------
drop function if exists public.admin_review_rider_application(uuid, boolean);

create or replace function public.admin_review_rider_application(
  p_application_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
begin
  perform public.require_verified_admin();
  select * into v_app from rider_applications where id::text = p_application_id::text;
  if not found then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'This application has already been reviewed';
  end if;

  update rider_applications
     set status = case when p_approve then 'approved' else 'rejected' end,
         rejection_reason = case when p_approve then null else nullif(trim(p_reason), '') end,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id::text = p_application_id::text;

  if p_approve then
    update users
       set role = 'rider',
           is_approved = true,
           is_available = false,
           avatar_url = coalesce(avatar_url, v_app.selfie_url),
           vehicle_type = coalesce(v_app.vehicle_type, vehicle_type),
           vehicle_number = coalesce(v_app.vehicle_number, vehicle_number),
           license_number = coalesce(v_app.license_number, license_number),
           vehicle_ownership = coalesce(v_app.vehicle_ownership, vehicle_ownership),
           bank_name = coalesce(v_app.bank_name, bank_name),
           account_number = coalesce(v_app.account_number, account_number),
           account_name = coalesce(v_app.account_name, account_name),
           updated_at = now()
     where id::text = v_app.user_id::text;

    -- Payout account used by the rider Withdraw screen.
    if v_app.account_number is not null then
      if exists (select 1 from bank_details where user_id::text = v_app.user_id::text and user_type = 'rider') then
        update bank_details
           set bank_name = v_app.bank_name,
               account_number = v_app.account_number,
               account_name = v_app.account_name,
               is_default = true,
               updated_at = now()
         where user_id::text = v_app.user_id::text and user_type = 'rider';
      else
        insert into bank_details (user_id, user_type, bank_name, account_number, account_name, is_default)
        values (v_app.user_id::uuid, 'rider', v_app.bank_name, v_app.account_number, v_app.account_name, true);
      end if;
    end if;
  else
    update users set is_approved = false, updated_at = now() where id::text = v_app.user_id::text;
  end if;

  insert into notifications (user_id, type, title, message, action_label)
  values (v_app.user_id::uuid, 'system',
          case when p_approve then 'You are now a Vesphe rider 🎉' else 'Rider application not approved' end,
          case when p_approve then 'Your application was approved. Open the app, go online and start accepting deliveries.'
               else 'Your rider application was not approved'
                    || coalesce(': ' || nullif(trim(p_reason), ''), '.')
                    || ' You can fix this and apply again from your profile.' end,
          'Open');
end;
$$;

revoke all on function public.admin_review_rider_application(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_rider_application(uuid, boolean, text) to authenticated;
