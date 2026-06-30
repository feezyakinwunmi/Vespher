// app/utils/paystack.ts

const PAYSTACK_SECRET_KEY =
process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY;

export async function verifyBankAccount(
accountNumber: string,
bankCode: string
) {
try {
const response = await fetch(
`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
{
method: 'GET',
headers: {
Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
'Content-Type': 'application/json',
},
}
);


const data = await response.json();

console.log(
  '🏦 Paystack verify response:',
  data
);

if (data.status && data.data) {
  return {
    status: 'success',
    message: 'Account verified',
    data: {
      account_number:
        data.data.account_number,
      account_name:
        data.data.account_name,
      bank_code: bankCode,
    },
  };
}

return {
  status: 'error',
  message:
    data.message ||
    'Unable to verify account',
};

} catch (error: any) {
console.error(
'❌ Paystack verification error:',
error
);


return {
  status: 'error',
  message:
    error.message ||
    'Verification failed',
};


}
}
