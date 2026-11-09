-- =====================================================================
-- Release readiness
-- 1. Records when a customer agreed to Vesphe storing their health details.
-- 2. Indexes for the busiest lookups, so they stay fast as orders grow.
-- =====================================================================

alter table public.customer_health_profiles
  add column if not exists health_consent_at timestamptz;

create index if not exists orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_vendor_created_idx   on public.orders (vendor_id, created_at desc);
create index if not exists orders_rider_status_idx     on public.orders (rider_id, status);
create index if not exists orders_claimable_idx        on public.orders (created_at) where rider_id is null;
create index if not exists products_vendor_idx         on public.products (vendor_id);
create index if not exists notifications_user_idx      on public.notifications (user_id);
create index if not exists addresses_user_idx          on public.addresses (user_id);
create index if not exists withdrawals_user_status_idx on public.withdrawals (user_id, status);
create index if not exists users_role_idx              on public.users (role);
create index if not exists conversations_participants_idx on public.conversations using gin (participants);
