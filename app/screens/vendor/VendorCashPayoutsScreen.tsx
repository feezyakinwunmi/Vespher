// app/screens/vendor/VendorCashPayoutsScreen.tsx
// Cash orders are paid to the rider; Vesphe then transfers the vendor's share.
// Shows what's still on its way and every transfer with its receipt.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CashPayout, fetchCashPayouts, fetchCashPending } from '../../services/cashPayouts';

const C = {
  bg: '#0a0a0a',
  card: '#141414',
  border: 'rgba(255,255,255,0.06)',
  text: '#fff',
  muted: '#8a8a8a',
  faint: '#5c5c5c',
  orange: '#f97316',
  green: '#10b981',
  amber: '#f59e0b',
};

const naira = (n: number) => `₦${Math.round(n || 0).toLocaleString()}`;

export function VendorCashPayoutsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<CashPayout[]>([]);
  const [pending, setPending] = useState({ amount: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: vendor } = await supabase.from('vendors').select('id').eq('owner_id', user.id).maybeSingle();
      if (!vendor) return;
      const [p, pend] = await Promise.all([fetchCashPayouts(vendor.id), fetchCashPending(vendor.id)]);
      setPayouts(p);
      setPending(pend);
    } catch (e) {
      console.error('Error loading cash payouts:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const received = payouts.reduce((s, p) => s + p.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Cash order payouts</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.orange} />}
          ListHeaderComponent={
            <>
              <View style={styles.info}>
                <Feather name="info" size={15} color="#93c5fd" />
                <Text style={styles.infoText}>
                  Card payments go straight to your bank. For cash orders the rider collects the money, then Vesphe sends your share by bank transfer.
                </Text>
              </View>
              <View style={styles.statsRow}>
                <View style={[styles.stat, { borderColor: 'rgba(245,158,11,0.3)' }]}>
                  <Text style={styles.statLabel}>On its way</Text>
                  <Text style={[styles.statValue, { color: C.amber }]}>{naira(pending.amount)}</Text>
                  <Text style={styles.statSub}>{pending.count} cash order{pending.count === 1 ? '' : 's'}</Text>
                </View>
                <View style={[styles.stat, { borderColor: 'rgba(16,185,129,0.3)' }]}>
                  <Text style={styles.statLabel}>Received</Text>
                  <Text style={[styles.statValue, { color: C.green }]}>{naira(received)}</Text>
                  <Text style={styles.statSub}>{payouts.length} transfer{payouts.length === 1 ? '' : 's'}</Text>
                </View>
              </View>
              <Text style={styles.section}>Transfers</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={26} color={C.faint} />
              <Text style={styles.emptyText}>No cash payouts yet. They'll appear here with the bank receipt.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <View style={styles.rowIcon}><Feather name="check" size={16} color={C.green} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowAmount}>{naira(item.amount)}</Text>
                  <Text style={styles.rowSub}>
                    {format(new Date(item.paid_at), 'd MMM yyyy, h:mm a')} · {item.order_count} order{item.order_count === 1 ? '' : 's'}
                  </Text>
                </View>
                {item.receipt_url && (
                  <TouchableOpacity style={styles.receiptBtn} onPress={() => setViewer(item.receipt_url)}>
                    <Feather name="file-text" size={14} color={C.orange} />
                    <Text style={styles.receiptText}>Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
              {item.reference ? <Text style={styles.ref}>Ref: {item.reference}</Text> : null}
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            </View>
          )}
        />
      )}

      <Modal visible={!!viewer} transparent onRequestClose={() => setViewer(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <Text style={{ color: C.muted, marginTop: 12 }}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 19, fontWeight: '800' },
  info: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.1)', marginBottom: 14 },
  infoText: { color: '#cfe0ff', fontSize: 12.5, flex: 1, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, padding: 14 },
  statLabel: { color: C.muted, fontSize: 12 },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  statSub: { color: C.faint, fontSize: 12, marginTop: 2 },
  section: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 30, paddingHorizontal: 20 },
  emptyText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  row: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(16,185,129,0.12)', justifyContent: 'center', alignItems: 'center' },
  rowAmount: { color: C.text, fontSize: 16, fontWeight: '800' },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.1)' },
  receiptText: { color: C.orange, fontSize: 12.5, fontWeight: '700' },
  ref: { color: '#d4d4d4', fontSize: 12.5, marginTop: 10 },
  note: { color: C.muted, fontSize: 12.5, marginTop: 4, fontStyle: 'italic' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
});
