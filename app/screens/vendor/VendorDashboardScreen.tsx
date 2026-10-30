// app/screens/vendor/VendorDashboardScreen.tsx
// Vendor home: what needs doing right now (new orders, kitchen queue), the shop's
// open/closed switch and today's numbers. Full lists live in the Orders tab.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Switch,
  Image,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';
import Toast from 'react-native-toast-message';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorOrders } from '../../hooks/vendor/useVendorOrders';
import { useVendorStats } from '../../hooks/vendor/useVendorStats';
import { useVendorEarnings } from '../../hooks/vendor/useVendorEarnings';
import { useNotifications } from '../../hooks/useNotifications';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type IconName = React.ComponentProps<typeof Feather>['name'];

const C = {
  bg: '#0a0a0a',
  card: '#141414',
  raised: '#1c1c1c',
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
};

const naira = (n?: number | null) => `₦${Math.round(n || 0).toLocaleString()}`;

interface ShopInfo {
  id: string;
  name: string;
  image_url: string | null;
  is_open: boolean;
  is_approved: boolean;
  is_suspended: boolean;
}

export function VendorDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { unreadCount: unreadNotifications } = useNotifications();
  const { orders, ordersByStatus, isLoading: ordersLoading, refreshOrders, acceptOrder, rejectOrder, startPreparing, markAsReady } = useVendorOrders();
  const { stats, refreshStats } = useVendorStats();
  const { earnings, isLoading: earningsLoading, refreshData: refreshEarnings } = useVendorEarnings();

  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const fetchShop = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('vendors')
      .select('id, name, image_url, is_open, is_approved, is_suspended')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (data) {
      setShop({
        id: data.id,
        name: data.name,
        image_url: data.image_url,
        is_open: data.is_open ?? true,
        is_approved: !!data.is_approved,
        is_suspended: !!data.is_suspended,
      });
    }
  }, [user?.id]);

  // Conversations store user ids (not store ids) as participants.
  const fetchUnreadMessages = useCallback(async () => {
    if (!user?.id) return;
    const { data: conversations } = await supabase.from('conversations').select('id').contains('participants', [user.id]);
    if (!conversations?.length) {
      setUnreadMessages(0);
      return;
    }
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversations.map(c => c.id))
      .eq('read', false)
      .neq('sender_id', user.id);
    setUnreadMessages(count || 0);
  }, [user?.id]);

  useEffect(() => {
    fetchShop();
    fetchUnreadMessages();
    const channel = supabase
      .channel(`vendor-home-messages-${user?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchUnreadMessages)
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [fetchShop, fetchUnreadMessages, user?.id]);

  useFocusEffect(
    useCallback(() => {
      refreshOrders();
      fetchUnreadMessages();
    }, [fetchUnreadMessages]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchShop(), refreshOrders(), refreshStats(), refreshEarnings(), fetchUnreadMessages()]);
    setRefreshing(false);
  };

  const toggleOpen = async (open: boolean) => {
    if (!shop) return;
    setTogglingOpen(true);
    const { error } = await supabase.from('vendors').update({ is_open: open }).eq('id', shop.id);
    setTogglingOpen(false);
    if (error) {
      Toast.show({ type: 'error', text1: 'Could not update your shop', text2: error.message });
      return;
    }
    setShop({ ...shop, is_open: open });
    Toast.show({ type: 'success', text1: open ? 'Your shop is open' : 'Your shop is closed', text2: open ? 'Customers can order from you now.' : "Customers can't place new orders." });
  };

  // `success` is omitted for actions that already show their own alert (decline).
  const runOrderAction = async (orderId: string, action: () => Promise<void>, success?: string) => {
    setBusyOrderId(orderId);
    try {
      await action();
      if (success) Toast.show({ type: 'success', text1: success });
      refreshOrders();
    } catch (error: any) {
      if (success) Toast.show({ type: 'error', text1: 'Something went wrong', text2: error?.message });
    } finally {
      setBusyOrderId(null);
    }
  };

  const confirmDecline = (orderId: string, orderNumber: string) =>
    Alert.alert('Decline order', `Decline order #${orderNumber}? If the customer paid by card, they will be refunded.`, [
      { text: 'Keep order', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => runOrderAction(orderId, () => rejectOrder(orderId)) },
    ]);

  const newOrders = ordersByStatus.pending;
  const kitchen = [...ordersByStatus.confirmed, ...ordersByStatus.preparing];
  const isLive = !!shop?.is_approved && !shop?.is_suspended;
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />}
      >
        {/* Header */}
        <View style={styles.header}>
          {shop?.image_url ? (
            <Image source={{ uri: shop.image_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoText}>{(shop?.name || 'V').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{greeting}</Text>
            <Text style={styles.shopName} numberOfLines={1}>{shop?.name || 'Your shop'}</Text>
          </View>
          <IconButton icon="message-circle" count={unreadMessages} onPress={() => navigation.navigate('Messaging')} />
          <IconButton icon="bell" dot={unreadNotifications > 0} onPress={() => navigation.navigate('Notifications')} />
        </View>

        {/* Approval / suspension */}
        {shop && !isLive && (
          <View style={styles.banner}>
            <Feather name={shop.is_suspended ? 'slash' : 'clock'} size={18} color={C.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{shop.is_suspended ? 'Shop suspended' : 'Waiting for approval'}</Text>
              <Text style={styles.bannerText}>
                {shop.is_suspended
                  ? 'Your shop is hidden from customers. Contact support to sort this out.'
                  : "We're reviewing your shop. Add your menu now so you're ready the moment you're approved."}
              </Text>
              {!shop.is_suspended && (
                <TouchableOpacity onPress={() => navigation.navigate('VendorTabs', { screen: 'Menu' })} style={styles.bannerBtn}>
                  <Text style={styles.bannerBtnText}>Set up menu</Text>
                  <Feather name="arrow-right" size={14} color={C.amber} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Open / closed */}
        {isLive && (
          <View style={[styles.openCard, shop?.is_open ? styles.openCardOn : null]}>
            <View style={[styles.openDot, { backgroundColor: shop?.is_open ? C.green : C.faint }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.openTitle}>{shop?.is_open ? 'Open for orders' : 'Shop closed'}</Text>
              <Text style={styles.openSub}>{shop?.is_open ? 'Customers can see and order from you' : 'Turn on when you are ready to take orders'}</Text>
            </View>
            {togglingOpen ? (
              <ActivityIndicator color={C.green} />
            ) : (
              <Switch
                value={!!shop?.is_open}
                onValueChange={toggleOpen}
                trackColor={{ false: '#333', true: 'rgba(16,185,129,0.45)' }}
                thumbColor={shop?.is_open ? C.green : '#888'}
              />
            )}
          </View>
        )}

        {/* Today */}
        <View style={styles.todayRow}>
          <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.todayMain}>
            <Text style={styles.todayLabel}>Today's sales</Text>
            <Text style={styles.todayValue}>{naira(stats?.todaySales)}</Text>
            <Text style={styles.todaySub}>{stats?.todayOrders || 0} orders delivered</Text>
          </LinearGradient>
          <View style={styles.todaySide}>
            <MiniStat icon="star" color={C.amber} value={stats?.averageRating ? stats.averageRating.toFixed(1) : '–'} label={`${stats?.reviewCount || 0} reviews`} />
            <MiniStat icon="clock" color={C.blue} value={stats?.averagePrepTime ? `${Math.round(stats.averagePrepTime)}m` : '–'} label="avg prep" />
          </View>
        </View>

        {/* Pipeline */}
        <View style={styles.pipeline}>
          <PipelineChip label="New" count={newOrders.length} color={C.amber} />
          <PipelineChip label="Kitchen" count={kitchen.length} color={C.orange} />
          <PipelineChip label="Ready" count={ordersByStatus.ready.length} color={C.green} />
          <PipelineChip label="On the way" count={ordersByStatus.in_transit.length} color={C.purple} />
        </View>

        {/* New orders */}
        <SectionHeader
          title="New orders"
          count={newOrders.length}
          action="All orders"
          onAction={() => navigation.navigate('VendorTabs', { screen: 'Orders' })}
        />
        {ordersLoading && orders.length === 0 ? (
          <ActivityIndicator color={C.orange} style={{ marginVertical: 24 }} />
        ) : newOrders.length === 0 ? (
          <Empty icon="inbox" text={shop?.is_open === false && isLive ? 'Your shop is closed. Open it to start getting orders.' : 'No new orders right now. They will pop up here.'} />
        ) : (
          newOrders.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              accent={C.amber}
              onPress={() => navigation.navigate('VendorOrderDetails', { orderId: order.id })}
              busy={busyOrderId === order.id}
              secondary={{ label: 'Decline', onPress: () => confirmDecline(order.id, order.order_number ?? '') }}
              primary={{ label: 'Accept', onPress: () => runOrderAction(order.id, () => acceptOrder(order.id), 'Order accepted') }}
            />
          ))
        )}

        {/* Kitchen */}
        {kitchen.length > 0 && (
          <>
            <SectionHeader title="In the kitchen" count={kitchen.length} />
            {kitchen.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                accent={C.orange}
                onPress={() => navigation.navigate('VendorOrderDetails', { orderId: order.id })}
                busy={busyOrderId === order.id}
                primary={
                  order.status === 'confirmed'
                    ? { label: 'Start preparing', onPress: () => runOrderAction(order.id, () => startPreparing(order.id), 'Marked as preparing') }
                    : { label: 'Mark ready', onPress: () => runOrderAction(order.id, () => markAsReady(order.id), 'Order ready for pickup') }
                }
              />
            ))}
          </>
        )}

        {/* Ready, waiting for rider */}
        {ordersByStatus.ready.length > 0 && (
          <>
            <SectionHeader title="Waiting for rider" count={ordersByStatus.ready.length} />
            {ordersByStatus.ready.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                accent={C.green}
                note={order.rider_id ? 'Rider on the way to you' : 'Finding a rider…'}
                onPress={() => navigation.navigate('VendorOrderDetails', { orderId: order.id })}
              />
            ))}
          </>
        )}

        {/* Earnings */}
        <SectionHeader title="Earnings" action="Details" onAction={() => navigation.navigate('VendorTabs', { screen: 'Earnings' })} />
        <TouchableOpacity activeOpacity={0.9} style={styles.card} onPress={() => navigation.navigate('VendorTabs', { screen: 'Earnings' })}>
          {earningsLoading ? (
            <ActivityIndicator color={C.orange} />
          ) : (
            <>
              <View style={styles.earnTop}>
                <View>
                  <Text style={styles.earnLabel}>This week</Text>
                  <Text style={styles.earnValue}>{naira(earnings?.weeklyEarnings)}</Text>
                </View>
                {!!earnings && earnings.weeklyGrowth !== 0 && (
                  <View style={[styles.growth, { backgroundColor: earnings.weeklyGrowth > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                    <Feather name={earnings.weeklyGrowth > 0 ? 'trending-up' : 'trending-down'} size={12} color={earnings.weeklyGrowth > 0 ? C.green : C.red} />
                    <Text style={[styles.growthText, { color: earnings.weeklyGrowth > 0 ? C.green : C.red }]}>
                      {earnings.weeklyGrowth > 0 ? '+' : ''}{earnings.weeklyGrowth}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.earnRow}>
                <View style={styles.earnCell}>
                  <Text style={styles.earnCellLabel}>All time</Text>
                  <Text style={styles.earnCellValue}>{naira(earnings?.totalEarnings)}</Text>
                </View>
                <View style={styles.earnCell}>
                  <Text style={styles.earnCellLabel}>Arriving soon</Text>
                  <Text style={[styles.earnCellValue, { color: '#fcd34d' }]}>{naira(earnings?.settling)}</Text>
                </View>
              </View>
              {earnings && !earnings.payoutAccountReady && (
                <TouchableOpacity style={styles.payoutWarn} onPress={() => navigation.navigate('VendorTabs', { screen: 'Settings' })}>
                  <Feather name="alert-circle" size={15} color={C.amber} />
                  <Text style={styles.payoutWarnText}>Add your bank account to receive card payments</Text>
                  <Feather name="chevron-right" size={15} color={C.amber} />
                </TouchableOpacity>
              )}
            </>
          )}
        </TouchableOpacity>

        {/* Shortcuts */}
        <View style={styles.shortcuts}>
          <Shortcut icon="coffee" label="Menu" onPress={() => navigation.navigate('VendorTabs', { screen: 'Menu' })} />
          <Shortcut icon="trending-up" label="Promote" onPress={() => navigation.navigate('Promotions')} />
          <Shortcut icon="bar-chart-2" label="Analytics" onPress={() => navigation.navigate('VendorAnalytics')} />
          <Shortcut icon="clock" label="History" onPress={() => navigation.navigate('History')} />
        </View>

        {/* Best sellers */}
        {!!stats?.popularItems?.length && (
          <>
            <SectionHeader title="Best sellers" />
            <View style={styles.card}>
              {stats.popularItems.slice(0, 5).map((item, i) => (
                <View key={item.id} style={[styles.popular, i > 0 && styles.rowBorder]}>
                  <Text style={[styles.rank, i === 0 && { color: C.orange }]}>{i + 1}</Text>
                  <Text style={styles.popularName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.popularCount}>{item.count} sold</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

function IconButton({ icon, count, dot, onPress }: { icon: IconName; count?: number; dot?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress}>
      <Feather name={icon} size={20} color={C.text} />
      {!!count && count > 0 ? (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : dot ? (
        <View style={styles.dot} />
      ) : null}
    </TouchableOpacity>
  );
}

function MiniStat({ icon, color, value, label }: { icon: IconName; color: string; value: string; label: string }) {
  return (
    <View style={styles.mini}>
      <Feather name={icon} size={15} color={color} />
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function PipelineChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipCount, { color: count > 0 ? color : C.faint }]}>{count}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, count, action, onAction }: { title: string; count?: number; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!count && (
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{count}</Text>
          </View>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={22} color={C.faint} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function Shortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.shortcut} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.shortcutIcon}>
        <Feather name={icon} size={19} color={C.orange} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

interface RowAction {
  label: string;
  onPress: () => void;
}

function OrderRow({
  order,
  accent,
  onPress,
  primary,
  secondary,
  busy,
  note,
}: {
  order: any;
  accent: string;
  onPress: () => void;
  primary?: RowAction;
  secondary?: RowAction;
  busy?: boolean;
  note?: string;
}) {
  const items: any[] = order.items || [];
  const summary = items.slice(0, 2).map(i => `${i.quantity}× ${i.name}`).join(', ');
  const more = items.length > 2 ? ` +${items.length - 2} more` : '';

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.order, { borderLeftColor: accent }]}>
      <View style={styles.orderTop}>
        <Text style={styles.orderNo}>#{order.order_number}</Text>
        <Text style={styles.orderTime}>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</Text>
      </View>
      <Text style={styles.orderItems} numberOfLines={2}>{summary}{more}</Text>
      <View style={styles.orderMeta}>
        <Text style={styles.orderCustomer} numberOfLines={1}>{order.customer_name}</Text>
        <Text style={styles.orderTotal}>{naira(order.subtotal || order.total)}</Text>
      </View>
      {note ? (
        <View style={styles.orderNote}>
          <Feather name="truck" size={13} color={C.green} />
          <Text style={styles.orderNoteText}>{note}</Text>
        </View>
      ) : null}
      {(primary || secondary) && (
        <View style={styles.orderActions}>
          {busy ? (
            <ActivityIndicator color={C.orange} style={{ flex: 1, height: 40 }} />
          ) : (
            <>
              {secondary && (
                <TouchableOpacity style={[styles.orderBtn, styles.orderBtnGhost]} onPress={secondary.onPress}>
                  <Text style={[styles.orderBtnText, { color: C.red }]}>{secondary.label}</Text>
                </TouchableOpacity>
              )}
              {primary && (
                <TouchableOpacity style={{ flex: 2 }} onPress={primary.onPress}>
                  <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.orderBtn}>
                    <Text style={styles.orderBtnText}>{primary.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 110 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  logo: { width: 46, height: 46, borderRadius: 14 },
  logoFallback: { backgroundColor: C.orange, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  greet: { color: C.muted, fontSize: 13 },
  shopName: { color: C.text, fontSize: 20, fontWeight: '800', marginTop: 1 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: C.rose },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.rose,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  banner: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginBottom: 12,
  },
  bannerTitle: { color: C.amber, fontSize: 14, fontWeight: '700' },
  bannerText: { color: '#d4d4d4', fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  bannerBtnText: { color: C.amber, fontSize: 13, fontWeight: '700' },

  openCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  openCardOn: { borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.06)' },
  openDot: { width: 10, height: 10, borderRadius: 5 },
  openTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  openSub: { color: C.muted, fontSize: 12, marginTop: 2 },

  todayRow: { flexDirection: 'row', gap: 12 },
  todayMain: { flex: 1.4, borderRadius: 20, padding: 16, justifyContent: 'space-between' },
  todayLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5 },
  todayValue: { color: '#fff', fontSize: 26, fontWeight: '800', marginVertical: 6 },
  todaySub: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  todaySide: { flex: 1, gap: 12 },
  mini: { flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 12, justifyContent: 'center' },
  miniValue: { color: C.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  miniLabel: { color: C.muted, fontSize: 11, marginTop: 1 },

  pipeline: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 12,
    paddingVertical: 12,
  },
  chip: { flex: 1, alignItems: 'center' },
  chipCount: { fontSize: 20, fontWeight: '800' },
  chipLabel: { color: C.muted, fontSize: 11, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  sectionCount: { backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  sectionCountText: { color: C.orange, fontSize: 12, fontWeight: '700' },
  sectionAction: { color: C.orange, fontSize: 13, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#262626',
  },
  emptyText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  order: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
  },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { color: C.text, fontSize: 15, fontWeight: '700' },
  orderTime: { color: C.faint, fontSize: 12 },
  orderItems: { color: '#d4d4d4', fontSize: 13.5, marginTop: 6, lineHeight: 19 },
  orderMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  orderCustomer: { color: C.muted, fontSize: 12.5, flex: 1, marginRight: 8 },
  orderTotal: { color: C.text, fontSize: 15, fontWeight: '800' },
  orderNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  orderNoteText: { color: C.green, fontSize: 12.5, fontWeight: '600' },
  orderActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  orderBtn: { height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  orderBtnGhost: { flex: 1, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  orderBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 },
  earnTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  earnLabel: { color: C.muted, fontSize: 12.5 },
  earnValue: { color: C.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  growth: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  growthText: { fontSize: 12, fontWeight: '700' },
  earnRow: { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  earnCell: { flex: 1 },
  earnCellLabel: { color: C.muted, fontSize: 12 },
  earnCellValue: { color: C.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
  payoutWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  payoutWarnText: { color: C.amber, fontSize: 12.5, flex: 1, fontWeight: '600' },

  shortcuts: { flexDirection: 'row', gap: 10, marginTop: 16 },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutLabel: { color: C.text, fontSize: 12, fontWeight: '600', marginTop: 8 },

  popular: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  rank: { color: C.faint, fontSize: 15, fontWeight: '800', width: 18 },
  popularName: { color: C.text, fontSize: 14, flex: 1 },
  popularCount: { color: C.muted, fontSize: 12.5 },
});
