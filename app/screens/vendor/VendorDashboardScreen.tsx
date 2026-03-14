// app/screens/vendor/VendorDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VendorLayout, VendorTab } from '../../components/vendor/VendorLayout';
import { useVendorOrders } from '../../hooks/vendor/useVendorOrders';
import { useVendorMenu } from '../../hooks/vendor/useVendorMenu';
import { useVendorStats } from '../../hooks/vendor/useVendorStats';
import { Image } from 'react-native'; // Add this import
import { useNavigation } from '@react-navigation/native';


const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

export function VendorDashboardScreen() {
  const [activeTab, setActiveTab] = useState<VendorTab>('overview');
  const [refreshing, setRefreshing] = useState(false);
const navigation = useNavigation();

  const { 
    orders, 
    ordersByStatus, 
    isLoading: ordersLoading, 
    error: ordersError,
    refreshOrders 
  } = useVendorOrders();
  
  const { 
    refreshMenu 
  } = useVendorMenu();
  
  const { 
    stats, 
    isLoading: statsLoading,
    refreshStats 
  } = useVendorStats();

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  const refreshData = async () => {
    if (activeTab === 'orders') {
      await refreshOrders();
    } else if (activeTab === 'overview') {
      await refreshStats();
    } else if (activeTab === 'menu') {
      await refreshMenu();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
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

  const getStatusBgColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'rgba(245,158,11,0.1)',
      confirmed: 'rgba(59,130,246,0.1)',
      preparing: 'rgba(249,115,22,0.1)',
      ready: 'rgba(16,185,129,0.1)',
      delivered: 'rgba(16,185,129,0.1)',
      cancelled: 'rgba(239,68,68,0.1)',
    };
    return colors[status] || 'rgba(255,255,255,0.05)';
  };

  // In VendorDashboardScreen.tsx, update the renderOverview function:

const renderOverview = () => (
  <ScrollView
    showsVerticalScrollIndicator={false}
    refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
    }
  >
    {/* Welcome Section */}
    <View style={styles.welcomeSection}>
      <View>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.vendorName}>Vendor Name</Text>
      </View>
      <View style={styles.dateBadge}>
        <Feather name="calendar" size={14} color="#f97316" />
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          })}
        </Text>
      </View>
    </View>

    {/* Main Stats Card */}
    <LinearGradient
      colors={['#f97316', '#f43f5e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.mainStatCard}
    >
      <View style={styles.mainStatContent}>
        <View>
          <Text style={styles.mainStatLabel}>Today's Revenue</Text>
          <Text style={styles.mainStatValue}>
            ₦{stats?.todaySales?.toLocaleString() || '0'}
          </Text>
        </View>
        <View style={styles.mainStatIcon}>
          <Feather name="trending-up" size={32} color="rgba(255,255,255,0.3)" />
        </View>
      </View>
      <View style={styles.mainStatFooter}>
        <View style={styles.mainStatFooterItem}>
          <Feather name="package" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.mainStatFooterText}>
            {stats?.todayOrders || 0} orders today
          </Text>
        </View>
        <View style={styles.mainStatFooterItem}>
          <Feather name="clock" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.mainStatFooterText}>
            {stats?.averagePrepTime || 0}min avg
          </Text>
        </View>
      </View>
    </LinearGradient>

    {/* Stats Grid */}
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
          <Feather name="shopping-bag" size={20} color="#3b82f6" />
        </View>
        <Text style={styles.statNumber}>{stats?.totalOrders || 0}</Text>
        <Text style={styles.statLabel}>Total Orders</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
          <Feather name="dollar-sign" size={20} color="#10b981" />
        </View>
        <Text style={styles.statNumber}>₦{stats?.totalVendorEarnings?.toLocaleString() || 0}</Text>
        <Text style={styles.statLabel}>Total Revenue</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
          <Feather name="star" size={20} color="#f97316" />
        </View>
        <Text style={styles.statNumber}>{stats?.averageRating?.toFixed(1) || '0.0'}</Text>
        <Text style={styles.statLabel}>Rating</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
          <Feather name="message-circle" size={20} color="#8b5cf6" />
        </View>
        <Text style={styles.statNumber}>{stats?.reviewCount || 0}</Text>
        <Text style={styles.statLabel}>Reviews</Text>
      </View>
    </View>

    {/* Order Status Summary */}
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Order Status</Text>
        <TouchableOpacity onPress={() => setActiveTab('orders')}>
          <Text style={styles.seeAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusGrid}>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.statusLabel}>Pending</Text>
          <Text style={styles.statusCount}>{ordersByStatus.pending.length}</Text>
        </View>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.statusLabel}>Confirmed</Text>
          <Text style={styles.statusCount}>{ordersByStatus.confirmed.length}</Text>
        </View>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#f97316' }]} />
          <Text style={styles.statusLabel}>Preparing</Text>
          <Text style={styles.statusCount}>{ordersByStatus.preparing.length}</Text>
        </View>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.statusLabel}>Ready</Text>
          <Text style={styles.statusCount}>{ordersByStatus.ready.length}</Text>
        </View>
      </View>
    </View>

    {/* Recent Orders - Updated with images */}
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        <TouchableOpacity onPress={() => navigation.navigate('VendorOrders' as never)}>
  <Text style={styles.seeAllText}>See All</Text>
