// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    const body = await req.json()

    const response = await fetch(
      'https://api.paystack.co/transfer',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: body.amount * 100,
          recipient: body.recipient_code,
          reason: 'Vendor payout',
        }),
      }
    )

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
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