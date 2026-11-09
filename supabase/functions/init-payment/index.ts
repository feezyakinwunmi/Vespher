// supabase/functions/init-payment/index.ts
// Starts every Paystack payment server-side so amounts and splits come from the
// database, never from the app.
//
//  - order:        amount = order total. Split (see _shared/orderPayment.ts): the vendor's
//                  share goes to their Paystack subaccount (settled to their bank); the
//                  platform keeps the rest (commission + delivery) and bears Paystack's fee.
//  - promotion:    amount = days × admin cost per day (no split).
//  - subscription: amount = price set by the database at creation (no split).
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCaller, handler, json, paystack, readJson, HttpError } from '../_shared/http.ts';
import { newReference, orderCharge } from '../_shared/orderPayment.ts';

// Never loaded: the in-app checkout intercepts navigation to this URL.
export const CALLBACK_URL = 'https://vesphe.app/paystack/callback';

interface Body {
  kind?: 'order' | 'promotion' | 'subscription';
  id?: string;
  // Keep the card on Paystack for one-tap and voice checkout next time.
  save_card?: boolean;
  // Web checkout returns here; the app intercepts CALLBACK_URL instead.
  return_url?: string;
}

serve(handler(async (req) => {
  const caller = await getCaller(req);
  const { kind = 'order', id, save_card, return_url } = await readJson<Body>(req);
  const callbackUrl = return_url && /^(https:\/\/|http:\/\/localhost)/.test(return_url) ? return_url : CALLBACK_URL;
  if (!id || typeof id !== 'string') throw new HttpError(400, 'id is required');
  if (!caller.email) throw new HttpError(400, 'Your account needs an email address to pay by card');

  const { admin } = caller;
  let table: 'orders' | 'promotions' | 'subscriptions';
  let amount: number;
  const split: Record<string, unknown> = {};

  if (kind === 'order') {
    table = 'orders';
    const charge = await orderCharge(caller, id);
    amount = charge.amount;
    Object.assign(split, charge.split);
  } else if (kind === 'promotion') {
    table = 'promotions';
    const { data: promo } = await admin
      .from('promotions')
      .select('id, days_count, payment_status, vendors!inner(owner_id)')
      .eq('id', id)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    if (!promo || (promo as any).vendors?.owner_id !== caller.userId) throw new HttpError(404, 'Promotion not found');
    if (promo.payment_status === 'paid') throw new HttpError(409, 'Promotion is already paid');
    const { data: settings } = await admin
      .from('platform_settings')
      .select('promotion_cost_per_day')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    amount = (Number(settings?.promotion_cost_per_day) || 300) * (Number(promo.days_count) || 0);
  } else if (kind === 'subscription') {
    table = 'subscriptions';
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, user_id, amount, payment_status')
      .eq('id', id)
      .maybeSingle();
    if (!sub || sub.user_id !== caller.userId) throw new HttpError(404, 'Subscription not found');
    if (sub.payment_status === 'paid') throw new HttpError(409, 'Subscription is already paid');
    amount = Number(sub.amount) || 0;
  } else {
    throw new HttpError(400, 'Unknown payment kind');
  }

  if (amount < 100) throw new HttpError(400, 'Amount is too small for card payment');

  const prefix = kind === 'order' ? 'VESP' : kind === 'promotion' ? 'PROMO' : 'PRO';
  const reference = newReference(prefix);

  const init = await paystack('/transaction/initialize', {
    method: 'POST',
    body: {
      email: caller.email,
      amount: Math.round(amount * 100),
      currency: 'NGN',
      reference,
      callback_url: callbackUrl,
      metadata: { kind, id, user_id: caller.userId, save_card: save_card === true },
      ...split,
    },
  });
  if (!init.ok) throw new HttpError(400, init.data?.message || 'Could not start payment');

  // verify-payment only accepts this reference for this record.
  const { error } = await admin.from(table).update({ payment_reference: reference }).eq('id', id);
  if (error) throw new HttpError(500, 'Could not save payment reference');

  return json({
    status: true,
    data: {
      authorization_url: init.data.data.authorization_url,
      reference,
      callback_url: callbackUrl,
      amount,
    },
  });
}));
