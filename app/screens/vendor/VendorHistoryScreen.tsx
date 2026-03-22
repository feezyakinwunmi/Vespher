// app/screens/vendor/VendorHistoryScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
type VendorScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OrderHistory {
  id: string;
  order_number: string;
  customer_name: string;
  customer_address: string;
  items_count: number;
  total: number;
  vendor_earnings: number; // After fees - using stored vendor_payout
  status: string;
  payment_method: string;
  created_at: string;
  completed_at: string;
}

export function VendorHistoryScreen({ onTabChange }: { onTabChange?: (tab: string) => void }) {
  const navigation = useNavigation<VendorScreenNavigationProp>();
  const { user } = useAuth();
  const { settings } = usePlatformSettings();
  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      
      // Get vendor ID
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (!vendorData) return;

      // Fetch orders with customer details using join
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_id,
          delivery_address,
          items,
          total,
          subtotal,
          delivery_fee,
          vendor_payout,
          status,
          payment_method,
          created_at,
          delivered_at,
          users!customer_id (
            name
          )
        `)
        .eq('vendor_id', vendorData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders: OrderHistory[] = (data || []).map((order: any) => {
        // ✅ USE STORED vendor_payout from the order
        // This is the actual amount the vendor earned after all fees
        let vendorEarnings = 0;
        
        // For delivered orders, use the stored vendor_payout
        if (order.status === 'delivered') {
          // Parse vendor_payout if it's a string (from your data it's stored as "3600")
          vendorEarnings = typeof order.vendor_payout === 'string' 
            ? parseFloat(order.vendor_payout) 
            : (order.vendor_payout || 0);
        }

        // Count items (if items is an array)
        const itemsCount = Array.isArray(order.items) ? order.items.length : 0;

        return {
          id: order.id,
          order_number: order.order_number || order.id.slice(0, 8),
          customer_name: order.users?.name || 'Customer',
          customer_address: order.delivery_address ? 
            `${order.delivery_address.street || ''}, ${order.delivery_address.area || ''}` : 
            'Address not available',
          items_count: itemsCount,
          total: order.total || 0,
          vendor_earnings: vendorEarnings,
          status: order.status,
          payment_method: order.payment_method,
          created_at: order.created_at,
          completed_at: order.delivered_at || order.created_at,
        };
      });

      console.log('Formatted orders with vendor earnings:', formattedOrders);
      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const filterOrders = () => {
    let filtered = orders;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o => 
        o.order_number.toLowerCase().includes(query) ||
        o.customer_name.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Date filter
    const now = new Date();
    if (dateFilter === 'today') {
      filtered = filtered.filter(o => 
        new Date(o.created_at).toDateString() === now.toDateString()
      );
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      filtered = filtered.filter(o => new Date(o.created_at) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      filtered = filtered.filter(o => new Date(o.created_at) >= monthAgo);
    }

    return filtered;
  };

  const filteredOrders = filterOrders();
  const completedOrders = filteredOrders.filter(o => o.status === 'delivered').length;
  const totalEarnings = filteredOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + o.vendor_earnings, 0);

  const exportToCSV = async () => {
    const headers = ['Order ID', 'Customer', 'Items', 'Total', 'Your Earnings', 'Status', 'Payment', 'Date'];
    const csvData = filteredOrders.map(o => [
      o.order_number,
      o.customer_name,
      o.items_count,
      o.total,
      o.vendor_earnings,
      o.status,
      o.payment_method,
      new Date(o.created_at).toLocaleDateString()
    ]);
    
    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    
    await Share.share({
      title: 'Order History Export',
      message: csv,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return '#10b981';
      case 'cancelled': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'rgba(16,185,129,0.1)';
      case 'cancelled': return 'rgba(239,68,68,0.1)';
      case 'pending': return 'rgba(245,158,11,0.1)';
      default: return 'rgba(59,130,246,0.1)';
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
        {onTabChange && (
          <TouchableOpacity
            onPress={() => onTabChange('analytics')}
            style={styles.analyticsButton}
          >
            <Feather name="bar-chart-2" size={20} color="#f97316" />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={['#f97316', '#f43f5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Total Orders</Text>
          <Text style={styles.statValue}>{filteredOrders.length}</Text>
        </LinearGradient>
        <LinearGradient
          colors={['#10b981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statValue}>{completedOrders}</Text>
        </LinearGradient>
        <LinearGradient
          colors={['#3b82f6', '#2563eb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Your Earnings</Text>
          <Text style={styles.statValue}>₦{totalEarnings.toLocaleString()}</Text>
        </LinearGradient>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search orders..."
            placeholderTextColor="#666"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={styles.filterButton}
        >
          <Feather name="filter" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterChips}>
              {['all', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setStatusFilter(status)}
                  style={[
                    styles.filterChip,
                    statusFilter === status && styles.filterChipActive,
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    statusFilter === status && styles.filterChipTextActive,
                  ]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.dateFilters}>
            {[
              { value: 'all', label: 'All Time' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setDateFilter(option.value as typeof dateFilter)}
                style={[
                  styles.dateFilterButton,
                  dateFilter === option.value && styles.dateFilterButtonActive,
                ]}
              >
                <Text style={[
                  styles.dateFilterText,
                  dateFilter === option.value && styles.dateFilterTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={exportToCSV} style={styles.exportButton}>
            <Feather name="download" size={16} color="#f97316" />
            <Text style={styles.exportButtonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredOrders.length} of {orders.length} orders
        </Text>
        {(searchQuery || statusFilter !== 'all' || dateFilter !== 'all') && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setDateFilter('all');
            }}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Orders List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => navigation.navigate('VendorOrderDetails', { orderId: order.id })}
            >
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                  <View style={styles.customerInfoRow}>
                    <Feather name="user" size={12} color="#f97316" />
                    <Text style={styles.orderCustomer}>{order.customer_name}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(order.status) }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                    {order.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.addressContainer}>
                <Feather name="map-pin" size={12} color="#666" />
                <Text style={styles.addressText} numberOfLines={2}>
                  {order.customer_address}
                </Text>
              </View>

              <View style={styles.orderFooter}>
                <View style={styles.itemsInfo}>
                  <Feather name="package" size={12} color="#666" />
                  <Text style={styles.itemsText}>{order.items_count} items</Text>
                  <Text style={styles.paymentMethod}>• {order.payment_method}</Text>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={styles.amount}>₦{order.total.toLocaleString()}</Text>
                  {order.status === 'delivered' && (
                    <Text style={styles.earnings}>You get: ₦{order.vendor_earnings.toLocaleString()}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="package" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters</Text>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  analyticsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: '#f97316',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  dateFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  dateFilterButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
  },
  dateFilterButtonActive: {
    backgroundColor: '#f97316',
  },
  dateFilterText: {
    fontSize: 12,
    color: '#666',
  },
  dateFilterTextActive: {
    color: '#fff',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  exportButtonText: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500',
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
  },
  clearText: {
    fontSize: 12,
    color: '#f97316',
  },
  content: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  orderCustomer: {
    fontSize: 12,
    color: '#666',
  },
  customerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  itemsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemsText: {
    fontSize: 11,
    color: '#666',
  },
  paymentMethod: {
    fontSize: 11,
    color: '#666',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  earnings: {
    fontSize: 10,
    color: '#f97316',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
});