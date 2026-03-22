// app/hooks/useOrderTimer.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TimerReturn {
  timeRemaining: number | null;
  isExpired: boolean;
  formattedTime: string;
}

// Helper function to process refund
const processRefund = async (transactionId: string, amount: number, orderId: string) => {
  try {
    // Call your refund edge function
    const response = await fetch('https://your-project-ref.supabase.co/functions/v1/process-refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        transactionId,
        amount,
        orderId,
        reason: 'Auto-cancelled - not accepted within 30 minutes'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // Update refund status
      await supabase
        .from('orders')
        .update({
          refund_status: 'processing',
          refund_reference: result.refundId,
          refund_requested_at: new Date().toISOString(),
          refund_amount: amount,
          refund_reason: 'Auto-cancelled - not accepted within 30 minutes'
        })
        .eq('id', orderId);
      
      return { success: true };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('Refund error:', error);
    return { success: false, error };
  }
};

export function useOrderTimer(createdAt: string, status: string, orderId: string): TimerReturn {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Auto-cancel function
  const handleAutoCancel = async () => {
    try {
      // Get current order details
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status, payment_method, payment_status, flutterwave_transaction_id, total')
        .eq('id', orderId)
        .single();

      if (fetchError) {
        console.error('Error fetching order for auto-cancel:', fetchError);
        return;
      }

      // Only cancel if still pending
      if (order?.status === 'pending') {
        // For paid card orders - process refund
        if (order.payment_method === 'card' && order.payment_status === 'paid') {
          console.log(`💰 Processing refund for order ${orderId}`);
          
          // Call refund function
          const refundResult = await processRefund(
            order.flutterwave_transaction_id,
            order.total,
            orderId
          );
          
          // Update order with refund status
          await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              payment_status: refundResult.success ? 'refunded' : 'paid',
              refund_status: refundResult.success ? 'processing' : 'failed',
              updated_at: new Date().toISOString(),
              cancelled_by: 'system',
              cancelled_at: new Date().toISOString(),
              rejection_reason: refundResult.success 
                ? 'Auto-cancelled - refund initiated'
                : 'Auto-cancelled - refund failed'
            })
            .eq('id', orderId);
          
          console.log(`✅ Order ${orderId} auto-cancelled with refund: ${refundResult.success ? 'success' : 'failed'}`);
        } else {
          // Cash order - just cancel
          await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString(),
              cancelled_by: 'system',
              cancelled_at: new Date().toISOString(),
              rejection_reason: 'Auto-cancelled - not accepted within 30 minutes'
            })
            .eq('id', orderId);
          
          console.log(`✅ Order ${orderId} auto-cancelled (no refund needed)`);
        }
      }
    } catch (error) {
      console.error('Error auto-cancelling order:', error);
    }
  };

  useEffect(() => {
    // Only run timer for pending orders
    if (status !== 'pending') {
      setTimeRemaining(null);
      setIsExpired(false);
      return;
    }

    const calculateTimeRemaining = () => {
      const created = new Date(createdAt).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - created) / 1000); // seconds
      const remaining = 30 * 60 - elapsed; // 30 minutes in seconds

      if (remaining <= 0) {
        setTimeRemaining(0);
        setIsExpired(true);
        // Call auto-cancel when time expires
        handleAutoCancel();
        return 0;
      }

      setTimeRemaining(remaining);
      setIsExpired(false);
      return remaining;
    };

    // Initial calculation
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt, status, orderId]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timeRemaining,
    isExpired,
    formattedTime: timeRemaining !== null ? formatTime(timeRemaining) : '00:00'
  };
}