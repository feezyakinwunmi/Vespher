-- =====================================================================
-- In-app chat: photos, read receipts, safe contact list, server-set sender
-- =====================================================================

-- ---------------------------------------------------------------------
-- Messages: photo messages + when they were read
-- ---------------------------------------------------------------------
alter table public.messages add column if not exists image_path text;   -- path in the chat-media bucket
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages alter column content set default '';
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type = any (array['text', 'image', 'inquiry', 'complaint', 'warning', 'support']));

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages (conversation_id) where not coalesce(read, false);

-- Sender name/role come from the database, not the phone (the old app always sent "vendor").
create or replace function public.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
begin
  select role, name into v_role, v_name from users where id = new.sender_id;
  if v_role = 'vendor' then
    select coalesce(name, v_name) into v_name from vendors where owner_id = new.sender_id limit 1;
  end if;
  new.sender_role := coalesce(v_role, 'customer');
  new.sender_name := case when v_role = 'admin' then 'Vesphe Support' else coalesce(v_name, 'User') end;
  new.content := btrim(coalesce(new.content, ''));
  new.type := case when new.image_path is not null then 'image'
                   when new.type in ('inquiry', 'complaint', 'warning', 'support') then new.type
                   else 'text' end;
  new.read := false;
  new.read_at := null;
  if new.content = '' and new.image_path is null then
    raise exception 'Message is empty';
  end if;
  if char_length(new.content) > 4000 then
    raise exception 'Message is too long';
  end if;
  -- Photos must live in this conversation's folder.
  if new.image_path is not null and split_part(new.image_path, '/', 1) <> new.conversation_id::text then
    raise exception 'Invalid photo';
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_message on public.messages;
create trigger prepare_message before insert on public.messages
  for each row execute function public.prepare_message();

-- Keeps the conversation list preview up to date.
create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
     set last_message = case when new.image_path is not null and new.content = '' then '📷 Photo'
                             when new.image_path is not null then '📷 ' || left(new.content, 200)
                             else left(new.content, 200) end,
         last_message_time = new.created_at
   where id = new.conversation_id;
  return null;
end;
$$;

drop trigger if exists bump_conversation on public.messages;
create trigger bump_conversation after insert on public.messages
  for each row execute function public.bump_conversation();

-- Push to the other person (replaces the old version: shows the vendor's store name,
-- "📷 Photo" for photos, and opens the chat when tapped).
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participants text[];
  v_receiver uuid;
begin
  select participants into v_participants from conversations where id = new.conversation_id;
  select p::uuid into v_receiver from unnest(v_participants) p where p <> new.sender_id::text limit 1;
  if v_receiver is null then
    return new;
  end if;
  perform send_push_notification(
    v_receiver,
    coalesce(new.sender_name, 'New message'),
    case when new.image_path is not null and new.content = '' then '📷 Photo'
         when new.image_path is not null then '📷 ' || left(new.content, 100)
         else left(new.content, 100) end,
    jsonb_build_object('conversation_id', new.conversation_id, 'type', 'message')
  );
  return new;
end;
$$;

-- Mark everything the other person sent in a conversation as read.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from conversations where id = p_conversation_id and auth.uid()::text = any (participants)) then
    raise exception 'Conversation not found';
  end if;
  update messages
     set read = true, read_at = now()
   where conversation_id = p_conversation_id
     and sender_id <> auth.uid()
     and not coalesce(read, false);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Who you can start a chat with
