// app/screens/rider/RiderJobsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useRider } from '../../contexts/RiderContext';
import { JobCard } from '../../components/rider/JobCard';
import { R, EmptyState } from '../../components/rider/ui';
import type { RiderStackParamList, RiderTabParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RiderStackParamList>;
type Tab = 'available' | 'active' | 'completed';

export function RiderJobsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RiderTabParamList, 'Jobs'>>();
  const { isOnline, available, active, delivered, refreshing, refresh, acceptOrder } = useRider();
  const [tab, setTab] = useState<Tab>(route.params?.tab || (active.length ? 'active' : 'available'));
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const lists: Record<Tab, typeof available> = { available, active, completed: delivered };
  const data = tab === 'available' && !isOnline ? [] : lists[tab];

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

  const empty = {
    available: isOnline
      ? { icon: 'coffee' as const, title: 'No orders waiting', body: 'Pull down to refresh. New orders also appear automatically.' }
      : { icon: 'power' as const, title: "You're offline", body: 'Go online from Home to see orders waiting for a rider.' },
    active: { icon: 'navigation' as const, title: 'No active deliveries', body: 'Orders you accept show up here until they are delivered.' },
    completed: { icon: 'check-circle' as const, title: 'No completed deliveries yet', body: 'Your finished deliveries will be listed here.' },
  }[tab];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Deliveries</Text>

      <View style={styles.segment}>
        {(['available', 'active', 'completed'] as Tab[]).map(t => {
          const count = t === 'available' ? (isOnline ? available.length : 0) : t === 'active' ? active.length : 0;
          const on = tab === t;
          return (
            <TouchableOpacity key={t} style={[styles.segBtn, on && styles.segBtnOn]} onPress={() => setTab(t)}>
              <Text style={[styles.segText, on && styles.segTextOn]}>
                {t === 'available' ? 'Available' : t === 'active' ? 'Active' : 'Completed'}
              </Text>
              {count > 0 && (
                <View style={[styles.count, on && styles.countOn]}>
                  <Text style={[styles.countText, on && { color: R.orange }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={data}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={R.orange} />}
        ListEmptyComponent={<EmptyState icon={empty.icon} title={empty.title} body={empty.body} />}
        renderItem={({ item }) => (
          <JobCard
            order={item}
            onPress={() => navigation.navigate('RiderDelivery', { orderId: item.id })}
            onAccept={tab === 'available' ? () => handleAccept(item.id) : undefined}
            accepting={acceptingId === item.id}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: R.bg },
  title: { color: R.text, fontSize: 26, fontWeight: '800', paddingHorizontal: 16, paddingTop: 8, marginBottom: 14 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: R.card,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: R.border,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segBtnOn: { backgroundColor: R.orange },
  segText: { color: R.muted, fontSize: 13, fontWeight: '600' },
  segTextOn: { color: '#fff' },
  count: { backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 999, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' },
  countOn: { backgroundColor: '#fff' },
  countText: { color: R.orange, fontSize: 11, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 110 },
});
