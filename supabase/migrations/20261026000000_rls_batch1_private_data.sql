-- =====================================================================
-- RLS batch 1: the most sensitive tables. Until now row-level security was OFF,
-- so anyone with the app's public key could read/change these rows.
--
-- Triggers/RPCs that write these tables (generate_delivery_code_on_transit,
-- verify_delivery_code, notify_new_message, ...) are SECURITY DEFINER and are
-- not affected. Edge functions use the service role and bypass RLS.
-- Rollback for a table if needed:  alter table public.<t> disable row level security;
-- =====================================================================

-- ---------------------------------------------------------------------
-- password_reset_otps: never readable from the apps (server-side only)
-- ---------------------------------------------------------------------
alter table public.password_reset_otps enable row level security;
-- No policies: only the service role / SECURITY DEFINER functions can use it.

-- ---------------------------------------------------------------------
-- delivery_verification_codes: the customer may see their own order's code;
-- riders verify through the verify_delivery_code() function, not by reading it.
-- ---------------------------------------------------------------------
alter table public.delivery_verification_codes enable row level security;

drop policy if exists "dvc: customer reads own" on public.delivery_verification_codes;
create policy "dvc: customer reads own" on public.delivery_verification_codes
  for select using (
    exists (select 1 from public.orders o where o.id = delivery_verification_codes.order_id and o.customer_id = auth.uid())
  );

drop policy if exists "dvc: admin reads all" on public.delivery_verification_codes;
create policy "dvc: admin reads all" on public.delivery_verification_codes
  for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- bank_details: each user manages their own; admins can read for payouts
-- ---------------------------------------------------------------------
alter table public.bank_details enable row level security;

drop policy if exists "bank_details: own" on public.bank_details;
create policy "bank_details: own" on public.bank_details
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "bank_details: admin reads" on public.bank_details;
create policy "bank_details: admin reads" on public.bank_details
  for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- customer_health_profiles: private to the customer
-- ---------------------------------------------------------------------
alter table public.customer_health_profiles enable row level security;

drop policy if exists "health: own" on public.customer_health_profiles;
create policy "health: own" on public.customer_health_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- conversations / messages: only participants (participants holds user ids)
-- ---------------------------------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists "conversations: participants read" on public.conversations;
create policy "conversations: participants read" on public.conversations
  for select using (auth.uid()::text = any (participants));

drop policy if exists "conversations: participants create" on public.conversations;
create policy "conversations: participants create" on public.conversations
  for insert with check (auth.uid()::text = any (participants));

drop policy if exists "conversations: participants update" on public.conversations;
create policy "conversations: participants update" on public.conversations
  for update using (auth.uid()::text = any (participants))
  with check (auth.uid()::text = any (participants));

alter table public.messages enable row level security;

drop policy if exists "messages: participants read" on public.messages;
create policy "messages: participants read" on public.messages
  for select using (
    exists (select 1 from public.conversations c
             where c.id = messages.conversation_id and auth.uid()::text = any (c.participants))
  );

drop policy if exists "messages: participants send" on public.messages;
create policy "messages: participants send" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                 where c.id = messages.conversation_id and auth.uid()::text = any (c.participants))
  );

-- Marking messages as read.
drop policy if exists "messages: participants update" on public.messages;
create policy "messages: participants update" on public.messages
  for update using (
    exists (select 1 from public.conversations c
             where c.id = messages.conversation_id and auth.uid()::text = any (c.participants))
  );
