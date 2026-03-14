// app/hooks/vendor/useVendorEarnings.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePlatformSettings } from '../usePlatformSettings';
import { Alert } from 'react-native';

export interface EarningsData {
  totalEarnings: number;
  weeklyEarnings: number;
  weeklyGrowth: number;
  pendingPayout: number;
  availableBalance: number;
  orderCount: number;
  averageOrderValue: number;
  rating: number;
  reviewCount: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface Transaction {
  id: string;
  type: 'order' | 'payout' | 'refund';
  amount: number;
  date: string;
  status?: string;
  order_id?: string;
  reference?: string;
}

export interface PayoutRequest {
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
}

export function useVendorEarnings() {
  const { user } = useAuth();
  const { settings } = usePlatformSettings();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get vendor ID and bank details
  useEffect(() => {
    if (!user) return;

    const getVendorId = async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, rating, review_count, bank_name, account_number, account_name')
        .eq('owner_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching vendor:', error);
        return;
      }

      if (data) {
        setVendorId(data.id);
      }
    };

    getVendorId();
  }, [user]);

  // Fetch earnings data - ONLY DELIVERED ORDERS COUNT
  // Fetch earnings data - ONLY DELIVERED ORDERS COUNT
const fetchEarnings = useCallback(async () => {
  if (!vendorId) return;

  try {
    setIsLoading(true);

    // Get date ranges
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    // Fetch ONLY DELIVERED orders for this vendor
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'delivered');

    if (ordersError) throw ordersError;

    // Platform fee percentage from settings
    const platformFeePercentage = settings?.platform_fee_percentage ? settings.platform_fee_percentage / 100 : 0.1;

    // Calculate vendor payout from delivered orders
    const ordersWithPayout = orders?.map(order => {
      const orderTotal = order.total || 0;
      const deliveryFee = order.delivery_fee || 0;
      const subtotal = orderTotal - deliveryFee;
      const platformFee = Math.round(subtotal * platformFeePercentage);
      const vendorPayout = subtotal - platformFee;
      
      return {
        ...order,
        vendor_payout: vendorPayout,
        subtotal: subtotal,
        platform_fee: platformFee
      };
    }) || [];

    // Calculate total earnings
    const totalEarnings = ordersWithPayout.reduce((sum, order) => sum + (order.vendor_payout || 0), 0) || 0;

    // Calculate weekly earnings
    const weeklyOrders = ordersWithPayout.filter(order => 
      new Date(order.created_at) >= startOfWeek
    );
    const weeklyEarnings = weeklyOrders.reduce((sum, order) => sum + (order.vendor_payout || 0), 0) || 0;

    // Calculate last week's earnings
    const lastWeekOrders = ordersWithPayout.filter(order => {
      const date = new Date(order.created_at);
      return date >= startOfLastWeek && date < startOfWeek;
    });
    const lastWeekEarnings = lastWeekOrders.reduce((sum, order) => sum + (order.vendor_payout || 0), 0) || 0;

    // Calculate weekly growth
    const weeklyGrowth = lastWeekEarnings > 0 
      ? Math.round(((weeklyEarnings - lastWeekEarnings) / lastWeekEarnings) * 100)
      : weeklyEarnings > 0 ? 100 : 0;

    // Calculate total revenue (gross) for average order value
    const totalGrossRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

    // Get ALL withdrawals
    const { data: allWithdrawals } = await supabase
      .from('withdrawals')
      .select('amount, status')
      .eq('user_id', user?.id);

    // Calculate pending payouts
    const pendingPayout = allWithdrawals
      ?.filter(w => w.status === 'pending' || w.status === 'processing')
      .reduce((sum, w) => sum + w.amount, 0) || 0;

    // Calculate total withdrawn
    const totalWithdrawn = allWithdrawals
      ?.filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + w.amount, 0) || 0;

    // Available balance
    const availableBalance = Math.max(0, totalEarnings - totalWithdrawn - pendingPayout);

    // Get delivered order count
    const orderCount = orders?.length || 0;

    // Calculate average order value
    const averageOrderValue = orderCount > 0 
      ? Math.round(totalGrossRevenue / orderCount)
      : 0;

    // FIX: Calculate rating properly from reviews table
    const { data: allReviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('vendor_id', vendorId);

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      throw reviewsError;
    }

    const reviewCount = allReviews?.length || 0;
    const averageRating = reviewCount > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount 
      : 0;

    // Optional: Update the vendors table with calculated values
    if (reviewCount > 0) {
      await supabase
        .from('vendors')
        .update({ 
          rating: averageRating,
          review_count: reviewCount 
        })
        .eq('id', vendorId);
    }

    // Get bank details from vendor table
    const { data: vendor } = await supabase
      .from('vendors')
      .select('bank_name, account_number, account_name')
      .eq('id', vendorId)
      .single();

    console.log('Rating calculation:', {
      reviewCount,
      averageRating,
      allReviews
    });

    setEarnings({
      totalEarnings,
      weeklyEarnings,
      weeklyGrowth,
      pendingPayout,
      availableBalance,
      orderCount,
      averageOrderValue,
      rating: averageRating, // Use calculated rating
      reviewCount: reviewCount, // Use calculated count
      bankName: vendor?.bank_name,
      accountNumber: vendor?.account_number,
      accountName: vendor?.account_name,
    });

  } catch (err: any) {
    console.error('Error fetching earnings:', err);
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
}, [vendorId, user?.id, settings]);

  // Fetch transactions - ONLY DELIVERED ORDERS
  const fetchTransactions = useCallback(async () => {
    if (!vendorId || !user) return;

    try {
      // Fetch ONLY DELIVERED orders as income transactions
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, total, created_at, status, subtotal, delivery_fee')
        .eq('vendor_id', vendorId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(50);

      if (ordersError) throw ordersError;

      // Platform fee percentage from settings
      const platformFeePercentage = settings?.platform_fee_percentage ? settings.platform_fee_percentage / 100 : 0.1;

      // Calculate vendor payout for each delivered order
      const orderTransactions: Transaction[] = orders?.map(order => {
        const orderTotal = order.total || 0;
        const deliveryFee = order.delivery_fee || 0;
        const subtotal = orderTotal - deliveryFee;
        const platformFee = Math.round(subtotal * platformFeePercentage);
        const vendorPayout = subtotal - platformFee;

        return {
          id: order.id,
          type: 'order',
          amount: vendorPayout,
          date: new Date(order.created_at).toLocaleDateString(),
          status: order.status,
          order_id: order.id,
        };
      }) || [];

      // Fetch withdrawals
      const { data: payouts, error: payoutsError } = await supabase
        .from('withdrawals')
        .select('id, amount, created_at, status, reference')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (payoutsError) throw payoutsError;

      const payoutTransactions: Transaction[] = payouts?.map(p => ({
        id: p.reference || `PO-${p.id}`,
        type: 'payout',
        amount: -p.amount,
        date: new Date(p.created_at).toLocaleDateString(),
        status: p.status,
      })) || [];

      // Combine and sort by date (newest first)
      const allTransactions = [...orderTransactions, ...payoutTransactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);

      setTransactions(allTransactions);

    } catch (err: any) {
      console.error('Error fetching transactions:', err);
    }
  }, [vendorId, user?.id, settings]);

  // Request payout
  const requestPayout = async (payoutData: PayoutRequest): Promise<boolean> => {
    if (!vendorId || !user) {
      Alert.alert('Error', 'Vendor not found');
      return false;
    }

    try {
      // Validate minimum payout
      if (payoutData.amount < 1000) {
        Alert.alert('Error', 'Minimum payout amount is ₦1,000');
        return false;
      }

      // Check available balance
      if (payoutData.amount > (earnings?.availableBalance || 0)) {
        Alert.alert('Error', 'Insufficient balance');
        return false;
      }

      // Generate reference
      const reference = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

      // Create payout request
      const { error: payoutError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          user_type: 'vendor',
          amount: payoutData.amount,
          bank_name: payoutData.bank_name,
          account_number: payoutData.account_number,
          account_name: payoutData.account_name,
          reference: reference,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (payoutError) {
        console.error('Payout error:', payoutError);
        Alert.alert('Error', 'Failed to request payout');
        return false;
      }

      // Refresh data
      await fetchEarnings();
      await fetchTransactions();

      Alert.alert('Success', 'Payout request submitted successfully!');
      return true;

    } catch (err: any) {
      console.error('Error requesting payout:', err);
      Alert.alert('Error', err.message || 'Failed to request payout');
      return false;
    }
  };

  // Fetch data when vendorId changes
  useEffect(() => {
    if (vendorId) {
      fetchEarnings();
      fetchTransactions();
    }
  }, [vendorId, fetchEarnings, fetchTransactions]);

  // Refresh function
  const refreshData = async () => {
    await fetchEarnings();
    await fetchTransactions();
  };

  return {
    earnings,
    transactions,
    isLoading,
    error,
    requestPayout,
    refreshData,
  };
}