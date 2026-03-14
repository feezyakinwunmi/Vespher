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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type AdminLogisticsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type OrderType = 'food' | 'business' | 'all';
type FilterPeriod = 'week' | 'month' | 'year' | 'all';

interface CombinedOrder {
  id: string;
  order_number?: string;
  request_number?: string;
  type: 'food' | 'business';
  status: string;
  payment_status?: string;
  total?: number;
  calculated_fee?: number;
  created_at: string;
  customer_name?: string;
  business_name?: string;
  vendor_name?: string;
  pickup_address?: string;
  delivery_address?: string;
  items?: any[];
  package_name?: string;
  firstItem?: any;
  itemCount?: number;
}

export function AdminAllOrdersScreen() {
  const navigation = useNavigation<AdminLogisticsScreenNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<CombinedOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<CombinedOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [vendorSearch, setVendorSearch] = useState('');

  useEffect(() => {
    fetchAllOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, orderType, selectedPeriod, selectedStatus, vendorSearch]);

  const fetchAllOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch food orders
      const { data: foodOrders, error: foodError } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customer_id(name, email),
          vendor:vendors(name),
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (foodError) throw foodError;

      // Fetch business logistics orders
      const { data: businessOrders, error: businessError } = await supabase
        .from('business_logistics_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (businessError) throw businessError;

      // Format food orders
      const formattedFoodOrders = (foodOrders || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        type: 'food' as const,
        status: order.status,
        payment_status: order.payment_status,
        total: order.total,
        created_at: order.created_at,
        customer_name: order.customer?.name || 'N/A',
        vendor_name: order.vendor?.name || 'N/A',
        delivery_address: order.delivery_address?.street,
        items: order.items,
        firstItem: order.items?.[0],
        itemCount: order.items?.length || 0,
      }));

      // Format business orders
      const formattedBusinessOrders = (businessOrders || []).map(order => ({
        id: order.id,
        request_number: order.request_number,
        type: 'business' as const,
        status: order.status,
        payment_status: order.payment_status,
        calculated_fee: order.calculated_fee,
        created_at: order.created_at,
        business_name: order.business_name,
        customer_name: order.delivery_contact_name,
        pickup_address: order.pickup_address,
        delivery_address: order.delivery_address,
        package_name: order.package_name,
      }));

      // Combine and sort by date (newest first)
      const combined = [...formattedFoodOrders, ...formattedBusinessOrders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(combined);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load orders',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllOrders();
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Filter by order type
    if (orderType !== 'all') {
      filtered = filtered.filter(o => o.type === orderType);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(o => o.status === selectedStatus);
    }

    // Filter by period
    if (selectedPeriod !== 'all') {
      const now = new Date();
      const periodMap = {
        week: 7,
        month: 30,
        year: 365,
      };
      
      const daysAgo = periodMap[selectedPeriod];
      const cutoffDate = new Date(now.setDate(now.getDate() - daysAgo));
      filtered = filtered.filter(o => new Date(o.created_at) >= cutoffDate);
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(o => 
        (o.order_number?.toLowerCase().includes(query)) ||
        (o.request_number?.toLowerCase().includes(query)) ||
        (o.customer_name?.toLowerCase().includes(query)) ||
        (o.business_name?.toLowerCase().includes(query)) ||
        (o.vendor_name?.toLowerCase().includes(query)) ||
        (o.package_name?.toLowerCase().includes(query))
      );
    }

    // Apply vendor search
    if (vendorSearch) {
      const query = vendorSearch.toLowerCase().trim();
      filtered = filtered.filter(o => 
        (o.vendor_name?.toLowerCase().includes(query)) ||
        (o.business_name?.toLowerCase().includes(query))
      );
    }

    setFilteredOrders(filtered);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      accepted: '#3b82f6',
      confirmed: '#3b82f6',
      preparing: '#f97316',
      ready: '#10b981',
      paid: '#8b5cf6',
      assigned: '#10b981',
      picked_up: '#f97316',
      in_transit: '#f97316',
      delivered: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#666';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOrderPress = (order: CombinedOrder) => {
    if (order.type === 'food') {
      navigation.navigate('AdminOrderDetails', { orderId: order.id });
    } else {
      navigation.navigate('AdminBusinessRequests');
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#f97316', '#f43f5e']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Orders</Text>
        <TouchableOpacity onPress={fetchAllOrders} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by order #, customer, business..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={18} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filters Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        <View style={styles.filters}>
          {/* Order Type Filter */}
          <TouchableOpacity
            style={[styles.filterChip, orderType === 'all' && styles.filterChipActive]}
            onPress={() => setOrderType('all')}
          >
            <Text style={[styles.filterChipText, orderType === 'all' && styles.filterChipTextActive]}>
              All Orders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, orderType === 'food' && styles.filterChipActive]}
            onPress={() => setOrderType('food')}
          >
            <Feather name="coffee" size={14} color={orderType === 'food' ? '#f97316' : '#666'} />
            <Text style={[styles.filterChipText, orderType === 'food' && styles.filterChipTextActive]}>
              Food
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, orderType === 'business' && styles.filterChipActive]}
            onPress={() => setOrderType('business')}
          >
            <Feather name="package" size={14} color={orderType === 'business' ? '#f97316' : '#666'} />
            <Text style={[styles.filterChipText, orderType === 'business' && styles.filterChipTextActive]}>
              Business
            </Text>
          </TouchableOpacity>

          {/* Period Filters */}
          <TouchableOpacity
            style={[styles.filterChip, selectedPeriod === 'week' && styles.filterChipActive]}
            onPress={() => setSelectedPeriod('week')}
          >
            <Text style={[styles.filterChipText, selectedPeriod === 'week' && styles.filterChipTextActive]}>
              This Week
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedPeriod === 'month' && styles.filterChipActive]}
            onPress={() => setSelectedPeriod('month')}
          >
            <Text style={[styles.filterChipText, selectedPeriod === 'month' && styles.filterChipTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedPeriod === 'year' && styles.filterChipActive]}
            onPress={() => setSelectedPeriod('year')}
          >
            <Text style={[styles.filterChipText, selectedPeriod === 'year' && styles.filterChipTextActive]}>
              This Year
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Status Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
        <View style={styles.filters}>
          {['all', 'pending', 'accepted', 'paid', 'assigned', 'delivered'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusChip,
                selectedStatus === status && styles.statusChipActive,
                selectedStatus === status && { borderColor: getStatusColor(status) }
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              {status !== 'all' && (
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
              )}
              <Text style={[
                styles.statusChipText,
                selectedStatus === status && { color: getStatusColor(status) }
              ]}>
                {status === 'all' ? 'All Status' : status.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredOrders.length} of {orders.length} orders
        </Text>
      </View>

      {/* Orders List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="package" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters</Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => handleOrderPress(order)}
              activeOpacity={0.7}
            >
              {/* Order Type Badge */}
              <View style={[
                styles.typeBadge,
                { backgroundColor: order.type === 'food' ? '#f97316' : '#8b5cf6' }
              ]}>
                <Feather 
                  name={order.type === 'food' ? 'coffee' : 'package'} 
                  size={10} 
                  color="#fff" 
                />
                <Text style={styles.typeBadgeText}>
                  {order.type === 'food' ? 'FOOD' : 'BUSINESS'}
                </Text>
              </View>

              {/* Order Header */}
              <View style={styles.orderHeader}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNumber}>
                    {order.type === 'food' 
                      ? `#${order.order_number || order.id.slice(0, 8)}`
                      : `#${order.request_number || order.id.slice(0, 8)}`}
                  </Text>
                  <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(order.status) + '20' }
                ]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                    {order.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Order Details */}
              <View style={styles.orderDetails}>
                {order.type === 'food' ? (
                  // Food Order Details
                  <>
                    <View style={styles.detailRow}>
                      <Feather name="user" size={12} color="#666" />
                      <Text style={styles.detailText}>Customer: {order.customer_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="home" size={12} color="#666" />
                      <Text style={styles.detailText}>Vendor: {order.vendor_name}</Text>
                    </View>
                    {order.firstItem && (
                      <View style={styles.itemPreview}>
                        <Feather name="package" size={12} color="#f97316" />
                        <Text style={styles.itemText} numberOfLines={1}>
                          {order.firstItem.quantity}x {order.firstItem.name}
                        </Text>
                        {order.itemCount && order.itemCount > 1 && (
                          <Text style={styles.moreItems}>+{order.itemCount - 1}</Text>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  // Business Order Details
                  <>
                    <View style={styles.detailRow}>
                      <Feather name="briefcase" size={12} color="#666" />
                      <Text style={styles.detailText}>Business: {order.business_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="package" size={12} color="#666" />
                      <Text style={styles.detailText}>Package: {order.package_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="map-pin" size={12} color="#10b981" />
                      <Text style={styles.detailText} numberOfLines={1}>
                        From: {order.pickup_address}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="flag" size={12} color="#f97316" />
                      <Text style={styles.detailText} numberOfLines={1}>
                        To: {order.delivery_address}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Order Footer */}
              <View style={styles.orderFooter}>
                <View style={styles.paymentStatus}>
                  {order.payment_status && (
                    <>
                      <Feather 
                        name={order.payment_status === 'paid' ? 'check-circle' : 'clock'} 
                        size={12} 
                        color={order.payment_status === 'paid' ? '#10b981' : '#f59e0b'} 
                      />
                      <Text style={[
                        styles.paymentText,
                        { color: order.payment_status === 'paid' ? '#10b981' : '#f59e0b' }
                      ]}>
                        {order.payment_status.toUpperCase()}
                      </Text>
                    </>
                  )}
                </View>
                <Text style={styles.orderAmount}>
                  ₦{(order.total || order.calculated_fee || 0).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
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
        paddingBottom:25,

  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
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
  filtersContainer: {
    maxHeight: 50,
    marginBottom: 8,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#f97316',
  },
  statusFilters: {
    maxHeight: 50,
    marginBottom: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 4,
  },
  statusChipActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  statusChipText: {
    fontSize: 12,
    color: '#666',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resultsContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    zIndex: 1,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 10,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  itemText: {
    fontSize: 12,
    color: '#f97316',
    flex: 1,
  },
  moreItems: {
    fontSize: 10,
    color: '#666',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentText: {
    fontSize: 10,
    fontWeight: '500',
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f97316',
  },
  bottomPadding: {
    height: 20,
  },
});