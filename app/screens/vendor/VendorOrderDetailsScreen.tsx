// app/screens/vendor/VendorOrderDetailsScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

// ✅ Add interface for fee breakdown
interface FeeBreakdown {
  subtotal: number;
  platformCommission: number;
  flutterwaveFee: number;
  vatOnFee: number;
  stampDuty: number;
  vendorPayout: number;
  platformNetEarnings: number;
}

export function VendorOrderDetailsScreen() {
  const navigation = useNavigation();
  const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  const route = useRoute();
  const { orderId } = route.params as { orderId: string };

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number; timestamp?: string } | null>(null);
  const [rider, setRider] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<any>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  
  const mapRef = useRef<any>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    fetchOrderDetails();
    fetchPlatformSettings();
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [orderId]);

  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setPlatformSettings(data);
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    }
  };

  const calculateFeeBreakdown = (orderData: any) => {
    if (!orderData) return null;

    const subtotal = orderData.subtotal || 0;
    const platformCommission = orderData.platform_commission || Math.round(subtotal * 0.1);
    const vendorPayout = orderData.vendor_payout || (subtotal - platformCommission);
    
    const flutterwaveFee = orderData.flutterwave_fee || Math.round(orderData.total * 0.02);
    const vatOnFee = orderData.vat_on_fee || Math.round(flutterwaveFee * 0.075);
    const stampDuty = orderData.stamp_duty || (orderData.total >= 10000 ? 50 : 0);
    const platformNetEarnings = orderData.platform_net_earnings || 
      (platformCommission - flutterwaveFee - vatOnFee - stampDuty);

    return {
      subtotal,
      platformCommission,
      flutterwaveFee,
      vatOnFee,
      stampDuty,
      vendorPayout,
      platformNetEarnings,
    };
  };

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          vendor:vendors(*),
          rider:rider_id(*),
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      setOrder(data);
      setFeeBreakdown(calculateFeeBreakdown(data));

      if (data.customer_id) {
        const { data: customerData } = await supabase
          .from('users')
          .select('id, name, phone, email, avatar_url')
          .eq('id', data.customer_id)
          .single();

        setCustomer(customerData);
      }

      if (data.rider_id) {
        setRiderId(data.rider_id);
        setRider(data.rider);

        const { data: riderLocData, error: locError } = await supabase
          .from('users')
          .select('current_latitude, current_longitude, last_location_update')
          .eq('id', data.rider_id)
          .single();

        if (locError) {
          console.warn('No rider location yet:', locError.message);
        } else if (riderLocData?.current_latitude && riderLocData?.current_longitude) {
          setRiderLocation({
            latitude: Number(riderLocData.current_latitude),
            longitude: Number(riderLocData.current_longitude),
            timestamp: riderLocData.last_location_update || new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      showToast('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!riderId) return;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .channel(`rider-location-${riderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${riderId}`,
        },
        (payload: any) => {
          if (payload.new.current_latitude && payload.new.current_longitude) {
            setRiderLocation({
              latitude: Number(payload.new.current_latitude),
              longitude: Number(payload.new.current_longitude),
              timestamp: payload.new.last_location_update || new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [riderId]);

  const centerMap = () => {
    const coordinates = [];

    if (order?.vendor?.latitude && order?.vendor?.longitude) {
      coordinates.push({
        latitude: order.vendor.latitude,
        longitude: order.vendor.longitude,
      });
    }

    if (order?.delivery_address?.latitude && order?.delivery_address?.longitude) {
      coordinates.push({
        latitude: order.delivery_address.latitude,
        longitude: order.delivery_address.longitude,
      });
    }

    if (riderLocation) {
      coordinates.push(riderLocation);
    }
  };

  const updateOrderStatus = async (newStatus: OrderStatus) => {
    if (!order) return;

    setUpdating(true);
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'preparing') {
        updates.prepared_at = new Date().toISOString();
      } else if (newStatus === 'ready') {
        updates.ready_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id);

      if (error) throw error;

      showToast(`Order status updated to ${newStatus}`);
      fetchOrderDetails();
    } catch (error) {
      console.error('Error updating order:', error);
      showToast('Failed to update order status');
    } finally {
      setUpdating(false);
    }
  };

  const handleCallRider = () => {
    if (rider?.phone) {
      Linking.openURL(`tel:${rider.phone}`);
    } else {
      showToast('Rider phone not available');
    }
  };

  const handleWhatsAppRider = () => {
    if (rider?.phone) {
      const formatted = rider.phone.replace(/\+/g, '').replace(/\s/g, '');
      Linking.openURL(`https://wa.me/${formatted}`);
    }
  };

  const handleCallCustomer = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const handleWhatsAppCustomer = () => {
    if (customer?.phone) {
      const formatted = customer.phone.replace(/\+/g, '').replace(/\s/g, '');
      Linking.openURL(`https://wa.me/${formatted}`);
    }
  };

  const handleNavigate = (lat?: number, lng?: number) => {
    if (!lat || !lng) {
      showToast('Coordinates not available');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      showToast('Could not open maps');
    });
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

  const getStatusActions = () => {
    if (!order) return null;
    const actions = [];

    if (order.status === 'confirmed') {
      actions.push(
        <TouchableOpacity
          key="preparing"
          style={[styles.actionButton, styles.preparingButton]}
          onPress={() => updateOrderStatus('preparing')}
          disabled={updating}
        >
          <Feather name="coffee" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Start Preparing</Text>
        </TouchableOpacity>
      );
    }

    if (order.status === 'preparing') {
      actions.push(
        <TouchableOpacity
          key="ready"
          style={[styles.actionButton, styles.readyButton]}
          onPress={() => updateOrderStatus('ready')}
          disabled={updating}
        >
          <Feather name="check-circle" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Mark as Ready</Text>
        </TouchableOpacity>
      );
    }

    return actions.length > 0 ? actions : null;
  };

  const formatLastUpdate = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEventTypeLabel = (eventType: string) => {
    const types: Record<string, string> = {
      party: 'Party/Celebration',
      corporate: 'Corporate Event',
      family: 'Family Gathering',
      dietary: 'Dietary Restrictions',
      allergies: 'Allergies',
      other: 'Other',
    };
    return types[eventType] || eventType;
  };

  // ✅ Render earnings breakdown
  const renderEarningsBreakdown = () => {
    if (!feeBreakdown) return null;

    return (
      <View style={styles.earningsCard}>
        <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
        
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Order Subtotal:</Text>
          <Text style={styles.earningsValue}>₦{feeBreakdown.subtotal.toLocaleString()}</Text>
        </View>

        <View style={styles.earningsDivider} />

        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Platform Commission (10%):</Text>
          <Text style={[styles.earningsValue, styles.deduction]}>
            -₦{feeBreakdown.platformCommission.toLocaleString()}
          </Text>
        </View>

        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Flutterwave Fee (2%):</Text>
          <Text style={[styles.earningsValue, styles.deduction]}>
            -₦{feeBreakdown.flutterwaveFee.toLocaleString()}
          </Text>
        </View>

        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>VAT on Fee (7.5%):</Text>
          <Text style={[styles.earningsValue, styles.deduction]}>
            -₦{feeBreakdown.vatOnFee.toLocaleString()}
          </Text>
        </View>

        {feeBreakdown.stampDuty > 0 && (
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Stamp Duty:</Text>
            <Text style={[styles.earningsValue, styles.deduction]}>
              -₦{feeBreakdown.stampDuty.toLocaleString()}
            </Text>
          </View>
        )}

        <View style={styles.earningsDivider} />

        <View style={[styles.earningsRow, styles.netEarningsRow]}>
          <Text style={styles.netEarningsLabel}>Your Net Payout:</Text>
          <Text style={styles.netEarningsValue}>₦{feeBreakdown.vendorPayout.toLocaleString()}</Text>
        </View>

        <View style={styles.earningsNote}>
          <Feather name="info" size={12} color="#f97316" />
          <Text style={styles.earningsNoteText}>
            Payout will be sent to your registered bank account within 1-3 business days
          </Text>
        </View>
      </View>
    );
  };

  // ✅ Render scheduled details (now from orders table)
 // ✅ Render scheduled details (from orders table)
const renderScheduledDetails = () => {
  if (!order?.is_scheduled) return null;

  const scheduledDateTime = order.scheduled_datetime ? new Date(order.scheduled_datetime) : null;

  return (
    <View style={styles.scheduledCard}>
      <Text style={styles.sectionTitle}>
        <Feather name="calendar" size={16} color="#8b5cf6" /> Scheduled Order
      </Text>
      
      {scheduledDateTime && (
        <>
          <View style={styles.infoRow}>
            <Feather name="calendar" size={16} color="#f97316" />
            <Text style={styles.infoText}>
              Date: {scheduledDateTime.toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Feather name="clock" size={16} color="#f97316" />
            <Text style={styles.infoText}>
              Time: {scheduledDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </>
      )}
      
      {order.event_type && order.event_type !== 'other' && (
        <View style={styles.infoRow}>
          <Feather name="tag" size={16} color="#f97316" />
          <Text style={styles.infoText}>
            Event Type: {order.event_type.charAt(0).toUpperCase() + order.event_type.slice(1)}
          </Text>
        </View>
      )}
      
      {order.special_request_category && (
        <View style={styles.infoRow}>
          <Feather name="alert-circle" size={16} color="#f97316" />
          <Text style={styles.infoText}>
            Request Category: {order.special_request_category}
          </Text>
        </View>
      )}
      
      {order.special_request_text && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsLabel}>Special Request:</Text>
          <Text style={styles.instructionsText}>{order.special_request_text}</Text>
        </View>
      )}
    </View>
  );
};

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading order details...</Text>
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

  const statusActions = getStatusActions();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order?.order_number || order?.id?.slice(0, 8)}</Text>
        <TouchableOpacity onPress={centerMap} style={styles.centerButton}>
          <Feather name="target" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.mapContainer}>
          <WebView
            originWhitelist={['*']}
            style={styles.map}
            source={{
              html: `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body{margin:0;padding:0}
#map{height:100vh;width:100vw}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var vendorIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -35]
});

var riderIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -35]
});

var deliveryIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -35]
});

var map = L.map('map').setView(
[${order?.vendor?.latitude || 6.5244}, ${order?.vendor?.longitude || 3.3792}],
13
);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{ attribution: '© OpenStreetMap' }
).addTo(map);

var vendor = L.marker([
${order?.vendor?.latitude || 6.5244},
${order?.vendor?.longitude || 3.3792}
],  {icon: vendorIcon}
).addTo(map).bindPopup("Restaurant");

${
order?.delivery_address?.latitude
? `
var delivery = L.marker([
${order.delivery_address.latitude},
${order.delivery_address.longitude}
],{icon: deliveryIcon}).addTo(map).bindPopup("Delivery Location");
`
: ''
}

${
riderLocation
? `
var rider = L.marker([
${riderLocation.latitude},
${riderLocation.longitude}
],{icon: riderIcon}).addTo(map).bindPopup("Rider");
`
: ''
}

var routePoints = [];

routePoints.push([
${order?.vendor?.latitude || 6.5244},
${order?.vendor?.longitude || 3.3792}
]);

${
riderLocation
? `
routePoints.push([
${riderLocation.latitude},
${riderLocation.longitude}
]);
`
: ''
}

${
order?.delivery_address?.latitude
? `
routePoints.push([
${order.delivery_address.latitude},
${order.delivery_address.longitude}
]);
`
: ''
}

var polyline = L.polyline(routePoints,{
color:'#f97316',
weight:5
}).addTo(map);

map.fitBounds(polyline.getBounds());

</script>
</body>
</html>
`
            }}
          />

          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
              <Text style={styles.legendText}>Restaurant</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Delivery</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>Rider</Text>
            </View>
          </View>

          <View style={styles.mapStatus}>
            <Text style={styles.mapStatusText}>
              {riderLocation
                ? 'Rider is on the way'
                : order?.status === 'ready'
                ? 'Waiting for rider assignment'
                : `Order status: ${order?.status?.replace('_', ' ')}`}
            </Text>
          </View>
        </View>

        {statusActions && (
          <View style={styles.statusActionsContainer}>
            {statusActions}
          </View>
        )}

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Order Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order?.status) }]}>
            <Text style={styles.statusBadgeText}>{order?.status?.toUpperCase()}</Text>
          </View>
        </View>

        {/* ✅ Scheduled Details - Now from orders table */}
        {renderScheduledDetails()}

        {/* ✅ Earnings Breakdown */}
        {feeBreakdown && renderEarningsBreakdown()}

        <View style={styles.customerCard}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.customerInfo}>
            <View style={styles.customerAvatar}>
              {customer?.avatar_url ? (
                <Image source={{ uri: customer.avatar_url }} style={styles.customerAvatarImage} />
              ) : (
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.customerAvatarPlaceholder}
                >
                  <Text style={styles.customerAvatarText}>
                    {customer?.name?.charAt(0) || order?.customer_name?.charAt(0) || 'C'}
                  </Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.customerDetails}>
              <Text style={styles.customerName}>
                {customer?.name || order?.customer_name || 'Customer'}
              </Text>
              <View style={styles.contactRow}>
                <Feather name="phone" size={14} color="#666" />
                <Text style={styles.contactText}>{customer?.phone || order?.customer_phone || 'No phone'}</Text>
              </View>
              {customer?.email && (
                <View style={styles.contactRow}>
                  <Feather name="mail" size={14} color="#666" />
                  <Text style={styles.contactText}>{customer.email}</Text>
                </View>
              )}
            </View>
            {customer?.phone && (
              <View style={styles.actionButtonsSmall}>
                <TouchableOpacity onPress={handleCallCustomer} style={styles.iconButton}>
                  <Feather name="phone" size={18} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleWhatsAppCustomer} style={styles.iconButton}>
                  <Feather name="message-circle" size={18} color="#25D366" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={16} color="#f97316" />
            <Text style={styles.infoText}>
              {order?.delivery_address?.street}, {order?.delivery_address?.area || ''}
            </Text>
          </View>
          {order?.delivery_address?.phone && (
            <View style={styles.infoRow}>
              <Feather name="phone" size={16} color="#666" />
              <Text style={styles.infoText}>{order.delivery_address.phone}</Text>
            </View>
          )}
        </View>

        {rider && (
          <View style={styles.riderCard}>
            <Text style={styles.sectionTitle}>Rider Details</Text>
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
                {rider.vehicle_type && (
                  <Text style={styles.riderVehicle}>{rider.vehicle_type}</Text>
                )}
              </View>
              <View style={styles.riderActions}>
                <TouchableOpacity onPress={handleCallRider} style={styles.riderAction}>
                  <Feather name="phone" size={18} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleWhatsAppRider} style={styles.riderAction}>
                  <Feather name="message-circle" size={18} color="#25D366" />
                </TouchableOpacity>
              </View>
            </View>
            {riderLocation && (
              <Text style={styles.lastUpdated}>
                Last location update: {formatLastUpdate(riderLocation.timestamp)}
              </Text>
            )}
          </View>
        )}

        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order?.items?.map((item: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQuantity}>x{item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>₦{(item.price * item.quantity).toLocaleString()}</Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₦{order?.total?.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Method:</Text>
            <Text style={styles.infoValue}>{order?.payment_method || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, { color: order?.payment_status === 'paid' ? '#10b981' : '#f59e0b' }]}>
              {order?.payment_status?.toUpperCase() || 'PENDING'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Add new styles for earnings breakdown
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingBottom: 60,
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  scheduledCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  instructionsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  instructionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
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
  centerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    height: 300,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  riderMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'blue',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  callout: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  calloutTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 4,
  },
  calloutAddress: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 2,
  },
  calloutContact: {
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
  },
  calloutButton: {
    backgroundColor: '#f97316',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  calloutButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  calloutRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  calloutIconButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  mapLegend: {
    position: 'absolute',
    bottom: 60,
    right: 16,
    backgroundColor: '#1a1a1a',
    padding: 8,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#fff',
  },
  mapStatus: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
  },
  mapStatusText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  statusActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
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
  preparingButton: {
    backgroundColor: '#f97316',
  },
  readyButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  earningsCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  earningsLabel: {
    fontSize: 13,
    color: '#666',
  },
  earningsValue: {
    fontSize: 13,
    color: '#fff',
  },
  deduction: {
    color: '#f43f5e',
  },
  earningsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 8,
  },
  netEarningsRow: {
    marginTop: 4,
  },
  netEarningsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  netEarningsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  earningsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249,115,22,0.1)',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  earningsNoteText: {
    fontSize: 11,
    color: '#f97316',
    flex: 1,
  },
  customerCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 12,
  },
  customerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  customerAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  contactText: {
    fontSize: 13,
    color: '#666',
  },
  actionButtonsSmall: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
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
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    width: 80,
  },
  infoValue: {
    fontSize: 13,
    color: '#fff',
    flex: 1,
  },
  riderCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
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
  riderVehicle: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  riderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  riderAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastUpdated: {
    fontSize: 10,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
  },
  itemsCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 14,
    color: '#fff',
  },
  itemQuantity: {
    fontSize: 13,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f97316',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
  },
  paymentCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
});