// app/components/admin/AdminOrderCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AdminOrderCardProps {
  order: any;
  onPress?: () => void;
}

export function AdminOrderCard({ order, onPress }: AdminOrderCardProps) {
  const [imageError, setImageError] = useState<Record<string, boolean>>({});

  // Get first item from order
  const items = order.items || [];
  const firstItem = items[0];
  
  // Get image from product if available
  const itemImage = firstItem?.product?.image_url;
  const itemCount = items.length;

  // Get item names to display (first 3 items)
  const itemNames = items.slice(0, 3).map((item: any) => 
    item.name || item.product?.name || 'Item'
  ).join(', ');

  const remainingCount = items.length > 3 ? items.length - 3 : 0;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'delivered':
        return { bg: '#10b981', label: 'Delivered' };
      case 'pending':
        return { bg: '#f59e0b', label: 'Pending' };
      case 'confirmed':
        return { bg: '#3b82f6', label: 'Confirmed' };
      case 'preparing':
        return { bg: '#f97316', label: 'Preparing' };
      case 'ready':
        return { bg: '#10b981', label: 'Ready' };
      case 'cancelled':
        return { bg: '#ef4444', label: 'Cancelled' };
      default:
        return { bg: '#666', label: status };
    }
  };

  const status = getStatusStyle(order.status);

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Order Image */}
      <View style={styles.imageContainer}>
        {itemImage && !imageError[itemImage] ? (
          <Image
            source={{ uri: itemImage }}
            style={styles.image}
            onError={() => setImageError(prev => ({ ...prev, [itemImage]: true }))}
          />
        ) : (
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            style={styles.imagePlaceholder}
          >
            <Feather name="package" size={24} color="#fff" />
          </LinearGradient>
        )}
      </View>

      {/* Order Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.orderNumber}>#{order.order_number?.slice(0, 8)}</Text>
          <View style={[styles.statusChip, { backgroundColor: `${status.bg}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: status.bg }]} />
            <Text style={[styles.statusText, { color: status.bg }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <Text style={styles.customerName} numberOfLines={1}>
          {order.customer?.name || 'Customer'}
        </Text>

        <Text style={styles.vendorName} numberOfLines={1}>
          {order.vendor?.name || 'Vendor'}
        </Text>

        {/* Items Preview */}
        <View style={styles.itemsPreview}>
          {items.length > 0 ? (
            <>
              <Text style={styles.itemNames} numberOfLines={1}>
                {itemNames}
              </Text>
              {remainingCount > 0 && (
                <Text style={styles.moreItems}>+{remainingCount}</Text>
              )}
            </>
          ) : (
            <Text style={styles.itemNames}>No items</Text>
          )}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.amount}>₦{order.total?.toLocaleString()}</Text>
          <Text style={styles.date}>
            {new Date(order.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '500',
  },
  customerName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#f97316',
    marginBottom: 2,
  },
  vendorName: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  itemsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  itemNames: {
    fontSize: 11,
    color: '#fff',
    flex: 1,
  },
  moreItems: {
    fontSize: 10,
    color: '#f97316',
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f97316',
  },
  date: {
    fontSize: 9,
    color: '#666',
  },
});