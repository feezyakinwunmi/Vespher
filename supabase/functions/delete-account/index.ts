// supabase/functions/delete-account/index.ts
// In-app account deletion (required by the App Store and Google Play). Personal data is
// removed and the auth user is soft-deleted; order records are kept (anonymised) because
// vendors, riders and accounting still reference them.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno npm import
import { SignJWT, importPKCS8 } from 'npm:jose@5';
import { getCaller, handler, json, readJson, HttpError } from '../_shared/http.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

// Sign in with Apple must be revoked on deletion. Needs the APPLE_TEAM_ID, APPLE_KEY_ID,
// APPLE_PRIVATE_KEY and APPLE_CLIENT_ID (bundle id) function secrets. A failure here
// never blocks the deletion itself.
async function revokeApple(code: string) {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  if (!teamId || !keyId || !privateKey || !clientId) {
    console.error('Apple revoke skipped: secrets are not set');
    return;
  }
  try {
    const clientSecret = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setAudience('https://appleid.apple.com')
      .setSubject(clientId)
      .sign(await importPKCS8(privateKey.replace(/\\n/g, '\n'), 'ES256'));
    const post = (path: string, fields: Record<string, string>) =>
      fetch(`https://appleid.apple.com/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields }),
      });
    const tokenRes = await post('token', { code, grant_type: 'authorization_code' });
    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) {
      console.error('Apple revoke: no refresh token', tokens.error);
      return;
    }
    await post('revoke', { token: tokens.refresh_token, token_type_hint: 'refresh_token' });
  } catch (error) {
    console.error('Apple revoke failed', error);
  }
}

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
      await admin
        .from('vendors')
        .update({
          is_approved: false,
          is_suspended: true,
          phone: null,
          email: null,
          bank_name: null,
          bank_code: null,
          account_number: null,
          account_name: null,
        })
        .eq('id', vendor.id);
    }
  } else {
    const { count: activeOrders } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .or(`customer_id.eq.${userId},rider_id.eq.${userId}`)
      .in('status', ACTIVE_ORDER_STATUSES);
    if (activeOrders && activeOrders > 0) {
      throw new HttpError(400, 'You have orders in progress. Please wait until they are completed.');
    }
  }

  const { apple_authorization_code: appleCode } = await readJson<{ apple_authorization_code?: string }>(req);
  if (appleCode) await revokeApple(appleCode);

  await admin.from('addresses').delete().eq('user_id', userId);
  await admin.from('user_push_tokens').delete().eq('user_id', userId);
  await admin.from('customer_health_profiles').delete().eq('user_id', userId);
  await admin.from('bank_details').delete().eq('user_id', userId);
  await admin.from('saved_cards').delete().eq('user_id', userId);
  await admin.from('rider_applications').delete().eq('user_id', userId);

  // Identity documents uploaded with a rider application.
  const { data: documents } = await admin.storage.from('rider-documents').list(userId);
  if (documents?.length) {
    await admin.storage.from('rider-documents').remove(documents.map((f: { name: string }) => `${userId}/${f.name}`));
  }

  await admin
    .from('users')
    .update({
      name: 'Deleted user',
      email: `deleted-${userId}@deleted.invalid`,
      phone: null,
      avatar_url: null,
      is_available: false,
      current_latitude: null,
      current_longitude: null,
      license_number: null,
      bank_name: null,
      account_number: null,
      account_name: null,
    })
    .eq('id', userId);

  // Soft delete: the user can no longer sign in, and the id stays valid for old orders.
  const { error } = await admin.auth.admin.deleteUser(userId, true);
  if (error) throw new HttpError(500, 'Could not delete account. Please contact support.');

  return json({ status: true, message: 'Account deleted' });
}));
