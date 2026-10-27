// supabase/functions/transfer-webhook/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const body = await req.text()
    const payload = JSON.parse(body)
    const data = payload.data
    const event = payload.event

    console.log('📥 Transfer webhook:', event, data?.reference)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (event === 'transfer.completed') {
      // Update withdrawal to completed
      const { error } = await supabase
        .from('withdrawals')
        .update({
          status: 'completed',
          notes: `Transfer completed. Flutterwave reference: ${data.reference}`
        })
        .eq('reference', data.reference)

      if (error) {
        console.error('Error updating withdrawal:', error)
      } else {
        console.log('✅ Withdrawal marked as completed:', data.reference)
      }
    } else if (event === 'transfer.failed') {
      // Update withdrawal to failed
      await supabase
        .from('withdrawals')
        .update({
          status: 'failed',
          notes: `Transfer failed: ${data.message || 'Unknown error'}`
        })
        .eq('reference', data.reference)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Error', { status: 500 })
  }
})