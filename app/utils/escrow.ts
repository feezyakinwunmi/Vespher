// app/utils/escrow.ts
import { supabase } from '../lib/supabase';

export const releaseEscrowToVendor = async (orderId: string) => {
  try {
    console.log(`🔄 Releasing escrow for order: ${orderId}`);
    
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError) throw orderError;
    
    // Only release if in held status
    if (order.escrow_status !== 'held') {
      console.log('⚠️ Order not in escrow, skipping release');
      return { success: false, message: 'Order not in escrow' };
    }
    
    // For card payments, capture the preauthorized payment
    if (order.payment_method === 'card' && order.payment_intent_id) {
      // Call Flutterwave to capture payment
      const captureResponse = await fetch(
        `https://api.flutterwave.com/v3/charges/${order.payment_intent_id}/capture`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const captureResult = await captureResponse.json();
      
      if (captureResult.status === 'success') {
        // Update order
        await supabase
          .from('orders')
          .update({
            escrow_status: 'released',
            escrow_released_at: new Date().toISOString(),
            escrow_release_id: captureResult.data.id,
            payment_status: 'paid'
          })
          .eq('id', orderId);
        
        console.log(`✅ Escrow released for order: ${orderId}`);
        return { success: true };
      } else {
        throw new Error(captureResult.message || 'Failed to capture payment');
      }
    }
    
    return { success: false, message: 'No payment intent found' };
    
  } catch (error) {
    console.error('❌ Escrow release error:', error);
    return { success: false, error };
  }
};