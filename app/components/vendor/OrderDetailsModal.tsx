// app/components/vendor/OrderDetailsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

interface OrderDetailsModalProps {
  visible: boolean;
  order: any;
  onClose: () => void;
  onAccept?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  onPrepare?: (orderId: string) => void;
  onReady?: (orderId: string) => void;
}

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#f97316',
  ready: '#10b981',
  picked_up: '#8b5cf6',
  in_transit: '#f97316',
  delivered: '#10b981',
  cancelled: '#ef4444',
  scheduled: '#8b5cf6',
};

const statusLabels: Record<string, string> = {
  pending: 'New Order',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  picked_up: 'Picked Up',
  in_transit: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  scheduled: 'Scheduled',
};

export function OrderDetailsModal({
  visible,
  order,
  onClose,
  onAccept,
  onReject,
  onPrepare,
  onReady,
}: OrderDetailsModalProps) {
  const [scheduledDetails, setScheduledDetails] = useState<any>(null);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (order?.id) {
      fetchScheduledDetails(order.id);
    }
  }, [order]);

  const fetchScheduledDetails = async (orderId: string) => {
    setLoadingScheduled(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_orders')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (error) throw error;
      setScheduledDetails(data);
    } catch (error) {
      console.error('Error fetching scheduled details:', error);
    } finally {
      setLoadingScheduled(false);
    }
  };

  if (!order) return null;

  const handleAction = (action: string) => {
    switch (action) {
      case 'accept':
        onAccept?.(order.id);
        break;
      case 'reject':
        onReject?.(order.id);
        break;
      case 'prepare':
        onPrepare?.(order.id);
        break;
      case 'ready':
        onReady?.(order.id);
        break;
    }
  };

  const getActionButtons = () => {
    if (order.status === 'scheduled') {
      return (
        <View style={styles.actionButtonsContainer}>
          <View style={styles.scheduledInfo}>
            <Feather name="calendar" size={16} color="#8b5cf6" />
            <Text style={styles.scheduledText}>This order is scheduled for future delivery</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleAction('accept')}
            style={[styles.actionButton, styles.acceptButton]}
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Accept & Start Preparing</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (order.status) {
      case 'pending':
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => handleAction('reject')}
              style={[styles.actionButton, styles.rejectButton]}
            >
              <Feather name="x-circle" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleAction('accept')}
              style={[styles.actionButton, styles.acceptButton]}
            >
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Accept Order</Text>
            </TouchableOpacity>
          </View>
        );

      case 'confirmed':
        return (
          <TouchableOpacity
            onPress={() => handleAction('prepare')}
            style={[styles.actionButton, styles.prepareButton]}
          >
            <Feather name="coffee" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Start Preparing</Text>
          </TouchableOpacity>
        );

      case 'preparing':
        return (
          <TouchableOpacity
            onPress={() => handleAction('ready')}
            style={[styles.actionButton, styles.readyButton]}
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Mark as Ready</Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Order Details</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColors[order.status]}20` }]}>
              <Text style={[styles.statusText, { color: statusColors[order.status] }]}>
                {statusLabels[order.status]}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Order Info */}
            <View style={styles.section}>
              <View style={styles.orderInfoRow}>
                <Text style={styles.orderNumber}>{order.order_number}</Text>
                <Text style={styles.orderTime}>
                  {new Date(order.created_at).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Scheduled Order Details */}
            {scheduledDetails && (
              <View style={[styles.section, styles.scheduledSection]}>
                <Text style={styles.sectionTitle}>
                  <Feather name="calendar" size={14} color="#8b5cf6" /> Scheduled Delivery
                </Text>
                <View style={styles.scheduledDetail}>
                  <Text style={styles.scheduledDetailText}>
                    Date: {formatDate(scheduledDetails.scheduled_date)}
                  </Text>
                  <Text style={styles.scheduledDetailText}>
                    Time: {scheduledDetails.scheduled_time}
                  </Text>
                  <Text style={styles.scheduledDetailText}>
                    Event: {scheduledDetails.event_type}
                  </Text>
                  {scheduledDetails.guest_count && (
                    <Text style={styles.scheduledDetailText}>
                      Guests: {scheduledDetails.guest_count}
                    </Text>
                  )}
                  {scheduledDetails.special_instructions && (
                    <View style={styles.instructionsBox}>
                      <Text style={styles.instructionsLabel}>Special Instructions:</Text>
                      <Text style={styles.instructionsText}>
                        {scheduledDetails.special_instructions}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Customer Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Details</Text>
              <View style={styles.customerInfo}>
                <View style={styles.infoRow}>
                  <Feather name="user" size={14} color="#666" />
                  <Text style={styles.infoText}>{order.customer_name}</Text>
                </View>
                {order.customer_phone && (
                  <View style={styles.infoRow}>
                    <Feather name="phone" size={14} color="#666" />
                    <Text style={styles.infoText}>{order.customer_phone}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Delivery Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Address</Text>
              <View style={styles.addressInfo}>
                <Feather name="map-pin" size={14} color="#f97316" />
                <View style={styles.addressTextContainer}>
                  <Text style={styles.addressStreet}>{order.delivery_address?.street}</Text>
                  <Text style={styles.addressArea}>{order.delivery_address?.area}</Text>
                  {order.delivery_address?.phone && (
                    <Text style={styles.addressPhone}>Phone: {order.delivery_address.phone}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Order Items */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Items</Text>
              {order.items?.map((item: any, idx: number) => (
                <View key={idx} style={styles.itemCard}>
                  <View style={styles.itemImageContainer}>
                    {item.product?.image && !imageErrors[item.product.id] ? (
                      <Image
                        source={{ uri: item.product.image }}
                        style={styles.itemImage}
                        onError={() => setImageErrors(prev => ({ ...prev, [item.product.id]: true }))}
                      />
                    ) : (
                      <LinearGradient
                        colors={['#f97316', '#f43f5e']}
                        style={styles.itemImagePlaceholder}
                      >
                        <Feather name="package" size={20} color="#fff" />
                      </LinearGradient>
                    )}
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name || item.product?.name}</Text>
                    <Text style={styles.itemPrice}>
                      {item.quantity} x ₦{(item.price || item.product?.price).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>
                    ₦{(item.quantity * (item.price || item.product?.price)).toLocaleString()}
                  </Text>
                </View>
              ))}

              {/* Order Summary */}
              <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>₦{(order.subtotal || 0).toLocaleString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>₦{(order.delivery_fee || 0).toLocaleString()}</Text>
                </View>
                {(order.service_fee || 0) > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Service Fee</Text>
                    <Text style={styles.summaryValue}>₦{(order.service_fee || 0).toLocaleString()}</Text>
                  </View>
                )}
                {(order.discount || 0) > 0 && (
                  <View style={[styles.summaryRow, styles.discountRow]}>
                    <Text style={styles.discountLabel}>Discount</Text>
                    <Text style={styles.discountValue}>-₦{(order.discount || 0).toLocaleString()}</Text>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₦{(order.total || 0).toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Payment Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentMethod}>{order.payment_method}</Text>
                {order.payment_status && (
                  <View style={[
                    styles.paymentStatus,
                    order.payment_status === 'paid' ? styles.paidStatus : styles.pendingStatus
                  ]}>
                    <Text style={styles.paymentStatusText}>
                      {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Notes */}
            {(order.notes || order.special_instructions) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Notes</Text>
                <Text style={styles.notesText}>{order.notes || order.special_instructions}</Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons - Fixed at bottom */}
          <View style={styles.modalFooter}>
            {getActionButtons()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  orderTime: {
    fontSize: 12,
    color: '#666',
  },
  scheduledSection: {
    backgroundColor: 'rgba(139,92,246,0.1)',
    padding: 12,
    borderRadius: 8,
  },
  scheduledDetail: {
    gap: 6,
  },
  scheduledDetailText: {
    fontSize: 13,
    color: '#fff',
  },
  instructionsBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
  },
  instructionsLabel: {
    fontSize: 12,
    color: '#8b5cf6',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 12,
    color: '#666',
  },
  customerInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
  },
  addressInfo: {
    flexDirection: 'row',
    gap: 8,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressStreet: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 2,
  },
  addressArea: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  addressPhone: {
    fontSize: 11,
    color: '#666',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  itemImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 11,
    color: '#666',
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  summaryContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  summaryValue: {
    fontSize: 12,
    color: '#fff',
  },
  discountRow: {
    marginBottom: 4,
  },
  discountLabel: {
    fontSize: 12,
    color: '#f43f5e',
  },
  discountValue: {
    fontSize: 12,
    color: '#f43f5e',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f97316',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentMethod: {
    fontSize: 13,
    color: '#fff',
    textTransform: 'capitalize',
  },
  paymentStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paidStatus: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  pendingStatus: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  paymentStatusText: {
    fontSize: 10,
    color: '#10b981',
  },
  notesText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionButtonsContainer: {
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  prepareButton: {
    backgroundColor: '#f97316',
  },
  readyButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  scheduledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderRadius: 8,
  },
  scheduledText: {
    flex: 1,
    fontSize: 13,
    color: '#8b5cf6',
  },
});