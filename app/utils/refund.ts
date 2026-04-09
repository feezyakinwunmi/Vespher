// app/utils/refund.ts
import { supabase } from '../lib/supabase';

export const processRefund = async (orderId: string, reason: string) => {
  try {
    console.log('💰 Starting refund for order:', orderId);
    
    // Get order details
    const { data: order, error } = await supabase
      .from('orders')
      .select('flutterwave_transaction_id, total')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    
    if (!order.flutterwave_transaction_id) {
      console.log('💰 No transaction ID found - order might be cash');
      return { success: false, error: 'No transaction found for refund' };
    }

    console.log('💰 Calling refund edge function...');
    
    // Get your project reference from Supabase URL
    // Example: if your URL is https://xyzabc.supabase.co, then projectRef is "xyzabc"
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectRef) {
      throw new Error('Could not determine project reference');
    }
    
    const edgeFunctionUrl = `https://${projectRef}.supabase.co/functions/v1/process-refund`;
    
    console.log('💰 Calling URL:', edgeFunctionUrl);
    
    const response = await fetch(edgeFunctionUrl, {
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
    });

    const result = await response.json();
    console.log('💰 Refund result:', result);
    
    if (!response.ok) {
      throw new Error(result.error || 'Refund failed');
    }
    
    return result;
    
  } catch (error) {
    console.error('Refund error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
};