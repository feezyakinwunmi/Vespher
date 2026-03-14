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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_DEFAULT, Callout } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

// Define order status type
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

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
  const mapRef = useRef<MapView>(null);

  // Subscription ref for cleanup
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    fetchOrderDetails();
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      // Fetch order with relations
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

      // Fetch customer separately
      if (data.customer_id) {
        const { data: customerData } = await supabase
          .from('users')
          .select('id, name, phone, email, avatar_url')
          .eq('id', data.customer_id)
          .single();

        setCustomer(customerData);
      }

      // Get rider_id and fetch real location from users table
      if (data.rider_id) {
        setRiderId(data.rider_id);
        setRider(data.rider);

        // Fetch initial rider location from users
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
      } else {
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      showToast( 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription for rider location (from users table)
  useEffect(() => {
    if (!riderId) return;

    // Cleanup previous subscription
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
    if (!mapRef.current) return;

    const coordinates = [];

    // Vendor (restaurant)
    if (order?.vendor?.latitude && order?.vendor?.longitude) {
      coordinates.push({
        latitude: order.vendor.latitude,
        longitude: order.vendor.longitude,
      });
    }

    // Delivery (customer)
    if (order?.delivery_address?.latitude && order?.delivery_address?.longitude) {
      coordinates.push({
        latitude: order.delivery_address.latitude,
        longitude: order.delivery_address.longitude,
      });
    }

    // Rider
    if (riderLocation) {
      coordinates.push(riderLocation);
    }

    if (coordinates.length > 1) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    } else if (coordinates.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 1000);
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

      showToast( `Order status updated to ${newStatus}`);
      fetchOrderDetails();
    } catch (error) {
      console.error('Error updating order:', error);
      showToast( 'Failed to update order status');
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
    showToast( 'Coordinates not available');
    return;
  }
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(url).catch(() => {
    showToast( 'Could not open maps');
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
      {/* Header */}
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
        {/* Enhanced Map View */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: order?.vendor?.latitude || 6.5244,
              longitude: order?.vendor?.longitude || 3.3792,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsCompass
            showsScale
          >
            {/* Vendor (Restaurant) */}
            {order?.vendor?.latitude && order?.vendor?.longitude && (
              <Marker
                coordinate={{
                  latitude: order.vendor.latitude,
                  longitude: order.vendor.longitude,
                }}
                title="Your Restaurant"
                description={order.vendor.name}
              >
                <View style={[styles.marker, { backgroundColor: '#f97316' }]}>
                  <Feather name="home" size={18} color="#fff" />
                </View>
                <Callout tooltip>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>YOUR RESTAURANT</Text>
                    <Text style={styles.calloutAddress}>{order.vendor.name}</Text>
                    <Text style={styles.calloutAddress}>{order.vendor.address}</Text>
                   
                  </View>
                </Callout>
              </Marker>
            )}

            {/* Delivery (Customer) */}
            {order?.delivery_address?.latitude && order?.delivery_address?.longitude && (
              <Marker
                coordinate={{
                  latitude: order.delivery_address.latitude,
                  longitude: order.delivery_address.longitude,
                }}
                title="Delivery Location"
                description={order.delivery_address.street}
              >
                <View style={[styles.marker, { backgroundColor: '#10b981' }]}>
                  <Feather name="map-pin" size={18} color="#fff" />
                </View>
                <Callout tooltip>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>DELIVERY LOCATION</Text>
                    <Text style={styles.calloutAddress}>{order.delivery_address.street}</Text>
                    <Text style={styles.calloutContact}>
                      {order.delivery_address.area || ''}
                    </Text>
                  
                  </View>
                </Callout>
              </Marker>
            )}

            {/* Rider Live Location - from users table */}
            {riderLocation && (
              <Marker
                coordinate={riderLocation}
                title="Rider Location"
                description="Live tracking"
              >
                <View style={styles.riderMarker}>
                  <Feather name="truck" size={20} color="#fff" />
                </View>
                <Callout tooltip>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>RIDER LIVE</Text>
                    <Text style={styles.calloutAddress}>Current Position</Text>
                    {riderLocation.timestamp && (
                      <Text style={styles.calloutContact}>
                        Updated: {formatLastUpdate(riderLocation.timestamp)}
                      </Text>
                    )}
                
                  </View>
                </Callout>
              </Marker>
            )}
          </MapView>

          {/* Map Legend */}
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

          {/* Map Status */}
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

        {/* Status Action Buttons */}
        {statusActions && (
          <View style={styles.statusActionsContainer}>
            {statusActions}
          </View>
        )}

        {/* Order Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Order Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order?.status) }]}>
            <Text style={styles.statusBadgeText}>{order?.status?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Customer Info */}
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

        {/* Delivery Address */}
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

        {/* Rider Info */}
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

        {/* Order Items */}
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

        {/* Payment Info */}
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

// Styles (unchanged from your original)
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
    backgroundColor: '#f97316',
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