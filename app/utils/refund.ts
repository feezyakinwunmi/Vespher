// app/utils/refund.ts
// Refunds are executed by the process-refund edge function, which checks that the
// caller may cancel the order, refunds via Paystack and updates the order itself.
import { supabase } from '../lib/supabase';
import { functionErrorMessage } from './paystack';

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

export const processRefund = async (orderId: string, reason: string): Promise<RefundResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('process-refund', {
      body: { order_id: orderId, reason },
    });

    if (error) {
      return { success: false, error: await functionErrorMessage(error, 'Refund failed') };
    }
    if (!data?.success) {
      return { success: false, error: data?.error || data?.message || 'Refund failed' };
    }
    return { success: true, refundId: data.refundId };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Refund failed' };
  }
};
