// app/screens/admin/AdminDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdmin } from '../../hooks/admin/useAdmin';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';

type AdminLogisticsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface DashboardFinancials {
  totalRevenue: number;
  platformFees: number;
  totalFoodRevenue: number;
  totalBusinessRevenue: number;
  totalFoodDeliveryFees: number;
  totalBusinessPlatformShare: number;
  totalRiderEarnings: number;
}

export function AdminDashboardScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const navigation = useNavigation<AdminLogisticsScreenNavigationProp>();
  
  // State for business request stats
  const [businessRequestStats, setBusinessRequestStats] = useState({
    pending: 0,
    accepted: 0,
    paid: 0,
    assigned: 0,
    total: 0
  });
  const [loadingBusinessStats, setLoadingBusinessStats] = useState(true);
  
  // State for real financial data
  const [financials, setFinancials] = useState<DashboardFinancials>({
    totalRevenue: 0,
    platformFees: 0,
    totalFoodRevenue: 0,
    totalBusinessRevenue: 0,
    totalFoodDeliveryFees: 0,
    totalBusinessPlatformShare: 0,
    totalRiderEarnings: 0,
  });
  const [loadingFinancials, setLoadingFinancials] = useState(true);

  const { 
    isLoading, 
    stats, 
    pendingVendors, 
    withdrawalRequests,
    refresh 
  } = useAdmin();

  // Fetch business request stats
  const fetchBusinessRequestStats = async () => {
    try {
      const { data, error } = await supabase
        .from('business_logistics')
        .select('status');

      if (error) throw error;

      const stats = {
        pending: data.filter(r => r.status === 'pending').length,
        accepted: data.filter(r => r.status === 'accepted').length,
        paid: data.filter(r => r.status === 'paid').length,
        assigned: data.filter(r => ['assigned', 'picked_up', 'in_transit'].includes(r.status)).length,
        total: data.length
      };
      
      setBusinessRequestStats(stats);
    } catch (error) {
      console.error('Error fetching business request stats:', error);
    } finally {
      setLoadingBusinessStats(false);
    }
  };

  // Fetch real financial data (same calculation as analytics)
  const fetchFinancialData = async () => {
    setLoadingFinancials(true);
    try {
      // Fetch food orders (delivered)
      const { data: foodOrders, error: foodError } = await supabase
        .from('orders')
        .select('total, delivery_fee, service_fee, status')
        .in('status', ['delivered']);

      if (foodError) throw foodError;

      // Fetch business orders (paid)
      const { data: businessOrders, error: businessError } = await supabase
        .from('business_logistics_view')
        .select('calculated_fee, platform_share, rider_share, payment_status')
        .eq('payment_status', 'paid');

      if (businessError) throw businessError;

      // Calculate food metrics
      const totalFoodRevenue = foodOrders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      const totalFoodDeliveryFees = foodOrders?.reduce((sum, order) => sum + (order.delivery_fee || 0), 0) || 0;
      const foodPlatformFees = totalFoodDeliveryFees * 0.5;

      // Calculate business metrics
      const totalBusinessRevenue = businessOrders?.reduce((sum, order) => {
        const fee = typeof order.calculated_fee === 'string' 
          ? parseFloat(order.calculated_fee) 
          : (order.calculated_fee || 0);
        return sum + fee;
      }, 0) || 0;

      const totalBusinessPlatformShare = businessOrders?.reduce((sum, order) => {
        if (order.platform_share) {
          const share = typeof order.platform_share === 'string' 
            ? parseFloat(order.platform_share) 
            : order.platform_share;
          return sum + share;
        }
        return sum;
      }, 0) || 0;

      const totalBusinessRiderShare = businessOrders?.reduce((sum, order) => {
        if (order.rider_share) {
          const share = typeof order.rider_share === 'string' 
            ? parseFloat(order.rider_share) 
            : order.rider_share;
          return sum + share;
        }
        return sum;
      }, 0) || 0;

      // Calculate totals
      const totalRevenue = totalFoodRevenue + totalBusinessRevenue;
      const totalPlatformFees = foodPlatformFees + totalBusinessPlatformShare;
      const totalRiderEarnings = (totalFoodDeliveryFees * 0.5) + totalBusinessRiderShare;

      setFinancials({
        totalRevenue,
        platformFees: totalPlatformFees,
        totalFoodRevenue,
        totalBusinessRevenue,
        totalFoodDeliveryFees,
        totalBusinessPlatformShare,
        totalRiderEarnings,
      });

      console.log('📊 Dashboard Financials:', {
        totalRevenue,
        platformFees: totalPlatformFees,
        totalFoodRevenue,
        totalBusinessRevenue,
        totalFoodDeliveryFees,
        totalBusinessPlatformShare,
        totalRiderEarnings,
      });

    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoadingFinancials(false);
    }
  };

  useEffect(() => {
    fetchBusinessRequestStats();
    fetchFinancialData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    await fetchBusinessRequestStats();
    await fetchFinancialData();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading admin dashboard...</Text>
      </View>
    );
  }

  const pendingCounts = {
    vendors: pendingVendors?.length || 0,
    withdrawals: withdrawalRequests?.filter(w => w?.status === 'pending').length || 0,
    menu: stats?.pendingMenu || 0,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#f97316',
      ready: '#10b981',
      delivered: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#666';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('NGN', '₦');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        {/* Header - Only title, no tabs */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
          }
        >
          {/* Stats Grid - Updated with real data */}
          <View style={styles.statsGrid}>
            {/* Total Users Card */}
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              style={styles.statCard}
            >
              <View style={styles.statIconContainer}>
                <Feather name="users" size={24} color="#fff" />
              </View>
              <Text style={styles.statNumber}>{stats?.totalUsers || 0}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </LinearGradient>

            {/* Total Orders Card */}
            <View style={styles.statCardSecondary}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                <Feather name="shopping-bag" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.statNumberSecondary}>{stats?.totalOrders || 0}</Text>
              <Text style={styles.statLabelSecondary}>Orders</Text>
            </View>

            {/* Total Revenue Card - REAL DATA */}
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={[styles.statCard, { width: '47%' }]}
            >
              <View style={styles.statIconContainer}>
                <Feather name="dollar-sign" size={24} color="#fff" />
              </View>
              <Text style={styles.statNumber}>
                {loadingFinancials ? '...' : formatCurrency(financials.totalRevenue).replace('₦', '')}
              </Text>
              <Text style={styles.statLabel}>Total Revenue</Text>
              {!loadingFinancials && (
                <View style={styles.metricBreakdown}>
                  <Text style={styles.metricBreakdownText}>🍔 {formatCurrency(financials.totalFoodRevenue).replace('₦', '')}</Text>
                  <Text style={styles.metricBreakdownText}>📦 {formatCurrency(financials.totalBusinessRevenue).replace('₦', '')}</Text>
                </View>
              )}
            </LinearGradient>

            {/* Platform Fees Card - REAL DATA */}
            <LinearGradient
              colors={['#8b5cf6', '#7c3aed']}
              style={[styles.statCard, { width: '47%' }]}
            >
              <View style={styles.statIconContainer}>
                <Feather name="percent" size={24} color="#fff" />
              </View>
              <Text style={styles.statNumber}>
                {loadingFinancials ? '...' : formatCurrency(financials.platformFees).replace('₦', '')}
              </Text>
              <Text style={styles.statLabel}>Platform Income </Text>
              {!loadingFinancials && (
                <View style={styles.metricBreakdown}>
                  <Text style={styles.metricBreakdownText}>🍔 {formatCurrency(financials.totalFoodDeliveryFees * 0.5).replace('₦', '')}</Text>
                  <Text style={styles.metricBreakdownText}>📦 {formatCurrency(financials.totalBusinessPlatformShare).replace('₦', '')}</Text>
                </View>
              )}
            </LinearGradient>
          </View>

          {/* Analytics Dashboard Button */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => navigation.navigate('AdminAnalytics')}
          >
            <LinearGradient
              colors={['#8b5cf6', '#f97316']}
              style={styles.menuIcon}
            >
              <Feather name="trending-up" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Analytics Dashboard</Text>
              <Text style={styles.menuDescription}>
                View charts, top vendors, and performance metrics
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#666" />
          </TouchableOpacity>

          {/* Business Requests Card with Status Dots */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => navigation.navigate('AdminBusinessRequests')}
          >
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              style={styles.menuIcon}
            >
              <Feather name="package" size={24} color="#fff" />
            </LinearGradient>
            
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Business Requests</Text>
              <Text style={styles.menuDescription}>
                Manage logistics requests from businesses
              </Text>
              
              {/* Status Dots and Counts */}
              {!loadingBusinessStats && (
                <View style={styles.statusContainer}>
                  <View style={styles.statusItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
                    <Text style={styles.statusCount}>{businessRequestStats.pending}</Text>
                  </View>
                  
                  <View style={styles.statusItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={styles.statusCount}>{businessRequestStats.accepted}</Text>
                  </View>
                  
                  <View style={styles.statusItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#8b5cf6' }]} />
                    <Text style={styles.statusCount}>{businessRequestStats.paid}</Text>
                  </View>
                  
                  <View style={styles.statusItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                    <Text style={styles.statusCount}>{businessRequestStats.assigned}</Text>
                  </View>
                  
                  <View style={styles.statusDivider} />
                  
                  <View style={styles.statusItem}>
                    <Feather name="package" size={12} color="#f97316" />
                    <Text style={styles.statusTotal}>{businessRequestStats.total}</Text>
                  </View>
                </View>
              )}
              
              {loadingBusinessStats && (
                <ActivityIndicator size="small" color="#666" style={styles.statusLoader} />
              )}
            </View>
            
            <Feather name="chevron-right" size={20} color="#666" />
          </TouchableOpacity>

          {/* Quick Action Cards */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('AdminVendors')}
            >
              <View style={styles.quickActionIcon}>
                <Feather name="users" size={24} color="#f97316" />
                {pendingCounts.vendors > 0 && (
                  <View style={styles.quickActionBadge}>
                    <Text style={styles.quickActionBadgeText}>{pendingCounts.vendors}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickActionTitle}>Pending Vendors</Text>
              <Text style={styles.quickActionValue}>{pendingCounts.vendors} awaiting approval</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('AdminWithdrawals')}
            >
              <View style={styles.quickActionIcon}>
                <Feather name="credit-card" size={24} color="#10b981" />
                {pendingCounts.withdrawals > 0 && (
                  <View style={styles.quickActionBadge}>
                    <Text style={styles.quickActionBadgeText}>{pendingCounts.withdrawals}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickActionTitle}>Withdrawals</Text>
              <Text style={styles.quickActionValue}>{pendingCounts.withdrawals} pending requests</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('AdminMenu')}
            >
              <View style={styles.quickActionIcon}>
                <Feather name="coffee" size={24} color="#8b5cf6" />
                {pendingCounts.menu > 0 && (
                  <View style={styles.quickActionBadge}>
                    <Text style={styles.quickActionBadgeText}>{pendingCounts.menu}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickActionTitle}>Pending Menu</Text>
              <Text style={styles.quickActionValue}>{pendingCounts.menu} items to review</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('AdminUsers')}
            >
              <View style={styles.quickActionIcon}>
                <Feather name="user-plus" size={24} color="#f43f5e" />
              </View>
              <Text style={styles.quickActionTitle}>New Users</Text>
              <Text style={styles.quickActionValue}>Manage users</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Orders - Limited to 3 with View All button */}
          {stats?.recentOrders && stats.recentOrders.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate('AdminAllOrders')}
                >
                  <Text style={styles.viewAllText}>View All</Text>
                  <Feather name="arrow-right" size={16} color="#f97316" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.recentOrders}>
                {stats.recentOrders.slice(0, 3).map((order) => {
                  const firstItem = order.firstItem;
                  const itemCount = order.itemCount || 0;
                  
                  return (
                    <TouchableOpacity 
                      key={order.id} 
                      style={styles.recentOrderCard}
                      onPress={() => navigation.navigate('AdminOrderDetails', { orderId: order.id })}
                      activeOpacity={0.7}
                    >
                      {/* Order Image */}
                      <View style={styles.recentOrderImageContainer}>
                        {firstItem && firstItem.product?.image ? (
                          <Image 
                            source={{ uri: firstItem.product.image }} 
                            style={styles.recentOrderImage}
                            onError={() => console.log('Image failed to load')}
                          />
                        ) : (
                          <View style={styles.recentOrderImagePlaceholder}>
                            <Feather name="image" size={20} color="#666" />
                          </View>
                        )}
                      </View>

                      {/* Order Details */}
                      <View style={styles.recentOrderContent}>
                        <View style={styles.recentOrderHeader}>
                          <Text style={styles.recentOrderNumber}>
                            #{order.order_number || order.id.slice(0, 8)}
                          </Text>
                          <View style={[
                            styles.recentOrderStatusBadge,
                            { backgroundColor: getStatusColor(order.status) + '20' }
                          ]}>
                            <Text style={[styles.recentOrderStatusText, { color: getStatusColor(order.status) }]}>
                              {order.status}
                            </Text>
                          </View>
                        </View>

                        {/* First Item Preview */}
                        {firstItem && (
                          <View style={styles.recentOrderItemPreview}>
                            <Feather name="package" size={12} color="#f97316" />
                            <Text style={styles.recentOrderItemName} numberOfLines={1}>
                              {firstItem.quantity}x {firstItem.name}
                            </Text>
                            {itemCount > 1 && (
                              <Text style={styles.recentOrderMoreItems}>
                                +{itemCount - 1}
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Customer & Vendor */}
                        <View style={styles.recentOrderDetails}>
                          <View style={styles.recentOrderDetailRow}>
                            <Feather name="user" size={10} color="#666" />
                            <Text style={styles.recentOrderCustomer} numberOfLines={1}>
                              {order.customer?.name || 'N/A'}
                            </Text>
                          </View>
                          <View style={styles.recentOrderDetailRow}>
                            <Feather name="home" size={10} color="#666" />
                            <Text style={styles.recentOrderVendor} numberOfLines={1}>
                              {order.vendor?.name || 'N/A'}
                            </Text>
                          </View>
                        </View>

                        {/* Total Amount */}
                        <Text style={styles.recentOrderTotal}>
                          ₦{order.total?.toLocaleString() || 0}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Recent Vendors */}
          {pendingVendors.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent Vendor Applications</Text>
              <View style={styles.recentVendors}>
                {pendingVendors.slice(0, 2).map((vendor) => (
                  <TouchableOpacity
                    key={vendor.id}
                    style={styles.recentVendorCard}
                    onPress={() => navigation.navigate('AdminVendors')}
                  >
                    <View style={styles.recentVendorHeader}>
                      <View>
                        <Text style={styles.recentVendorName}>{vendor.name}</Text>
                        <Text style={styles.recentVendorEmail}>{vendor.owner?.email}</Text>
                      </View>
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    </View>
                    <Text style={styles.recentVendorDetail}>{vendor.category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Add these new styles to your existing StyleSheet
const styles = StyleSheet.create({
  // ... keep all your existing styles
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
    marginBottom: 8,
  },
  statCard: {
    width: '47%',
    padding: 20,
    borderRadius: 16,
    marginBottom: 8,
  },
  statCardSecondary: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  metricBreakdown: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  metricBreakdownText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewAllText: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500',
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  statusDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  statusTotal: {
    fontSize: 11,
    color: '#f97316',
    fontWeight: '600',
    marginLeft: 2,
  },
  statusLoader: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  statNumberSecondary: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabelSecondary: {
    fontSize: 12,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quickActionIcon: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  quickActionValue: {
    fontSize: 11,
    color: '#666',
  },
  recentOrders: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  recentOrderCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  recentOrderImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  recentOrderImage: {
    width: '100%',
    height: '100%',
  },
  recentOrderImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentOrderContent: {
    flex: 1,
  },
  recentOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentOrderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  recentOrderStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recentOrderStatusText: {
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  recentOrderItemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  recentOrderItemName: {
    fontSize: 11,
    color: '#f97316',
    flex: 1,
  },
  recentOrderMoreItems: {
    fontSize: 9,
    color: '#666',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recentOrderDetails: {
    marginBottom: 4,
    gap: 2,
  },
  recentOrderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentOrderCustomer: {
    fontSize: 10,
    color: '#666',
  },
  recentOrderVendor: {
    fontSize: 10,
    color: '#666',
  },
  recentOrderTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f97316',
  },
  recentVendors: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  recentVendorCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  recentVendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recentVendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  recentVendorEmail: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pendingBadgeText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '600',
  },
  recentVendorDetail: {
    fontSize: 11,
    color: '#f97316',
  },
});