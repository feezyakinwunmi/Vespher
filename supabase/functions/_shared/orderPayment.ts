// supabase/functions/_shared/orderPayment.ts
// Amount and Paystack split for a customer's order, shared by init-payment (card
// checkout page) and charge-saved-card (saved card / voice orders), so both always
// charge the same amount and send the vendor the same share.
import { HttpError } from './http.ts';
import type { Caller } from './http.ts';

export interface OrderCharge {
  amount: number; // naira
  split: Record<string, unknown>; // subaccount / transaction_charge / bearer, or empty
}

export async function orderCharge(caller: Caller, orderId: string): Promise<OrderCharge> {
  const { admin } = caller;
  const { data: order } = await admin
    .from('orders')
    .select('id, customer_id, vendor_id, status, subtotal, total, vendor_payout, payment_method, payment_status')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.customer_id !== caller.userId) throw new HttpError(404, 'Order not found');
  if (order.payment_method !== 'card') throw new HttpError(400, 'Order is not a card payment');
  if (order.payment_status === 'paid') throw new HttpError(409, 'Order is already paid');
  if (order.status === 'cancelled') throw new HttpError(400, 'Order was cancelled');

  const amount = Number(order.total) || 0;

  const { data: vendor } = await admin
    .from('vendors')
    .select('paystack_subaccount_code')
    .eq('id', order.vendor_id)
    .maybeSingle();
  if (!vendor?.paystack_subaccount_code) {
    throw new HttpError(400, "This vendor can't accept card payments yet. Please pay with cash or choose another vendor.");
  }

  const { data: settings } = await admin
    .from('platform_settings')
    .select('platform_fee_percentage')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  const feePct = Number(settings?.platform_fee_percentage) || 10;
  const subtotal = Number(order.subtotal) || 0;

  // The vendor never receives more than subtotal minus the standard commission,
  // whatever the app wrote into vendor_payout.
  const maxVendorShare = subtotal - Math.round(subtotal * (feePct / 100));
  const vendorShare = Math.max(0, Math.min(Number(order.vendor_payout) || 0, maxVendorShare, amount));
  const platformShare = amount - vendorShare;

  const split: Record<string, unknown> = {};
  if (vendorShare > 0) {
    split.subaccount = vendor.paystack_subaccount_code;
    split.transaction_charge = Math.round(platformShare * 100);
    split.bearer = 'account';
  }
  return { amount, split };
}

export const newReference = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`.toUpperCase();

// Saves a card Paystack marked reusable after a successful payment.
// deno-lint-ignore no-explicit-any
export async function saveCard(caller: Caller, tx: any) {
  const auth = tx?.authorization;
  if (!auth?.reusable || !auth.authorization_code || !auth.signature || auth.channel !== 'card') return;
  const email = tx?.customer?.email || caller.email;
  if (!email) return;
  const { count } = await caller.admin
    .from('saved_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', caller.userId);
  await caller.admin.from('saved_cards').upsert(
    {
      user_id: caller.userId,
      authorization_code: auth.authorization_code,
      signature: auth.signature,
      email,
      brand: auth.card_type || auth.brand || null,
      last4: String(auth.last4 || ''),
      exp_month: auth.exp_month ? String(auth.exp_month) : null,
      exp_year: auth.exp_year ? String(auth.exp_year) : null,
      bank: auth.bank || null,
      is_default: !count,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,signature' }
  );
}