--   everyone  → Vesphe Support (admins)
--   customer  → approved vendors, riders on their recent orders
--   vendor    → their customers, riders on their orders
--   rider     → customers / vendors / businesses of their deliveries
--   business  → riders on their delivery requests
--   admin     → everyone
-- ---------------------------------------------------------------------
create or replace function public.chat_directory()
returns table (id uuid, name text, role text, avatar_url text, subtitle text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role text;
  v_vendor uuid;
begin
  select u.role into v_role from users u where u.id = v_me;
  if v_role is null then
    return;
  end if;
  select v.id into v_vendor from vendors v where v.owner_id = v_me limit 1;

  return query
  with contacts as (
    -- Support
    select u.id, 'Vesphe Support'::text as name, 'admin'::text as role, null::text as avatar_url, 'Help with orders, payments and your account'::text as subtitle, 0 as rank
      from users u where u.role = 'admin' and not coalesce(u.is_suspended, false) and v_role <> 'admin'
    union all
    -- Admin sees everyone
    select u.id, coalesce(vv.name, u.name), u.role, coalesce(vv.image_url, u.avatar_url), initcap(u.role), 1
      from users u left join vendors vv on vv.owner_id = u.id
     where v_role = 'admin' and u.id <> v_me
    union all
    -- Customer → vendors
    select vv.owner_id, vv.name, 'vendor', vv.image_url, coalesce(vv.category, 'Restaurant'), 2
      from vendors vv
     where v_role = 'customer' and vv.is_approved and not coalesce(vv.is_suspended, false)
    union all
    -- Customer → riders on recent orders
    select o.rider_id, u.name, 'rider', u.avatar_url, 'Your rider · #' || coalesce(o.order_number, left(o.id, 8)), 1
      from orders o join users u on u.id = o.rider_id
     where v_role = 'customer' and o.customer_id = v_me and o.created_at > now() - interval '30 days'
    union all
    -- Vendor → customers and riders of their orders
    select o.customer_id, coalesce(u.name, o.customer_name), 'customer', u.avatar_url, 'Customer · #' || coalesce(o.order_number, left(o.id, 8)), 1
      from orders o join users u on u.id = o.customer_id
     where v_role = 'vendor' and o.vendor_id = v_vendor
    union all
    select o.rider_id, u.name, 'rider', u.avatar_url, 'Rider · #' || coalesce(o.order_number, left(o.id, 8)), 1
      from orders o join users u on u.id = o.rider_id
     where v_role = 'vendor' and o.vendor_id = v_vendor and o.created_at > now() - interval '30 days'
    union all
    -- Rider → customers and vendors of their deliveries
    select o.customer_id, coalesce(u.name, o.customer_name), 'customer', u.avatar_url, 'Customer · #' || coalesce(o.order_number, left(o.id, 8)), 1
      from orders o join users u on u.id = o.customer_id
     where v_role = 'rider' and o.rider_id = v_me and o.created_at > now() - interval '30 days'
    union all
    select vv.owner_id, vv.name, 'vendor', vv.image_url, 'Pickup · #' || coalesce(o.order_number, left(o.id, 8)), 1
      from orders o join vendors vv on vv.id = o.vendor_id
     where v_role = 'rider' and o.rider_id = v_me and o.created_at > now() - interval '30 days'
    union all
    select b.business_id, u.name, 'business', u.avatar_url, 'Business · ' || coalesce(b.request_number, ''), 1
      from business_logistics b join users u on u.id = b.business_id
     where v_role = 'rider' and b.rider_id = v_me and b.created_at > now() - interval '30 days'
    union all
    -- Business → riders on their requests
    select b.rider_id, u.name, 'rider', u.avatar_url, 'Rider · ' || coalesce(b.request_number, ''), 1
      from business_logistics b join users u on u.id = b.rider_id
     where v_role = 'business' and b.business_id = v_me and b.created_at > now() - interval '30 days'
  )
  select distinct on (c.id) c.id, c.name, c.role, c.avatar_url, c.subtitle
    from contacts c
   where c.id is not null and c.id <> v_me
   order by c.id, c.rank;
end;
$$;

-- Opens (or creates) the 1-to-1 conversation with someone in your contact list.
create or replace function public.start_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from public.chat_directory() d where d.id = p_other) then
    raise exception 'You can''t message this person';
  end if;
  select c.id into v_id
    from conversations c
   where c.participants @> array[v_me::text, p_other::text]
     and cardinality(c.participants) = 2
   order by c.created_at
   limit 1;
  if v_id is null then
    insert into conversations (participants, last_message, last_message_time, created_at)
    values (array[v_me::text, p_other::text], '', now(), now())
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Names and photos of the people in my conversations (works with RLS on users).
create or replace function public.conversation_people(p_ids uuid[])
returns table (id uuid, name text, role text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         case when u.role = 'admin' then 'Vesphe Support' else coalesce(v.name, u.name) end,
         u.role,
         coalesce(v.image_url, u.avatar_url)
    from users u
    left join vendors v on v.owner_id = u.id
   where u.id = any (p_ids)
     and exists (
       select 1 from conversations c
        where auth.uid()::text = any (c.participants)
          and u.id::text = any (c.participants)
     );
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.chat_directory() from public, anon;
revoke all on function public.start_conversation(uuid) from public, anon;
revoke all on function public.conversation_people(uuid[]) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.chat_directory() to authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.conversation_people(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Photo storage: private bucket, files under <conversation_id>/...,
-- only that conversation's two people can upload or view.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat-media: participants read" on storage.objects;
create policy "chat-media: participants read" on storage.objects
  for select to authenticated using (
    bucket_id = 'chat-media'
    and exists (select 1 from public.conversations c
                 where c.id::text = (storage.foldername(name))[1]
                   and auth.uid()::text = any (c.participants))
  );

drop policy if exists "chat-media: participants upload" on storage.objects;
create policy "chat-media: participants upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat-media'
    and exists (select 1 from public.conversations c
                 where c.id::text = (storage.foldername(name))[1]
                   and auth.uid()::text = any (c.participants))
  );
