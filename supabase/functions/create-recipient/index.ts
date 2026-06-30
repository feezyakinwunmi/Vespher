// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    const body = await req.json()

    console.log('Incoming body:', body)

    const response = await fetch(
      'https://api.paystack.co/transferrecipient',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name: body.account_name,
          account_number: body.account_number,
          bank_code: body.bank_code,
          currency: 'NGN',
        }),
      }
    )

    const data = await response.json()

    console.log('Paystack response:', data)

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (err: any) {
    console.log('Edge Function Error:', err)

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