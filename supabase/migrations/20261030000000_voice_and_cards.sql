-- =====================================================================
-- Saved cards (for one-tap and voice checkout) and voice assistant limits
-- =====================================================================

-- ---------------------------------------------------------------------
-- Saved cards. Paystack keeps the card; we keep only its reusable
-- authorization code (secret, server-only) and display details.
-- ---------------------------------------------------------------------
create table if not exists public.saved_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  authorization_code text not null,
  signature text not null,             -- Paystack's id for the physical card (dedupe)
  email text not null,                 -- Paystack requires the same email when charging
  brand text,
  last4 text not null,
  exp_month text,
  exp_year text,
  bank text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, signature)
);

alter table public.saved_cards enable row level security;

drop policy if exists "saved_cards: own read" on public.saved_cards;
create policy "saved_cards: own read" on public.saved_cards
  for select using (user_id = auth.uid());

drop policy if exists "saved_cards: own delete" on public.saved_cards;
create policy "saved_cards: own delete" on public.saved_cards
  for delete using (user_id = auth.uid());

-- The authorization code never leaves the server: apps can read the display
-- columns only. Cards are added by verify-payment (service role).
revoke all on public.saved_cards from anon, authenticated;
grant select (id, user_id, brand, last4, exp_month, exp_year, bank, is_default, created_at, last_used_at)
  on public.saved_cards to authenticated;
grant delete on public.saved_cards to authenticated;

-- ---------------------------------------------------------------------
-- Voice assistant usage, to cap AI cost per customer per day.
-- Written only by the voice-assistant edge function (service role).
-- ---------------------------------------------------------------------
create table if not exists public.voice_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null default (now() at time zone 'Africa/Lagos')::date,
  turns integer not null default 0,
  primary key (user_id, day)
);

alter table public.voice_usage enable row level security;
revoke all on public.voice_usage from anon, authenticated;

-- Counts one assistant turn; returns false when today's limit is reached.
create or replace function public.claim_voice_turn(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turns integer;
begin
  insert into voice_usage (user_id, day, turns)
  values (p_user, (now() at time zone 'Africa/Lagos')::date, 1)
  on conflict (user_id, day) do update set turns = voice_usage.turns + 1
  returning turns into v_turns;
  return v_turns <= p_limit;
end;
$$;

revoke all on function public.claim_voice_turn(uuid, integer) from public, anon, authenticated;

-- Voice settings admins can change (daily turn limit per customer).
alter table public.platform_settings add column if not exists voice_daily_turn_limit integer not null default 120;
alter table public.platform_settings add column if not exists voice_enabled boolean not null default true;
