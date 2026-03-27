// app/screens/admin/AdminPromotionsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Toast from 'react-native-toast-message';

interface Promotion {
  id: string;
  vendor_id: string;
  vendor_name: string;
  title: string;
  description: string;
  image_url: string;
  promotion_type: 'flyer' | 'product_offer' | 'combo';
  status: 'pending_payment' | 'pending_approval' | 'active' | 'rejected' | 'expired';
  start_date: string;
  end_date: string;
  days_count: number;
  cost_per_day: number;
  total_cost: number;
  payment_amount: number;
  payment_reference: string;
  payment_status: string;
  views: number;
  clicks: number;
  conversions: number;
  rejection_reason?: string;
  // Product offer fields
  product_id?: string;
  product_name?: string;
  discounted_price?: number;
  max_per_customer?: number;
  // Combo fields
  main_product_id?: string;
  main_product_name?: string;
  free_product_id?: string;
  free_product_name?: string;
  buy_quantity?: number;
  get_quantity?: number;
  main_product_original_price?: number;
  free_product_original_price?: number;
  // Timestamps
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

export function AdminPromotionsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'active' | 'all'>('pending');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
const [showDetailsModal, setShowDetailsModal] = useState(false);

// Add this function
const handleViewDetails = (promotion: Promotion) => {
  setSelectedPromotion(promotion);
  setShowDetailsModal(true);
};

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type: type,
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('promotions')
        .select(`
          *,
          vendor:vendor_id (name),
          products:product_id (name),
          main_product:main_product_id (name),
          free_product:free_product_id (name)
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Process data
     const processedData = data?.map(promo => ({
  ...promo,
  vendor_name: promo.vendor?.name,
  product_name: promo.products?.name,
  main_product_name: promo.main_product?.name,
  free_product_name: promo.free_product?.name,
  views: promo.views || 0,
  clicks: promo.clicks || 0,
  conversions: promo.conversions || 0,
  payment_amount: promo.payment_amount || 0,
  payment_reference: promo.payment_reference || '',
  payment_status: promo.payment_status || 'pending',
})) || [];

      setPromotions(processedData);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      showToast('Failed to load promotions', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPromotions();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPromotions();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'pending_approval':
        return '#f59e0b';
      case 'pending_payment':
        return '#3b82f6';
      case 'rejected':
        return '#ef4444';
      case 'expired':
        return '#6b7280';
      default:
        return '#666';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flyer':
        return 'image';
      case 'product_offer':
        return 'tag';
      case 'combo':
        return 'gift';
      default:
        return 'speaker';
    }
  };

  const handleApprove = async (promotion: Promotion) => {
    Alert.alert(
      'Approve Promotion',
      `Are you sure you want to approve "${promotion.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessing(true);
            try {
              const { error } = await supabase
                .from('promotions')
                .update({
                  status: 'active',
                  approved_by: user?.id,
                  approved_at: new Date().toISOString(),
                })
                .eq('id', promotion.id);

              if (error) throw error;

              showToast('Promotion approved successfully');
              fetchPromotions();
            } catch (error) {
              console.error('Error approving promotion:', error);
              showToast('Failed to approve promotion', 'error');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!selectedPromotion) return;
    if (!rejectionReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('promotions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedPromotion.id);

      if (error) throw error;

      showToast('Promotion rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedPromotion(null);
      fetchPromotions();
    } catch (error) {
      console.error('Error rejecting promotion:', error);
      showToast('Failed to reject promotion', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const openRejectModal = (promotion: Promotion) => {
    setSelectedPromotion(promotion);
    setShowRejectModal(true);
  };

  const filteredPromotions = promotions.filter(promo => {
    if (selectedTab === 'pending') return promo.status === 'pending_approval';
    if (selectedTab === 'active') return promo.status === 'active';
    return true;
  });

  const pendingCount = promotions.filter(p => p.status === 'pending_approval').length;
  const activeCount = promotions.filter(p => p.status === 'active').length;

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading promotions...</Text>
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
        <Text style={styles.headerTitle}>Promotion Approvals</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{promotions.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setSelectedTab('pending')}
          style={[styles.tab, selectedTab === 'pending' && styles.activeTab]}
        >
          <Text style={[styles.tabText, selectedTab === 'pending' && styles.activeTabText]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab('active')}
          style={[styles.tab, selectedTab === 'active' && styles.activeTab]}
        >
          <Text style={[styles.tabText, selectedTab === 'active' && styles.activeTabText]}>
            Active ({activeCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab('all')}
          style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
        >
          <Text style={[styles.tabText, selectedTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredPromotions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="check-circle" size={48} color="#10b981" />
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptyText}>
              {selectedTab === 'pending' 
                ? 'No pending promotions to review' 
                : selectedTab === 'active'
                ? 'No active promotions'
                : 'No promotions found'}
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredPromotions.map((promotion) => (
             <View key={promotion.id} style={styles.promotionCard}>
  <Image
    source={{ uri: promotion.image_url }}
    style={styles.promotionImage}
  />
  <View style={styles.promotionContent}>
    <View style={styles.promotionHeader}>
      <View style={styles.typeBadge}>
        <Feather name={getTypeIcon(promotion.promotion_type)} size={12} color="#f97316" />
        <Text style={styles.typeText}>
          {promotion.promotion_type === 'flyer' ? 'Flyer' : 
           promotion.promotion_type === 'product_offer' ? 'Product Offer' : 'Combo'}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(promotion.status)}20` }]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(promotion.status) }]} />
        <Text style={[styles.statusText, { color: getStatusColor(promotion.status) }]}>
          {promotion.status === 'pending_approval' ? 'Pending' : promotion.status}
        </Text>
      </View>
    </View>

    <Text style={styles.promotionTitle}>{promotion.title}</Text>
    <Text style={styles.vendorName}>{promotion.vendor_name}</Text>
    
    {/* Add View Details button */}
    <TouchableOpacity 
      style={styles.viewDetailsButton}
      onPress={() => handleViewDetails(promotion)}
    >
      <Text style={styles.viewDetailsText}>View Details</Text>
      <Feather name="eye" size={14} color="#f97316" />
    </TouchableOpacity>

    {promotion.status === 'pending_approval' && (
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => openRejectModal(promotion)}
          disabled={processing}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApprove(promotion)}
          disabled={processing}
        >
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
</View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Promotion</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Reason for rejection</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Enter reason (will be shown to vendor)"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmModalButton]}
                onPress={handleReject}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmModalButtonText}>Confirm Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Promotion Details Modal */}
<Modal
  visible={showDetailsModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowDetailsModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.detailsModalContent}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.detailsModalHeader}>
          <Text style={styles.detailsModalTitle}>Promotion Details</Text>
          <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {selectedPromotion && (
          <>
            {/* Image */}
            <Image
              source={{ uri: selectedPromotion.image_url }}
              style={styles.detailsImage}
            />

            {/* Basic Info */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>Title</Text>
              <Text style={styles.detailsValue}>{selectedPromotion.title}</Text>
              
              {selectedPromotion.description && (
                <>
                  <Text style={[styles.detailsLabel, { marginTop: 12 }]}>Description</Text>
                  <Text style={styles.detailsValue}>{selectedPromotion.description}</Text>
                </>
              )}
            </View>

            {/* Vendor Info */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>Vendor</Text>
              <Text style={styles.detailsValue}>{selectedPromotion.vendor_name}</Text>
            </View>

            {/* Type & Status */}
            <View style={styles.detailsRow}>
              <View style={styles.detailsHalf}>
                <Text style={styles.detailsLabel}>Type</Text>
                <View style={styles.typeBadgeLarge}>
                  <Feather name={getTypeIcon(selectedPromotion.promotion_type)} size={14} color="#f97316" />
                  <Text style={styles.typeTextLarge}>
                    {selectedPromotion.promotion_type === 'flyer' ? 'Flyer' : 
                     selectedPromotion.promotion_type === 'product_offer' ? 'Product Offer' : 'Combo'}
                  </Text>
                </View>
              </View>
              <View style={styles.detailsHalf}>
                <Text style={styles.detailsLabel}>Status</Text>
                <View style={[styles.statusBadgeLarge, { backgroundColor: `${getStatusColor(selectedPromotion.status)}20` }]}>
                  <View style={[styles.statusDotLarge, { backgroundColor: getStatusColor(selectedPromotion.status) }]} />
                  <Text style={[styles.statusTextLarge, { color: getStatusColor(selectedPromotion.status) }]}>
                    {selectedPromotion.status === 'pending_approval' ? 'Pending Approval' : selectedPromotion.status}
                  </Text>
                </View>
              </View>
            </View>

            {/* Product Details (if product offer) */}
            {selectedPromotion.promotion_type === 'product_offer' && selectedPromotion.product_name && (
              <View style={styles.detailsSection}>
                <Text style={styles.detailsLabel}>Product</Text>
                <Text style={styles.detailsValue}>{selectedPromotion.product_name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.discountedPrice}>₦{selectedPromotion.discounted_price?.toLocaleString()}</Text>
                </View>
                {selectedPromotion.max_per_customer ? (
                  <Text style={styles.limitText}>Max {selectedPromotion.max_per_customer} per customer</Text>
                ) : (
                  <Text style={styles.limitText}>No purchase limit</Text>
                )}
              </View>
            )}

            {/* Combo Details */}
            {selectedPromotion.promotion_type === 'combo' && selectedPromotion.main_product_name && (
              <View style={styles.detailsSection}>
                <Text style={styles.detailsLabel}>Combo Details</Text>
                <View style={styles.comboBox}>
                  <Text style={styles.comboText}>
                    Buy {selectedPromotion.buy_quantity} × {selectedPromotion.main_product_name}
                  </Text>
                  <Feather name="arrow-down" size={16} color="#f97316" />
                  <Text style={styles.comboTextFree}>
                    Get {selectedPromotion.get_quantity} × {selectedPromotion.free_product_name} FREE
                  </Text>
                </View>
                {selectedPromotion.max_per_customer ? (
                  <Text style={styles.limitText}>Max {selectedPromotion.max_per_customer} combos per customer</Text>
                ) : (
                  <Text style={styles.limitText}>No purchase limit</Text>
                )}
              </View>
            )}

            {/* Dates */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>Duration</Text>
              <View style={styles.dateRow}>
                <Feather name="calendar" size={14} color="#666" />
                <Text style={styles.dateText}>
                  {new Date(selectedPromotion.start_date).toLocaleDateString()} - {new Date(selectedPromotion.end_date).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.daysText}>{selectedPromotion.days_count} days</Text>
            </View>

            {/* Payment Info */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>Payment</Text>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Amount Paid:</Text>
                <Text style={styles.paymentAmount}>₦{selectedPromotion.payment_amount?.toLocaleString()}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Reference:</Text>
                <Text style={styles.paymentRef}>{selectedPromotion.payment_reference}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Status:</Text>
                <Text style={[styles.paymentStatus, { color: selectedPromotion.payment_status === 'paid' ? '#10b981' : '#f59e0b' }]}>
                  {selectedPromotion.payment_status?.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Performance Stats (if active) */}
            {selectedPromotion.status === 'active' && (
              <View style={styles.detailsSection}>
                <Text style={styles.detailsLabel}>Performance</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Feather name="eye" size={16} color="#10b981" />
                    <Text style={styles.statBoxNumber}>{selectedPromotion.views || 0}</Text>
                    <Text style={styles.statBoxLabel}>Views</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Feather name="mouse-pointer" size={16} color="#f59e0b" />
                    <Text style={styles.statBoxNumber}>{selectedPromotion.clicks || 0}</Text>
                    <Text style={styles.statBoxLabel}>Clicks</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Feather name="shopping-bag" size={16} color="#f97316" />
                    <Text style={styles.statBoxNumber}>{selectedPromotion.conversions || 0}</Text>
                    <Text style={styles.statBoxLabel}>Orders</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Rejection Reason (if rejected) */}
            {selectedPromotion.status === 'rejected' && selectedPromotion.rejection_reason && (
              <View style={styles.rejectionBox}>
                <Feather name="alert-triangle" size={16} color="#ef4444" />
                <View>
                  <Text style={styles.rejectionTitle}>Rejection Reason</Text>
                  <Text style={styles.rejectionText}>{selectedPromotion.rejection_reason}</Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Action Buttons at bottom of modal */}
      {selectedPromotion?.status === 'pending_approval' && (
        <View style={styles.modalActionButtons}>
          <TouchableOpacity
            style={[styles.modalActionButton, styles.modalRejectButton]}
            onPress={() => {
              setShowDetailsModal(false);
              openRejectModal(selectedPromotion);
            }}
          >
            <Text style={styles.modalRejectButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalActionButton, styles.modalApproveButton]}
            onPress={() => {
              setShowDetailsModal(false);
              handleApprove(selectedPromotion);
            }}
          >
            <Text style={styles.modalApproveButtonText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
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
  placeholder: {
    width: 40,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#f97316',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  promotionCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  promotionImage: {
    width: 100,
    height: 100,
    backgroundColor: '#2a2a2a',
  },
  promotionContent: {
    flex: 1,
    padding: 12,
  },
  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 10,
    color: '#f97316',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  promotionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 12,
    color: '#f97316',
    marginBottom: 6,
  },
  productInfo: {
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
  },
  promotionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 10,
    color: '#666',
  },
  costText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f97316',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  rejectButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  rejectButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#2a2a2a',
  },
  cancelModalButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmModalButton: {
    backgroundColor: '#ef4444',
  },
  confirmModalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  detailsModalContent: {
  backgroundColor: '#1a1a1a',
  borderRadius: 20,
  margin: 16,
  maxHeight: '90%',
  minWidth:'90%',
  overflow: 'hidden',
},
detailsModalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.05)',
},
detailsModalTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: '#fff',
},
detailsImage: {
  width: '100%',
  height: 200,
  resizeMode: 'cover',
},
detailsSection: {
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.05)',
},
detailsLabel: {
  fontSize: 12,
  color: '#666',
  marginBottom: 4,
},
detailsValue: {
  fontSize: 14,
  color: '#fff',
  lineHeight: 20,
},
detailsRow: {
  flexDirection: 'row',
  padding: 16,
  gap: 12,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.05)',
},
detailsHalf: {
  flex: 1,
},
typeBadgeLarge: {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 6,
  backgroundColor: 'rgba(249,115,22,0.1)',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 20,
  marginTop: 4,
},
typeTextLarge: {
  fontSize: 13,
  color: '#f97316',
},
statusBadgeLarge: {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 6,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 20,
  marginTop: 4,
},
statusDotLarge: {
  width: 8,
  height: 8,
  borderRadius: 4,
},
statusTextLarge: {
  fontSize: 13,
  fontWeight: '500',
},
priceRow: {
  marginTop: 8,
},
discountedPrice: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#f97316',
},
limitText: {
  fontSize: 11,
  color: '#666',
  marginTop: 8,
},
comboBox: {
  backgroundColor: '#0a0a0a',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  gap: 8,
},
comboText: {
  fontSize: 14,
  color: '#fff',
},
comboTextFree: {
  fontSize: 14,
  color: '#10b981',
  fontWeight: '500',
},
dateRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
},

daysText: {
  fontSize: 12,
  color: '#666',
  marginTop: 4,
},
paymentRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 8,
},
paymentLabel: {
  fontSize: 13,
  color: '#666',
},
paymentAmount: {
  fontSize: 13,
  color: '#f97316',
  fontWeight: '500',
},
paymentRef: {
  fontSize: 11,
  color: '#666',
},
paymentStatus: {
  fontSize: 13,
  fontWeight: '500',
},

statBox: {
  flex: 1,
  backgroundColor: '#0a0a0a',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  gap: 6,
},
statBoxNumber: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#fff',
},
statBoxLabel: {
  fontSize: 10,
  color: '#666',
},
rejectionBox: {
  flexDirection: 'row',
  backgroundColor: 'rgba(239,68,68,0.1)',
  margin: 16,
  padding: 12,
  borderRadius: 8,
  gap: 10,
  borderWidth: 1,
  borderColor: '#ef4444',
},
rejectionTitle: {
  fontSize: 12,
  fontWeight: '600',
  color: '#ef4444',
  marginBottom: 2,
},
rejectionText: {
  fontSize: 11,
  color: '#ef4444',
},
modalActionButtons: {
  flexDirection: 'row',
  padding: 16,
  gap: 12,
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.05)',
},
modalActionButton: {
  flex: 1,
  paddingVertical: 14,
  borderRadius: 8,
  alignItems: 'center',
},
modalApproveButton: {
  backgroundColor: '#10b981',
},
modalApproveButtonText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
},
modalRejectButton: {
  backgroundColor: 'rgba(239,68,68,0.15)',
  borderWidth: 1,
  borderColor: '#ef4444',
},
modalRejectButtonText: {
  color: '#ef4444',
  fontSize: 14,
  fontWeight: '500',
},
viewDetailsButton: {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 6,
  marginTop: 8,
  marginBottom: 8,
},
viewDetailsText: {
  fontSize: 12,
  color: '#f97316',
},
});