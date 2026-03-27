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
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';


const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;
type VendorAddressesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function VendorDashboardScreen() {
  const [activeTab, setActiveTab] = useState<VendorTab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<VendorAddressesScreenNavigationProp>();
const { user } = useAuth();
const [vendorName, setVendorName] = useState('');
// Add this state at the top with other states
const [unreadCount, setUnreadCount] = useState(0);
const [latestMessage, setLatestMessage] = useState<string | null>(null);

// Add this function to fetch unread messages
const fetchUnreadMessages = async () => {
  if (!user?.id) return;
  
  try {
    // Get vendor ID first
    const { data: vendorData } = await supabase
      .from('vendors')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    
    if (!vendorData) return;
    
    // Get conversations where vendor is a participant
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .contains('participants', [vendorData.id]);
    
    if (!conversations || conversations.length === 0) {
      setUnreadCount(0);
      return;
    }
    
    const conversationIds = conversations.map(c => c.id);
    
    // Count unread messages where vendor is not the sender
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .eq('read', false)
      .neq('sender_id', user.id);
    
    if (!error) {
      setUnreadCount(count || 0);
    }
    
    // Get latest message preview
    const { data: latest } = await supabase
      .from('messages')
      .select('content, created_at, sender_name')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (latest && latest.length > 0) {
      const msg = latest[0];
      const preview = msg.content.length > 40 ? msg.content.substring(0, 40) + '...' : msg.content;
      setLatestMessage(`${msg.sender_name}: ${preview}`);
    } else {
      setLatestMessage(null);
    }
    
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
};

// Add useEffect to fetch messages on mount and periodically
useEffect(() => {
  fetchUnreadMessages();
  
  // Set up real-time subscription for new messages
  const subscription = supabase
    .channel('vendor-messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      () => {
        fetchUnreadMessages();
      }
    )
    .subscribe();
  
  return () => {
    subscription.unsubscribe();
  };
}, [user?.id]);
// Add this useEffect after the existing useEffects
useEffect(() => {
  fetchVendorName();
}, [user?.id]);

const fetchVendorName = async () => {
  if (!user?.id) return;
  
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('name')
      .eq('owner_id', user.id)
      .single();
    
    if (!error && data) {
      setVendorName(data.name);
    } else {
      setVendorName('Vendor');
    }
  } catch (error) {
    console.error('Error fetching vendor:', error);
    setVendorName('Vendor');
  }
};

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
  <SafeAreaView style={styles.container}>
  <ScrollView
    showsVerticalScrollIndicator={false}
    refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
    }
  >
   {/* Welcome Section */}
<View style={styles.welcomeSection}>
  <View style={styles.welcomeLeft}>
    <View>
      <Text style={styles.welcomeText}>Welcome back, 👋</Text>
      <Text style={styles.vendorName}>{vendorName || 'Vendor'}</Text>
    </View>
  </View>
  <View style={styles.headerRight}>
    <TouchableOpacity 
      onPress={() => navigation.navigate('Messaging')}
      style={styles.messageButton}
    >
      <Feather name="message-circle" size={20} color="#f97316" />
      {unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
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
</View>

{/* Latest Message Preview (if there's a recent message) */}
{latestMessage && (
  <TouchableOpacity 
    style={styles.latestMessagePreview}
    onPress={() => navigation.navigate('Messaging')}
  >
    <Feather name="message-square" size={14} color="#f97316" />
    <Text style={styles.latestMessageText} numberOfLines={1}>
      {latestMessage}
    </Text>
    <Feather name="chevron-right" size={14} color="#666" />
  </TouchableOpacity>
)}



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
        <TouchableOpacity onPress={() => navigation.navigate('VendorOrders' as never)}>
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



  <TouchableOpacity 
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Promotions')}
      style={stylesCompact.container}
    >
      <LinearGradient
        colors={['#f97316', '#f43f5e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={stylesCompact.gradient}
      >
        <View style={stylesCompact.content}>
          <View style={stylesCompact.iconContainer}>
            <Feather name="phone" size={24} color="#fff" />
          </View>
          
          <View style={stylesCompact.textContainer}>
            <Text style={stylesCompact.title}>Promote Your Business! 🚀</Text>
            <Text style={stylesCompact.subtitle}>
                Get featured on our homepage starting at ₦300/day
            </Text>
          </View>
          
          <View style={stylesCompact.button}>
            <Text style={stylesCompact.buttonText}>Create</Text>
            <Feather name="arrow-right" size={14} color="#fff" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>

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

 
  </ScrollView>
  </SafeAreaView>
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
  container:{
    flex:1,
        paddingBottom:60,

  },
  welcomeLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
headerRight: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
messageButton: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#1a1a1a',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
},
unreadBadge: {
  position: 'absolute',
  top: -4,
  right: -4,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: '#ef4444',
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 4,
},
unreadBadgeText: {
  fontSize: 10,
  fontWeight: 'bold',
  color: '#fff',
},
latestMessagePreview: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#1a1a1a',
  marginHorizontal: 16,
  marginBottom: 16,
  padding: 12,
  borderRadius: 12,
  gap: 10,
  borderWidth: 1,
  borderColor: 'rgba(249,115,22,0.2)',
},
latestMessageText: {
  flex: 1,
  fontSize: 12,
  color: '#fff',
},
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

  gradient: {
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  textContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
    marginBottom: 12,
  },
  benefits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  benefitText: {
    fontSize: 11,
    color: '#fff',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonContainer: {
    alignItems: 'flex-start',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  decoration: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 1,
  },
  decoration1: {
    top: -30,
    right: -30,
    width: 120,
    height: 120,
  },
  decoration2: {
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
  },
  decoration3: {
    top: 40,
    right: 40,
    width: 40,
    height: 40,
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

const stylesCompact = StyleSheet.create({
  container: {
    marginHorizontal: 2,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});