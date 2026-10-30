// app/components/rider/JobCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import type { RiderOrder } from '../../services/riderOrders';
import { R, naira, StatusPill, RouteLine } from './ui';

interface Props {
  order: RiderOrder;
  onPress: () => void;
  // Shown on claimable orders.
  onAccept?: () => void;
  accepting?: boolean;
}

export function JobCard({ order, onPress, onAccept, accepting }: Props) {
  const isCash = order.payment_method === 'cash';

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <View style={styles.top}>
        {order.vendor.image_url ? (
          <Image source={{ uri: order.vendor.image_url }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Feather name="shopping-bag" size={18} color={R.orange} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.vendor} numberOfLines={1}>{order.vendor.name}</Text>
          <Text style={styles.meta}>
            #{order.order_number} · {order.item_count} item{order.item_count === 1 ? '' : 's'} ·{' '}
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </Text>
        </View>
        <View style={styles.earnBox}>
          <Text style={styles.earn}>{naira(order.rider_earnings)}</Text>
          <Text style={styles.earnLabel}>you earn</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <RouteLine from={order.vendor.address} to={order.dropoff.address} compact />

      <View style={styles.bottom}>
        <View style={styles.tags}>
          <StatusPill status={order.status} />
          {isCash && (
            <View style={styles.cashTag}>
              <Feather name="dollar-sign" size={11} color={R.amber} />
              <Text style={styles.cashText}>Collect {naira(order.total)}</Text>
            </View>
          )}
        </View>

        {onAccept ? (
          <TouchableOpacity onPress={onAccept} disabled={accepting} activeOpacity={0.85}>
            <LinearGradient colors={R.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptBtn}>
              {accepting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.acceptText}>Accept</Text>
                  <Feather name="arrow-right" size={15} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <Feather name="chevron-right" size={20} color={R.muted} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: R.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: R.border,
    padding: 16,
    marginBottom: 12,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 42, height: 42, borderRadius: 12 },
  logoFallback: { backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },
  vendor: { color: R.text, fontSize: 15, fontWeight: '700' },
  meta: { color: R.muted, fontSize: 12, marginTop: 2 },
  earnBox: { alignItems: 'flex-end' },
  earn: { color: R.green, fontSize: 17, fontWeight: '800' },
  earnLabel: { color: R.faint, fontSize: 10, marginTop: 1 },
  divider: { height: 1, backgroundColor: R.border, marginVertical: 14 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, flexWrap: 'wrap' },
  cashTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cashText: { color: R.amber, fontSize: 11, fontWeight: '600' },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 12,
    minWidth: 96,
    justifyContent: 'center',
  },
  acceptText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
