// supabase/functions/verify-payment/index.ts
// Confirms a Paystack transaction server-side and only then marks the order or
// promotion as paid. The client can no longer set payment_status = 'paid' itself.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCaller, handler, json, paystack, readJson, HttpError } from '../_shared/http.ts';
import { saveCard } from '../_shared/orderPayment.ts';

interface Body {
  kind?: 'order' | 'promotion' | 'subscription';
  id?: string;
  reference?: string;
}

serve(handler(async (req) => {
  const caller = await getCaller(req);
  const { kind = 'order', id, reference } = await readJson<Body>(req);

  if (!id || typeof id !== 'string') throw new HttpError(400, 'id is required');
  if (!reference || !/^[A-Za-z0-9._=-]{6,100}$/.test(reference)) {
    throw new HttpError(400, 'Invalid payment reference');
  }

  const { admin } = caller;
  let expectedAmount: number;
  let table: 'orders' | 'promotions' | 'subscriptions';

  if (kind === 'order') {
    table = 'orders';
    const { data: order } = await admin
      .from('orders')
      .select('id, customer_id, total, payment_method, payment_status, payment_reference')
      .eq('id', id)
      .maybeSingle();
    if (!order || order.customer_id !== caller.userId) throw new HttpError(404, 'Order not found');
    if (order.payment_status === 'paid') return json({ status: true, message: 'Already verified' });
    if (order.payment_method !== 'card') throw new HttpError(400, 'Order is not a card payment');
    expectedAmount = Number(order.total) || 0;
  } else if (kind === 'promotion') {
    table = 'promotions';
    const { data: promo } = await admin
      .from('promotions')
      .select('id, vendor_id, days_count, payment_status, vendors!inner(owner_id)')
      .eq('id', id)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const ownerId = (promo as any)?.vendors?.owner_id;
    if (!promo || ownerId !== caller.userId) throw new HttpError(404, 'Promotion not found');
    if (promo.payment_status === 'paid') return json({ status: true, message: 'Already verified' });

    const { data: settings } = await admin
      .from('platform_settings')
      .select('promotion_cost_per_day')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const costPerDay = Number(settings?.promotion_cost_per_day) || 300;
    expectedAmount = costPerDay * (Number(promo.days_count) || 0);
  } else if (kind === 'subscription') {
    table = 'subscriptions';
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, user_id, amount, payment_status')
      .eq('id', id)
      .maybeSingle();
    if (!sub || sub.user_id !== caller.userId) throw new HttpError(404, 'Subscription not found');
    if (sub.payment_status === 'paid') return json({ status: true, message: 'Already verified' });
    // amount is set by the database from platform_settings when the row is created.
    expectedAmount = Number(sub.amount) || 0;
  } else {
    throw new HttpError(400, 'Unknown payment kind');
  }
  if (expectedAmount <= 0) throw new HttpError(400, 'Nothing to pay');

  // Only the reference issued by init-payment for this record is accepted.
  const { data: record } = await admin.from(table).select('payment_reference').eq('id', id).single();
  if (record?.payment_reference && record.payment_reference !== reference) {
    throw new HttpError(400, 'Payment reference does not match this payment');
  }

  // A reference may only ever pay for one record.
  const { count } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('payment_reference', reference)
    .eq('payment_status', 'paid')
    .neq('id', id);
  if (count && count > 0) throw new HttpError(409, 'Payment reference already used');

  const verify = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  const tx = verify.data?.data;
  if (!verify.ok || !tx) throw new HttpError(400, verify.data?.message || 'Could not verify payment');
  if (tx.status !== 'success') throw new HttpError(402, `Payment not successful (${tx.status})`);
  if (tx.currency !== 'NGN') throw new HttpError(400, 'Unexpected payment currency');

  const expectedKobo = Math.round(expectedAmount * 100);
  if (Number(tx.amount) < expectedKobo) {
    throw new HttpError(402, 'Amount paid is less than the amount due');
  }

  const updates: Record<string, unknown> = {
    payment_status: 'paid',
    payment_reference: reference,
  };
  if (table === 'promotions') updates.status = 'pending_approval';
  if (table === 'subscriptions') {
    const { data: sub } = await admin.from('subscriptions').select('plan, tier').eq('id', id).single();
    // Renewing the same tier early extends from its current expiry instead of losing paid
    // days; upgrading to Pro Max starts now.
    const { data: current } = await admin
      .from('subscriptions')
      .select('expires_at')
      .eq('user_id', caller.userId)
      .eq('tier', sub?.tier || 'pro')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = current?.expires_at ? new Date(current.expires_at) : new Date();
    const expires = new Date(start);
    if (sub?.plan === 'yearly') expires.setFullYear(expires.getFullYear() + 1);
    else expires.setMonth(expires.getMonth() + 1);
    updates.status = 'active';
    updates.starts_at = start.toISOString();
    updates.expires_at = expires.toISOString();
  }

  const { error } = await admin.from(table).update(updates).eq('id', id);
  if (error) throw new HttpError(500, 'Payment verified but record update failed');

  // "Save card" was ticked at checkout: keep Paystack's reusable authorization.
  const meta = typeof tx.metadata === 'string' ? (() => { try { return JSON.parse(tx.metadata); } catch { return {}; } })() : tx.metadata;
  if (meta?.save_card === true && meta?.user_id === caller.userId) {
    await saveCard(caller, tx).catch(e => console.error('save card failed', e));
  }

  return json({
    status: true,
    message: 'Payment verified',
    data: { amount: Number(tx.amount) / 100, fees: Number(tx.fees || 0) / 100, transaction_id: tx.id },
  });
}));
