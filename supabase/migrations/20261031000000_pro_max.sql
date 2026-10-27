-- =====================================================================
-- Vesphe Pro Max: everything in Pro + voice ordering.
-- Free trial: a few voice orders, then Pro Max is required.
-- Voice AI usage is metered so the Pro Max price can be checked against the
-- Claude bill (Reports → Voice ordering).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Subscription tier
-- ---------------------------------------------------------------------
alter table public.subscriptions add column if not exists tier text not null default 'pro';
alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions add constraint subscriptions_tier_check check (tier in ('pro', 'pro_max'));

alter table public.platform_settings
  add column if not exists pro_max_monthly_price integer not null default 4500,
  add column if not exists pro_max_yearly_price integer not null default 45000,
  add column if not exists voice_free_trial_orders integer not null default 3,
  add column if not exists voice_trial_turn_limit integer not null default 60,
  add column if not exists voice_monthly_turn_limit integer not null default 600,
  -- For the cost estimate in Reports. Claude Haiku 5.5: $0.10 in / $0.50 out per million tokens.
  add column if not exists voice_input_usd_per_mtok numeric not null default 0.10,
  add column if not exists voice_output_usd_per_mtok numeric not null default 0.50,
  add column if not exists usd_ngn_rate numeric not null default 1600;

-- Prices come from the admin settings for the chosen tier and plan.
create or replace function public.price_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  select pro_monthly_price, pro_yearly_price, pro_max_monthly_price, pro_max_yearly_price
    into s
    from public.platform_settings
   order by id
   limit 1;

  new.tier := coalesce(new.tier, 'pro');
  new.amount := case
    when new.tier = 'pro_max' and new.plan = 'yearly' then coalesce(s.pro_max_yearly_price, 45000)
    when new.tier = 'pro_max' then coalesce(s.pro_max_monthly_price, 4500)
    when new.plan = 'yearly' then coalesce(s.pro_yearly_price, 15000)
    else coalesce(s.pro_monthly_price, 1500)
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

-- is_pro() (any tier) is unchanged. Pro Max only:
create or replace function public.is_pro_max(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
     where user_id = uid and tier = 'pro_max' and status = 'active' and expires_at > now()
  );
$$;
grant execute on function public.is_pro_max(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Voice usage metering
-- ---------------------------------------------------------------------
alter table public.voice_usage
  add column if not exists input_tokens bigint not null default 0,
  add column if not exists output_tokens bigint not null default 0;

create or replace function public.record_voice_usage(p_user uuid, p_input bigint, p_output bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into voice_usage (user_id, day, turns, input_tokens, output_tokens)
  values (p_user, (now() at time zone 'Africa/Lagos')::date, 0, greatest(p_input, 0), greatest(p_output, 0))
  on conflict (user_id, day) do update
    set input_tokens = voice_usage.input_tokens + excluded.input_tokens,
        output_tokens = voice_usage.output_tokens + excluded.output_tokens;
$$;
revoke all on function public.record_voice_usage(uuid, bigint, bigint) from public, anon, authenticated;

-- Can this customer use voice ordering right now, and why not?
create or replace function public.voice_access(p_user uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
  v_pro_max boolean;
  v_trial_orders integer;
  v_trial_turns integer;
  v_month_turns integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and p_user is distinct from auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select voice_enabled, voice_free_trial_orders, voice_trial_turn_limit, voice_monthly_turn_limit,
         pro_max_monthly_price, pro_max_yearly_price
    into s from platform_settings order by id limit 1;

  v_pro_max := public.is_pro_max(p_user);
  select count(*) into v_trial_orders
    from orders
   where customer_id = p_user and metadata ->> 'source' = 'voice' and status <> 'cancelled';
  select coalesce(sum(turns), 0) into v_trial_turns from voice_usage where user_id = p_user;
  select coalesce(sum(turns), 0) into v_month_turns
    from voice_usage
   where user_id = p_user and day >= date_trunc('month', now() at time zone 'Africa/Lagos')::date;

  return jsonb_build_object(
    'allowed', coalesce(s.voice_enabled, true) and (
      (v_pro_max and v_month_turns < coalesce(s.voice_monthly_turn_limit, 600))
      or (not v_pro_max and v_trial_orders < coalesce(s.voice_free_trial_orders, 3)
                        and v_trial_turns < coalesce(s.voice_trial_turn_limit, 60))
    ),
    'reason', case
      when not coalesce(s.voice_enabled, true) then 'disabled'
      when v_pro_max and v_month_turns >= coalesce(s.voice_monthly_turn_limit, 600) then 'monthly_limit'
      when v_pro_max then 'ok'
      when v_trial_orders >= coalesce(s.voice_free_trial_orders, 3) or v_trial_turns >= coalesce(s.voice_trial_turn_limit, 60) then 'trial_used'
      else 'trial'
    end,
    'pro_max', v_pro_max,
    'trial_orders_left', greatest(coalesce(s.voice_free_trial_orders, 3) - v_trial_orders, 0),
    'pro_max_monthly_price', s.pro_max_monthly_price,
    'pro_max_yearly_price', s.pro_max_yearly_price
  );
end;
$$;
revoke all on function public.voice_access(uuid) from public, anon;
grant execute on function public.voice_access(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Reports: is Pro Max paying for the voice AI?
-- ---------------------------------------------------------------------
create or replace function public.admin_voice_report(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
  v_from date := coalesce((p_from at time zone 'Africa/Lagos')::date, '-infinity'::date);
  v_to date := coalesce((p_to at time zone 'Africa/Lagos')::date, 'infinity'::date);
  r jsonb;
begin
  perform public.require_verified_admin();
  select voice_input_usd_per_mtok, voice_output_usd_per_mtok, usd_ngn_rate into s from platform_settings order by id limit 1;

  with u as (
    select * from voice_usage where day >= v_from and day < v_to
  ), cost as (
    select coalesce(sum(input_tokens), 0) as tin, coalesce(sum(output_tokens), 0) as tout,
           coalesce(sum(turns), 0) as turns, count(distinct user_id) as users
      from u
  )
  select jsonb_build_object(
    'turns', c.turns,
    'users', c.users,
    'input_tokens', c.tin,
    'output_tokens', c.tout,
    'cost_usd', round((c.tin * s.voice_input_usd_per_mtok + c.tout * s.voice_output_usd_per_mtok) / 1000000.0, 4),
    'cost_ngn', round((c.tin * s.voice_input_usd_per_mtok + c.tout * s.voice_output_usd_per_mtok) / 1000000.0 * s.usd_ngn_rate),
    'usd_ngn_rate', s.usd_ngn_rate,
    'voice_orders', (select count(*) from orders
                      where metadata ->> 'source' = 'voice' and status <> 'cancelled'
                        and created_at >= coalesce(p_from, '-infinity') and created_at < coalesce(p_to, 'infinity')),
    'pro_max_revenue', (select coalesce(sum(amount), 0) from subscriptions
                         where tier = 'pro_max' and payment_status = 'paid'
                           and created_at >= coalesce(p_from, '-infinity') and created_at < coalesce(p_to, 'infinity')),
    'pro_max_members_now', (select count(distinct user_id) from subscriptions
                             where tier = 'pro_max' and status = 'active' and payment_status = 'paid' and expires_at > now())
  ) into r
  from cost c;
  return r;
end;
$$;
revoke all on function public.admin_voice_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_voice_report(timestamptz, timestamptz) to authenticated;
