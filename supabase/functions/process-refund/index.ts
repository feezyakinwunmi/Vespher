// supabase/functions/process-refund/index.ts
// Refunds a paid card order through Paystack and cancels it. Callable by the order's
// customer (before the vendor starts preparing it), the order's vendor, or an admin.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCaller, handler, json, paystack, readJson, HttpError } from '../_shared/http.ts';

const CUSTOMER_CANCELLABLE = ['pending', 'confirmed', 'cancelled'];

serve(handler(async (req) => {
  const caller = await getCaller(req);
  const { order_id, reason } = await readJson<{ order_id?: string; reason?: string }>(req);
  if (!order_id) throw new HttpError(400, 'order_id is required');

  const { admin } = caller;
  const { data: order } = await admin
    .from('orders')
    .select('id, customer_id, vendor_id, status, total, payment_method, payment_status, payment_reference, refund_status')
    .eq('id', order_id)
    .maybeSingle();
  if (!order) throw new HttpError(404, 'Order not found');

  let cancelledBy: string;
  if (caller.role === 'admin') {
    cancelledBy = 'admin';
  } else if (caller.role === 'vendor') {
    const { data: vendor } = await admin
      .from('vendors')
      .select('id')
      .eq('owner_id', caller.userId)
      .maybeSingle();
    if (!vendor || vendor.id !== order.vendor_id) throw new HttpError(404, 'Order not found');
    cancelledBy = 'vendor';
  } else {
    if (order.customer_id !== caller.userId) throw new HttpError(404, 'Order not found');
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new HttpError(400, 'This order can no longer be cancelled');
    }
    cancelledBy = 'customer';
  }

  if (order.payment_status === 'refunded' || order.refund_status === 'processing') {
    return json({ success: true, message: 'Refund already in progress' });
  }
  if (order.payment_method !== 'card' || order.payment_status !== 'paid' || !order.payment_reference) {
    throw new HttpError(400, 'Order has no card payment to refund');
  }

  const refundReason = String(reason || `Cancelled by ${cancelledBy}`).slice(0, 200);
  const refund = await paystack('/refund', {
    method: 'POST',
    body: { transaction: order.payment_reference, merchant_note: refundReason },
  });

  const now = new Date().toISOString();
  if (!refund.ok) {
    await admin
      .from('orders')
      .update({ status: 'cancelled', refund_status: 'failed', refund_reason: refundReason, cancelled_by: cancelledBy, cancelled_at: now, updated_at: now })
      .eq('id', order.id);
    return json({ success: false, error: refund.data?.message || 'Refund failed' }, 400);
  }

  const refundId = String(refund.data?.data?.id ?? '');
  await admin
    .from('orders')
    .update({
      status: 'cancelled',
      payment_status: 'refunded',
      refund_status: 'processing',
      refund_reference: refundId,
      refund_requested_at: now,
      refund_amount: order.total,
      refund_reason: refundReason,
      cancelled_by: cancelledBy,
      cancelled_at: now,
      updated_at: now,
    })
    .eq('id', order.id);

  return json({ success: true, refundId });
}));
