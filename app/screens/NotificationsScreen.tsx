// app/screens/NotificationsScreen.tsx
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { formatDistanceToNow } from 'date-fns';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { openAppLink } from '../navigation/RootNavigation';

type NotificationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define proper icon names that exist in Feather
const notificationIcons = {
  order: 'package' as const,
  payout: 'dollar-sign' as const,
  system: 'bell' as const,
  alert: 'alert-circle' as const,
    promotion: 'tag' as const,  // ← ADD THIS

};

const notificationColors = {
  order: '#f97316',
  payout: '#10b981',
  system: '#6b7280',
  alert: '#ef4444',
    promotion: '#f97316',  // ← ADD THIS (use orange like orders)

};

const notificationBgColors = {
  order: 'rgba(59,130,246,0.1)',
  payout: 'rgba(16,185,129,0.1)',
  system: 'rgba(107,114,128,0.1)',
  alert: 'rgba(239,68,68,0.1)',
    promotion: 'rgba(249,115,22,0.1)',  // ← ADD THIS (orange tint)

};

export function NotificationsScreen() {
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const { user } = useAuth();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    refresh,
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.read);
const [selectedPromo, setSelectedPromo] = useState<any>(null);
const [showPromoModal, setShowPromoModal] = useState(false);
const [copied, setCopied] = useState(false);



const handleNotificationClick = async (notification: any) => {
  console.log('🔔 Notification clicked:', notification);
  
  // Check if it's a promo code notification (check metadata instead of data)
  if ((notification.type === 'system' || notification.type === 'promotion') && notification.metadata?.type === 'promo_code') {
    console.log('🎯 This is a promo code notification!');
    await handlePromoCodeClick(notification);
    return;
  }
  
  // Check if it's an announcement
  if (notification.metadata?.announcement_id || notification.data?.announcement_id) {
    const announcementId = notification.metadata?.announcement_id || notification.data?.announcement_id;
    navigation.navigate('AnnouncementDetails', { announcementId });
    return;
  }
  
  // Check if it's a message notification
  if (notification.type === 'message' && (notification.metadata?.conversation_id || notification.data?.conversation_id)) {
    navigation.navigate('Messaging');
    return;
  }
  
  // Mark as read
  if (!notification.read) {
    await markAsRead(notification.id);
  }
  
  // Handle action_link navigation (resolved for the signed-in user's role)
  openAppLink(user?.role, notification.action_link);
};

const handlePromoCodeClick = async (notification: any) => {
  console.log('🎯 handlePromoCodeClick called');
  console.log('🎯 Notification metadata:', notification.metadata);
  
  if (!notification.read) {
    await markAsRead(notification.id);
  }
  
  // The promo code info is in metadata, not data
  const promoCodeId = notification.metadata?.promo_code_id;
  const promoCode = notification.metadata?.code;
  const vendorId = notification.metadata?.vendor_id;
  
  console.log('🎯 Promo code ID:', promoCodeId);
  console.log('🎯 Promo code:', promoCode);
  console.log('🎯 Vendor ID:', vendorId);
  
  // If we have the promo code ID, fetch full details
  if (promoCodeId) {
    try {
      console.log('🔍 Fetching promo details for ID:', promoCodeId);
      
      const { data, error } = await supabase
        .from('promo_codes')
        .select(`
          *,
          vendor:vendor_id (name, image_url)
        `)
        .eq('id', promoCodeId)
        .single();
      
      if (error) {
        console.error('❌ Error fetching promo:', error);
        throw error;
      }
      
      console.log('✅ Promo data fetched:', data);
      
      setSelectedPromo({
        ...data,
        vendor_name: data.vendor?.name,
        vendor_image: data.vendor?.image_url,
      });
      
      console.log('🎉 Setting showPromoModal to true');
      setShowPromoModal(true);
    } catch (error) {
      console.error('Error fetching promo details:', error);
      Toast.show({ type: 'error', text1: 'Failed to load promo details' });
    }
  } else {
    // If no ID, use the data from metadata directly
    console.log('📱 Using metadata directly (no ID found)');
    setSelectedPromo({
      code: notification.metadata?.code,
      discount_type: notification.metadata?.discount_type,
      discount_value: notification.metadata?.discount_value,
      description: notification.metadata?.description,
      min_order_amount: notification.metadata?.min_order_amount,
      end_date: notification.metadata?.end_date,
      vendor_id: notification.metadata?.vendor_id,
      vendor_name: notification.metadata?.vendor_name,
      usage_per_user: notification.metadata?.usage_per_user || 1,
    });
    setShowPromoModal(true);
  }
};

