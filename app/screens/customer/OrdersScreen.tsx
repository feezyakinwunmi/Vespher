// app/screens/customer/OrdersScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useOrders } from '../../hooks/customer/useOrders';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Order, OrderStatus } from '../../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';

type OrdersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const orderTabs = [
  { value: 'active', label: 'Active' },
  { value: 'past', label: 'Past Orders' },
];

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  pending: { label: 'Pending', color: '#f59e0b', icon: 'clock' },
  confirmed: { label: 'Confirmed', color: '#f97316', icon: 'check-circle' },
  preparing: { label: 'Preparing', color: '#f97316', icon: 'coffee' },
  ready: { label: 'Ready', color: '#f43f5e', icon: 'package' },
  picked_up: { label: 'Picked Up', color: '#8b5cf6', icon: 'truck' },
  in_transit: { label: 'On the Way', color: '#f97316', icon: 'truck' },
  delivered: { label: 'Delivered', color: '#10b981', icon: 'check-circle' },
  cancelled: { label: 'Cancelled', color: '#ef4444', icon: 'x-circle' },
  scheduled: { label: 'Scheduled', color: '#8b5cf6', icon: 'calendar' },
};

// Rating Modal Component
function RatingModal({ 
  isOpen, 
  onClose, 
  orderId, 
  vendorId, 
  vendorName 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  orderId: string; 
  vendorId: string; 
  vendorName: string;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
 const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  const handleSubmit = async () => {
    if (rating === 0) {
      showToast( 'Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          order_id: orderId,
          user_id: user?.id,
          vendor_id: vendorId,
          rating,
          comment: comment.trim() || null,
        });

      if (error) throw error;

      showToast( 'Thank you for your review!');
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
      showToast('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rate {vendorName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {/* Stars */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  onPressIn={() => setHover(star)}
                  onPressOut={() => setHover(0)}
                  style={styles.starButton}
                >
                  <Feather
                    name="star"
                    size={32}
                    color={(hover || rating) >= star ? '#fbbf24' : '#666'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment */}
            <View style={styles.commentContainer}>
              <Text style={styles.commentLabel}>Comment (Optional)</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Share your experience..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={styles.submitButton}
            >
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Submit Review</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
   const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  const navigation = useNavigation();
  const { addItem } = useCart();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const status = statusConfig[order.status];
  const isActive = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'in_transit'].includes(order.status);

  const vendorName = order.vendor?.name || 'Vendor';
  
  // Get the first item's image
  const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
  const itemImage = firstItem?.product?.image || firstItem?.image_url || 'https://via.placeholder.com/100';

  const handleReorder = async (e: any) => {
    e.stopPropagation();
    order.items.forEach((item: any) => {
      if (item.product) {
        addItem(item.product, item.quantity);
      }
    });
    showToast('Items added to cart');
    navigation.navigate('Cart' as never);
  };

  const handleCallRider = (e: any) => {
    e.stopPropagation();
    if (order.rider?.phone) {
      // Will implement later
    }
  };

  return (
    <>
      <TouchableOpacity onPress={onPress} style={styles.orderCard}>
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={styles.vendorInfo}>
            <View style={styles.itemImageContainer}>
              <Image 
                source={{ uri: itemImage }} 
                style={styles.itemImage}
                onError={() => setImageError(true)}
              />
              {imageError && (
                <View style={styles.itemImageFallback}>
                  <Feather name="image" size={20} color="#666" />
                </View>
              )}
            </View>
            <View>
              <Text style={styles.vendorName}>{vendorName}</Text>
              <Text style={styles.orderNumber}>{order.order_number || order.id.slice(0, 8)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
            <Feather name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* Items */}
        <View style={styles.itemsContainer}>
          {order.items.slice(0, 2).map((item: any, idx: number) => (
            <Text key={idx} style={styles.itemText}>
              {item.quantity}x {item.name}
            </Text>
          ))}
          {order.items.length > 2 && (
            <Text style={styles.moreItemsText}>
              +{order.items.length - 2} more items
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.orderFooter}>
          <View style={styles.dateContainer}>
            <Feather name="clock" size={14} color="#666" />
            <Text style={styles.dateText}>
              {new Date(order.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.totalContainer}>
            <Text style={styles.totalText}>₦{order.total.toLocaleString()}</Text>
            <Feather name="chevron-right" size={16} color="#666" />
          </View>
        </View>

        {/* Action Buttons for Active Orders */}
        {isActive && order.status === 'in_transit' && order.rider && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              onPress={handleCallRider}
              style={styles.actionButtonSecondary}
            >
              <Feather name="phone" size={16} color="#f97316" />
              <Text style={styles.actionButtonSecondaryText}>Call Rider</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={onPress}
              style={styles.actionButtonPrimary}
            >
              <Text style={styles.actionButtonPrimaryText}>Track Order</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reorder and Rate buttons for Delivered Orders */}
        {order.status === 'delivered' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              onPress={handleReorder}
              style={styles.actionButtonSecondary}
            >
              <Feather name="refresh-cw" size={16} color="#f97316" />
              <Text style={styles.actionButtonSecondaryText}>Reorder</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                setShowRatingModal(true);
              }}
              style={styles.actionButtonSecondary}
            >
              <Feather name="star" size={16} color="#f97316" />
              <Text style={styles.actionButtonSecondaryText}>Rate</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        orderId={order.id}
        vendorId={order.vendor_id}
        vendorName={vendorName}
      />
    </>
  );
}

export function OrdersScreen() {
  const navigation = useNavigation<OrdersScreenNavigationProp>();
  const [activeTab, setActiveTab] = useState('active');
  const { orders, isLoading, refreshOrders } = useOrders();
  const [refreshing, setRefreshing] = useState(false);

  const activeOrders = orders.filter(o => 
    ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'in_transit'].includes(o.status)
  );

  const pastOrders = orders.filter(o => 
    ['delivered', 'cancelled'].includes(o.status)
  );

  const displayedOrders = activeTab === 'active' ? activeOrders : pastOrders;

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  const handleOrderPress = (orderId: string) => {
    navigation.navigate('OrderTracking', { orderId });
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
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          {orderTabs.map(tab => (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={[
                styles.tab,
                activeTab === tab.value && styles.activeTab,
              ]}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab.value && styles.activeTabText,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Orders List */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {displayedOrders.length > 0 ? (
          <View style={styles.ordersList}>
            {displayedOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onPress={() => handleOrderPress(order.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="package" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>
              No {activeTab === 'active' ? 'active' : 'past'} orders
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'active' 
                ? "You don't have any active orders right now"
                : 'Your order history will appear here'}
            </Text>
            {activeTab === 'active' && (
              <TouchableOpacity 
                onPress={() => navigation.navigate('Vendors')}
                style={styles.emptyButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyButtonGradient}
                >
                  <Text style={styles.emptyButtonText}>Order Now</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
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
  headerRight: {
    width: 40,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#f97316',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  ordersList: {
    padding: 16,
    gap: 16,
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '500',
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  moreItemsText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButtonPrimary: {
    flex: 1,
    backgroundColor: '#f97316',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2a2a2a',
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonSecondaryText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '500',
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
    marginBottom: 20,
  },
  emptyButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    gap: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  commentContainer: {
    gap: 8,
  },
  commentLabel: {
    fontSize: 14,
    color: '#666',
  },
  commentInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});