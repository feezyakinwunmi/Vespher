// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
try {
const body = await req.json()


const accountNumber = body.account_number
const bankCode = body.bank_code

const response = await fetch(
  `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
  }
)

const data = await response.json()

console.log('🏦 Verify response:', data)

return new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
  },
})


} catch (err: any) {
return new Response(
JSON.stringify({
status: false,
message: err.message,
}),
{
status: 500,
}
)
}
})