// Add this function to copy promo code
const copyPromoCode = (code: string) => {
  // Copy to clipboard
  console.log('Copied:', code);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
  Toast.show({ type: 'success', text1: 'Code copied to clipboard!' });
};

const applyPromoCode = (code: string, vendorId: string) => {
  setShowPromoModal(false);
  if (user?.role !== 'customer') return;
  // CartScreen pre-fills the code and validates it against the cart.
  navigation.navigate('Cart', { promoCode: code });
};

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
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
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
            </Text>
          </View>
        </View>
        
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Feather name="check-circle" size={18} color="#f97316" />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={[
              styles.tab,
              filter === 'all' && styles.activeTab,
            ]}
          >
            <Text style={[
              styles.tabText,
              filter === 'all' && styles.activeTabText,
            ]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('unread')}
            style={[
              styles.tab,
              filter === 'unread' && styles.activeTab,
            ]}
          >
            <Text style={[
              styles.tabText,
              filter === 'unread' && styles.activeTabText,
            ]}>
              Unread
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="bell" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>
              No {filter === 'unread' ? 'unread ' : ''}notifications
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {filteredNotifications.map((notification) => {
              const IconName = notificationIcons[notification.type as keyof typeof notificationIcons] || 'bell';
              const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });
              
              return (
                <TouchableOpacity
                  key={notification.id}
                  onPress={() => handleNotificationClick(notification)}
                  style={[
                    styles.notificationCard,
                    !notification.read && styles.notificationCardUnread,
                  ]}
                >
                  <View style={styles.notificationContent}>
                    {/* Icon */}
                    <View style={[
                      styles.notificationIcon,
                      { backgroundColor: notificationBgColors[notification.type as keyof typeof notificationBgColors] || 'rgba(107,114,128,0.1)' }
                    ]}>
                      <Feather 
                        name={IconName} 
                        size={20} 
                        color={notificationColors[notification.type as keyof typeof notificationColors] || '#6b7280'} 
                      />
                    </View>

                    {/* Content */}
                    <View style={styles.notificationInfo}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle} numberOfLines={1}>
                          {notification.title}
                        </Text>
                        <Text style={styles.notificationTime}>{timeAgo}</Text>
                      </View>
                      
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {notification.message}
                      </Text>

                      {/* Action Button */}
                      {notification.action_label && (
                        <View style={styles.notificationAction}>
                          <Text style={styles.notificationActionText}>
                            {notification.action_label}
                          </Text>
                          <Feather name="chevron-right" size={14} color="#f97316" />
                        </View>
                      )}
                    </View>

                    {/* Unread Dot */}
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}

                    {/* Delete Button */}
                    <TouchableOpacity
                      onPress={() => deleteNotification(notification.id)}
                      style={styles.deleteButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Feather name="x" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Promo Code Details Modal */}
