-- =====================================================================
-- Reliable push notifications
--
-- Before: send_push_notification() pushed to only the newest device of a user,
-- through the unauthenticated send-notification relay; many in-app
-- notifications never produced a push; two triggers were attached twice, so
-- some notifications arrived double; any signed-in user could re-point any
-- device token ("Users can update any token").
--
-- After:
--   * Every row inserted into notifications is pushed to all of that user's
--     devices (Expo push API, called directly via pg_net, after commit).
--   * Triggers that call send_push_notification() themselves still work; a
--     user gets at most one push per database transaction, so an event that
--     both pushes and writes an in-app notification is not delivered twice.
--   * Devices register through register_push_token(), which only ever
--     attaches a token to the caller.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Device tokens: one row per device token
-- ---------------------------------------------------------------------
delete from public.user_push_tokens t
 using public.user_push_tokens newer
 where t.push_token = newer.push_token
   and (coalesce(t.updated_at, t.created_at, 'epoch'), t.id)
     < (coalesce(newer.updated_at, newer.created_at, 'epoch'), newer.id);

create unique index if not exists user_push_tokens_push_token_key on public.user_push_tokens (push_token);

drop policy if exists "Users can update any token" on public.user_push_tokens;
drop policy if exists "Users can delete their own tokens" on public.user_push_tokens;
create policy "Users can delete their own tokens" on public.user_push_tokens
  for delete using (auth.uid() = user_id);

-- Attach this device's token to the signed-in user (moves it off whoever used
-- the device before).
create or replace function public.register_push_token(p_token text, p_device text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[.+\]$' then
    raise exception 'Invalid push token';
  end if;

  insert into user_push_tokens (user_id, push_token, device_type, is_active, created_at, updated_at)
  values (auth.uid(), p_token, left(p_device, 20), true, now(), now())
  on conflict (push_token) do update
    set user_id = excluded.user_id,
        device_type = excluded.device_type,
        is_active = true,
        updated_at = now();
end;
$$;

-- Detach this device on sign-out.
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from user_push_tokens where push_token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------
-- The one push sender. Same signature as before, so every existing trigger
-- that calls it keeps working.
-- ---------------------------------------------------------------------
create or replace function public.send_push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pushed text := coalesce(current_setting('vesphe.pushed_users', true), '');
  v_type text := coalesce(p_data->>'type', '');
  v_channel text;
  v_messages jsonb;
begin
  if p_user_id is null then
    return 'No user';
  end if;
  -- One push per user per transaction.
  if position(p_user_id::text in v_pushed) > 0 then
    return 'Already notified';
  end if;

  v_channel := case
    when v_type in ('order', 'delivery') or p_data ? 'order_id' or p_data ? 'orderId' then 'orders'
    when v_type in ('payout', 'payment') then 'payments'
    when v_type = 'alert' then 'alerts'
    else 'default'
  end;

  select jsonb_agg(jsonb_build_object(
           'to', t.push_token,
           'title', left(coalesce(p_title, 'Vesphe'), 120),
           'body', left(coalesce(p_body, ''), 400),
           'data', coalesce(p_data, '{}'::jsonb),
           'sound', 'default',
           'priority', 'high',
           'channelId', v_channel))
    into v_messages
    from (select push_token
            from user_push_tokens
           where user_id = p_user_id and coalesce(is_active, true)
           order by updated_at desc nulls last
           limit 10) t;

  if v_messages is null then
    return 'No push token found';
  end if;

  perform set_config('vesphe.pushed_users', v_pushed || p_user_id::text || ',', true);

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
    body := v_messages
  );

  return 'Sent to ' || jsonb_array_length(v_messages) || ' device(s)';
exception when others then
  -- A push failure must never roll back the order/payment that caused it.
  raise warning 'send_push_notification failed: %', sqlerrm;
  return 'Failed';
end;
$$;

revoke all on function public.send_push_notification(uuid, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Every in-app notification becomes a push
-- ---------------------------------------------------------------------
create or replace function public.push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform send_push_notification(
    new.user_id,
    new.title,
    new.message,
    coalesce(new.metadata, '{}'::jsonb) || coalesce(new.data, '{}'::jsonb) ||
      jsonb_strip_nulls(jsonb_build_object(
        'notification_id', new.id,
        'type', new.type,
        'action_link', new.action_link))
  );
  return null;
end;
$$;

drop trigger if exists trigger_push_on_notification_insert on public.notifications;
create trigger trigger_push_on_notification_insert
  after insert on public.notifications
  for each row execute function public.push_on_notification_insert();

-- ---------------------------------------------------------------------
-- Duplicate triggers
-- ---------------------------------------------------------------------
-- notify_rider_assigned_to_order() was attached twice.
drop trigger if exists trigger_notify_rider_assigned on public.orders;
-- create_order_notification() repeats what notify_order_created() and
-- notify_order_status_update() already send (and showed the amount /100).
drop trigger if exists order_notification_trigger on public.orders;
