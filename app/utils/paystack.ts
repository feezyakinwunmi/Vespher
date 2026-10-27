// app/utils/paystack.ts
// Client-side wrappers around Paystack edge functions. Secret keys live only on the
// server (Supabase function secrets) and must never be bundled into the app.
import { supabase } from '../lib/supabase';

export interface VerifyAccountResult {
  status: 'success' | 'error';
  message: string;
  data?: {
    account_number: string;
    account_name: string;
    bank_code: string;
  };
}

export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<VerifyAccountResult> {
  if (!/^\d{10}$/.test(accountNumber)) {
    return { status: 'error', message: 'Account number must be 10 digits' };
  }
  if (!bankCode) {
    return { status: 'error', message: 'Please select a bank' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('verify-bank', {
      body: { account_number: accountNumber, bank_code: bankCode },
    });

    if (error || !data?.status || !data?.data?.account_name) {
      return { status: 'error', message: data?.message || 'Unable to verify account' };
    }

    return {
      status: 'success',
      message: 'Account verified',
      data: {
        account_number: data.data.account_number,
        account_name: data.data.account_name,
        bank_code: bankCode,
      },
    };
  } catch (error: any) {
    return { status: 'error', message: error?.message || 'Verification failed' };
  }
}

// Extracts the server's error message from a FunctionsHttpError, if any.
export async function functionErrorMessage(error: any, fallback: string): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.message) return body.message;
  } catch {
    // ignore - body was not JSON
  }
  return error?.message || fallback;
}