<Modal
  visible={showPromoModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowPromoModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.promoModalContent}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {selectedPromo && (
          <>
            {/* Header */}
            <View style={styles.promoModalHeader}>
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.promoModalGradient}
              >
                <TouchableOpacity
                  onPress={() => setShowPromoModal(false)}
                  style={styles.promoModalClose}
                >
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={styles.promoModalIcon}>
                  <Feather name="tag" size={48} color="#fff" />
                </View>
                
                <Text style={styles.promoModalCode}>{selectedPromo.code}</Text>
                
                <View style={styles.promoModalDiscount}>
                  <Text style={styles.promoModalDiscountText}>
                    {selectedPromo.discount_type === 'percentage' 
                      ? `${selectedPromo.discount_value}% OFF`
                      : `₦${selectedPromo.discount_value.toLocaleString()} OFF`}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Content */}
            <View style={styles.promoModalBody}>
              {/* Vendor Info */}
              <View style={styles.promoModalVendor}>
                {selectedPromo.vendor_image ? (
                  <Image source={{ uri: selectedPromo.vendor_image }} style={styles.promoModalVendorImage} />
                ) : (
                  <View style={styles.promoModalVendorImagePlaceholder}>
                    <Feather name="home" size={24} color="#f97316" />
                  </View>
                )}
                <View style={styles.promoModalVendorInfo}>
                  <Text style={styles.promoModalVendorName}>{selectedPromo.vendor_name}</Text>
                  <TouchableOpacity onPress={() => {
                    setShowPromoModal(false);
                    navigation.navigate('VendorDetails', { vendorId: selectedPromo.vendor_id });
                  }}>
                    <Text style={styles.promoModalVendorLink}>View Store →</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Description */}
              {selectedPromo.description && (
                <View style={styles.promoModalSection}>
                  <Text style={styles.promoModalSectionTitle}>Offer Details</Text>
                  <Text style={styles.promoModalDescription}>{selectedPromo.description}</Text>
                </View>
              )}

              {/* Terms */}
              <View style={styles.promoModalSection}>
                <Text style={styles.promoModalSectionTitle}>Terms & Conditions</Text>
                <View style={styles.promoModalTermsList}>
                  {selectedPromo.min_order_amount > 0 && (
                    <View style={styles.promoModalTermItem}>
                      <Feather name="shopping-bag" size={16} color="#f97316" />
                      <Text style={styles.promoModalTermText}>
                        Minimum order: ₦{selectedPromo.min_order_amount.toLocaleString()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.promoModalTermItem}>
                    <Feather name="users" size={16} color="#f97316" />
                    <Text style={styles.promoModalTermText}>
                      Max {selectedPromo.usage_per_user || 1} use{selectedPromo.usage_per_user !== 1 ? 's' : ''} per customer
                    </Text>
                  </View>
                  {selectedPromo.usage_limit && (
                    <View style={styles.promoModalTermItem}>
                      <Feather name="hash" size={16} color="#f97316" />
                      <Text style={styles.promoModalTermText}>
                        Limited to {selectedPromo.usage_limit} redemptions
                      </Text>
                    </View>
                  )}
                  <View style={styles.promoModalTermItem}>
                    <Feather name="calendar" size={16} color="#f97316" />
                    <Text style={styles.promoModalTermText}>
                      Valid until: {new Date(selectedPromo.end_date).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* How to Use */}
              <View style={styles.promoModalHowTo}>
                <Text style={styles.promoModalHowToTitle}>How to use:</Text>
                <View style={styles.promoModalStepItem}>
                  <View style={styles.promoModalStepNumber}><Text style={styles.promoModalStepNumberText}>1</Text></View>
                  <Text style={styles.promoModalStepText}>Add items to your cart</Text>
                </View>
                <View style={styles.promoModalStepItem}>
                  <View style={styles.promoModalStepNumber}><Text style={styles.promoModalStepNumberText}>2</Text></View>
                  <Text style={styles.promoModalStepText}>Go to checkout</Text>
                </View>
                <View style={styles.promoModalStepItem}>
                  <View style={styles.promoModalStepNumber}><Text style={styles.promoModalStepNumberText}>3</Text></View>
                  <Text style={styles.promoModalStepText}>Enter code: {selectedPromo.code}</Text>
                </View>
                <View style={styles.promoModalStepItem}>
                  <View style={styles.promoModalStepNumber}><Text style={styles.promoModalStepNumberText}>4</Text></View>
                  <Text style={styles.promoModalStepText}>Discount applied automatically</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.promoModalFooter}>
              <TouchableOpacity
                style={styles.promoModalShareButton}
                onPress={() => copyPromoCode(selectedPromo.code)}
              >
                <Feather name="share-2" size={20} color="#f97316" />
                <Text style={styles.promoModalShareButtonText}>Share</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.promoModalApplyButton}
                onPress={() => applyPromoCode(selectedPromo.code, selectedPromo.vendor_id)}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.promoModalApplyGradient}
                >
                  <Feather name="check-circle" size={20} color="#fff" />
                  <Text style={styles.promoModalApplyButtonText}>Apply to Order</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  </View>
