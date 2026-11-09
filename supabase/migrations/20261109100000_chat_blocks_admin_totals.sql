-- =====================================================================
-- 1. Chat: people can block each other (required by the App Store for apps
--    where users message each other).
-- 2. Admin dashboard totals are added up in the database instead of
--    downloading every order to the phone.
-- =====================================================================

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks: own" on public.user_blocks;
create policy "user_blocks: own" on public.user_blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

drop policy if exists "user_blocks: admin read" on public.user_blocks;
create policy "user_blocks: admin read" on public.user_blocks for select using (public.is_admin());

-- Messages can't be sent in either direction once someone is blocked. Support can still reach anyone.
create or replace function public.guard_blocked_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if exists (
    select 1
      from conversations c
      join user_blocks b
        on (b.blocked_id::text = new.sender_id::text and b.blocker_id::text = any (c.participants))
        or (b.blocker_id::text = new.sender_id::text and b.blocked_id::text = any (c.participants))
     where c.id = new.conversation_id
  ) then
    raise exception 'This message can''t be delivered' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_blocked_messages on public.messages;
create trigger guard_blocked_messages
  before insert on public.messages
  for each row execute function public.guard_blocked_messages();

create or replace function public.admin_order_sums()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'live_total', coalesce(sum(total) filter (where status <> 'cancelled'), 0),
           'delivered_total', coalesce(sum(total) filter (where status = 'delivered'), 0),
           'delivered_delivery_fees', coalesce(sum(delivery_fee) filter (where status = 'delivered'), 0)
         )
    into v_result
    from orders;
  return v_result;
end;
$$;

revoke all on function public.admin_order_sums() from public, anon;
grant execute on function public.admin_order_sums() to authenticated;