</TouchableOpacity>
      </View>

      {ordersLoading ? (
        <ActivityIndicator size="small" color="#f97316" style={styles.loader} />
      ) : orders.slice(0, 3).length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="package" size={32} color="#666" />
          <Text style={styles.emptyStateText}>No orders yet</Text>
        </View>
      ) : (
        orders.slice(0, 3).map((order) => {
          const firstItem = order.items?.[0];
          const itemImage = firstItem?.product?.image || firstItem?.image_url;
          
          return (
            <TouchableOpacity 
              key={order.id} 
              style={styles.recentOrderCard}
onPress={() => (navigation as any).navigate('VendorOrders', { orderId: order.id })}
            >
              {/* Order Image */}
              <View style={styles.recentOrderImageContainer}>
                {itemImage ? (
                  <Image 
                    source={{ uri: itemImage }} 
                    style={styles.recentOrderImage}
                  />
                ) : (
                  <View style={styles.recentOrderImagePlaceholder}>
                    <Feather name="package" size={20} color="#f97316" />
                  </View>
                )}
              </View>

              {/* Order Details */}
              <View style={styles.recentOrderDetails}>
                <View style={styles.recentOrderHeader}>
                  <Text style={styles.recentOrderId}>#{order.order_number}</Text>
                  <View style={[styles.recentOrderBadge, { backgroundColor: getStatusBgColor(order.status) }]}>
                    <Text style={[styles.recentOrderBadgeText, { color: getStatusColor(order.status) }]}>
                      {order.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.recentOrderCustomer}>{order.customer_name}</Text>
                
                <View style={styles.recentOrderItems}>
                  {order.items.slice(0, 2).map((item: any, idx: number) => (
                    <Text key={idx} style={styles.recentOrderItem} numberOfLines={1}>
                      {item.quantity}x {item.name}
                    </Text>
                  ))}
                  {order.items.length > 2 && (
                    <Text style={styles.recentOrderMore}>
                      +{order.items.length - 2} more
                    </Text>
                  )}
                </View>

                <Text style={styles.recentOrderTotal}>₦{order.total.toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>

    {/* Popular Items */}
    {stats?.popularItems && stats.popularItems.length > 0 && (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Items</Text>
        </View>
        {stats.popularItems.map((item, index) => (
          <View key={item.id} style={styles.popularItem}>
            <View style={styles.popularItemLeft}>
              <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#f97316' : '#2a2a2a' }]}>
                <Text style={[styles.rankText, index === 0 && styles.rankTextFirst]}>
                  #{index + 1}
                </Text>
              </View>
              <Text style={styles.popularItemName}>{item.name}</Text>
            </View>
            <Text style={styles.popularItemCount}>{item.count} sold</Text>
          </View>
        ))}
      </View>
    )}

    {/* Quick Actions */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={styles.quickActionCard}
          onPress={() => setActiveTab('menu')}
        >
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickActionGradient}
          >
            <Feather name="plus-circle" size={28} color="#fff" />
            <Text style={styles.quickActionTitle}>Add Product</Text>
            <Text style={styles.quickActionSubtitle}>Add new item to menu</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionCard}
          onPress={() => setActiveTab('orders')}
        >
          <LinearGradient
            colors={['#3b82f6', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickActionGradient}
          >
            <Feather name="package" size={28} color="#fff" />
            <Text style={styles.quickActionTitle}>Manage Orders</Text>
            <Text style={styles.quickActionSubtitle}>View and update orders</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  </ScrollView>
);

  const renderOrders = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Orders</Text>
        {ordersLoading ? (
          <ActivityIndicator size="large" color="#f97316" style={styles.loader} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color="#666" />
            <Text style={styles.emptyStateTitle}>No orders found</Text>
            <Text style={styles.emptyStateSubtitle}>Your orders will appear here</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View>
                  <Text style={styles.orderCardNumber}>#{order.order_number}</Text>
                  <Text style={styles.orderCardTime}>
                    {new Date(order.created_at).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.orderCardBadge, { backgroundColor: getStatusBgColor(order.status) }]}>
                  <Text style={[styles.orderCardBadgeText, { color: getStatusColor(order.status) }]}>
                    {order.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.orderCardCustomer}>
                <Feather name="user" size={14} color="#666" />
                <Text style={styles.orderCardCustomerText}>{order.customer_name}</Text>
              </View>

              <View style={styles.orderCardItems}>
                {order.items.slice(0, 3).map((item: any, idx: number) => (
                  <Text key={idx} style={styles.orderCardItemText}>
                    {item.quantity}x {item.name}
                  </Text>
                ))}
                {order.items.length > 3 && (
                  <Text style={styles.orderCardMoreText}>
                    +{order.items.length - 3} more items
                  </Text>
                )}
              </View>

              <View style={styles.orderCardFooter}>
                <Text style={styles.orderCardTotal}>₦{order.total.toLocaleString()}</Text>
                
                {order.status === 'pending' && (
                  <View style={styles.orderCardActions}>
                    <TouchableOpacity 
                      style={[styles.orderCardAction, styles.rejectAction]}
                      onPress={() => {}}
                    >
                      <Text style={styles.rejectActionText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.orderCardAction, styles.acceptAction]}
                      onPress={() => {}}
                    >
                      <Text style={styles.acceptActionText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'orders':
        return renderOrders();
      case 'menu':
        return (
          <View style={styles.placeholderContainer}>
            <Feather name="coffee" size={48} color="#666" />
            <Text style={styles.placeholderTitle}>Menu Management</Text>
            <Text style={styles.placeholderText}>Coming soon</Text>
          </View>
        );
      case 'earnings':
        return (
          <View style={styles.placeholderContainer}>
            <Feather name="dollar-sign" size={48} color="#666" />
            <Text style={styles.placeholderTitle}>Earnings Overview</Text>
            <Text style={styles.placeholderText}>Coming soon</Text>
          </View>
        );
      case 'history':
        return (
          <View style={styles.placeholderContainer}>
            <Feather name="clock" size={48} color="#666" />
            <Text style={styles.placeholderTitle}>Order History</Text>
            <Text style={styles.placeholderText}>Coming soon</Text>
          </View>
        );
      case 'settings':
        return (
          <View style={styles.placeholderContainer}>
            <Feather name="settings" size={48} color="#666" />
            <Text style={styles.placeholderTitle}>Settings</Text>
            <Text style={styles.placeholderText}>Coming soon</Text>
          </View>
        );
      default:
        return renderOverview();
    }
  };

  return (
    <VendorLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Vendor Dashboard"
    >
      {renderContent()}
    </VendorLayout>
  );
}

const styles = StyleSheet.create({
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  vendorName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#f97316',
  },
  mainStatCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  mainStatContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainStatLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  mainStatValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  mainStatIcon: {
    opacity: 0.5,
  },
  mainStatFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  mainStatFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mainStatFooterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: cardWidth,
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  seeAllText: {
    color: '#f97316',
    fontSize: 14,
  },
  statusGrid: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  statusCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loader: {
    marginTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },

recentOrderCard: {
  flexDirection: 'row',
  backgroundColor: '#1a1a1a',
  borderRadius: 12,
  padding: 12,
  marginBottom: 8,
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
recentOrderDetails: {
  flex: 1,
},
recentOrderHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
},
recentOrderId: {
  fontSize: 12,
  color: '#666',
},
recentOrderBadge: {
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 4,
},
recentOrderBadgeText: {
  fontSize: 9,
  fontWeight: '500',
},
recentOrderCustomer: {
  fontSize: 14,
  fontWeight: '600',
  color: '#fff',
  marginBottom: 4,
},
recentOrderItems: {
  marginBottom: 4,
},
recentOrderItem: {
  fontSize: 11,
  color: '#666',
},
recentOrderMore: {
  fontSize: 10,
  color: '#f97316',
  marginTop: 2,
},
recentOrderTotal: {
  fontSize: 14,
  fontWeight: '600',
  color: '#f97316',
},
  orderItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderItemNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  orderItemCustomer: {
    fontSize: 12,
    color: '#666',
  },
  orderItemRight: {
    alignItems: 'flex-end',
  },
  orderItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 4,
  },
  orderItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderItemBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  popularItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  popularItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  rankTextFirst: {
    color: '#fff',
  },
  popularItemName: {
    fontSize: 14,
    color: '#fff',
  },
  popularItemCount: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  quickActionSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderCardNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  orderCardTime: {
    fontSize: 11,
    color: '#666',
  },
  orderCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  orderCardBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderCardCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  orderCardCustomerText: {
    fontSize: 13,
    color: '#666',
  },
  orderCardItems: {
    marginBottom: 12,
  },
  orderCardItemText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  orderCardMoreText: {
    fontSize: 11,
    color: '#f97316',
    marginTop: 4,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  orderCardTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  orderCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  orderCardAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  acceptAction: {
    backgroundColor: '#10b981',
  },
  acceptActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  rejectAction: {
    backgroundColor: '#ef4444',
  },
  rejectActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
  },
});