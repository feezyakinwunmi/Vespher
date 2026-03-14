// app/hooks/vendor/useVendorStats.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePlatformSettings } from '../usePlatformSettings';

export interface VendorStats {
  todaySales: number; // Vendor earnings after fees
  todayGrossSales: number; // Total order value before fees
  todayOrders: number;
  todayDeliveryFees: number;
  todayPlatformFees: number;
  totalOrders: number;
  totalRevenue: number; // Total order value all time
  totalVendorEarnings: number; // Total vendor earnings after fees
  totalPlatformFees: number;
  averageRating: number;
  reviewCount: number;
  averagePrepTime: number;
  averageOrderValue: number;
  popularItems: Array<{
    id: string;
    name: string;
    count: number;
  }>;
}

export function useVendorStats() {
  const { user } = useAuth();
  const { settings } = usePlatformSettings();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);

  console.log('useVendorStats - user:', user?.id);

  // Get vendor ID on mount
  useEffect(() => {
    if (!user) {
      console.log('No user found');
      return;
    }

    const getVendorId = async () => {
      console.log('Fetching vendor ID for user:', user.id);
      
      const { data, error } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching vendor ID:', error);
        return;
      }

      if (data) {
        console.log('Vendor ID found:', data.id);
        setVendorId(data.id);
      } else {
        console.log('No vendor found for this user');
      }
    };

    getVendorId();
  }, [user]);

  // Calculate average prep time
  const calculateAvgPrepTime = (orders: any[]) => {
    const ordersWithPrepTime = orders.filter(order => 
      order.prepared_at && 
      order.accepted_at && 
      order.status === 'delivered'
    );
    
    if (ordersWithPrepTime.length === 0) return 0;
    
    const totalTime = ordersWithPrepTime.reduce((sum, order) => {
      const prepTime = new Date(order.prepared_at).getTime() - new Date(order.accepted_at).getTime();
      const minutes = Math.max(0, prepTime / 1000 / 60);
      return sum + minutes;
    }, 0);
    
    return Math.round(totalTime / ordersWithPrepTime.length);
  };

  const fetchStats = useCallback(async () => {
    if (!vendorId) {
      console.log('No vendor ID available yet');
      return;
    }

    console.log('Fetching stats for vendor:', vendorId);

    try {
      setIsLoading(true);
      
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      console.log('Date range:', today.toISOString(), 'to', tomorrow.toISOString());

      // Fetch today's orders - EXCLUDE cancelled
      const { data: todayOrders, error: todayError } = await supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', vendorId)
        .neq('status', 'cancelled')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (todayError) {
        console.error('Error fetching today orders:', todayError);
        throw todayError;
      }

      console.log('Today orders count:', todayOrders?.length);
      console.log('Today orders:', todayOrders);

      // Fetch all orders for stats - EXCLUDE cancelled
      const { data: allOrders, error: allError } = await supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', vendorId)
        .neq('status', 'cancelled');

      if (allError) {
        console.error('Error fetching all orders:', allError);
        throw allError;
      }

      console.log('All orders count:', allOrders?.length);

      // Filter for delivered/delivered orders only
      const deliveredTodayOrders = todayOrders?.filter(order => 
        order.status === 'delivered' || order.status === 'delivered'
      ) || [];

      const deliveredAllOrders = allOrders?.filter(order => 
        order.status === 'delivered' || order.status === 'delivered'
      ) || [];

      console.log('delivered today orders count:', deliveredTodayOrders.length);
      console.log('delivered all orders count:', deliveredAllOrders.length);

      // Calculate today's stats (only from delivered orders)
      const todayGrossSales = deliveredTodayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const todayDeliveryFees = deliveredTodayOrders.reduce((sum, order) => sum + (order.delivery_fee || 0), 0);
      const todaySubtotal = todayGrossSales - todayDeliveryFees;
      const platformFeePercentage = settings?.platform_fee_percentage ? settings.platform_fee_percentage / 100 : 0.1;
      const todayPlatformFees = Math.round(todaySubtotal * platformFeePercentage);
      const todayVendorEarnings = todaySubtotal - todayPlatformFees;
      const todayOrdersCount = deliveredTodayOrders.length;

      console.log('Today calculations:', {
        todayGrossSales,
        todayDeliveryFees,
        todaySubtotal,
        platformFeePercentage,
        todayPlatformFees,
        todayVendorEarnings,
        todayOrdersCount
      });

      // Calculate all-time stats (only from delivered orders)
      const totalGrossRevenue = deliveredAllOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const totalDeliveryFees = deliveredAllOrders.reduce((sum, order) => sum + (order.delivery_fee || 0), 0);
      const totalSubtotal = totalGrossRevenue - totalDeliveryFees;
      const totalPlatformFees = Math.round(totalSubtotal * platformFeePercentage);
      const totalVendorEarnings = totalSubtotal - totalPlatformFees;
      const totalOrders = deliveredAllOrders.length;

      console.log('Total calculations:', {
        totalGrossRevenue,
        totalDeliveryFees,
        totalSubtotal,
        totalPlatformFees,
        totalVendorEarnings,
        totalOrders
      });

      const averageOrderValue = totalOrders > 0 ? totalGrossRevenue / totalOrders : 0;
      const averagePrepTime = calculateAvgPrepTime(allOrders || []);

      // Fetch reviews from reviews table
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('vendor_id', vendorId);

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
        throw reviewsError;
      }

      console.log('Reviews count:', reviews?.length);

      const reviewCount = reviews?.length || 0;
      const averageRating = reviewCount > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount 
        : 0;

      // Get popular items from order_items (only from delivered orders)
      const { data: popularItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          product_id,
          name,
          quantity,
          orders!inner(status),
          products:product_id (
            name
          )
        `)
        .eq('vendor_id', vendorId)
        .in('orders.status', ['delivered', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (itemsError) {
        console.error('Error fetching popular items:', itemsError);
        throw itemsError;
      }

      console.log('Popular items count:', popularItems?.length);

      // Aggregate popular items
      const itemCounts = new Map();
      popularItems?.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || item.name;
        const current = itemCounts.get(productId) || { count: 0, name: productName };
        current.count += item.quantity;
        itemCounts.set(productId, current);
      });

      const topItems = Array.from(itemCounts.entries())
        .map(([id, data]: [string, any]) => ({
          id,
          name: data.name,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const newStats = {
        todaySales: todayVendorEarnings,
        todayGrossSales: todayGrossSales,
        todayOrders: todayOrdersCount,
        todayDeliveryFees: todayDeliveryFees,
        todayPlatformFees: todayPlatformFees,
        totalOrders,
        totalRevenue: totalGrossRevenue,
        totalVendorEarnings,
        totalPlatformFees,
        averageRating,
        reviewCount,
        averagePrepTime,
        averageOrderValue,
        popularItems: topItems,
      };

      console.log('Final stats:', newStats);
      setStats(newStats);

    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [vendorId, settings]);

  // Real-time subscription for stats updates
  useEffect(() => {
    if (!vendorId) return;

    console.log('Setting up real-time subscription for vendor:', vendorId);

    const subscription = supabase
      .channel('vendor-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          console.log('Order change detected:', payload);
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          console.log('Review change detected:', payload);
          fetchStats();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [vendorId, fetchStats]);

  useEffect(() => {
    if (vendorId) {
      console.log('Vendor ID set, fetching stats...');
      fetchStats();
    }
  }, [vendorId, fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refreshStats: fetchStats,
  };
}