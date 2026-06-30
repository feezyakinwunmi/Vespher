// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  console.log('🚀 Payout function started');

  try {
    // ✅ Parse request body
    const body = await req.json();

    console.log(
      '📦 Incoming request body:',
      JSON.stringify(body, null, 2)
    );

    // ✅ Extract values
    const amount = body.amount;
    const recipientCode = body.recipient_code;
    const reference = body.reference;

    console.log('💰 Amount:', amount);
    console.log('👤 Recipient Code:', recipientCode);
    console.log('🧾 Reference:', reference);

    // ✅ Validate fields
    if (!amount) {
      console.error('❌ Missing amount');

      return new Response(
        JSON.stringify({
          status: false,
          message: 'Amount is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!recipientCode) {
      console.error('❌ Missing recipient_code');

      return new Response(
        JSON.stringify({
          status: false,
          message: 'Recipient code is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // ✅ Check secret key
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

    console.log(
      '🔑 Secret key exists:',
      !!secretKey
    );

    if (!secretKey) {
      console.error('❌ PAYSTACK_SECRET_KEY missing');

      return new Response(
        JSON.stringify({
          status: false,
          message: 'Paystack secret key missing',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // ✅ Build payload
    const payload = {
      source: 'balance',
      amount: amount * 100,
      recipient: recipientCode,
      reason: 'Vendor payout',
      reference,
    };

    console.log(
      '📤 Sending payload to Paystack:',
      JSON.stringify(payload, null, 2)
    );

    // ✅ Call Paystack
    const response = await fetch(
      'https://api.paystack.co/transfer',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    console.log(
      '🌐 Paystack response status:',
      response.status
    );

    console.log(
      '🌐 Paystack response ok:',
      response.ok
    );

    // ✅ Parse response
    const data = await response.json();

    console.log(
      '📥 Paystack response body:',
      JSON.stringify(data, null, 2)
    );

    // ✅ Handle Paystack errors
    if (!response.ok || data.status === false) {
      console.error(
        '❌ Paystack transfer failed:',
        JSON.stringify(data, null, 2)
      );

      return new Response(
        JSON.stringify({
          status: false,
          message:
            data.message || 'Transfer failed',
          error: data,
        }),
        {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('✅ Transfer successful');

    return new Response(
      JSON.stringify({
        status: true,
        message: 'Transfer initiated successfully',
        data,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('🔥 FUNCTION CRASHED');
    console.error('🔥 Error message:', err?.message);
    console.error('🔥 Full error:', err);

    return new Response(
      JSON.stringify({
        status: false,
        message: err?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
});