// app/screens/customer/OrderTrackingScreen.tsx

import React, { useState, useEffect } from "react";
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
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WebView } from "react-native-webview";
import { processRefund } from '../../utils/refund';
import { useOrders } from "../../hooks/customer/useOrders";
import { supabase } from "../../lib/supabase";
import { RootStackParamList } from "../../navigation/types";
import { useTracking } from "../../contexts/TrackingContext";
import type { Order, OrderStatus } from "../../types";
import { useOrderTimer } from "../../hooks/useOrderTimer";

import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");

type OrderTrackingScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

const trackingSteps: {
  status: OrderStatus;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}[] = [
  { status: "confirmed", label: "Order Confirmed", icon: "check-circle" },
  { status: "preparing", label: "Preparing Food", icon: "coffee" },
  { status: "ready", label: "Ready for Pickup", icon: "package" },
  { status: "picked_up", label: "Rider Picked Up", icon: "truck" },
  { status: "in_transit", label: "On the Way", icon: "truck" },
  { status: "delivered", label: "Delivered", icon: "home" },
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

  const showToast = (message: string) => {
    Toast.show({
      type: "success",
      text1: message,
      position: "bottom",
      visibilityTime: 2000,
    });
  };

  useEffect(() => {
    loadOrder();
    startTracking(orderId);

    return () => stopTracking();
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    const data = await getOrderById(orderId);
    setOrder(data);
    setLoading(false);
  };

const handleCancelOrder = async () => {
  if (!order) return;

  // Check if order can be cancelled
  if (order.status !== 'pending') {
    showToast('Order cannot be cancelled at this stage');
    return;
  }

  // Check if order is scheduled (maybe different cancellation rules)
  const isScheduled = order.is_scheduled === true;
  const cancelMessage = isScheduled 
    ? 'Are you sure you want to cancel this scheduled order?'
    : 'Are you sure you want to cancel this order?';

  // Add payment warning if already paid
  const paymentWarning = order.payment_method === 'card' && order.payment_status === 'paid'
    ? '\n\nA refund will be processed to your card. This may take 3-7 business days.'
    : '';

  Alert.alert(
    "Cancel Order", 
    cancelMessage + paymentWarning,
    [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);

          try {
            // 1. If paid with card, process refund via Flutterwave
            if (order.payment_method === 'card' && order.payment_status === 'paid') {
              showToast('Processing refund...');
              
              // Get transaction ID from order
              const transactionId = order.flutterwave_transaction_id;
              
              if (transactionId) {
                // Call your refund function
                const refundResult = await processRefund(order.id, 'Customer cancelled');
                
                if (!refundResult.success) {
                  // If refund fails, still cancel but warn
                  showToast('Order cancelled but refund failed. Contact support.');
                }
              }
            }

            // 2. Update order status to cancelled
            const { error } = await supabase
              .from("orders")
              .update({ 
                status: "cancelled",
                updated_at: new Date().toISOString(),
                cancelled_by: 'customer',
                cancelled_at: new Date().toISOString(),
                rejection_reason: "Cancelled by customer"
              })
              .eq("id", order.id);

            if (error) throw error;

            showToast("Order cancelled successfully");
            await loadOrder();
            
          } catch (error) {
            console.error('Cancel error:', error);
            showToast("Failed to cancel order");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]
  );
};
  
  const handleCallRider = () => {
    if (order?.rider?.phone) {
      Linking.openURL(`tel:${order.rider.phone}`);
    } else {
      showToast("Rider phone number not available");
    }
  };

  const handleWhatsAppRider = () => {
    if (order?.rider?.phone) {
      const formatted = order.rider.phone.replace(/\+/g, "").replace(/\s/g, "");

      Linking.openURL(`https://wa.me/${formatted}`);
    } else {
      showToast("Rider WhatsApp number not available");
    }
  };

 
// Move this hook to the top with fallback values
const { timeRemaining, isExpired, formattedTime } = useOrderTimer(
  order?.created_at || new Date().toISOString(),  // Fallback if order is null
  order?.status || 'pending',                      // Fallback if order is null
  orderId                                          // orderId is always available
);
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
          onPress={() => navigation.navigate("Orders")}
          style={styles.errorButton}
        >
          <Text style={styles.errorButtonText}>Back to Orders</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const vendorLat = order.vendor?.latitude || 6.5244;
  const vendorLng = order.vendor?.longitude || 3.3792;

  const deliveryLat = order.delivery_address?.latitude;
  const deliveryLng = order.delivery_address?.longitude;

  const riderLat = riderLocation?.latitude;
  const riderLng = riderLocation?.longitude;

  const mapHTML = `

<!DOCTYPE html>
<html>

<head>

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<link rel="stylesheet"
href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>

<style>
html,body{margin:0;padding:0}
#map{height:100vh;width:100vw}
</style>

</head>

<body>

<div id="map"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<script>


// Custom marker icons

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



var map=L.map('map').setView(
[${vendorLat},${vendorLng}],13);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{ attribution:'© OpenStreetMap'}
).addTo(map);

var vendor=L.marker(
  [${vendorLat},${vendorLng}],
  {icon: vendorIcon}
).addTo(map).bindPopup("Restaurant");

${
  deliveryLat && deliveryLng
    ? `
var delivery=L.marker(
  [${deliveryLat},${deliveryLng}],
  {icon: deliveryIcon}
).addTo(map).bindPopup("Delivery");
`
    : ""
}

${
  riderLat && riderLng
    ? `
var rider=L.marker(
  [${riderLat},${riderLng}],
  {icon: riderIcon}
).addTo(map).bindPopup("Rider");
`
    : ""
}

var routePoints=[];

routePoints.push([${vendorLat},${vendorLng}]);

${riderLat ? `routePoints.push([${riderLat},${riderLng}]);` : ""}

${deliveryLat ? `routePoints.push([${deliveryLat},${deliveryLng}]);` : ""}

var polyline=L.polyline(routePoints,{
color:'#f97316',
weight:5
}).addTo(map);

map.fitBounds(polyline.getBounds());

</script>

</body>
</html>

`;

  const currentStepIndex = trackingSteps.findIndex(
    (s) => s.status === order.status,
  );

  const progress =
    currentStepIndex >= 0
      ? ((currentStepIndex + 1) / trackingSteps.length) * 100
      : 0;



  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>

        <View>
          <Text style={styles.headerTitle}>Track Order</Text>

          <Text style={styles.headerSubtitle}>
            {order.order_number || order.id.slice(0, 8)}
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.mapContainer}>
          <WebView originWhitelist={["*"]} source={{ html: mapHTML }} />

          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#f97316" }]}
              />
              <Text style={styles.legendText}>Restaurant</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#10b981" }]}
              />
              <Text style={styles.legendText}>Delivery</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#3b82f6" }]}
              />
              <Text style={styles.legendText}>Rider</Text>
            </View>
          </View>

          <View style={styles.mapStatus}>
            <Text style={styles.mapStatusText}>
              {order.status === "in_transit"
                ? "Rider is on the way"
                : "Preparing your order"}
            </Text>
          </View>
        </View>

        {/* Cancel */}

        {(order.status === "pending" || order.status === "confirmed") && (
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


{order.status === 'pending' && timeRemaining !== null && (
  <View style={styles.vendorTimerCard}>
    <View style={styles.vendorTimerHeader}>
      <Feather name="clock" size={20} color="#f59e0b" />
      <Text style={styles.vendorTimerTitle}>Waiting for vendor</Text>
    </View>
    
    {!isExpired && timeRemaining > 0 ? (
      <>
        <Text style={styles.vendorTimerSubtitle}>
          The vendor has {formattedTime} to accept your order
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { 
                width: `${(timeRemaining / (30 * 60)) * 100}%`,
                backgroundColor: timeRemaining < 300 ? '#ef4444' : '#f59e0b'
              }
            ]} 
          />
        </View>
      </>
    ) : isExpired ? (
      <View style={styles.expiredContainer}>
        <Feather name="alert-circle" size={20} color="#ef4444" />
        <View style={styles.expiredContent}>
          <Text style={styles.expiredTitle}>Order Cancelled</Text>
          <Text style={styles.expiredMessage}>
            Vendor didn't accept your order within 30 minutes.
          </Text>
          
          {/* ONLY show refund message for PAID orders */}
          {order.payment_method === 'card' && order.payment_status === 'paid' && (
            <View style={styles.refundInfo}>
              <Feather name="info" size={14} color="#f59e0b" />
              <Text style={styles.refundText}>
                A refund will be processed to your card within 3-7 business days.
                You don't need to do anything.
              </Text>
            </View>
          )}
          
          {/* For cash orders - NO refund message, just cancellation notice */}
          {/* No additional UI needed here since the cancellation message already shows */}
          
        </View>
      </View>
    ) : null}
  </View>
)}


  {order.status === 'cancelled' && (
    <View style={styles.cancelledCard}>
      <Feather name="alert-circle" size={24} color="#ef4444" />
      <Text style={styles.cancelledTitle}>Order Cancelled</Text>
      <Text style={styles.cancelledReason}>{order.rejection_reason}</Text>
      
      {order.payment_method === 'card' && order.payment_status === 'refunded' && (
        <View style={styles.refundSuccess}>
          <Feather name="check-circle" size={16} color="#10b981" />
          <Text style={styles.refundSuccessText}>
            Refund completed - check your bank account
          </Text>
        </View>
      )}
      
      {order.payment_method === 'card' && order.refund_status === 'processing' && (
        <View style={styles.refundPending}>
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text style={styles.refundPendingText}>
            Refund processing (3-7 business days)
          </Text>
        </View>
      )}
      
      {order.payment_method === 'card' && order.refund_status === 'failed' && (
        <View style={styles.refundFailed}>
          <Feather name="alert-triangle" size={16} color="#ef4444" />
          <Text style={styles.refundFailedText}>
            Refund failed - please contact support
          </Text>
        </View>
      )}
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
                  <View
                    style={[
                      styles.stepIcon,
                      isCompleted && styles.stepIconCompleted,
                    ]}
                  >
                    <Feather
                      name={step.icon}
                      size={20}
                      color={isCompleted ? "#fff" : "#666"}
                    />
                  </View>
                  {index < trackingSteps.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        index < currentStepIndex && styles.stepLineCompleted,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text
                    style={[
                      styles.stepLabel,
                      isCompleted && styles.stepLabelCompleted,
                    ]}
                  >
                    {step.label}
                  </Text>

                  {isCurrent && !isCompleted && (
                    <Text style={styles.stepStatus}>
                      {order.status === "preparing"
                        ? "Chef is preparing your meal"
                        : "In progress..."}
                    </Text>
                  )}

                  {isCompleted && (
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

          {order.items.map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
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
            <Text style={styles.totalValue}>
              ₦{order.total.toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Rider */}

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
                  colors={["#f97316", "#f43f5e"]}
                  style={styles.riderAvatarPlaceholder}
                >
                  <Text style={styles.riderAvatarText}>
                    {order.rider.name?.charAt(0) || "R"}
                  </Text>
                </LinearGradient>
              )}
            </View>

            <View>
              <Text style={styles.riderName}>{order.rider.name}</Text>

              <Text style={styles.riderType}>{order.rider.vehicle_type}</Text>
            </View>
          </View>

          <View style={styles.riderActions}>
            <TouchableOpacity
              onPress={handleCallRider}
              style={styles.riderAction}
            >
              <Feather name="phone" size={22} color="#f97316" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleWhatsAppRider}
              style={styles.riderAction}
            >
              <Feather name="message-circle" size={22} color="#25D366" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", paddingBottom: 60 },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  errorTitle: { color: "#fff", marginTop: 10 },

  errorButton: {
    backgroundColor: "#f97316",
    padding: 10,
    marginTop: 10,
  },

  errorButtonText: { color: "#fff" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    alignItems: "center",
  },

  backButton: {
    width: 40,
    height: 40,
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },

  headerSubtitle: {
    color: "#666",
    fontSize: 12,
  },

  mapContainer: {
    height: 260,
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
  },

  mapStatus: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 8,
    borderRadius: 8,
  },

  mapStatusText: {
    color: "#fff",
    textAlign: "center",
  },

  cancelContainer: { paddingHorizontal: 16 },

  cancelButton: {
    borderWidth: 1,
    borderColor: "#ef4444",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#ef4444",
    fontWeight: "600",
  },

  progressContainer: { padding: 16 },

  progressBar: {
    height: 4,
    backgroundColor: "#1a1a1a",
    borderRadius: 2,
  },

  progressFill: {
    height: 4,
    backgroundColor: "#f97316",
  },
  vendorTimerCard: {
  backgroundColor: '#1a1a1a',
  padding: 16,
  borderRadius: 12,
  marginBottom: 16,
},
vendorTimerHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
},
vendorTimerTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#fff',
},
vendorTimerSubtitle: {
  fontSize: 13,
  color: '#f59e0b',
  marginBottom: 12,
},
cancelledCard: {
  backgroundColor: '#1a1a1a',
  margin: 16,
  marginTop: 0,
  padding: 20,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#ef4444',
  alignItems: 'center',
},
cancelledTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#ef4444',
  marginTop: 8,
  marginBottom: 4,
},
cancelledReason: {
  fontSize: 14,
  color: '#666',
  textAlign: 'center',
  marginBottom: 16,
},
refundSuccess: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: 'rgba(16,185,129,0.1)',
  padding: 12,
  borderRadius: 8,
  width: '100%',
},
refundSuccessText: {
  fontSize: 13,
  color: '#10b981',
  flex: 1,
},
refundPending: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: 'rgba(245,158,11,0.1)',
  padding: 12,
  borderRadius: 8,
  width: '100%',
},
refundPendingText: {
  fontSize: 13,
  color: '#f59e0b',
  flex: 1,
},
refundFailed: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: 'rgba(239,68,68,0.1)',
  padding: 12,
  borderRadius: 8,
  width: '100%',
},
refundFailedText: {
  fontSize: 13,
  color: '#ef4444',
  flex: 1,
},

