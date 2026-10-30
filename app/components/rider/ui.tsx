// app/components/rider/ui.tsx
// Small building blocks shared by the rider screens.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { RiderOrderStatus } from '../../services/riderOrders';

export const R = {
  bg: '#0a0a0a',
  card: '#141414',
  cardRaised: '#1c1c1c',
  border: 'rgba(255,255,255,0.06)',
  text: '#ffffff',
  muted: '#8a8a8a',
  faint: '#5c5c5c',
  orange: '#f97316',
  rose: '#f43f5e',
  green: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  red: '#ef4444',
  gradient: ['#f97316', '#f43f5e'] as const,
};

export const naira = (n: number) => `₦${Math.round(n || 0).toLocaleString()}`;

const STATUS: Record<RiderOrderStatus, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: R.blue },
  preparing: { label: 'Preparing', color: R.amber },
  ready: { label: 'Ready for pickup', color: R.green },
  picked_up: { label: 'Picked up', color: R.purple },
  in_transit: { label: 'On the way', color: R.orange },
  delivered: { label: 'Delivered', color: R.green },
  cancelled: { label: 'Cancelled', color: R.red },
};

export function statusInfo(status: RiderOrderStatus) {
  return STATUS[status] || { label: status, color: R.muted };
}

export function StatusPill({ status }: { status: RiderOrderStatus }) {
  const { label, color } = statusInfo(status);
  return (
    <View style={[styles.pill, { backgroundColor: color + '1f' }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={26} color={R.orange} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

// Pickup → drop-off summary used on job cards.
export function RouteLine({ from, to, compact }: { from: string; to: string; compact?: boolean }) {
  return (
    <View style={styles.route}>
      <View style={styles.routeRail}>
        <View style={[styles.routeDot, { borderColor: R.orange }]} />
        <View style={styles.routeBar} />
        <View style={[styles.routeDot, { borderColor: R.green, backgroundColor: R.green }]} />
      </View>
      <View style={{ flex: 1, gap: compact ? 10 : 14 }}>
        <View>
          <Text style={styles.routeLabel}>PICKUP</Text>
          <Text style={styles.routeText} numberOfLines={1}>{from}</Text>
        </View>
        <View>
          <Text style={styles.routeLabel}>DROP-OFF</Text>
          <Text style={styles.routeText} numberOfLines={compact ? 1 : 2}>{to}</Text>
        </View>
      </View>
    </View>
  );
}

export const callPhone = (phone?: string | null) => phone && Linking.openURL(`tel:${phone}`);

export const openDirections = (lat?: number | null, lng?: number | null, address?: string) => {
  const destination = lat && lng ? `${lat},${lng}` : encodeURIComponent(address || '');
  if (!destination) return;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`);
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600' },
  card: {
    backgroundColor: R.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: R.border,
    padding: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { color: R.text, fontSize: 16, fontWeight: '700' },
  sectionAction: { color: R.orange, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: { color: R.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyBody: { color: R.muted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  route: { flexDirection: 'row', gap: 12 },
  routeRail: { alignItems: 'center', paddingTop: 16, paddingBottom: 6 },
  routeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  routeBar: { flex: 1, width: 2, backgroundColor: R.border, marginVertical: 3 },
  routeLabel: { color: R.faint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  routeText: { color: R.text, fontSize: 14, marginTop: 2 },
});
