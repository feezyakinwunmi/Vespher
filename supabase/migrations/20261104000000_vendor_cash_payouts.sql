-- =====================================================================
-- Cash order payouts to vendors.
-- Card payments are split by Paystack and reach the vendor's bank on their own.
-- Cash orders are paid to the rider, so Vesphe pays the vendor their share
-- (orders.vendor_payout) by bank transfer. An admin records each transfer with
-- a reference and a receipt photo; the vendor sees it in their earnings.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Payout records
-- ---------------------------------------------------------------------
create table if not exists public.vendor_cash_payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount numeric not null check (amount > 0),
  order_count integer not null default 0,
  reference text,
  receipt_path text,          -- file in the payout-receipts bucket
  note text,
  paid_by uuid references public.users(id),
  paid_at timestamptz not null default now()
);

create index if not exists vendor_cash_payouts_vendor_idx on public.vendor_cash_payouts (vendor_id, paid_at desc);

-- Which payout settled each cash order (null = not paid to the vendor yet).
alter table public.orders add column if not exists cash_payout_id uuid references public.vendor_cash_payouts(id);
create index if not exists orders_unpaid_cash_idx on public.orders (vendor_id)
  where payment_method = 'cash' and status = 'delivered' and cash_payout_id is null;

alter table public.vendor_cash_payouts enable row level security;

drop policy if exists "vendor_cash_payouts: vendor or admin read" on public.vendor_cash_payouts;
create policy "vendor_cash_payouts: vendor or admin read" on public.vendor_cash_payouts
  for select using (
    public.is_admin()
    or exists (select 1 from public.vendors v where v.id::text = vendor_cash_payouts.vendor_id::text and v.owner_id::text = auth.uid()::text)
  );
-- No insert/update policies: payouts are only created through admin_record_cash_payout().

-- ---------------------------------------------------------------------
-- Receipts: private bucket, files under <vendor_id>/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payout-receipts', 'payout-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "payout-receipts: admin upload" on storage.objects;
create policy "payout-receipts: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'payout-receipts' and public.is_admin());

drop policy if exists "payout-receipts: vendor or admin read" on storage.objects;
create policy "payout-receipts: vendor or admin read" on storage.objects
  for select to authenticated using (
    bucket_id = 'payout-receipts'
    and (
      public.is_admin()
      or exists (select 1 from public.vendors v
                  where v.id::text = (storage.foldername(name))[1] and v.owner_id::text = auth.uid()::text)
    )
  );

-- ---------------------------------------------------------------------
-- What each vendor is owed from delivered cash orders
-- ---------------------------------------------------------------------
create or replace function public.admin_cash_owed()
returns table (
  vendor_id uuid,
  vendor_name text,
  bank_name text,
  account_number text,
  account_name text,
  owed numeric,
  order_count bigint,
  oldest_order_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_verified_admin();
  return query
    select v.id, v.name, v.bank_name, v.account_number, v.account_name,
           coalesce(sum(o.vendor_payout), 0)::numeric,
           count(o.id),
           min(coalesce(o.delivered_at, o.created_at))
      from orders o
      join vendors v on v.id::text = o.vendor_id::text
     where o.payment_method = 'cash'
       and o.status = 'delivered'
       and o.cash_payout_id is null
     group by v.id
    having coalesce(sum(o.vendor_payout), 0) > 0
     order by min(coalesce(o.delivered_at, o.created_at));
end;
$$;

revoke all on function public.admin_cash_owed() from public, anon;
grant execute on function public.admin_cash_owed() to authenticated;

-- ---------------------------------------------------------------------
-- Record a transfer: settles the given (or all) unpaid cash orders for a vendor
-- ---------------------------------------------------------------------
-- An earlier draft took uuid[]; remove it so the call below isn't ambiguous.
drop function if exists public.admin_record_cash_payout(uuid, text, text, text, uuid[]);

create or replace function public.admin_record_cash_payout(
  p_vendor_id uuid,
  p_reference text,
  p_receipt_path text,
  p_note text default null,
  p_order_ids text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_count integer;
  v_payout_id uuid;
  v_owner uuid;
begin
  perform public.require_verified_admin();

  if coalesce(trim(p_reference), '') = '' then
    raise exception 'Add the transfer reference';
  end if;
  if coalesce(trim(p_receipt_path), '') = '' then
    raise exception 'Attach the transfer receipt';
  end if;

  select coalesce(sum(vendor_payout), 0), count(*)
    into v_amount, v_count
    from orders
   where vendor_id::text = p_vendor_id::text
     and payment_method = 'cash'
     and status = 'delivered'
     and cash_payout_id is null
     and (p_order_ids is null or id::text = any (p_order_ids));

  if v_count = 0 or v_amount <= 0 then
    raise exception 'Nothing is owed to this vendor for those orders';
  end if;

  insert into vendor_cash_payouts (vendor_id, amount, order_count, reference, receipt_path, note, paid_by)
  values (p_vendor_id, v_amount, v_count, trim(p_reference), p_receipt_path, nullif(trim(p_note), ''), auth.uid())
  returning id into v_payout_id;

  update orders
     set cash_payout_id = v_payout_id
   where vendor_id::text = p_vendor_id::text
     and payment_method = 'cash'
     and status = 'delivered'
     and cash_payout_id is null
     and (p_order_ids is null or id::text = any (p_order_ids));

  select owner_id into v_owner from vendors where id::text = p_vendor_id::text;
  if v_owner is not null then
    insert into notifications (user_id, type, title, message, action_link, action_label)
    values (v_owner, 'system', 'Cash payout sent',
            '₦' || to_char(v_amount, 'FM999,999,999') || ' for ' || v_count || ' cash order'
              || case when v_count = 1 then '' else 's' end
              || ' has been sent to your bank. Ref: ' || trim(p_reference),
            '/earnings', 'View receipt');
  end if;

  return v_payout_id;
end;
$$;

revoke all on function public.admin_record_cash_payout(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.admin_record_cash_payout(uuid, text, text, text, text[]) to authenticated;
