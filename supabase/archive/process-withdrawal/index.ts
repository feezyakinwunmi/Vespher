// supabase/functions/process-withdrawal/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FLW_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { withdrawalId, amount, accountNumber, bankCode, accountName } = await req.json()

    console.log('Processing withdrawal:', { withdrawalId, amount, accountNumber, bankCode })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Generate unique reference
    const transferRef = `TF-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase()

    // Call Flutterwave Transfer API
    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_bank: bankCode,
        account_number: accountNumber,
        amount: amount,
        currency: 'NGN',
        narration: 'Vendor Withdrawal',
        reference: transferRef,
        debit_currency: 'NGN',
        callback_url: `${SUPABASE_URL}/functions/v1/transfer-webhook`
      })
    })

    const transferResult = await transferResponse.json()
    console.log('Flutterwave response:', transferResult)

    if (transferResult.status === 'success') {
      // ✅ Set status to PROCESSING, not completed
      await supabase
        .from('withdrawals')
        .update({
          status: 'processing',
          processed_at: new Date().toISOString(),
          reference: transferRef,
          notes: `Transfer initiated. Flutterwave ID: ${transferResult.data.id}`
        })
        .eq('id', withdrawalId)

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'processing',
          transferId: transferResult.data.id,
          message: 'Transfer initiated, will complete shortly'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } else {
      await supabase
        .from('withdrawals')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          notes: `Failed: ${transferResult.message}`
        })
        .eq('id', withdrawalId)

      return new Response(
        JSON.stringify({ success: false, message: transferResult.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})