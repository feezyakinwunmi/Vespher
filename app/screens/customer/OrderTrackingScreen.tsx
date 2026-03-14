// app/screens/customer/OrderTrackingScreen.tsx
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useOrders } from '../../hooks/customer/useOrders';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import { useTracking } from '../../contexts/TrackingContext';
import type { Order, OrderStatus } from '../../types';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

type OrderTrackingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const trackingSteps: { status: OrderStatus; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { status: 'confirmed', label: 'Order Confirmed', icon: 'check-circle' },
  { status: 'preparing', label: 'Preparing Food', icon: 'coffee' },
  { status: 'ready', label: 'Ready for Pickup', icon: 'package' },
  { status: 'picked_up', label: 'Rider Picked Up', icon: 'truck' },
  { status: 'in_transit', label: 'On the Way', icon: 'truck' },
  { status: 'delivered', label: 'Delivered', icon: 'home' },
];

export function OrderTrackingScreen() {
  const navigation = useNavigation<OrderTrackingScreenNavigationProp>();
  const route = useRoute();
  const { orderId } = route.params as { orderId: string };
  
  const { getOrderById } = useOrders();
  const { riderLocation, startTracking, stopTracking } = useTracking();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const mapRef = useRef<MapView>(null);
 const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  useEffect(() => {
    loadOrder();
    startTracking(orderId);

    return () => {
      stopTracking();
    };
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    const data = await getOrderById(orderId);
    setOrder(data);
    setLoading(false);
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', order.id);

              if (error) throw error;
              
              showToast( 'Order cancelled');
              await loadOrder();
            } catch (error) {
              showToast('Failed to cancel order');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // Call Rider
  const handleCallRider = () => {
    if (order?.rider?.phone) {
      Linking.openURL(`tel:${order.rider.phone}`);
    } else {
      showToast('Rider phone number not available');
    }
  };

  // WhatsApp Rider
  const handleWhatsAppRider = () => {
    if (order?.rider?.phone) {
      const formatted = order.rider.phone.replace(/\+/g, '').replace(/\s/g, '');
      Linking.openURL(`https://wa.me/${formatted}`);
    } else {
      showToast( 'Rider WhatsApp number not available');
    }
  };

  const centerMap = () => {
    if (riderLocation && order?.delivery_address?.latitude && order?.delivery_address?.longitude) {
      mapRef.current?.fitToCoordinates(
        [
          { 
            latitude: riderLocation.latitude, 
            longitude: riderLocation.longitude 
          },
          { 
            latitude: order.delivery_address.latitude, 
            longitude: order.delivery_address.longitude 
          },
        ],
        {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        }
      );
    } else if (order?.vendor?.latitude && order?.vendor?.longitude) {
      mapRef.current?.animateToRegion({
        latitude: order.vendor.latitude,
        longitude: order.vendor.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
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
        <TouchableOpacity
          onPress={() => navigation.navigate('Orders')}
          style={styles.errorButton}
        >
          <Text style={styles.errorButtonText}>Back to Orders</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStepIndex = trackingSteps.findIndex(s => s.status === order.status);
  const progress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / trackingSteps.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Track Order</Text>
          <Text style={styles.headerSubtitle}>{order.order_number || order.id.slice(0, 8)}</Text>
        </View>
        <TouchableOpacity onPress={centerMap} style={styles.centerButton}>
          <Feather name="target" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: order.vendor?.latitude || 6.5244,
              longitude: order.vendor?.longitude || 3.3792,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {/* Vendor */}
            {order.vendor?.latitude && order.vendor?.longitude && (
              <Marker
                coordinate={{
                  latitude: order.vendor.latitude,
                  longitude: order.vendor.longitude,
                }}
                title={order.vendor.name}
                description="Restaurant"
              >
                <View style={[styles.marker, { backgroundColor: '#f97316' }]}>
                  <Feather name="home" size={16} color="#fff" />
                </View>
              </Marker>
            )}

            {/* Delivery */}
            {order.delivery_address?.latitude && order.delivery_address?.longitude && (
              <Marker
                coordinate={{
                  latitude: order.delivery_address.latitude,
                  longitude: order.delivery_address.longitude,
                }}
                title="Delivery Address"
                description={order.delivery_address.label}
              >
                <View style={[styles.marker, { backgroundColor: '#10b981' }]}>
                  <Feather name="map-pin" size={16} color="#fff" />
                </View>
              </Marker>
            )}

            {/* Rider */}
            {riderLocation && (
              <Marker
                coordinate={riderLocation}
                title="Rider"
                description="Live location"
              >
                <View style={styles.riderMarker}>
                  <Feather name="truck" size={20} color="#fff" />
                </View>
              </Marker>
            )}
          </MapView>

          <View style={styles.mapStatus}>
            <Text style={styles.mapStatusText}>
              {order.status === 'in_transit' ? 'Rider is on the way' : 'Preparing your order'}
            </Text>
          </View>
        </View>

        {/* Cancel Button */}
        {(order.status === 'pending' || order.status === 'confirmed') && (
          <View style={styles.cancelContainer}>
            <TouchableOpacity
              onPress={handleCancelOrder}
              disabled={cancelling}
              style={styles.cancelButton}
            >
              {cancelling ? (
                <ActivityIndicator color="#ef4444" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Order</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {trackingSteps.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <View key={step.status} style={styles.stepRow}>
                <View style={styles.stepIconContainer}>
                  <View style={[
                    styles.stepIcon,
                    isCompleted && styles.stepIconCompleted,
                  ]}>
                    <Feather 
                      name={step.icon} 
                      size={20} 
                      color={isCompleted ? '#fff' : '#666'} 
                    />
                  </View>
                  {index < trackingSteps.length - 1 && (
                    <View style={[
                      styles.stepLine,
                      index < currentStepIndex && styles.stepLineCompleted,
                    ]} />
                  )}
                </View>

                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepLabel,
                    isCompleted && styles.stepLabelCompleted,
                  ]}>
                    {step.label}
                  </Text>
                  {isCurrent && (
                    <Text style={styles.stepStatus}>
                      {order.status === 'preparing' ? 'Chef is preparing your meal' : 'In progress...'}
                    </Text>
                  )}
                  {isCompleted && !isCurrent && (
                    <Text style={styles.stepCompleted}>Completed</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Order Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Order Details</Text>
          <View style={styles.itemsList}>
            {order.items.map((item: any, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName}>
                  {item.quantity}x {item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  ₦{(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{order.total.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.addressCard}>
          <Text style={styles.addressTitle}>Delivery Address</Text>
          <View style={styles.addressContent}>
            <Feather name="map-pin" size={18} color="#f97316" />
            <View style={styles.addressTextContainer}>
              <Text style={styles.addressLabel}>{order.delivery_address?.label}</Text>
              <Text style={styles.addressText}>
                {order.delivery_address?.street}, {order.delivery_address?.area}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Rider Info with Call/WhatsApp Buttons */}
      {order.rider && (
        <View style={styles.riderContainer}>
          <View style={styles.riderInfo}>
            <View style={styles.riderAvatar}>
              {order.rider.avatar_url ? (
                <Image 
                  source={{ uri: order.rider.avatar_url }} 
                  style={styles.riderAvatarImage}
                />
              ) : (
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.riderAvatarPlaceholder}
                >
                  <Text style={styles.riderAvatarText}>
                    {order.rider.name?.charAt(0) || 'R'}
                  </Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.riderDetails}>
              <Text style={styles.riderName}>{order.rider.name || 'Assigned Rider'}</Text>
              <Text style={styles.riderType}>{order.rider.vehicle_type || 'Rider'}</Text>
            </View>
          </View>

         
        </View>
      )}
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
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    height: 250,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  riderMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapStatus: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
  },
  mapStatusText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  cancelContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cancelButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 2,
  },
  stepsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepIconContainer: {
    alignItems: 'center',
    width: 40,
    marginRight: 12,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  stepIconCompleted: {
    backgroundColor: '#f97316',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 4,
  },
  stepLineCompleted: {
    backgroundColor: '#f97316',
  },
  stepContent: {
    flex: 1,
    paddingBottom: 24,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  stepLabelCompleted: {
    color: '#fff',
  },
  stepStatus: {
    fontSize: 13,
    color: '#f97316',
  },
  stepCompleted: {
    fontSize: 12,
    color: '#666',
  },
  detailsCard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    color: '#fff',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  addressCard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  addressContent: {
    flexDirection: 'row',
    gap: 12,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13,
    color: '#666',
  },
  riderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#1a1a1a',
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
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
    justifyContent: 'center',
  },
  riderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  riderType: {
    fontSize: 12,
    color: '#666',
  },
  riderActions: {
    flexDirection: 'row',
    gap: 16,
  },
  riderAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});