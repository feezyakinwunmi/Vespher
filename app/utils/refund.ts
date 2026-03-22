// app/utils/refund.ts
import { supabase } from '../lib/supabase';

export const processRefund = async (orderId: string, reason: string) => {
  try {
    // Get order details
    const { data: order, error } = await supabase
      .from('orders')
      .select('flutterwave_transaction_id, total')
      .eq('id', orderId)
      .single();

    if (error) throw error;

    // Call your edge function to process refund
    const response = await fetch(
      `https://${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          transactionId: order.flutterwave_transaction_id,
          amount: order.total,
          orderId,
          reason
        })
      }
    );

    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('Refund error:', error);
  }
};