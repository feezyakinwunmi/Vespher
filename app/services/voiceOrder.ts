// app/services/voiceOrder.ts
// Checkout for orders placed by voice. Uses the same pricing rules as the cart
// screen for a standard order (platform commission, first-order 10% off, free
// delivery on a first order over ₦10,000, cash only under ₦10,000). Promo codes,
// rewards and scheduling stay on the cart screen.
import { supabase } from '../lib/supabase';
import { estimatePaystackFee, PAYSTACK_FEE_PERCENTAGE } from '../utils/fees';
import type { CartItem } from '../types';

export const CASH_LIMIT = 10000;

export interface SavedCard {
  id: string;
  brand: string | null;
  last4: string;
}

export interface VoiceCheckout {
  ok: boolean;
  problems: string[];
  vendor: { id: string; name: string; is_open: boolean | null; latitude: number | null; longitude: number | null } | null;
  address: any | null;
  addressLabel: string | null;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  isFirstOrder: boolean;
  freeDelivery: boolean;
  cashAllowed: boolean;
  cards: SavedCard[];
  platformFeePercentage: number;
}

type DeliveryFeeFn = (vendorLat: number, vendorLng: number, lat: number, lng: number) => Promise<number>;

export const addressLabel = (a: any): string | null =>
  a ? [a.label, a.street || a.address, a.area || a.city].filter(Boolean).join(', ') || 'saved address' : null;

export async function loadSavedCards(): Promise<SavedCard[]> {
  const { data } = await supabase.from('saved_cards').select('id, brand, last4, is_default').order('is_default', { ascending: false });
  return (data as SavedCard[]) || [];
}

export async function buildVoiceCheckout(userId: string, items: CartItem[], vendorId: string | null, deliveryFee: DeliveryFeeFn): Promise<VoiceCheckout> {
  const problems: string[] = [];
  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);

  const [{ data: vendor }, { data: addresses }, { count: orderCount }, { data: settings }, cards] = await Promise.all([
    vendorId
      ? supabase.from('vendors').select('id, name, is_open, latitude, longitude').eq('id', vendorId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }).limit(1),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', userId),
    supabase.from('platform_settings').select('platform_fee_percentage').limit(1).maybeSingle(),
    loadSavedCards(),
  ]);

  const address = addresses?.[0] || null;
  if (!items.length) problems.push('The cart is empty.');
  if (!address) problems.push('No delivery address saved. The customer must add one in the app.');
  if (vendor && vendor.is_open === false) problems.push(`${vendor.name} is closed right now.`);

  let fee = 0;
  if (vendor?.latitude && vendor?.longitude && address?.latitude && address?.longitude) {
    try {
      fee = await deliveryFee(vendor.latitude, vendor.longitude, address.latitude, address.longitude);
    } catch {
      problems.push('Could not work out the delivery fee. Try again in a moment.');
    }
  } else if (address && vendor) {
    problems.push('The delivery address has no map location. The customer must re-select it in the app.');
  }

  const isFirstOrder = (orderCount || 0) === 0;
  const firstOrderDiscount = isFirstOrder ? Math.round(subtotal * 0.1) : 0;
  const freeDelivery = isFirstOrder && subtotal > CASH_LIMIT;
  const discount = firstOrderDiscount + (freeDelivery ? fee : 0);
  const total = subtotal + fee - discount;

  return {
    ok: problems.length === 0,
    problems,
    vendor: (vendor as VoiceCheckout['vendor']) || null,
    address,
    addressLabel: addressLabel(address),
    subtotal,
    deliveryFee: fee,
    discount,
    total,
    isFirstOrder,
    freeDelivery,
    cashAllowed: total < CASH_LIMIT,
    cards,
    platformFeePercentage: Number(settings?.platform_fee_percentage) || 10,
  };
}

export type VoicePayResult =
  | { status: 'placed'; orderId: string; orderNumber: string | null; paid: boolean }
  | { status: 'needs_checkout'; orderId: string; message: string }
  | { status: 'failed'; message: string };