</Modal>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 16,
  },
  markAllText: {
    fontSize: 12,
    color: '#f97316',
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  // Add these to your existing styles
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.9)',
  justifyContent: 'flex-end',
},
promoModalContent: {
  backgroundColor: '#0a0a0a',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  maxHeight: '90%',
  overflow: 'hidden',
},
promoModalHeader: {
  position: 'relative',
},
promoModalGradient: {
  paddingTop: 40,
  paddingBottom: 30,
  alignItems: 'center',
},
promoModalClose: {
  position: 'absolute',
  top: 16,
  right: 16,
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: 'rgba(255,255,255,0.2)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
},
promoModalIcon: {
  width: 80,
  height: 80,
  borderRadius: 40,
  backgroundColor: 'rgba(255,255,255,0.2)',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 16,
},
promoModalCode: {
  fontSize: 28,
  fontWeight: 'bold',
  color: '#fff',
  letterSpacing: 2,
  marginBottom: 8,
},
promoModalDiscount: {
  backgroundColor: 'rgba(0,0,0,0.3)',
  paddingHorizontal: 16,
  paddingVertical: 6,
  borderRadius: 20,
},
promoModalDiscountText: {
  fontSize: 16,
  color: '#fff',
  fontWeight: '600',
},
promoModalBody: {
  padding: 20,
},
promoModalVendor: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  backgroundColor: '#1a1a1a',
  padding: 16,
  borderRadius: 12,
  marginBottom: 20,
},
promoModalVendorImage: {
  width: 50,
  height: 50,
  borderRadius: 25,
},
promoModalVendorImagePlaceholder: {
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: '#2a2a2a',
  justifyContent: 'center',
  alignItems: 'center',
},
promoModalVendorInfo: {
  flex: 1,
},
promoModalVendorName: {
  fontSize: 16,
  fontWeight: '600',
  color: '#fff',
  marginBottom: 4,
},
promoModalVendorLink: {
  fontSize: 13,
  color: '#f97316',
},
promoModalSection: {
  marginBottom: 20,
},
promoModalSectionTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#fff',
  marginBottom: 12,
},
promoModalDescription: {
  fontSize: 14,
  color: '#ccc',
  lineHeight: 22,
},
promoModalTermsList: {
  gap: 10,
},
promoModalTermItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
promoModalTermText: {
  flex: 1,
  fontSize: 13,
  color: '#666',
},
promoModalHowTo: {
  backgroundColor: '#1a1a1a',
  padding: 16,
  borderRadius: 12,
  marginBottom: 20,
},
promoModalHowToTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#fff',
  marginBottom: 12,
},
promoModalStepItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  marginBottom: 10,
},
promoModalStepNumber: {
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: '#f97316',
  justifyContent: 'center',
  alignItems: 'center',
},
promoModalStepNumberText: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 12,
},
promoModalStepText: {
  flex: 1,
  fontSize: 13,
  color: '#ccc',
},
promoModalFooter: {
  flexDirection: 'row',
  gap: 12,
  padding: 20,
  paddingTop: 0,
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.05)',
},
promoModalShareButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  backgroundColor: '#1a1a1a',
  paddingVertical: 14,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#f97316',
},
promoModalShareButtonText: {
  color: '#f97316',
  fontSize: 14,
  fontWeight: '500',
},
promoModalApplyButton: {
  flex: 2,
  borderRadius: 12,
  overflow: 'hidden',
},
promoModalApplyGradient: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingVertical: 14,
},
promoModalApplyButtonText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
},
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#f97316',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  notificationsList: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  notificationCardUnread: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  notificationContent: {
    flexDirection: 'row',
    gap: 12,
    position: 'relative',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingRight: 20,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  notificationTime: {
    fontSize: 11,
    color: '#666',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  notificationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  notificationActionText: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '500',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
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