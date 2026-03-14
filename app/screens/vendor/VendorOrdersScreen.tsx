// app/screens/vendor/VendorOrdersScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useVendorOrders } from '../../hooks/vendor/useVendorOrders';
import { OrderCard } from '../../components/vendor/OrderCard';
import { OrderDetailsModal } from '../../components/vendor/OrderDetailsModal';
import Toast from 'react-native-toast-message';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'in_transit' | 'completed';
type OrderStatusType = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'in_transit' | 'completed';

const statusTabs = [
  { id: 'pending', label: 'New Orders', icon: 'clock', color: '#f59e0b' },
  { id: 'confirmed', label: 'Confirmed', icon: 'check-circle', color: '#3b82f6' },
  { id: 'preparing', label: 'Preparing', icon: 'coffee', color: '#f97316' },
  { id: 'ready', label: 'Ready', icon: 'package', color: '#10b981' },
  { id: 'in_transit', label: 'In Transit', icon: 'truck', color: '#8b5cf6' },
  { id: 'completed', label: 'Completed', icon: 'check-square', color: '#6b7280' },
];

export function VendorOrdersScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<OrderStatus>('pending');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
   const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  const { 
    ordersByStatus, 
    isLoading, 
    refreshOrders,
    acceptOrder,
    rejectOrder,
    startPreparing,
    markAsReady,
  } = useVendorOrders();

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  const handleOrderPress = (order: any) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await acceptOrder(orderId);
      setShowOrderModal(false);
    } catch (error) {
      showToast( 'Failed to accept order');
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    Alert.alert(
      'Reject Order',
      'Are you sure you want to reject this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectOrder(orderId);
              setShowOrderModal(false);
            } catch (error) {
              showToast( 'Failed to reject order');
            }
          },
        },
      ]
    );
  };

  const handleStartPreparing = async (orderId: string) => {
    try {
      await startPreparing(orderId);
      setShowOrderModal(false);
    } catch (error) {
      showToast( 'Failed to update order');
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      await markAsReady(orderId);
      setShowOrderModal(false);
    } catch (error) {
      showToast( 'Failed to update order');
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const currentOrders = ordersByStatus[activeTab] || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity onPress={refreshOrders} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Status Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {statusTabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as OrderStatus)}
            style={[
              styles.tab,
              activeTab === tab.id && styles.activeTab,
            ]}
          >
            <Feather 
              name={tab.icon as any} 
              size={16} 
              color={activeTab === tab.id ? '#fff' : tab.color} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText,
            ]}>
              {tab.label}
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: tab.color }]}>
              <Text style={styles.tabBadgeText}>
                {(ordersByStatus[tab.id as OrderStatusType]?.length) || 0}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {currentOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="package" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>No orders</Text>
            <Text style={styles.emptyText}>
              No {activeTab} orders at the moment
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {currentOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => handleOrderPress(order)}
                status={activeTab}
                onAccept={() => handleAcceptOrder(order.id)}
                onReject={() => handleRejectOrder(order.id)}
                onPrepare={() => handleStartPreparing(order.id)}
                onReady={() => handleMarkReady(order.id)}
              />
            ))}
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Order Details Modal */}
      <OrderDetailsModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onAccept={handleAcceptOrder}
        onReject={handleRejectOrder}
        onPrepare={handleStartPreparing}
        onReady={handleMarkReady}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    maxHeight: 70,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeTab: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  tabText: {
    fontSize: 13,
    color: '#fff',
  },
  activeTabText: {
    color: '#fff',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  ordersList: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
});