-- =====================================================================
-- Admin web dashboard: complaint chat, notification rules, realtime,
-- rider approvals, full-history reports, admin sign-in code check.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin second sign-in step
-- An admin session counts as verified when it was created (or re-verified)
-- with an emailed one-time code in the last 12 hours. Supabase records how a
-- session signed in in the JWT "amr" claim (password, otp, totp, ...).
-- ---------------------------------------------------------------------
create or replace function public.admin_code_verified()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
     where m ->> 'method' in ('otp', 'magiclink', 'totp')
       and coalesce((m ->> 'timestamp')::bigint, 0) > extract(epoch from now()) - 12 * 3600
  );
$$;

-- Admin who passed the second step. Used by the admin-only functions below.
create or replace function public.require_verified_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if not public.admin_code_verified() then
    raise exception 'Enter the sign-in code sent to your email' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Notifications: users only see / change / delete their own. Server
-- triggers (SECURITY DEFINER) create them; a user may only create one for
-- themselves, so nobody can push messages to other people's phones.
-- ---------------------------------------------------------------------
drop policy if exists "System can create notifications" on public.notifications;
drop policy if exists "Users can create own notifications" on public.notifications;
create policy "Users can create own notifications" on public.notifications
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Complaints + complaint chat
-- ---------------------------------------------------------------------
alter table public.complaints add column if not exists updated_at timestamptz default now();
alter table public.complaints add column if not exists last_message_at timestamptz;

alter table public.complaints enable row level security;

drop policy if exists "complaints: own or admin read" on public.complaints;
create policy "complaints: own or admin read" on public.complaints
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "complaints: create own" on public.complaints;
create policy "complaints: create own" on public.complaints
  for insert with check (user_id = auth.uid() and coalesce(status, 'pending') = 'pending');

drop policy if exists "complaints: admin update" on public.complaints;
create policy "complaints: admin update" on public.complaints
  for update using (public.is_admin()) with check (public.is_admin());

create table if not exists public.complaint_messages (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  sender_role text not null default 'customer',
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists complaint_messages_complaint_idx on public.complaint_messages (complaint_id, created_at);

alter table public.complaint_messages enable row level security;

drop policy if exists "complaint_messages: read" on public.complaint_messages;
create policy "complaint_messages: read" on public.complaint_messages
  for select using (
    public.is_admin()
    or exists (select 1 from public.complaints c where c.id = complaint_id and c.user_id = auth.uid())
  );

drop policy if exists "complaint_messages: send" on public.complaint_messages;
create policy "complaint_messages: send" on public.complaint_messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.complaints c
                  where c.id = complaint_id and c.user_id = auth.uid() and c.status = 'pending')
    )
  );

-- Sets the sender's real role, bumps the complaint, notifies the other side.
create or replace function public.on_complaint_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complaint record;
  v_is_admin boolean;
begin
  select id, user_id, title into v_complaint from complaints where id = new.complaint_id;
  v_is_admin := exists (select 1 from users where id = new.sender_id and role = 'admin');

  if v_is_admin then
    update complaints set last_message_at = new.created_at, updated_at = now(), response = left(new.body, 1000)
     where id = new.complaint_id;
    insert into notifications (user_id, type, title, message, action_link, action_label, metadata)
    values (v_complaint.user_id, 'system', 'Vesphe support replied',
            left(v_complaint.title || ': ' || new.body, 200), '/complaints', 'Open',
            jsonb_build_object('complaint_id', new.complaint_id));
  else
    update complaints set last_message_at = new.created_at, updated_at = now() where id = new.complaint_id;
    insert into notifications (user_id, type, title, message, action_link, action_label, metadata)
    select u.id, 'alert', 'Complaint reply: ' || left(v_complaint.title, 60), left(new.body, 200),
           '/admin/complaints', 'Open', jsonb_build_object('complaint_id', new.complaint_id)
      from users u where u.role = 'admin' and not coalesce(u.is_suspended, false);
  end if;
  return null;
