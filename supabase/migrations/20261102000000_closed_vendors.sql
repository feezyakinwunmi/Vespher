-- =====================================================================
-- Closed shops can't receive orders.
-- When a vendor switches off "Open for orders" (vendors.is_open = false) the
-- app unlists the shop; this guard also refuses new orders on the server, so an
-- old cart or a stale screen can't get one through.
-- Same as guard_orders() from 20261023000000_security_hardening.sql, plus the
-- is_open check on insert.
-- =====================================================================

create or replace function public.guard_orders()
returns trigger
language plpgsql
as $$
declare
  changed text[];
  row_json jsonb;
  subtotal numeric;
  payout numeric;
  commission numeric;
begin
  if public.bypass_guards() then
    return new;
  end if;

  row_json := to_jsonb(new);

  if tg_op = 'INSERT' then
    if (row_json ->> 'customer_id') is distinct from auth.uid()::text then
      raise exception 'Orders must belong to the signed-in customer' using errcode = '42501';
    end if;

    if exists (
      select 1 from public.vendors v
      where v.id::text = row_json ->> 'vendor_id' and v.is_open is false
    ) then
      raise exception 'This shop is closed and is not taking orders right now' using errcode = '22023';
    end if;

    -- Card payments are confirmed by the verify-payment edge function.
    new.payment_status := 'pending';

    subtotal   := coalesce((row_json ->> 'subtotal')::numeric, 0);
    payout     := coalesce((row_json ->> 'vendor_payout')::numeric, 0);
    commission := coalesce((row_json ->> 'platform_commission')::numeric, 0);
    if subtotal < 0 or coalesce((row_json ->> 'total')::numeric, 0) < 0
       or payout < 0 or payout > subtotal or commission < 0 then
      raise exception 'Invalid order amounts' using errcode = '22023';
    end if;
    return new;
  end if;

  changed := public.changed_columns(row_json, to_jsonb(old), array[
    'customer_id', 'vendor_id', 'payment_status', 'payment_reference', 'payment_method',
    'subtotal', 'total',
    'vendor_payout', 'platform_commission', 'platform_net_earnings',
    'refund_status', 'refund_amount', 'refund_reference'
  ]);
  if array_length(changed, 1) > 0 then
    raise exception 'Not allowed to change: %', array_to_string(changed, ', ') using errcode = '42501';
  end if;
  return new;
end;
$$;
