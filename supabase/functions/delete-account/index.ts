// supabase/functions/delete-account/index.ts
// In-app account deletion (required by the App Store and Google Play). Personal data is
// removed and the auth user is soft-deleted; order records are kept (anonymised) because
// vendors, riders and accounting still reference them.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCaller, handler, json, HttpError } from '../_shared/http.ts';

const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'in_transit'];

serve(handler(async (req) => {
  const caller = await getCaller(req);
  const { admin, userId } = caller;

  if (caller.role === 'admin') {
    throw new HttpError(403, 'Admin accounts must be removed by another admin');
  }

  if (caller.role === 'vendor') {
    const { data: vendor } = await admin
      .from('vendors')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (vendor) {
      const { data: wallet } = await admin
        .from('vendor_wallets')
        .select('balance, pending_balance')
        .eq('vendor_id', vendor.id)
        .maybeSingle();
      if ((Number(wallet?.balance) || 0) > 0 || (Number(wallet?.pending_balance) || 0) > 0) {
        throw new HttpError(400, 'Please withdraw your remaining balance before deleting your account');
      }

      const { count: activeVendorOrders } = await admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendor.id)
        .in('status', ACTIVE_ORDER_STATUSES);
      if (activeVendorOrders && activeVendorOrders > 0) {
        throw new HttpError(400, 'Please complete or cancel your active orders first');
      }

      // Hide the store from customers.
      await admin.from('vendors').update({ is_approved: false, is_suspended: true }).eq('id', vendor.id);
    }
  } else {
    const { count: activeOrders } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', userId)
      .in('status', ACTIVE_ORDER_STATUSES);
    if (activeOrders && activeOrders > 0) {
      throw new HttpError(400, 'You have orders in progress. Please wait until they are completed.');
    }
  }

  await admin.from('addresses').delete().eq('user_id', userId);
  await admin.from('user_push_tokens').delete().eq('user_id', userId);
  await admin
    .from('users')
    .update({ name: 'Deleted user', phone: null, avatar_url: null })
    .eq('id', userId);

  // Soft delete: the user can no longer sign in, and the id stays valid for old orders.
  const { error } = await admin.auth.admin.deleteUser(userId, true);
  if (error) throw new HttpError(500, 'Could not delete account. Please contact support.');

  return json({ status: true, message: 'Account deleted' });
}));