end;
$$;

create or replace function public.set_complaint_message_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(role, 'customer') into new.sender_role from users where id = new.sender_id;
  return new;
end;
$$;

drop trigger if exists complaint_message_role on public.complaint_messages;
create trigger complaint_message_role before insert on public.complaint_messages
  for each row execute function public.set_complaint_message_role();

drop trigger if exists complaint_message_notify on public.complaint_messages;
create trigger complaint_message_notify after insert on public.complaint_messages
  for each row execute function public.on_complaint_message();

-- New complaint -> tell the admins. Status change -> tell the author.
create or replace function public.on_complaint_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into notifications (user_id, type, title, message, action_link, action_label, metadata)
    select u.id, 'alert', 'New complaint: ' || left(new.title, 60),
           left(coalesce(new.user_name, 'A user') || ' (' || coalesce(new.user_role, 'user') || '): ' || new.description, 200),
           '/admin/complaints', 'Open', jsonb_build_object('complaint_id', new.id)
      from users u where u.role = 'admin' and not coalesce(u.is_suspended, false);
  elsif new.status is distinct from old.status and new.status in ('resolved', 'rejected') then
    insert into notifications (user_id, type, title, message, action_link, action_label, metadata)
    values (new.user_id, 'system',
            case when new.status = 'resolved' then 'Complaint resolved' else 'Complaint closed' end,
            left(new.title, 200), '/complaints', 'Open', jsonb_build_object('complaint_id', new.id));
  end if;
  return null;
end;
$$;

drop trigger if exists complaint_change_notify on public.complaints;
create trigger complaint_change_notify after insert or update of status on public.complaints
  for each row execute function public.on_complaint_change();

