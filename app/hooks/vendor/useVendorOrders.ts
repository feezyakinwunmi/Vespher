// app/hooks/vendor/useVendorOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from 'react-native';
import type { Order } from '../../types';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

export function useVendorOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);

  // Get vendor ID on mount
  useEffect(() => {
    if (!user) return;

    const getVendorId = async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setVendorId(data.id);
      }
    };

    getVendorId();
  }, [user]);

  // Fetch orders with complete details including product images
  const fetchOrders = useCallback(async () => {
    if (!vendorId) return;

    try {
      setIsLoading(true);
      
      // Fetch orders with customer details
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            phone,
            email
          )
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Raw orders from DB:', data);

      // For each order, fetch product images for all items
      const ordersWithImages = await Promise.all(
        (data || []).map(async (order: any) => {
          // Get all unique product_ids from the order items
          const items = order.items || [];
          const productIds = items.map((item: any) => item.product_id).filter(Boolean);
          
          // Fetch all product images in one query
          let productImages: Record<string, string> = {};
          if (productIds.length > 0) {
            const { data: products } = await supabase
              .from('products')
              .select('id, image_url')
              .in('id', productIds);
            
            // Create a map of product_id -> image_url
            productImages = (products || []).reduce((acc: Record<string, string>, product: any) => {
              acc[product.id] = product.image_url || '';
              return acc;
            }, {});
          }

          // Enrich items with product images
          const enrichedItems = items.map((item: any) => ({
            ...item,
            product: {
              id: item.product_id,
              name: item.name,
              price: item.price,
              image: productImages[item.product_id] || '',
              vendorId: order.vendor_id,
              category: '',
              isAvailable: true
            }
          }));

          // Get customer info
          const customerName = order.customer?.name || 
                              order.delivery_address?.label || 
                              'Customer';
          
          const customerPhone = order.customer?.phone || 
                               order.delivery_address?.phone || 
                               '';

          return {
            id: order.id,
            order_number: order.order_number || order.id.slice(0, 8),
            customer_id: order.customer_id,
            vendor_id: order.vendor_id,
            rider_id: order.rider_id,
            items: enrichedItems,
            status: order.status,
            subtotal: order.subtotal || 0,
            delivery_fee: order.delivery_fee || 0,
            service_fee: order.service_fee || 0,
            discount: order.discount || 0,
            total: order.total || 0,
            payment_method: order.payment_method || 'cash',
            payment_status: order.payment_status || 'pending',
            delivery_address: order.delivery_address || {},
            notes: order.notes,
            created_at: order.created_at,
            updated_at: order.updated_at,
            accepted_at: order.accepted_at,
            prepared_at: order.prepared_at,
            picked_up_at: order.picked_up_at,
            delivered_at: order.delivered_at,
            customer: order.customer,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: order.customer?.email,
          };
        })
      );

      console.log('Orders with images:', ordersWithImages);
      setOrders(ordersWithImages);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [vendorId]);

  // Update order status
  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString(),
          ...(status === 'delivered' && { delivered_at: new Date().toISOString() })
        })
        .eq('id', orderId);

      if (error) throw error;

      // Update local state
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, status, updated_at: new Date().toISOString() }
            : order
        )
      );

      Alert.alert('Success', `Order status updated to ${status}`);
    } catch (err: any) {
      console.error('Error updating order:', err);
      Alert.alert('Error', 'Failed to update order status');
      throw err;
    }
  };

  // Accept order (from pending to confirmed)
  const acceptOrder = async (orderId: string) => {
    await updateOrderStatus(orderId, 'confirmed');
  };

  // Reject/Cancel order
  const rejectOrder = async (orderId: string) => {
    await updateOrderStatus(orderId, 'cancelled');
  };

  // Start preparing
  const startPreparing = async (orderId: string) => {
    await updateOrderStatus(orderId, 'preparing');
  };

  // Mark as ready
  const markAsReady = async (orderId: string) => {
    await updateOrderStatus(orderId, 'ready');
  };

  // Real-time subscription
  useEffect(() => {
    if (!vendorId) return;

    const subscription = supabase
      .channel('vendor-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          // Fetch the new order with customer details
          const { data } = await supabase
            .from('orders')
            .select(`
              *,
              customer:customer_id (
                id,
                name,
                phone
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            // Fetch product images for the new order
            const items = data.items || [];
            const productIds = items.map((item: any) => item.product_id).filter(Boolean);
            
            let productImages: Record<string, string> = {};
            if (productIds.length > 0) {
              const { data: products } = await supabase
                .from('products')
                .select('id, image_url')
                .in('id', productIds);
              
              productImages = (products || []).reduce((acc: Record<string, string>, product: any) => {
                acc[product.id] = product.image_url || '';
                return acc;
              }, {});
            }

            const enrichedItems = items.map((item: any) => ({
              ...item,
              product: {
                id: item.product_id,
                name: item.name,
                price: item.price,
                image: productImages[item.product_id] || '',
                vendorId: data.vendor_id,
                category: '',
                isAvailable: true
              }
            }));

            const newOrder: Order = {
              id: data.id,
              order_number: data.order_number || data.id.slice(0, 8),
              customer_id: data.customer_id,
              vendor_id: data.vendor_id,
              rider_id: data.rider_id,
              items: enrichedItems,
              status: data.status,
              subtotal: data.subtotal || 0,
              delivery_fee: data.delivery_fee || 0,
              service_fee: data.service_fee || 0,
              discount: data.discount || 0,
              total: data.total || 0,
              payment_method: data.payment_method || 'cash',
              payment_status: data.payment_status || 'pending',
              delivery_address: data.delivery_address || {},
              notes: data.notes,
              created_at: data.created_at,
              updated_at: data.updated_at,
              customer: data.customer,
              customer_name: data.customer?.name || data.delivery_address?.label || 'Customer',
              customer_phone: data.customer?.phone || data.delivery_address?.phone || '',
            };
            
            setOrders(prev => [newOrder, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          setOrders(prev => 
            prev.map(order => 
              order.id === payload.new.id 
                ? { ...order, ...payload.new }
                : order
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) {
      fetchOrders();
    }
  }, [vendorId, fetchOrders]);

  // Group orders by status
  const ordersByStatus = {
    pending: orders.filter(o => o.status === 'pending'),
    confirmed: orders.filter(o => o.status === 'confirmed'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready'),
    in_transit: orders.filter(o => ['picked_up', 'in_transit'].includes(o.status)), // Add this
    completed: orders.filter(o => ['delivered', 'cancelled'].includes(o.status)),
  };

  return {
    orders,
    ordersByStatus,
    isLoading,
    error,
    acceptOrder,
    rejectOrder,
    startPreparing,
    markAsReady,
    updateOrderStatus,
    refreshOrders: fetchOrders,
  };
}