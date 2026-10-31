-- =====================================================================
-- DEMO DATA: completed orders across the last 6 months, about ₦10.35M in
-- total order value, spread over your real vendors, their real menu items,
-- your customers and riders.
--
-- Run the whole file in Supabase → SQL Editor.
-- Every demo order's number starts with "SEED-" so it can be removed later
-- (see the cleanup at the bottom).
--
-- Order triggers (push notifications, guards) are switched off while the demo
-- rows are inserted, so nobody gets "new order" notifications, and switched
-- back on at the end. If anything fails, the whole script is undone.
-- =====================================================================

begin;

alter table public.orders disable trigger user;

do $$
declare
  target_revenue numeric := 10350000;   -- change this to aim higher or lower
  running        numeric := 0;
  created_count  integer := 0;

  fee_pct   numeric;
  rider_pct numeric;
  company_share numeric;   -- rider rides a Vesphe bike
  own_share     numeric;   -- rider brings their own / rented vehicle
  rider_own     text[];

  customer_ids text[];
  rider_ids    text[];
  vendor_ids   text[];

  v_vendor   text;
  v_customer text;
  v_rider    text;
  v_items    jsonb;
  v_subtotal numeric;
  v_delivery numeric;
  v_total    numeric;
  v_method   text;
  v_created  timestamptz;
  v_commission numeric;
  v_lat numeric;
  v_lng numeric;
  v_row  jsonb;
  v_cols text;
  v_vals text;
  order_cols text[];
  i integer;
begin
  select array_agg(column_name::text) into order_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'orders';

  -- Fees from Admin → Settings (falls back to 10% commission, and 50% / 80% rider
  -- share for company / own vehicles). Read as JSON so a missing column falls back.
  select (to_jsonb(s) ->> 'platform_fee_percentage')::numeric,
         (to_jsonb(s) ->> 'company_vehicle_rider_percentage')::numeric,
         (to_jsonb(s) ->> 'personal_vehicle_rider_percentage')::numeric
    into fee_pct, company_share, own_share
    from platform_settings s order by id limit 1;
  fee_pct := coalesce(fee_pct, 10);
  company_share := coalesce(company_share, 50);
  own_share := coalesce(own_share, 80);

  select array_agg(id::text) into customer_ids from users where role = 'customer';
  select array_agg(id::text order by id::text), array_agg(coalesce(vehicle_ownership, 'company') order by id::text)
    into rider_ids, rider_own
    from users where role = 'rider';
  select array_agg(v.id::text) into vendor_ids
    from vendors v
   where exists (select 1 from products p where p.vendor_id::text = v.id::text and p.price::numeric > 0);

  if customer_ids is null then raise exception 'Need at least one customer account to attach demo orders to.'; end if;
  if vendor_ids is null then raise exception 'Need at least one vendor with priced menu items.'; end if;

  while running < target_revenue loop
    v_vendor   := vendor_ids[1 + floor(random() * array_length(vendor_ids, 1))::int];
    v_customer := customer_ids[1 + floor(random() * array_length(customer_ids, 1))::int];
    if rider_ids is null then
      v_rider := null;
      rider_pct := company_share;
    else
      i := 1 + floor(random() * array_length(rider_ids, 1))::int;
      v_rider := rider_ids[i];
      rider_pct := case when rider_own[i] in ('personal', 'rented') then own_share else company_share end;
    end if;

    -- 1 to 3 real dishes from this vendor, 1 to 3 of each.
    select jsonb_agg(jsonb_build_object('product_id', id, 'name', name, 'price', price, 'quantity', qty)),
           sum(price * qty)
      into v_items, v_subtotal
      from (
        select id, name, price::numeric as price, (1 + floor(random() * 3))::int as qty
          from products
         where vendor_id::text = v_vendor and price::numeric > 0
         order by random()
         limit (1 + floor(random() * 3))::int
      ) picked;

    continue when v_subtotal is null;

    v_delivery   := 500 + floor(random() * 13) * 100;          -- ₦500 – ₦1,700
    v_total      := v_subtotal + v_delivery;
    v_commission := round(v_subtotal * fee_pct / 100);
    v_method     := case when random() < 0.7 then 'card' else 'cash' end;
    -- More orders in recent months than older ones.
    v_created    := now() - (power(random(), 1.4) * 180) * interval '1 day'
                          - (random() * 10) * interval '1 hour';
    v_lat := 6.45 + random() * 0.2;                              -- around Lagos
    v_lng := 3.35 + random() * 0.25;

    -- Column → value. Columns your orders table doesn't have are skipped below.
    -- Values are inserted as untyped literals, so they fit whatever type each column uses.
    v_row := jsonb_build_object(
      'id',                  gen_random_uuid()::text,
      'order_number',        'SEED-' || to_char(v_created, 'YYMMDD') || '-' || lpad((created_count + 1)::text, 5, '0'),
      'customer_id',         v_customer,
      'vendor_id',           v_vendor,
      'rider_id',            v_rider,
      'items',               v_items::text,
      'status',              'delivered',
      'subtotal',            v_subtotal,
      'delivery_fee',        v_delivery,
      'discount',            0,
      'total',               v_total,
      'payment_method',      v_method,
      'payment_status',      'paid',   -- card was charged, or the rider collected the cash
      'delivery_address',    jsonb_build_object('label', 'Home', 'street', 'Demo address', 'latitude', v_lat, 'longitude', v_lng)::text,
      'vendor_payout',       v_subtotal - v_commission,
      'platform_commission', v_commission,
      'rider_earnings',      round(v_delivery * rider_pct / 100),
      'platform_delivery_earnings', v_delivery - round(v_delivery * rider_pct / 100),
      'created_at',          v_created,
      'updated_at',          v_created + interval '50 minutes',
      'picked_up_at',        v_created + interval '20 minutes',
      'delivered_at',        v_created + interval '50 minutes'
    );

    select string_agg(format('%I', key), ', '),
           string_agg(case when jsonb_typeof(value) = 'null' then 'null' else format('%L', value #>> '{}') end, ', ')
      into v_cols, v_vals
      from jsonb_each(v_row)
     where key = any (order_cols);

    execute format('insert into public.orders (%s) values (%s)', v_cols, v_vals);

    running := running + v_total;
    created_count := created_count + 1;
  end loop;

  raise notice 'Created % demo orders worth ₦%', created_count, to_char(running, 'FM999,999,999');
end;
$$;

alter table public.orders enable trigger user;

commit;

-- Check the result (optional):
-- select to_char(date_trunc('month', created_at), 'Mon YYYY') as month,
--        count(*) as orders, sum(total) as revenue
--   from orders where order_number like 'SEED-%'
--  group by date_trunc('month', created_at) order by date_trunc('month', created_at);

-- =====================================================================
-- CLEANUP: remove every demo order (run on its own when you're done)
-- =====================================================================
-- delete from public.orders where order_number like 'SEED-%';
