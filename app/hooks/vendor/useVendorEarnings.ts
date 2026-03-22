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

    // ✅ USE STORED vendor_payout from database
    const ordersWithPayout = orders?.map(order => {
      let vendorPayout = order.vendor_payout;
      
      if (!vendorPayout || vendorPayout === 0) {
        const orderTotal = order.total || 0;
        const deliveryFee = order.delivery_fee || 0;
        const subtotal = orderTotal - deliveryFee;
        const platformFeePercentage = settings?.platform_fee_percentage ? settings.platform_fee_percentage / 100 : 0.1;
        const platformFee = Math.round(subtotal * platformFeePercentage);
        vendorPayout = subtotal - platformFee;
      }
      
      return {
        ...order,
        vendor_payout: vendorPayout,
      };
    }) || [];

    // ✅ Get wallet balance (including pending_balance)
    let walletBalance = 0;
    let pendingBalance = 0;
    let totalEarned = 0;
    
    const { data: wallet, error: walletError } = await supabase
      .from('vendor_wallets')
      .select('balance, pending_balance, total_earned')
      .eq('vendor_id', vendorId)
      .single();
    
    if (walletError && walletError.code !== 'PGRST116') {
      console.error('Error fetching wallet:', walletError);
    }
    
    if (wallet) {
      walletBalance = wallet.balance || 0;
      pendingBalance = wallet.pending_balance || 0;
      totalEarned = wallet.total_earned || 0;
    } else {
      // If no wallet exists, create one
      await supabase
        .from('vendor_wallets')
        .insert({
          vendor_id: vendorId,
          balance: 0,
          pending_balance: 0,
          total_earned: 0,
          updated_at: new Date().toISOString()
        });
    }

    // Calculate total earnings from wallet (already stored)
    const totalEarnings = totalEarned;

    // Calculate weekly earnings from orders (for growth calculation)
    const weeklyOrders = ordersWithPayout.filter(order => 
      new Date(order.created_at) >= startOfWeek
    );
    const weeklyEarnings = weeklyOrders.reduce((sum, order) => sum + (order.vendor_payout || 0), 0) || 0;

    const lastWeekOrders = ordersWithPayout.filter(order => {
      const date = new Date(order.created_at);
      return date >= startOfLastWeek && date < startOfWeek;
    });
    const lastWeekEarnings = lastWeekOrders.reduce((sum, order) => sum + (order.vendor_payout || 0), 0) || 0;

    const weeklyGrowth = lastWeekEarnings > 0 
      ? Math.round(((weeklyEarnings - lastWeekEarnings) / lastWeekEarnings) * 100)
      : weeklyEarnings > 0 ? 100 : 0;

    // ✅ Use pending_balance from wallet instead of querying withdrawals separately
    const pendingPayout = pendingBalance;

    // Available balance is wallet balance
    const availableBalance = walletBalance;

    // Get delivered order count
    const orderCount = orders?.length || 0;

    // Calculate average order value from gross revenue
    const totalGrossRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
    const averageOrderValue = orderCount > 0 
      ? Math.round(totalGrossRevenue / orderCount)
      : 0;

    // Get reviews
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

    // Update vendor rating if needed
    if (reviewCount > 0) {
      await supabase
        .from('vendors')
        .update({ 
          rating: averageRating,
          review_count: reviewCount 
        })
        .eq('id', vendorId);
    }

    // Get bank details
    const { data: vendor } = await supabase
      .from('vendors')
      .select('bank_name, account_number, account_name')
      .eq('id', vendorId)
      .single();

    console.log('Earnings from wallet:', {
      totalEarnings,
      walletBalance,
      pendingBalance,
      weeklyEarnings,
    });

    setEarnings({
      totalEarnings,
      weeklyEarnings,
      weeklyGrowth,
      pendingPayout,
      availableBalance,
      orderCount,
      averageOrderValue,
      rating: averageRating,
      reviewCount: reviewCount,
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
// Fetch transactions - ONLY DELIVERED ORDERS
const fetchTransactions = useCallback(async () => {
  if (!vendorId || !user) return;

  try {
    // Fetch ONLY DELIVERED orders as income transactions
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, total, created_at, status, subtotal, delivery_fee, vendor_payout, payment_status, refund_status')
      .eq('vendor_id', vendorId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(50);

    if (ordersError) throw ordersError;

    // ✅ USE STORED vendor_payout from database
    const orderTransactions: Transaction[] = orders?.map(order => {
      // Use stored vendor_payout if available
      let amount = order.vendor_payout;
      
      // Fallback calculation if needed
      if (!amount || amount === 0) {
        const orderTotal = order.total || 0;
        const deliveryFee = order.delivery_fee || 0;
        const subtotal = orderTotal - deliveryFee;
        const platformFeePercentage = settings?.platform_fee_percentage ? settings.platform_fee_percentage / 100 : 0.1;
        const platformFee = Math.round(subtotal * platformFeePercentage);
        amount = subtotal - platformFee;
      }

      return {
        id: order.id,
        type: 'order',
        amount: amount,
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




  // Add this function to your useVendorEarnings hook (after fetchTransactions)

const fetchOrderDetails = useCallback(async (orderId: string) => {
  try {
    console.log('Fetching order details for:', orderId);
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        subtotal,
        total,
        delivery_fee,
        platform_commission,
        flutterwave_fee,
        vat_on_fee,
        stamp_duty,
        vendor_payout,
        customer_name,
        created_at,
        payment_method,
        payment_status
      `)
      .eq('id', orderId)
      .single();
    
    if (error) {
      console.error('Error fetching order details:', error);
      
      // If columns don't exist, try a simpler query with calculations
      if (error.code === '42703') {
        console.log('Some columns missing, fetching basic order data...');
        
        const { data: basicData, error: basicError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            subtotal,
            total,
            delivery_fee,
            customer_name,
            created_at,
            payment_method,
            payment_status
          `)
          .eq('id', orderId)
          .single();
        
        if (basicError) throw basicError;
        
        // Calculate missing values
        const platformFeePercentage = settings?.platform_fee_percentage ? settings.platform_fee_percentage / 100 : 0.1;
        const subtotal = basicData.subtotal || 0;
        const platformCommission = Math.round(subtotal * platformFeePercentage);
        const flutterwaveFee = Math.round(subtotal * 0.02);
        const vatOnFee = Math.round(flutterwaveFee * 0.075);
        const stampDuty = basicData.total >= 10000 ? 50 : 0;
        const vendorPayout = subtotal - platformCommission;
        
        return {
          ...basicData,
          platform_commission: platformCommission,
          flutterwave_fee: flutterwaveFee,
          vat_on_fee: vatOnFee,
          stamp_duty: stampDuty,
          vendor_payout: vendorPayout,
        };
      }
      throw error;
    }
    
    // Parse string values to numbers if needed
    return {
      ...data,
      platform_commission: parseFloat(data.platform_commission || '0'),
      flutterwave_fee: parseFloat(data.flutterwave_fee || '0'),
      vat_on_fee: parseFloat(data.vat_on_fee || '0'),
      stamp_duty: parseFloat(data.stamp_duty || '0'),
      vendor_payout: parseFloat(data.vendor_payout || '0'),
    };
  } catch (error) {
    console.error('Error in fetchOrderDetails:', error);
    return null;
  }
}, [settings]);

  // Request payout
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

    // ✅ Get current wallet balance and pending_balance
    const { data: wallet, error: walletError } = await supabase
      .from('vendor_wallets')
      .select('balance, pending_balance')
      .eq('vendor_id', vendorId)
      .single();

    if (walletError) {
      console.error('Error fetching wallet:', walletError);
      Alert.alert('Error', 'Could not verify balance');
      return false;
    }

    // Check available balance
    if (payoutData.amount > (wallet?.balance || 0)) {
      Alert.alert('Error', 'Insufficient balance');
      return false;
    }

    // Generate reference
    const reference = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

    // Create withdrawal request
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

    // ✅ UPDATE: Deduct from balance, add to pending_balance
    await supabase
      .from('vendor_wallets')
      .update({
        balance: (wallet?.balance || 0) - payoutData.amount,
        pending_balance: (wallet?.pending_balance || 0) + payoutData.amount,
        updated_at: new Date().toISOString()
      })
      .eq('vendor_id', vendorId);

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
   fetchOrderDetails, // Add this line

  };
}