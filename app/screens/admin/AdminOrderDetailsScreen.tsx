// app/screens/admin/AdminOrderDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

export function AdminOrderDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params as { orderId: string };
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rider, setRider] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [showFinancialBreakdown, setShowFinancialBreakdown] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      // Fetch order with all related data
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            phone,
            email
          ),
          vendor:vendor_id (
            id,
            name,
            phone,
            email,
            address,
            image_url
          ),
          rider:rider_id (
            id,
            name,
            phone,
            email,
            avatar_url
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      // Fetch product images for all items
      const items = data.items || [];
      const productIds = items.map((item: any) => item.product_id).filter(Boolean);
      
      let productImages: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, image_url')
          .in('id', productIds);
        
        productImages = (products || []).reduce((acc: Record<string, string>, product: any) => {
          acc[product.id] = product.image_url || '';
          return acc;
        }, {});
      }

      // Enrich items with product images
      const enrichedItems = items.map((item: any) => ({
        ...item,
        product: {
          id: item.product_id,
          name: item.name,
          price: item.price,
          image: productImages[item.product_id] || '',
        }
      }));

      setOrder({
        ...data,
        items: enrichedItems,
        itemCount: enrichedItems.length
      });

      if (data.vendor) setVendor(data.vendor);
      if (data.customer) setCustomer(data.customer);
      if (data.rider) setRider(data.rider);

    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  const callRider = () => {
    if (rider?.phone) {
      Linking.openURL(`tel:${rider.phone}`);
    }
  };

  const messageRider = () => {
    if (rider?.phone) {
      Linking.openURL(`sms:${rider.phone}`);
    }
  };

  const callVendor = () => {
    if (vendor?.phone) {
      Linking.openURL(`tel:${vendor.phone}`);
    }
  };

  const callCustomer = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#f97316',
      ready: '#10b981',
      picked_up: '#8b5cf6',
      in_transit: '#f97316',
      delivered: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#666';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Order not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate platform share from delivery (50%)
  const platformDeliveryShare = order.delivery_fee ? order.delivery_fee * 0.5 : 0;
  
  // Calculate rider share from delivery (50%)
  const riderShare = order.delivery_fee ? order.delivery_fee * 0.5 : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.order_number || order.id.slice(0, 8)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Order Status Banner */}
        <LinearGradient
          colors={['#f97316', '#f43f5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statusBanner}
        >
          <View style={styles.statusBannerContent}>
            <Text style={styles.statusBannerLabel}>Order Status</Text>
            <View style={[styles.statusBannerBadge, { backgroundColor: getStatusColor(order.status) }]}>
              <Text style={styles.statusBannerText}>{order.status.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.statusBannerDate}>
            {new Date(order.created_at).toLocaleString()}
          </Text>
        </LinearGradient>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items?.map((item: any, index: number) => (
            <View key={index} style={styles.itemCard}>
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
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>
                  ₦{item.price.toLocaleString()} x {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                ₦{(item.price * item.quantity).toLocaleString()}
              </Text>
            </View>
          ))}

          {/* Order Summary */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₦{order.subtotal?.toLocaleString() || 0}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>₦{order.delivery_fee?.toLocaleString() || 0}</Text>
            </View>
            {order.discount > 0 && (
              <View style={[styles.summaryRow, styles.discountRow]}>
                <Text style={styles.discountLabel}>Discount</Text>
                <Text style={styles.discountValue}>-₦{order.discount.toLocaleString()}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Customer Total</Text>
              <Text style={styles.totalValue}>₦{order.total?.toLocaleString() || 0}</Text>
            </View>
          </View>
        </View>

        {/* FINANCIAL BREAKDOWN - UPDATED SECTION */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.accordionHeader}
            onPress={() => setShowFinancialBreakdown(!showFinancialBreakdown)}
          >
            <Text style={styles.sectionTitle}>Financial Breakdown</Text>
            <Feather 
              name={showFinancialBreakdown ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#f97316" 
            />
          </TouchableOpacity>

          {showFinancialBreakdown && (
            <View style={styles.financialCard}>
              {/* Platform Commission (from order) */}
              <View style={styles.financialRow}>
                <View style={styles.financialLabelContainer}>
                  <Feather name="percent" size={14} color="#f97316" />
                  <Text style={styles.financialLabel}>Platform Commission</Text>
                </View>
                <Text style={styles.financialValue}>
                  ₦{order.platform_commission?.toLocaleString() || 0}
                </Text>
              </View>
              <Text style={styles.financialSubtext}>
                ({order.platform_commission_percentage || 10}% of ₦{order.subtotal?.toLocaleString()})
              </Text>

              {/* Flutterwave Fee */}
              <View style={styles.financialRow}>
                <View style={styles.financialLabelContainer}>
                  <Feather name="credit-card" size={14} color="#ef4444" />
                  <Text style={styles.financialLabel}>Flutterwave Fee</Text>
                </View>
                <Text style={[styles.financialValue, styles.feeText]}>
                  -₦{order.flutterwave_fee?.toLocaleString() || 0}
                </Text>
              </View>
              <Text style={styles.financialSubtext}>
                (2% of ₦{order.subtotal?.toLocaleString()})
              </Text>

              {/* Platform Delivery Share (50% of delivery) */}
              <View style={styles.financialRow}>
                <View style={styles.financialLabelContainer}>
                  <Feather name="truck" size={14} color="#f97316" />
                  <Text style={styles.financialLabel}>Platform Delivery Share</Text>
                </View>
                <Text style={styles.financialValue}>
                  ₦{platformDeliveryShare.toLocaleString()}
                </Text>
              </View>
              <Text style={styles.financialSubtext}>
                (50% of ₦{order.delivery_fee?.toLocaleString()} delivery fee)
              </Text>

              {/* Platform Net Earnings (Commission - Flutterwave) */}
              <View style={styles.financialRow}>
                <View style={styles.financialLabelContainer}>
                  <Feather name="trending-up" size={14} color="#10b981" />
                  <Text style={styles.financialLabel}>Platform Net from Order</Text>
                </View>
                <Text style={[styles.financialValue, { color: '#10b981' }]}>
                  ₦{order.platform_net_earnings?.toLocaleString() || 0}
                </Text>
              </View>

              {/* TOTAL PLATFORM INCOME (Delivery Share + Net Earnings) */}
              <View style={[styles.financialRow, styles.financialTotalRow]}>
                <View style={styles.financialLabelContainer}>
                  <Feather name="briefcase" size={14} color="#f97316" />
                  <Text style={styles.financialTotalLabel}>TOTAL PLATFORM INCOME</Text>
                </View>
                <Text style={styles.financialTotalValue}>
                  ₦{(platformDeliveryShare + (order.platform_net_earnings || 0)).toLocaleString()}
                </Text>
              </View>

              <View style={styles.financialDivider} />

              {/* Vendor Payout */}
              <View style={styles.financialRow}>
                <View style={styles.financialLabelContainer}>
                  <Feather name="home" size={14} color="#8b5cf6" />
                  <Text style={styles.financialLabel}>Vendor Payout</Text>
                </View>
                <Text style={styles.financialValue}>
                  ₦{(order.subtotal - (order.platform_commission || 0)).toLocaleString()}
                </Text>
              </View>

              {/* Rider Payout (50% of delivery) */}
              <View style={styles.financialRow}>
                <View style={styles.financialLabelContainer}>
                  <Feather name="user" size={14} color="#10b981" />
                  <Text style={styles.financialLabel}>Rider Payout</Text>
                </View>
                <Text style={styles.financialValue}>
                  ₦{riderShare.toLocaleString()}
                </Text>
              </View>

              {/* Discount Info (if any) */}
              {order.discount > 0 && (
                <View style={styles.discountInfo}>
                  <Text style={styles.discountInfoText}>
                    ℹ️ Discount of ₦{order.discount.toLocaleString()} applied
                    {order.discount_type === 'first_order' ? ' (First Order - Platform paid)' : ''}
                    {order.discount_type === 'vendor_promo' ? ' (Vendor Promo - Vendor paid)' : ''}
                  </Text>
                </View>
              )}

              {/* Payment Reference if available */}
              {order.payment_reference && (
                <View style={styles.paymentReference}>
                  <Text style={styles.paymentReferenceLabel}>Payment Reference:</Text>
                  <Text style={styles.paymentReferenceValue}>{order.payment_reference}</Text>
                </View>
              )}

              {/* Gateway Response (if available) */}
              {order.payment_gateway_response && (
                <TouchableOpacity 
                  style={styles.viewResponseButton}
                  onPress={() => {
                    Alert.alert(
                      'Gateway Response',
                      JSON.stringify(order.payment_gateway_response, null, 2),
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <Text style={styles.viewResponseText}>View Gateway Response</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="user" size={16} color="#f97316" />
              <Text style={styles.infoText}>{customer?.name || 'N/A'}</Text>
            </View>
            {customer?.phone && (
              <View style={styles.infoRow}>
                <Feather name="phone" size={16} color="#f97316" />
                <Text style={styles.infoText}>{customer.phone}</Text>
                <TouchableOpacity onPress={callCustomer} style={styles.infoAction}>
                  <Feather name="phone-call" size={16} color="#f97316" />
                </TouchableOpacity>
              </View>
            )}
            {customer?.email && (
              <View style={styles.infoRow}>
                <Feather name="mail" size={16} color="#f97316" />
                <Text style={styles.infoText}>{customer.email}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="map-pin" size={16} color="#f97316" />
              <Text style={styles.infoText}>
                {order.delivery_address?.street}, {order.delivery_address?.area}
              </Text>
            </View>
            {order.delivery_address?.landmark && (
              <Text style={styles.infoSubtext}>Landmark: {order.delivery_address.landmark}</Text>
            )}
            <Text style={styles.infoSubtext}>Phone: {order.delivery_address?.phone}</Text>
          </View>
        </View>

        {/* Vendor Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vendor Details</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="home" size={16} color="#f97316" />
              <Text style={styles.infoText}>{vendor?.name || 'N/A'}</Text>
              {vendor?.phone && (
                <TouchableOpacity onPress={callVendor} style={styles.infoAction}>
                  <Feather name="phone-call" size={16} color="#f97316" />
                </TouchableOpacity>
              )}
            </View>
            {vendor?.phone && (
              <View style={styles.infoRow}>
                <Feather name="phone" size={16} color="#f97316" />
                <Text style={styles.infoText}>{vendor.phone}</Text>
              </View>
            )}
            <Text style={styles.infoSubtext}>{vendor?.address}</Text>
          </View>
        </View>

        {/* Rider Info - Only show if assigned */}
        {rider && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rider Details</Text>
            <View style={styles.riderCard}>
              <View style={styles.riderInfo}>
                <View style={styles.riderAvatar}>
                  {rider.avatar_url ? (
                    <Image source={{ uri: rider.avatar_url }} style={styles.riderAvatarImage} />
                  ) : (
                    <LinearGradient
                      colors={['#f97316', '#f43f5e']}
                      style={styles.riderAvatarPlaceholder}
                    >
                      <Text style={styles.riderAvatarText}>
                        {rider.name?.charAt(0) || 'R'}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.riderDetails}>
                  <Text style={styles.riderName}>{rider.name}</Text>
                  <Text style={styles.riderPhone}>{rider.phone}</Text>
                </View>
                <View style={styles.riderActions}>
                  <TouchableOpacity onPress={callRider} style={styles.riderAction}>
                    <Feather name="phone" size={20} color="#f97316" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={messageRider} style={styles.riderAction}>
                    <Feather name="message-square" size={20} color="#f97316" />
                  </TouchableOpacity>
                </View>
              </View>
              {order.picked_up_at && (
                <Text style={styles.riderMeta}>
                  Picked up at: {new Date(order.picked_up_at).toLocaleString()}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Payment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="credit-card" size={16} color="#f97316" />
              <Text style={styles.infoText}>Method: {order.payment_method}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="check-circle" size={16} color="#f97316" />
              <Text style={styles.infoText}>
                Status: {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Timeline</Text>
          <View style={styles.timelineCard}>
            {order.created_at && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#f97316' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Order Placed</Text>
                  <Text style={styles.timelineTime}>{new Date(order.created_at).toLocaleString()}</Text>
                </View>
              </View>
            )}
            {order.accepted_at && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#3b82f6' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Order Accepted</Text>
                  <Text style={styles.timelineTime}>{new Date(order.accepted_at).toLocaleString()}</Text>
                </View>
              </View>
            )}
            {order.prepared_at && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#f97316' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Prepared</Text>
                  <Text style={styles.timelineTime}>{new Date(order.prepared_at).toLocaleString()}</Text>
                </View>
              </View>
            )}
            {order.picked_up_at && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#8b5cf6' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Picked Up by Rider</Text>
                  <Text style={styles.timelineTime}>{new Date(order.picked_up_at).toLocaleString()}</Text>
                </View>
              </View>
            )}
            {order.delivered_at && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#10b981' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Delivered</Text>
                  <Text style={styles.timelineTime}>{new Date(order.delivered_at).toLocaleString()}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingBottom:60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 20,
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f97316',
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusBanner: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  statusBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBannerLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  statusBannerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBannerDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
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
  // Financial styles
  financialCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  financialLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  financialLabel: {
    fontSize: 13,
    color: '#fff',
  },
  financialValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  financialSubtext: {
    fontSize: 11,
    color: '#666',
    marginBottom: 12,
    marginLeft: 22,
  },
  feeText: {
    color: '#ef4444',
  },
  financialTotalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  financialTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  financialTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  financialDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 12,
  },
  discountInfo: {
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 6,
  },
  discountInfoText: {
    fontSize: 11,
    color: '#f97316',
    textAlign: 'center',
  },
  paymentReference: {
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 6,
  },
  paymentReferenceLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  paymentReferenceValue: {
    fontSize: 12,
    color: '#f97316',
  },
  viewResponseButton: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    alignItems: 'center',
  },
  viewResponseText: {
    color: '#f97316',
    fontSize: 12,
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
  },
  infoSubtext: {
    fontSize: 12,
    color: '#666',
    marginLeft: 28,
    marginBottom: 4,
  },
  infoAction: {
    padding: 4,
  },
  riderCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
  },
  riderAvatarImage: {
    width: '100%',
    height: '100%',
  },
  riderAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  riderPhone: {
    fontSize: 13,
    color: '#666',
  },
  riderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  riderAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderMeta: {
    fontSize: 11,
    color: '#666',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  timelineCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 11,
    color: '#666',
  },
});