// Creates the order and, for a saved card, charges it. "needs_checkout" means the bank
// wants the customer to confirm (OTP/PIN) on the Paystack page.
export async function placeVoiceOrder(
  userId: string,
  items: CartItem[],
  checkout: VoiceCheckout,
  payment: 'cash' | 'saved_card',
  cardId?: string,
  note?: string
): Promise<VoicePayResult> {
  if (!checkout.ok || !checkout.vendor) return { status: 'failed', message: checkout.problems.join(' ') || 'Checkout is not ready' };
  if (payment === 'cash' && !checkout.cashAllowed) {
    return { status: 'failed', message: 'Cash on delivery is only for orders under 10,000 naira. Use a saved card.' };
  }
  if (payment === 'saved_card' && !checkout.cards.some(c => c.id === cardId)) {
    return { status: 'failed', message: 'That card is not saved on this account.' };
  }

  const { subtotal, deliveryFee, total, platformFeePercentage, isFirstOrder, freeDelivery } = checkout;
  const method = payment === 'cash' ? 'cash' : 'card';
  const firstOrderDiscount = isFirstOrder ? Math.round(subtotal * 0.1) : 0;
  const platformCommission = Math.round(subtotal * (platformFeePercentage / 100));
  const vendorPayout = subtotal - platformCommission;
  const gatewayFee = method === 'card' ? estimatePaystackFee(total) : 0;
  const stampDuty = total >= CASH_LIMIT ? 50 : 0;
  const platformNet = platformCommission - firstOrderDiscount - gatewayFee - stampDuty;
  const autoCancelAt = new Date(Date.now() + 60 * 60 * 1000);

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id: userId,
      vendor_id: checkout.vendor.id,
      items: items.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        price: i.product.price,
        options: i.selectedOptions || [],
      })),
      status: 'pending',
      is_scheduled: false,
      event_type: 'other',
      special_request_text: note ? `${note} (ordered by voice)` : 'Ordered by voice',
      subtotal,
      delivery_fee: deliveryFee,
      discount: checkout.discount,
      total,
      payment_method: method,
      payment_status: 'pending',
      delivery_address: checkout.address,
      auto_cancel_at: autoCancelAt.toISOString(),
      stamp_duty: stampDuty,
      flutterwave_fee: gatewayFee,
      flutterwave_fee_percentage: method === 'card' ? PAYSTACK_FEE_PERCENTAGE : 0,
      platform_commission: platformCommission,
      platform_commission_percentage: platformFeePercentage,
      platform_delivery_earnings: 0,
      platform_net_earnings: platformNet,
      vendor_payout: vendorPayout,
      rider_earnings: 0,
      discount_code: firstOrderDiscount ? 'FIRST_ORDER' : null,
      discount_type: firstOrderDiscount ? 'percentage' : null,
      discount_percentage: firstOrderDiscount ? 10 : null,
      discount_metadata: firstOrderDiscount
        ? { type: 'first_order', discount_type: 'percentage', discount_value: 10, description: 'First order discount - 10% off', applied_by: 'platform', free_delivery: freeDelivery }
        : null,
      metadata: { source: 'voice' },
    })
    .select('id, order_number')
    .single();
  if (error || !order) return { status: 'failed', message: 'Could not place the order. Please try again.' };

  // Same bookkeeping as the cart screen.
  await Promise.all([
    decreaseStock(items),
    firstOrderDiscount
      ? supabase.from('first_order_discounts').insert({
          user_id: userId,
          order_id: order.id,
          discount_amount: firstOrderDiscount,
          free_delivery_applied: freeDelivery,
          applied_at: new Date().toISOString(),
        })
      : Promise.resolve(),
    supabase.from('platform_fees').insert({
      order_id: order.id,
      vendor_id: checkout.vendor.id,
      fee_percentage: platformFeePercentage,
      fee_amount: platformCommission,
      delivery_earnings: 0,
      stamp_duty: stampDuty,
      flutterwave_fee: gatewayFee,
      vendor_payout: vendorPayout,
      platform_net: platformNet,
      created_at: new Date().toISOString(),
    }),
  ]);

  if (payment === 'cash') return { status: 'placed', orderId: order.id, orderNumber: order.order_number, paid: false };

  const { data, error: chargeError } = await supabase.functions.invoke('charge-saved-card', {
    body: { order_id: order.id, payment_method_id: cardId },
  });
  if (!chargeError && data?.status) return { status: 'placed', orderId: order.id, orderNumber: order.order_number, paid: true };
  if (!chargeError && data?.needs_checkout) {
    return { status: 'needs_checkout', orderId: order.id, message: data.message || 'Your bank needs you to confirm this payment' };
  }
  // Declined: nothing was charged, so the order must not reach the vendor.
  await cancelUnpaid(order.id, 'Card payment declined');
  return { status: 'failed', message: data?.message || 'The card was declined. Try another card or pay in the app.' };
}

export async function cancelUnpaid(orderId: string, reason: string) {
  const now = new Date().toISOString();
  await supabase
    .from('orders')
    .update({ status: 'cancelled', cancelled_by: 'customer', cancelled_at: now, updated_at: now, rejection_reason: reason })
    .eq('id', orderId)
    .neq('payment_status', 'paid');
}

async function decreaseStock(items: CartItem[]) {
  for (const item of items) {
    const { data: product } = await supabase.from('products').select('track_stock, stock_quantity').eq('id', item.product.id).maybeSingle();
    if (product?.track_stock) {
      const next = (product.stock_quantity || 0) - item.quantity;
      if (next >= 0) await supabase.from('products').update({ stock_quantity: next }).eq('id', item.product.id);
    }
  }
}
