// supabase/functions/verify-bank/index.ts
// Resolves a Nigerian bank account name via Paystack. Called during vendor signup
// (before an account exists), so it accepts the anon key, but inputs are strictly validated.
// @ts-ignore - Deno remote import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handler, json, paystack, readJson, HttpError } from '../_shared/http.ts';

serve(handler(async (req) => {
  const body = await readJson<{ account_number?: string; bank_code?: string }>(req);
  const accountNumber = String(body.account_number || '');
  const bankCode = String(body.bank_code || '');

  if (!/^\d{10}$/.test(accountNumber)) throw new HttpError(400, 'Account number must be 10 digits');
  if (!/^\d{3,6}$/.test(bankCode)) throw new HttpError(400, 'Invalid bank code');

  const result = await paystack(
    `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
  );

  if (!result.ok) {
    return json({ status: false, message: result.data?.message || 'Could not resolve account' }, 400);
  }

  return json({
    status: true,
    message: 'Account verified',
    data: {
      account_number: result.data.data.account_number,
      account_name: result.data.data.account_name,
    },
  });
}));
