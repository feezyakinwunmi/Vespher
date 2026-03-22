// app/utils/flutterwave.ts

const FLW_PUBLIC_KEY = process.env.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
const FLW_SECRET_KEY = process.env.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY;

const BASE_URL = 'https://api.flutterwave.com/v3';

// Define the response types properly
interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    account_number: string;
    account_name: string;
    bank_code?: string;
  };
}

interface VerifyAccountResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    account_number: string;
    account_name: string;
    bank_code: string;
  };
}

/**
 * Verify bank account details with Flutterwave
 */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<VerifyAccountResponse> {
  try {
    const response = await fetch(`${BASE_URL}/accounts/resolve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: accountNumber,
        account_bank: bankCode,
      }),
    });

    const data: FlutterwaveVerifyResponse = await response.json();
    
    if (data.status === 'success' && data.data) {
      return {
        status: 'success',
        message: 'Account verified successfully',
        data: {
          account_number: data.data.account_number,
          account_name: data.data.account_name,
          bank_code: bankCode,
        },
      };
    } else {
      return {
        status: 'error',
        message: data.message || 'Unable to verify account',
      };
    }
  } catch (error: any) {
    console.error('Flutterwave verification error:', error);
    return {
      status: 'error',
      message: error.message || 'Network error. Please try again.',
    };
  }
}

/**
 * Get list of banks (if you want to fetch dynamically)
 */
export async function getBanks() {
  try {
    const response = await fetch(`${BASE_URL}/banks/NG`, {
      headers: {
        'Authorization': `Bearer ${FLW_SECRET_KEY}`,
      },
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching banks:', error);
    return { status: 'error', message: 'Failed to fetch banks' };
  }
}