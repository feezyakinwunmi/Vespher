// app/hooks/useOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Order } from '../../types';

export function useOrders() {
  const { user, isReady } = useAuth(); // Add isReady
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          vendor:vendors(*),
          rider:users!rider_id(*)
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to match Order type
      const transformedOrders: Order[] = data?.map(order => ({
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        vendor_id: order.vendor_id,
        rider_id: order.rider_id,
        items: order.items || [],
        status: order.status,
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee,
        service_fee: order.service_fee,
        discount: order.discount || 0,
        total: order.total,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        payment_reference: order.payment_reference,
        delivery_address: order.delivery_address,
        delivery_instructions: order.delivery_instructions,
        estimated_delivery_time: order.estimated_delivery_time,
        actual_delivery_time: order.actual_delivery_time,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        notes: order.notes,
        special_instructions: order.special_instructions,
        rejection_reason: order.rejection_reason,
        created_at: order.created_at,
        updated_at: order.updated_at,
        accepted_at: order.accepted_at,
        prepared_at: order.prepared_at,
        picked_up_at: order.picked_up_at,
        delivered_at: order.delivered_at,
        vendor: order.vendor,
        rider: order.rider,
        
        // For backward compatibility
        customerId: order.customer_id,
        vendorId: order.vendor_id,
        createdAt: order.created_at,
        deliveryFee: order.delivery_fee,
        paymentMethod: order.payment_method,
        deliveryAddress: order.delivery_address,
        estimatedDelivery: order.estimated_delivery_time,
      })) || [];

      setOrders(transformedOrders);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const getOrderById = useCallback(async (orderId: string) => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          vendor:vendors(*),
          rider:users!rider_id(*)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      // Transform the single order as well
      if (data) {
        return {
          id: data.id,
          order_number: data.order_number,
          customer_id: data.customer_id,
          vendor_id: data.vendor_id,
          rider_id: data.rider_id,
          items: data.items || [],
          status: data.status,
          subtotal: data.subtotal,
          delivery_fee: data.delivery_fee,
          service_fee: data.service_fee,
          discount: data.discount || 0,
          total: data.total,
          payment_method: data.payment_method,
          payment_status: data.payment_status,
          payment_reference: data.payment_reference,
          delivery_address: data.delivery_address,
          delivery_instructions: data.delivery_instructions,
          estimated_delivery_time: data.estimated_delivery_time,
          actual_delivery_time: data.actual_delivery_time,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_email: data.customer_email,
          notes: data.notes,
          special_instructions: data.special_instructions,
          rejection_reason: data.rejection_reason,
          created_at: data.created_at,
          updated_at: data.updated_at,
          accepted_at: data.accepted_at,
          prepared_at: data.prepared_at,
          picked_up_at: data.picked_up_at,
          delivered_at: data.delivered_at,
          vendor: data.vendor,
          rider: data.rider,
        };
      }
      return null;
    } catch (err: any) {
      return null;
    }
  }, [user]);

  // Wait for auth to be ready before fetching
  useEffect(() => {
    if (!isReady) return;
    fetchOrders();
  }, [isReady, fetchOrders]);

  // Set up real-time subscription for order updates
  useEffect(() => {
    if (!user || !isReady) return;

    const subscription = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          // Refresh orders when there's a change
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, isReady, fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    refreshOrders: fetchOrders,
    getOrderById,
  };
}