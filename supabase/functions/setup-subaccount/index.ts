// supabase/functions/setup-subaccount/index.ts
// Creates (or updates) the vendor's Paystack subaccount. Card payments are split at
// checkout: the vendor's share settles directly to this bank account, so the platform
// never holds vendor money. The account name is resolved here, not taken from the client.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCaller, handler, json, paystack, readJson, HttpError } from '../_shared/http.ts';

serve(handler(async (req) => {
  const caller = await getCaller(req);
  if (caller.role !== 'vendor' && caller.role !== 'admin') {
    throw new HttpError(403, 'Only vendors can set up payout accounts');
  }

  const body = await readJson<{
    account_number?: string;
    bank_code?: string;
    bank_name?: string;
    vendor_id?: string;
  }>(req);
  const accountNumber = String(body.account_number || '');
  const bankCode = String(body.bank_code || '');
  if (!/^\d{10}$/.test(accountNumber)) throw new HttpError(400, 'Account number must be 10 digits');
  if (!/^\d{3,6}$/.test(bankCode)) throw new HttpError(400, 'Invalid bank code');

  const { admin } = caller;
  // Vendors manage their own account; admins may update any vendor by id.
  const vendorQuery = admin.from('vendors').select('id, name, email, phone, paystack_subaccount_code');
  const { data: vendor } = caller.role === 'admin'
    ? await vendorQuery.eq('id', String(body.vendor_id || '')).maybeSingle()
    : await vendorQuery.eq('owner_id', caller.userId).maybeSingle();
  if (!vendor) throw new HttpError(404, 'Vendor profile not found');

  const resolved = await paystack(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
  if (!resolved.ok) throw new HttpError(400, resolved.data?.message || 'Could not verify bank account');
  const accountName: string = resolved.data.data.account_name;

  const { data: settings } = await admin
    .from('platform_settings')
    .select('platform_fee_percentage')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  // Default split if a transaction is ever started without an explicit transaction_charge.
  const percentage = Math.min(Math.max(Number(settings?.platform_fee_percentage) || 10, 0), 100);

  const subaccountBody = {
    business_name: String(vendor.name || accountName).slice(0, 100),
    settlement_bank: bankCode,
    account_number: accountNumber,
    percentage_charge: percentage,
    description: `Vesphe vendor ${vendor.id}`,
    primary_contact_email: vendor.email || undefined,
    primary_contact_phone: vendor.phone || undefined,
    metadata: { vendor_id: vendor.id },
  };

  const result = vendor.paystack_subaccount_code
    ? await paystack(`/subaccount/${encodeURIComponent(vendor.paystack_subaccount_code)}`, { method: 'PUT', body: subaccountBody })
    : await paystack('/subaccount', { method: 'POST', body: subaccountBody });
  if (!result.ok) throw new HttpError(400, result.data?.message || 'Could not set up payout account');

  const subaccountCode: string = result.data.data?.subaccount_code || vendor.paystack_subaccount_code;

  const updates: Record<string, unknown> = {
    paystack_subaccount_code: subaccountCode,
    account_number: accountNumber,
    account_name: accountName,
    bank_code: bankCode,
  };
  if (body.bank_name) updates.bank_name = String(body.bank_name).slice(0, 64);

  const { error } = await admin.from('vendors').update(updates).eq('id', vendor.id);
  if (error) throw new HttpError(500, 'Failed to save payout account');

  return json({
    status: true,
    message: 'Payout account ready',
    data: { subaccount_code: subaccountCode, account_name: accountName },
  });
}));
