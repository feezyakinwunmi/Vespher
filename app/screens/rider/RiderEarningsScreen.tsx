// app/screens/rider/RiderEarningsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, isToday, isYesterday } from 'date-fns';
import { useRiderWallet } from '../../hooks/rider/useRiderWallet';
import { R, naira, SectionTitle, EmptyState } from '../../components/rider/ui';
import type { RiderStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RiderStackParamList>;
type Period = 'week' | 'month';

const WITHDRAWAL_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: R.amber },
  processing: { label: 'Processing', color: R.blue },
  completed: { label: 'Paid', color: R.green },
  failed: { label: 'Failed', color: R.red },
};

const dayLabel = (d: Date) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEE, d MMM'));

export function RiderEarningsScreen() {
  const navigation = useNavigation<Nav>();
  const { available, pending, withdrawn, earned, withdrawals, delivered, hasPending, refresh } = useRiderWallet();
  const [period, setPeriod] = useState<Period>('week');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Bars for the last 7 days, or the last 4 weeks.
  const chart = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const buckets =
      period === 'week'
        ? Array.from({ length: 7 }, (_, i) => {
            const start = new Date(now);
            start.setDate(now.getDate() - (6 - i));
            const end = new Date(start);
            end.setDate(start.getDate() + 1);
            return { label: format(start, 'EEEEE'), start, end };
          })
        : Array.from({ length: 4 }, (_, i) => {
            const start = new Date(now);
            start.setDate(now.getDate() - 7 * (4 - i) + 1);
            const end = new Date(start);
            end.setDate(start.getDate() + 7);
            return { label: format(start, 'd MMM'), start, end };
          });

    const rows = buckets.map(b => {
      const inRange = delivered.filter(o => {
        const t = new Date(o.delivered_at || o.created_at);
        return t >= b.start && t < b.end;
      });
      return { label: b.label, amount: inRange.reduce((s, o) => s + o.rider_earnings, 0), count: inRange.length };
    });
    const max = Math.max(1, ...rows.map(r => r.amount));
    return {
      rows: rows.map(r => ({ ...r, ratio: r.amount / max })),
      total: rows.reduce((s, r) => s + r.amount, 0),
      count: rows.reduce((s, r) => s + r.count, 0),
    };
  }, [delivered, period]);

  // Deliveries and withdrawals in one timeline, newest first.
  const activity = useMemo(() => {
    const items = [
      ...delivered.slice(0, 40).map(o => ({
        id: `o-${o.id}`,
        date: new Date(o.delivered_at || o.created_at),
        title: o.vendor.name,
        sub: `#${o.order_number}`,
        amount: o.rider_earnings,
        kind: 'earning' as const,
        orderId: o.id,
      })),
      ...withdrawals.map(w => ({
        id: `w-${w.id}`,
        date: new Date(w.created_at),
        title: 'Withdrawal',
        sub: w.bank_name ? `${w.bank_name}${w.account_number ? ' ••' + w.account_number.slice(-4) : ''}` : '',
        amount: -w.amount,
        kind: 'withdrawal' as const,
        status: w.status,
      })),
    ];
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 40);
  }, [delivered, withdrawals]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={R.orange} />}
      >
        <Text style={styles.title}>Earnings</Text>

        {/* Balance */}
        <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balance}>
          <Text style={styles.balanceLabel}>Available to withdraw</Text>
          <Text style={styles.balanceValue}>{naira(available)}</Text>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceSmallLabel}>Pending payout</Text>
              <Text style={styles.balanceSmall}>{naira(pending)}</Text>
            </View>
            <View>
              <Text style={styles.balanceSmallLabel}>Paid out</Text>
              <Text style={styles.balanceSmall}>{naira(withdrawn)}</Text>
            </View>
            <View>
              <Text style={styles.balanceSmallLabel}>Lifetime</Text>
              <Text style={styles.balanceSmall}>{naira(earned)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.withdrawBtn} onPress={() => navigation.navigate('RiderWithdraw')} activeOpacity={0.85}>
            <Feather name="arrow-up-right" size={16} color={R.orange} />
            <Text style={styles.withdrawText}>{hasPending ? 'View withdrawal' : 'Withdraw'}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Chart */}
        <View style={styles.card}>
          <View style={styles.chartHead}>
            <View>
              <Text style={styles.chartTotal}>{naira(chart.total)}</Text>
              <Text style={styles.chartSub}>
                {chart.count} deliveries · {period === 'week' ? 'last 7 days' : 'last 4 weeks'}
              </Text>
            </View>
            <View style={styles.toggle}>
              {(['week', 'month'] as Period[]).map(p => (
                <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[styles.toggleBtn, period === p && styles.toggleOn]}>
                  <Text style={[styles.toggleText, period === p && { color: '#fff' }]}>{p === 'week' ? '7D' : '4W'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.bars}>
            {chart.rows.map((r, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <LinearGradient
                    colors={r.amount > 0 ? ['#f97316', '#f43f5e'] : ['#262626', '#262626']}
                    style={[styles.bar, { height: `${Math.max(r.ratio * 100, 4)}%` }]}
                  />
                </View>
                <Text style={styles.barLabel}>{r.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Activity */}
        <SectionTitle title="Activity" />
        {activity.length === 0 ? (
          <EmptyState icon="trending-up" title="No earnings yet" body="Complete your first delivery and it will show up here." />
        ) : (
          <View style={styles.card}>
            {activity.map((a, idx) => {
              const status = a.kind === 'withdrawal' ? WITHDRAWAL_STATUS[a.status] : null;
              return (
                <TouchableOpacity
                  key={a.id}
                  disabled={a.kind !== 'earning'}
                  onPress={() => a.kind === 'earning' && navigation.navigate('RiderDelivery', { orderId: a.orderId })}
                  style={[styles.row, idx > 0 && styles.rowBorder]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: a.kind === 'earning' ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)' }]}>
                    <Feather name={a.kind === 'earning' ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={a.kind === 'earning' ? R.green : R.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {dayLabel(a.date)} · {format(a.date, 'h:mm a')}{a.sub ? ` · ${a.sub}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.rowAmount, { color: a.amount >= 0 ? R.green : R.text }]}>
                      {a.amount >= 0 ? '+' : '−'}{naira(Math.abs(a.amount))}
                    </Text>
                    {status && <Text style={[styles.rowStatus, { color: status.color }]}>{status.label}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: R.bg },
  content: { padding: 16, paddingBottom: 110 },
  title: { color: R.text, fontSize: 26, fontWeight: '800', marginTop: 8, marginBottom: 14 },
  balance: { borderRadius: 22, padding: 20 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  balanceSmallLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  balanceSmall: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 },
  withdrawBtn: {
    marginTop: 18,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  withdrawText: { color: R.orange, fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: R.card, borderRadius: 18, borderWidth: 1, borderColor: R.border, padding: 16, marginTop: 14 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartTotal: { color: R.text, fontSize: 22, fontWeight: '800' },
  chartSub: { color: R.muted, fontSize: 12, marginTop: 2 },
  toggle: { flexDirection: 'row', backgroundColor: R.bg, borderRadius: 10, padding: 3 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toggleOn: { backgroundColor: R.orange },
  toggleText: { color: R.muted, fontSize: 12, fontWeight: '700' },
  bars: { flexDirection: 'row', height: 140, marginTop: 18, gap: 8 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { color: R.faint, fontSize: 11, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: R.border },
  rowIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { color: R.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: R.muted, fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '700' },
  rowStatus: { fontSize: 11, marginTop: 2, fontWeight: '600' },
});
