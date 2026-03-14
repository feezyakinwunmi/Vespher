// app/components/vendor/OrderCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
interface OrderCardProps {
  order: any;
  onPress: () => void;
  status: string;
  onAccept?: () => void;
  onReject?: () => void;
  onPrepare?: () => void;
  onReady?: () => void;
}
type OrderCardNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

export function OrderCard({ 
  order, 
  onPress, 
  status,
  onAccept,
  onReject,
  onPrepare,
  onReady,
}: OrderCardProps) {
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
const navigation = useNavigation<OrderCardNavigationProp>();
  
  const firstItem = order.items?.[0];
  const itemImage = firstItem?.product?.image || 'https://via.placeholder.com/100';
  const itemCount = order.items?.length || 0;
  const timeAgo = new Date(order.created_at).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Check if rider is assigned (rider_id exists)
  const hasRider = !!order.rider_id;

  const getStatusColor = () => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'confirmed': return '#3b82f6';
      case 'preparing': return '#f97316';
      case 'ready': return '#10b981';
      case 'picked_up': return '#8b5cf6';
      case 'in_transit': return '#f97316';
      default: return '#666';
    }
  };

  const getActionButtons = () => {
    switch (status) {
      case 'pending':
        return (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              onPress={onReject} 
              style={[styles.actionButton, styles.rejectButton]}
            >
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={onAccept} 
              style={[styles.actionButton, styles.acceptButton]}
            >
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        );
      case 'confirmed':
        return (
          <TouchableOpacity 
            onPress={onPrepare} 
            style={[styles.actionButton, styles.prepareButton]}
          >
            <Text style={styles.actionButtonText}>Start Preparing</Text>
          </TouchableOpacity>
        );
      case 'preparing':
        return (
          <TouchableOpacity 
            onPress={onReady} 
            style={[styles.actionButton, styles.readyButton]}
          >
            <Text style={styles.actionButtonText}>Mark Ready</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber} numberOfLines={1}>
            {order.order_number}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.timeText}>{timeAgo}</Text>
      </View>

      <View style={styles.customerInfo}>
        <Feather name="user" size={14} color="#666" />
        <Text style={styles.customerName}>{order.customer_name}</Text>
      </View>

      <View style={styles.itemsPreview}>
        <View style={styles.itemImageContainer}>
          {itemImage && !imageError[itemImage] ? (
            <Image 
              source={{ uri: itemImage }} 
              style={styles.itemImage}
              onError={() => setImageError(prev => ({ ...prev, [itemImage]: true }))}
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
        <View style={styles.itemsInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {firstItem?.name || 'Order items'}
          </Text>
          <Text style={styles.itemCount}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Text style={styles.totalAmount}>
          ₦{order.total?.toLocaleString()}
        </Text>
      </View>

      {getActionButtons()}

      {/* Show rider info if rider is assigned */}
      {hasRider && (
        <TouchableOpacity 
          style={styles.riderInfoRow}
onPress={(e) => {
  e.stopPropagation();
  console.log('Navigating to VendorOrderDetails with orderId:', order.id);
  navigation.navigate('VendorOrderDetails', { orderId: order.id });
}}        >
          <Feather name="truck" size={14} color="#f97316" />
          <Text style={styles.riderTrackingText}>
            {status === 'ready' ? 'Rider assigned - waiting for pickup' : 'Track Rider'}
          </Text>
          <Feather name="chevron-right" size={14} color="#666" style={styles.chevronIcon} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
    color: '#666',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  customerName: {
    fontSize: 13,
    color: '#666',
  },
  itemsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  itemImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
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
  itemsInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  itemCount: {
    fontSize: 11,
    color: '#666',
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f97316',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
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
    fontSize: 13,
    fontWeight: '500',
  },
  riderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  riderTrackingText: {
    fontSize: 12,
    color: '#f97316',
    flex: 1,
  },
  chevronIcon: {
    marginLeft: 'auto',
  },
});