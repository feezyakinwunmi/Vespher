// supabase/functions/charge-saved-card/index.ts
// Pays a customer's order with a card they saved earlier (one-tap and voice checkout).
// Same amount and vendor split as the normal card page (see _shared/orderPayment.ts).
// If the bank asks for an OTP/PIN, the app falls back to the normal Paystack page.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCaller, handler, json, paystack, readJson, HttpError } from '../_shared/http.ts';
import { newReference, orderCharge } from '../_shared/orderPayment.ts';

interface Body {
  order_id?: string;
  payment_method_id?: string;
}

serve(handler(async (req) => {
  const caller = await getCaller(req);
  const { order_id, payment_method_id } = await readJson<Body>(req);
  if (!order_id || !payment_method_id) throw new HttpError(400, 'order_id and payment_method_id are required');

  const { admin } = caller;
  const { data: card } = await admin
    .from('saved_cards')
    .select('id, user_id, authorization_code, email, last4')
    .eq('id', payment_method_id)
    .maybeSingle();
  if (!card || card.user_id !== caller.userId) throw new HttpError(404, 'Card not found');

  const { amount, split } = await orderCharge(caller, order_id);
  if (amount < 100) throw new HttpError(400, 'Amount is too small for card payment');

  const reference = newReference('VESP');
  // verify-style checks below only accept this reference for this order.
  const { error: refError } = await admin.from('orders').update({ payment_reference: reference }).eq('id', order_id);
  if (refError) throw new HttpError(500, 'Could not save payment reference');

  const charge = await paystack('/transaction/charge_authorization', {
    method: 'POST',
    body: {
      email: card.email,
      amount: Math.round(amount * 100),
      currency: 'NGN',
      authorization_code: card.authorization_code,
      reference,
      metadata: { kind: 'order', id: order_id, user_id: caller.userId, saved_card: card.id },
      ...split,
    },
  });
  const tx = charge.data?.data;
  if (!charge.ok || !tx) {
    return json({ status: false, needs_checkout: true, message: charge.data?.message || 'Card could not be charged' });
  }

  if (tx.status !== 'success') {
    // e.g. "send_otp", "send_pin", "failed": let the customer finish on the normal page.
    return json({
      status: false,
      needs_checkout: tx.status !== 'failed',
      message: tx.status === 'failed' ? tx.gateway_response || 'Card was declined' : 'Your bank needs you to confirm this payment',
    });
  }

  // Double-check with Paystack before marking paid (same rules as verify-payment).
  const verify = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  const vtx = verify.data?.data;
  if (!verify.ok || vtx?.status !== 'success' || vtx.currency !== 'NGN' || Number(vtx.amount) < Math.round(amount * 100)) {
    throw new HttpError(402, 'Payment could not be confirmed');
  }

  const { error } = await admin
    .from('orders')
    .update({ payment_status: 'paid', payment_reference: reference })
    .eq('id', order_id)
    .eq('customer_id', caller.userId);
  if (error) throw new HttpError(500, 'Paid, but the order could not be updated. Contact support.');

  await admin.from('saved_cards').update({ last_used_at: new Date().toISOString() }).eq('id', card.id);

  return json({ status: true, message: `Paid with card ending ${card.last4}`, data: { reference, amount } });
}));