expiredMessage: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: 'rgba(239,68,68,0.1)',
  padding: 12,
  borderRadius: 8,
},
expiredMessageText: {
  fontSize: 13,
  color: '#ef4444',
  flex: 1,
},
  stepsContainer: { paddingHorizontal: 16, paddingVertical: 16 },
  stepRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  expiredContainer: {
  flexDirection: 'row',
  backgroundColor: 'rgba(239,68,68,0.1)',
  padding: 16,
  borderRadius: 12,
  gap: 12,
},
expiredContent: {
  flex: 1,
},
expiredTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#ef4444',
  marginBottom: 4,
},

refundInfo: {
  flexDirection: 'row',
  gap: 8,
  backgroundColor: 'rgba(245,158,11,0.1)',
  padding: 10,
  borderRadius: 8,
  marginTop: 8,
},
refundText: {
  fontSize: 12,
  color: '#f59e0b',
  flex: 1,
  lineHeight: 18,
},
manualCancelButton: {
  backgroundColor: '#ef4444',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  marginTop: 12,
},
manualCancelText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
},
  stepIconContainer: { alignItems: "center", width: 40, marginRight: 12 },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  stepIconCompleted: {
    backgroundColor: "#f97316",
  },

  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#1a1a1a",
    marginVertical: 4,
  },

  stepLineCompleted: {
    backgroundColor: "#f97316",
  },

  stepContent: {
    flex: 1,
    paddingBottom: 24,
  },

  stepLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
    marginBottom: 4,
  },

  stepLabelCompleted: {
    color: "#fff",
  },

  stepStatus: {
    fontSize: 13,
    color: "#f97316",
  },
  stepCompleted: {
    fontSize: 12,
    color: "#666",
  },
  mapLegend: {
    position: "absolute",
    bottom: 60,
    right: 16,
    backgroundColor: "#1a1a1a",
    padding: 8,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: "#fff",
  },

  detailsCard: {
    backgroundColor: "#1a1a1a",
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },

  detailsTitle: {
    color: "#fff",
    marginBottom: 12,
    fontWeight: "600",
  },

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  itemName: { color: "#ccc" },

  itemPrice: { color: "#fff" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  totalLabel: {
    color: "#fff",
    fontWeight: "600",
  },

  totalValue: {
    color: "#f97316",
    fontWeight: "700",
  },

  riderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#1a1a1a",
  },

  riderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },

  riderAvatarImage: {
    width: "100%",
    height: "100%",
  },

  riderAvatarPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  riderAvatarText: {
    color: "#fff",
    fontWeight: "bold",
  },

  riderName: { color: "#fff" },

  riderType: {
    color: "#777",
    fontSize: 12,
  },

  riderActions: {
    flexDirection: "row",
    gap: 12,
  },

  riderAction: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(249,115,22,0.1)",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
