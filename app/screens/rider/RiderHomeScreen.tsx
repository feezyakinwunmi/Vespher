// app/screens/rider/RiderHomeScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Switch, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useRider } from '../../contexts/RiderContext';
import { useNotifications } from '../../hooks/useNotifications';
import { JobCard } from '../../components/rider/JobCard';
import { R, naira, SectionTitle, EmptyState, StatusPill, RouteLine } from '../../components/rider/ui';
import type { RiderStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RiderStackParamList>;

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const NEXT_STEP: Record<string, string> = {
  confirmed: 'Head to the restaurant',
  preparing: 'Head to the restaurant',
  ready: 'Pick up the order',
  picked_up: 'Start the trip',
  in_transit: 'Deliver to the customer',
};

export function RiderHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { isOnline, togglingOnline, setOnline, locationDenied, available, active, delivered, refreshing, refresh, acceptOrder } = useRider();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const when = (o: { delivered_at: string | null; created_at: string }) => new Date(o.delivered_at || o.created_at);
    const todays = delivered.filter(o => when(o) >= today);
    const week = delivered.filter(o => when(o) >= weekAgo);
    return {
      todayEarnings: todays.reduce((s, o) => s + o.rider_earnings, 0),
      todayCount: todays.length,
      weekEarnings: week.reduce((s, o) => s + o.rider_earnings, 0),
      weekCount: week.length,
    };
  }, [delivered]);

  const handleToggle = async (value: boolean) => {
    const res = await setOnline(value);
    if (!res.ok && res.message) Toast.show({ type: 'error', text1: res.message });
  };

  const handleAccept = async (orderId: string) => {
    const order = available.find(o => o.id === orderId);
    if (!order) return;
    setAcceptingId(orderId);
    const res = await acceptOrder(order);
    setAcceptingId(null);
    if (res.ok) {
      Toast.show({ type: 'success', text1: 'Order accepted', text2: `Head to ${order.vendor.name}` });
      navigation.navigate('RiderDelivery', { orderId });
    } else if (res.message) {
      Toast.show({ type: 'error', text1: res.message });
    }
  };

  const current = active[0];
  const firstName = (user?.name || 'Rider').split(' ')[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={R.orange} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{greeting()},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Messaging')}>
            <Feather name="message-circle" size={20} color={R.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Feather name="bell" size={20} color={R.text} />
            {unreadCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
        </View>

        {/* Online switch */}
        <LinearGradient
          colors={isOnline ? ['#f97316', '#f43f5e'] : ['#1c1c1c', '#161616']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statusCard}
        >
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: isOnline ? 'rgba(255,255,255,0.2)' : 'rgba(249,115,22,0.12)' }]}>
              <Feather name={isOnline ? 'radio' : 'moon'} size={22} color={isOnline ? '#fff' : R.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{isOnline ? "You're online" : "You're offline"}</Text>
              <Text style={[styles.statusSub, isOnline && { color: 'rgba(255,255,255,0.85)' }]}>
                {isOnline ? 'New orders will show up here' : 'Go online to start receiving orders'}
              </Text>
            </View>
            {togglingOnline ? (
              <ActivityIndicator color={isOnline ? '#fff' : R.orange} />
            ) : (
              <Switch
                value={isOnline}
                onValueChange={handleToggle}
                trackColor={{ false: '#333', true: 'rgba(255,255,255,0.35)' }}
                thumbColor={isOnline ? '#fff' : '#888'}
              />
            )}
          </View>
        </LinearGradient>

        {locationDenied && (
          <TouchableOpacity style={styles.warn} onPress={() => Linking.openSettings()}>
            <Feather name="map-pin" size={16} color={R.amber} />
            <Text style={styles.warnText}>Location is off. Customers can't see where you are. Tap to turn it on.</Text>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Today</Text>
            <Text style={styles.statValue}>{naira(stats.todayEarnings)}</Text>
            <Text style={styles.statSub}>{stats.todayCount} deliveries</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Last 7 days</Text>
            <Text style={styles.statValue}>{naira(stats.weekEarnings)}</Text>
            <Text style={styles.statSub}>{stats.weekCount} deliveries</Text>
          </View>
        </View>

        {/* Current delivery */}
        {current && (
          <>
            <SectionTitle title={active.length > 1 ? `Active deliveries (${active.length})` : 'Current delivery'} action={active.length > 1 ? 'See all' : undefined} onAction={() => navigation.navigate('RiderTabs', { screen: 'Jobs', params: { tab: 'active' } })} />
            <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('RiderDelivery', { orderId: current.id })} style={styles.current}>
              <View style={styles.currentTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentVendor}>{current.vendor.name}</Text>
                  <Text style={styles.currentMeta}>#{current.order_number} · {current.customer.name}</Text>
                </View>
                <StatusPill status={current.status} />
              </View>
              <RouteLine from={current.vendor.address} to={current.dropoff.address} compact />
              <LinearGradient colors={R.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtn}>
                <Text style={styles.nextText}>{NEXT_STEP[current.status] || 'Open delivery'}</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* Nearby orders */}
        <SectionTitle
          title="New orders"
          action={available.length > 3 ? `See all ${available.length}` : undefined}
          onAction={() => navigation.navigate('RiderTabs', { screen: 'Jobs', params: { tab: 'available' } })}
        />
        {!isOnline ? (
          <EmptyState icon="power" title="You're offline" body="Turn on the switch above to see orders waiting for a rider." />
        ) : available.length === 0 ? (
          <EmptyState icon="coffee" title="No orders right now" body="We'll show new orders here as soon as restaurants have them." />
        ) : (
          available.slice(0, 3).map(o => (
            <JobCard
              key={o.id}
              order={o}
              onPress={() => navigation.navigate('RiderDelivery', { orderId: o.id })}
              onAccept={() => handleAccept(o.id)}
              accepting={acceptingId === o.id}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: R.bg },
  content: { padding: 16, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  greet: { color: R.muted, fontSize: 14 },
  name: { color: R.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: R.card,
    borderWidth: 1,
    borderColor: R.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: R.rose },
  statusCard: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: R.border },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statusIcon: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  statusTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  statusSub: { color: R.muted, fontSize: 13, marginTop: 2 },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  warnText: { color: R.amber, fontSize: 12.5, flex: 1, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 14, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: R.card, borderRadius: 18, borderWidth: 1, borderColor: R.border, padding: 16 },
  statLabel: { color: R.muted, fontSize: 12 },
  statValue: { color: R.text, fontSize: 22, fontWeight: '800', marginTop: 6 },
  statSub: { color: R.faint, fontSize: 12, marginTop: 2 },
  current: {
    backgroundColor: R.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
    padding: 16,
    gap: 14,
    marginBottom: 10,
  },
  currentTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  currentVendor: { color: R.text, fontSize: 16, fontWeight: '700' },
  currentMeta: { color: R.muted, fontSize: 12, marginTop: 2 },
  nextBtn: {
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
