// app/hooks/useOrderTimer.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { processRefund } from '../utils/refund';

const AUTO_CANCEL_REASON = 'Auto-cancelled - not accepted within 30 minutes';

interface TimerReturn {
  timeRemaining: number | null;
  isExpired: boolean;
  formattedTime: string;
}

export function useOrderTimer(createdAt: string, status: string, orderId: string): TimerReturn {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Auto-cancel function
  const handleAutoCancel = async () => {
    try {
      // Get current order details
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status, payment_method, payment_status')
        .eq('id', orderId)
        .single();

      if (fetchError) {
        console.error('Error fetching order for auto-cancel:', fetchError);
        return;
      }

      // Only cancel if still pending
      if (order?.status === 'pending') {
        // Paid card orders: the refund function cancels and refunds server-side.
        if (order.payment_method === 'card' && order.payment_status === 'paid') {
          const refundResult = await processRefund(orderId, AUTO_CANCEL_REASON);
          if (!refundResult.success) {
            console.error(`Auto-cancel refund failed for order ${orderId}:`, refundResult.error);
          }
        } else {
          // Cash order - just cancel
          await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString(),
              cancelled_by: 'system',
              cancelled_at: new Date().toISOString(),
              rejection_reason: AUTO_CANCEL_REASON
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