-- ---------------------------------------------------------------------
-- Realtime: until now only "orders" was published, so in-app notifications,
-- chat and complaints never updated live.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['notifications', 'messages', 'conversations', 'complaints', 'complaint_messages'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Riders: approve / reject an application in one step
-- ---------------------------------------------------------------------
create or replace function public.admin_review_rider_application(p_application_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
begin
  perform public.require_verified_admin();
  select * into v_app from rider_applications where id = p_application_id;
  if not found then
    raise exception 'Application not found';
  end if;

  update rider_applications set status = case when p_approve then 'approved' else 'rejected' end
   where id = p_application_id;

  if p_approve then
    update users
       set role = 'rider',
           is_approved = true,
           vehicle_type = coalesce(v_app.vehicle_type, vehicle_type),
           vehicle_number = coalesce(v_app.vehicle_number, vehicle_number),
           license_number = coalesce(v_app.license_number, license_number),
           vehicle_ownership = coalesce(v_app.vehicle_ownership, vehicle_ownership),
           bank_name = coalesce(v_app.bank_name, bank_name),
           account_number = coalesce(v_app.account_number, account_number),
           account_name = coalesce(v_app.account_name, account_name),
           updated_at = now()
     where id = v_app.user_id;
  else
    update users set is_approved = false, updated_at = now() where id = v_app.user_id;
  end if;

  insert into notifications (user_id, type, title, message, action_label)
  values (v_app.user_id, 'system',
          case when p_approve then 'Rider application approved' else 'Rider application not approved' end,
          case when p_approve then 'You can now go online and accept deliveries.'
               else 'Your rider application was not approved. Contact Vesphe support for details.' end,
          'Open');
end;
$$;

revoke all on function public.admin_review_rider_application(uuid, boolean) from public, anon;
grant execute on function public.admin_review_rider_application(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Reports: totals for any period, or all time (p_from / p_to null).
-- Amounts are in naira. Cancelled orders are excluded from sales.
-- ---------------------------------------------------------------------
create or replace function public.admin_report(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := coalesce(p_from, '-infinity');
  v_to timestamptz := coalesce(p_to, 'infinity');
  r jsonb;
begin
  perform public.require_verified_admin();

  with o as (
    select * from orders where created_at >= v_from and created_at < v_to
  ), live as (
    select * from o where status <> 'cancelled'
  ), subs as (
    select * from subscriptions where payment_status = 'paid' and created_at >= v_from and created_at < v_to
  ), promos as (
    select * from promotions where payment_status = 'paid' and created_at >= v_from and created_at < v_to
  ), logi as (
    select * from business_logistics where created_at >= v_from and created_at < v_to
  )
  select jsonb_build_object(
    'orders', jsonb_build_object(
      'placed', (select count(*) from o),
      'delivered', (select count(*) from o where status = 'delivered'),
      'in_progress', (select count(*) from o where status not in ('delivered', 'cancelled')),
      'cancelled', (select count(*) from o where status = 'cancelled'),
      'card', (select count(*) from live where payment_method = 'card'),
      'cash', (select count(*) from live where payment_method = 'cash'),
      'customers', (select count(distinct customer_id) from live)
    ),
    'sales', jsonb_build_object(
      'gmv', (select coalesce(sum(total), 0) from live),
      'food', (select coalesce(sum(subtotal), 0) from live),
      'delivery_fees', (select coalesce(sum(delivery_fee), 0) from live),
      'service_fees', (select coalesce(sum(service_fee), 0) from live),
      'discounts', (select coalesce(sum(discount), 0) from live),
      'card_paid', (select coalesce(sum(total), 0) from live where payment_method = 'card' and payment_status = 'paid'),
      'cash', (select coalesce(sum(total), 0) from live where payment_method = 'cash')
    ),
    'vendors', jsonb_build_object(
      'payouts', (select coalesce(sum(vendor_payout), 0) from live),
      'payouts_card', (select coalesce(sum(vendor_payout), 0) from live where payment_method = 'card'),
      'payouts_cash', (select coalesce(sum(vendor_payout), 0) from live where payment_method = 'cash')
    ),
    'riders', jsonb_build_object(
      'order_earnings', (select coalesce(sum(rider_earnings), 0) from live),
      'logistics_earnings', (select coalesce(sum(rider_share), 0) from logi where payment_status = 'paid')
    ),
    'refunds', jsonb_build_object(
      'refunded_count', (select count(*) from o where payment_status = 'refunded'),
      'refunded', (select coalesce(sum(coalesce(refund_amount, total)), 0) from o where payment_status = 'refunded'),
      'owed_count', (select count(*) from o where status = 'cancelled' and payment_method = 'card' and payment_status = 'paid'),
      'owed', (select coalesce(sum(total), 0) from o where status = 'cancelled' and payment_method = 'card' and payment_status = 'paid')
    ),
    'pro', jsonb_build_object(
      'revenue', (select coalesce(sum(amount), 0) from subs),
      'payments', (select count(*) from subs),
      'monthly', (select coalesce(sum(amount), 0) from subs where plan = 'monthly'),
      'yearly', (select coalesce(sum(amount), 0) from subs where plan = 'yearly'),
      'active_now', (select count(distinct user_id) from subscriptions
                      where status = 'active' and payment_status = 'paid' and expires_at > now())
    ),
    'promotions', jsonb_build_object(
      'revenue', (select coalesce(sum(coalesce(payment_amount, total_cost)), 0) from promos where status <> 'rejected'),
      'paid_count', (select count(*) from promos),
      'rejected_paid', (select coalesce(sum(coalesce(payment_amount, total_cost)), 0) from promos where status = 'rejected')
    ),
    'logistics', jsonb_build_object(
      'requests', (select count(*) from logi),
      'paid', (select coalesce(sum(coalesce(total_amount, calculated_fee)), 0) from logi where payment_status = 'paid'),
      'platform_share', (select coalesce(sum(platform_share), 0) from logi where payment_status = 'paid')
    ),
    'platform', jsonb_build_object(
      'commission', (select coalesce(sum(coalesce(platform_commission, subtotal - vendor_payout)), 0) from live),
      'delivery_share', (select coalesce(sum(platform_delivery_earnings), 0) from live)
    ),
    'signups', jsonb_build_object(
      'customers', (select count(*) from users where role = 'customer' and created_at >= v_from and created_at < v_to),
      'vendors', (select count(*) from users where role = 'vendor' and created_at >= v_from and created_at < v_to),
      'riders', (select count(*) from users where role = 'rider' and created_at >= v_from and created_at < v_to),
      'businesses', (select count(*) from users where role = 'business' and created_at >= v_from and created_at < v_to)
    ),
    'totals_all_time', jsonb_build_object(
      'customers', (select count(*) from users where role = 'customer'),
      'vendors', (select count(*) from vendors),
      'vendors_approved', (select count(*) from vendors where is_approved and not coalesce(is_suspended, false)),
      'riders', (select count(*) from users where role = 'rider'),
      'pro_users_ever', (select count(distinct user_id) from subscriptions where payment_status = 'paid')
    )
  ) into r;

  -- Platform revenue = commission + service fees + platform delivery share
  --                    + Pro + promotions + logistics share
  r := jsonb_set(r, '{platform,total}', to_jsonb(
         (r #>> '{platform,commission}')::numeric
       + (r #>> '{sales,service_fees}')::numeric
       + (r #>> '{platform,delivery_share}')::numeric
       + (r #>> '{pro,revenue}')::numeric
       + (r #>> '{promotions,revenue}')::numeric
       + (r #>> '{logistics,platform_share}')::numeric));
  return r;
end;
$$;

-- Month-by-month figures (Lagos time) for milestones and accounting.
create or replace function public.admin_report_monthly(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  month date,
  orders bigint,
  delivered bigint,
  cancelled bigint,
  gmv numeric,
  commission numeric,
  service_fees numeric,
  delivery_fees numeric,
  vendor_payouts numeric,
  pro_revenue numeric,
  promotion_revenue numeric,
  logistics_share numeric,
  refunds numeric,
  new_customers bigint,
  new_vendors bigint,
  new_riders bigint,
  delivery_share numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := coalesce(p_from, '-infinity');
  v_to timestamptz := coalesce(p_to, 'infinity');
begin
  perform public.require_verified_admin();
  return query
  with months as (
    select date_trunc('month', created_at at time zone 'Africa/Lagos')::date m from orders where created_at >= v_from and created_at < v_to
    union select date_trunc('month', created_at at time zone 'Africa/Lagos')::date from users where created_at >= v_from and created_at < v_to
    union select date_trunc('month', created_at at time zone 'Africa/Lagos')::date from subscriptions where payment_status = 'paid' and created_at >= v_from and created_at < v_to
    union select date_trunc('month', created_at at time zone 'Africa/Lagos')::date from promotions where payment_status = 'paid' and created_at >= v_from and created_at < v_to
  ),
  o as (
    select date_trunc('month', created_at at time zone 'Africa/Lagos')::date m, * from orders where created_at >= v_from and created_at < v_to
  )
  select mo.m,
    (select count(*) from o where o.m = mo.m),
    (select count(*) from o where o.m = mo.m and o.status = 'delivered'),
    (select count(*) from o where o.m = mo.m and o.status = 'cancelled'),
    (select coalesce(sum(o.total), 0)::numeric from o where o.m = mo.m and o.status <> 'cancelled'),
    (select coalesce(sum(coalesce(o.platform_commission, o.subtotal - o.vendor_payout)), 0)::numeric from o where o.m = mo.m and o.status <> 'cancelled'),
    (select coalesce(sum(o.service_fee), 0)::numeric from o where o.m = mo.m and o.status <> 'cancelled'),
    (select coalesce(sum(o.delivery_fee), 0)::numeric from o where o.m = mo.m and o.status <> 'cancelled'),
    (select coalesce(sum(o.vendor_payout), 0)::numeric from o where o.m = mo.m and o.status <> 'cancelled'),
    (select coalesce(sum(s.amount), 0)::numeric from subscriptions s
      where s.payment_status = 'paid' and date_trunc('month', s.created_at at time zone 'Africa/Lagos')::date = mo.m),
    (select coalesce(sum(coalesce(p.payment_amount, p.total_cost)), 0)::numeric from promotions p
      where p.payment_status = 'paid' and p.status <> 'rejected' and date_trunc('month', p.created_at at time zone 'Africa/Lagos')::date = mo.m),
    (select coalesce(sum(b.platform_share), 0)::numeric from business_logistics b
      where b.payment_status = 'paid' and date_trunc('month', b.created_at at time zone 'Africa/Lagos')::date = mo.m),
    (select coalesce(sum(coalesce(o.refund_amount, o.total)), 0)::numeric from o where o.m = mo.m and o.payment_status = 'refunded'),
    (select count(*) from users u where u.role = 'customer' and date_trunc('month', u.created_at at time zone 'Africa/Lagos')::date = mo.m),
    (select count(*) from users u where u.role = 'vendor' and date_trunc('month', u.created_at at time zone 'Africa/Lagos')::date = mo.m),
    (select count(*) from users u where u.role = 'rider' and date_trunc('month', u.created_at at time zone 'Africa/Lagos')::date = mo.m),
    (select coalesce(sum(o.platform_delivery_earnings), 0)::numeric from o where o.m = mo.m and o.status <> 'cancelled')
  from months mo
  order by mo.m desc;
end;
$$;

revoke all on function public.admin_report(timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_report_monthly(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_report(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_report_monthly(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Rider totals over their whole history (food orders + business deliveries)
-- ---------------------------------------------------------------------
create or replace function public.admin_rider_stats()
returns table (
  rider_id uuid,
  deliveries bigint,
  active_orders bigint,
  order_earnings numeric,
  logistics_deliveries bigint,
  logistics_earnings numeric,
  paid_out numeric,
  pending_withdrawals numeric,
  last_delivery_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_verified_admin();
  return query
  select u.id,
    (select count(*) from orders o where o.rider_id = u.id and o.status = 'delivered'),
    (select count(*) from orders o where o.rider_id = u.id and o.status in ('ready', 'picked_up', 'in_transit')),
    (select coalesce(sum(o.rider_earnings), 0)::numeric from orders o where o.rider_id = u.id and o.status = 'delivered'),
    (select count(*) from business_logistics b where b.rider_id = u.id and b.status in ('delivered', 'completed')),
    (select coalesce(sum(b.rider_share), 0)::numeric from business_logistics b where b.rider_id = u.id and b.status in ('delivered', 'completed')),
    (select coalesce(sum(w.amount), 0)::numeric from rider_withdrawals w where w.rider_id = u.id and w.status in ('completed', 'paid', 'success'))
      + (select coalesce(sum(w.amount), 0)::numeric from withdrawals w where w.user_id = u.id and w.status in ('completed', 'paid', 'success')),
    (select coalesce(sum(w.amount), 0)::numeric from rider_withdrawals w where w.rider_id = u.id and w.status in ('pending', 'processing'))
      + (select coalesce(sum(w.amount), 0)::numeric from withdrawals w where w.user_id = u.id and w.status in ('pending', 'processing')),
    greatest(
      (select max(coalesce(o.delivered_at, o.updated_at)) from orders o where o.rider_id = u.id and o.status = 'delivered'),
      (select max(coalesce(b.delivered_at, b.completed_at)) from business_logistics b where b.rider_id = u.id)
    )
  from users u
  where u.role = 'rider'
     or exists (select 1 from rider_applications a where a.user_id = u.id);
end;
$$;

revoke all on function public.admin_rider_stats() from public, anon;
grant execute on function public.admin_rider_stats() to authenticated;
