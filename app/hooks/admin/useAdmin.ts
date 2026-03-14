// app/hooks/admin/useAdmin.ts
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from 'react-native';

export interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  totalRiders: number;
  totalOrders: number;
  totalRevenue: number;
  platformFees: number;
  pendingVendors: number;
  pendingWithdrawals: number;
  pendingMenu: number;
  recentOrders: any[];
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  user_type: 'vendor' | 'rider';
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  reference: string;
  created_at: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingVendors, setPendingVendors] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [pendingMenuItems, setPendingMenuItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }
    setIsAdmin(user.role === 'admin');
    setIsLoading(false);
  }, [user]);

  // ========== FETCH FUNCTIONS ==========

  // Fetch pending menu items
  const fetchPendingMenuItems = async () => {
    if (!isAdmin) return [];

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendor:vendor_id (
            id,
            name,
            owner_id
          )
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('Pending menu items fetched:', data?.length);
      setPendingMenuItems(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching pending menu items:', error);
      return [];
    }
  };

  const fetchStats = async () => {
    if (!isAdmin) return;

    try {
      // Get counts from existing tables
      const [
        { count: usersCount },
        { count: vendorsCount },
        { count: ridersCount },
        { count: ordersCount },
        { data: orders },
        { count: pendingVendorsCount }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('vendors').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'rider'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).neq('status', 'cancelled'),
        supabase.from('orders').select('total').neq('status', 'cancelled'),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_approved', false)
      ]);

      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const platformFees = orders?.reduce((sum, o) => sum + Math.round((o.total || 0) * 0.1), 0) || 0;

      // Fetch pending menu count
      const { count: pendingMenuCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');

      console.log('✅ Pending menu count:', pendingMenuCount);

      // Fetch recent orders with customer details
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            phone,
            email
          ),
          vendor:vendor_id (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) {
        console.error('Orders error:', ordersError);
      }

      // Process orders with images
      const recentOrders = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          const items = order.items || [];
          const productIds = items.map((item: any) => item.product_id).filter(Boolean);
          
          let productImages: Record<string, { image_url: string; name: string }> = {};
          if (productIds.length > 0) {
            const { data: products } = await supabase
              .from('products')
              .select('id, image_url, name')
              .in('id', productIds);
            
            productImages = (products || []).reduce((acc: any, product: any) => {
              acc[product.id] = {
                image_url: product.image_url || '',
                name: product.name
              };
              return acc;
            }, {});
          }

          const enrichedItems = items.map((item: any) => {
            const productData = productImages[item.product_id] || {};
            return {
              ...item,
              product: {
                id: item.product_id,
                name: productData.name || item.name,
                price: item.price,
                image: productData.image_url || '',
                vendorId: order.vendor_id,
              }
            };
          });

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
            total: order.total || 0,
            payment_method: order.payment_method || 'cash',
            payment_status: order.payment_status || 'pending',
            delivery_address: order.delivery_address || {},
            created_at: order.created_at,
            customer: order.customer,
            customer_name: customerName,
            customer_phone: customerPhone,
            vendor: order.vendor,
            itemCount: enrichedItems.length,
            firstItem: enrichedItems[0] || null
          };
        })
      );

      setStats({
        totalUsers: usersCount || 0,
        totalVendors: vendorsCount || 0,
        totalRiders: ridersCount || 0,
        totalOrders: ordersCount || 0,
        totalRevenue,
        platformFees,
        pendingVendors: pendingVendorsCount || 0,
        pendingWithdrawals: 0,
        pendingMenu: pendingMenuCount || 0,
        recentOrders: recentOrders || []
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPendingVendors = async () => {
    if (!isAdmin) return;

    try {
      const { data } = await supabase
        .from('vendors')
        .select(`
          *,
          owner:owner_id (
            name,
            email,
            phone
          )
        `)
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      console.log('🔥 Pending vendors fetched:', data?.length);
      setPendingVendors(data || []);
    } catch (error) {
      console.error('Error fetching pending vendors:', error);    
    }
  };

  const fetchWithdrawals = async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select(`
          *,
          user:user_id (
            name,
            email,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('All withdrawals:', data);
      setWithdrawalRequests(data || []);
      
      setStats(prev => prev ? {
        ...prev,
        pendingWithdrawals: data?.filter(w => w.status === 'pending' || w.status === 'processing').length || 0
      } : null);

    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  // ========== VENDOR ACTION FUNCTIONS ==========

  const approveVendor = async (vendorId: string) => {
    if (!isAdmin || !user) return;

    try {
      const { error } = await supabase
        .from('vendors')
        .update({ 
          is_approved: true,
          is_suspended: false
        })
        .eq('id', vendorId);

      if (error) throw error;
      Alert.alert('Success', 'Vendor approved successfully');
      fetchPendingVendors();
      fetchStats();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve vendor');
    }
  };

  const rejectVendor = async (vendorId: string) => {
    if (!isAdmin || !user) return;

    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId);

      if (error) throw error;
      Alert.alert('Success', 'Vendor rejected');
      fetchPendingVendors();
      fetchStats();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject vendor');
    }
  };

  const suspendVendor = async (vendorId: string) => {
    if (!isAdmin || !user) return;

    try {
      const { error } = await supabase
        .from('vendors')
        .update({ 
          is_suspended: true,
        })
        .eq('id', vendorId);

      if (error) throw error;
      Alert.alert('Success', 'Vendor suspended successfully');
      fetchPendingVendors();
      fetchStats();
    } catch (error) {
      Alert.alert('Error', 'Failed to suspend vendor');
    }
  };

  const unsuspendVendor = async (vendorId: string) => {
    if (!isAdmin || !user) return;

    try {
      const { error } = await supabase
        .from('vendors')
        .update({ 
          is_suspended: false,
        })
        .eq('id', vendorId);

      if (error) throw error;
      Alert.alert('Success', 'Vendor unsuspended successfully');
      fetchPendingVendors();
      fetchStats();
    } catch (error) {
      Alert.alert('Error', 'Failed to unsuspend vendor');
    }
  };

  // ========== WITHDRAWAL ACTION FUNCTIONS ==========

  const processWithdrawal = async (withdrawalId: string, action: 'approve' | 'reject', notes?: string) => {
    if (!isAdmin || !user) return;

    try {
      const status = action === 'approve' ? 'completed' : 'failed';
      
      const { error } = await supabase
        .from('withdrawals')
        .update({ 
          status, 
          processed_at: new Date().toISOString(),
          notes 
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      Alert.alert('Success', `Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}`);
      
      await fetchWithdrawals();
      await fetchStats();
      
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      Alert.alert('Error', 'Failed to process withdrawal');
    }
  };

  // ========== INITIAL FETCH ==========

  useEffect(() => {
    if (isAdmin) {
      Promise.all([
        fetchStats(),
        fetchPendingVendors(),
        fetchWithdrawals(),
        fetchPendingMenuItems()
      ]);
    }
  }, [isAdmin]);

  return {
    isAdmin,
    isLoading,
    stats,
    pendingVendors,
    withdrawalRequests,
    pendingMenuItems,
    approveVendor,
    rejectVendor,
    suspendVendor,
    unsuspendVendor,
    processWithdrawal,
    refresh: () => Promise.all([
      fetchStats(),
      fetchPendingVendors(),
      fetchWithdrawals(),
      fetchPendingMenuItems()
    ])
  };
}