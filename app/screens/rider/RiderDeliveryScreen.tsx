// app/screens/rider/RiderDeliveryScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRider } from '../../contexts/RiderContext';
import GoogleTrackingMap from '../../components/GoogleTrackingMap';
import {
  RiderOrder,
  CLAIMABLE_STATUSES,
  fetchOrder,
  markPickedUp,
  startTrip,
  completeDelivery,
} from '../../services/riderOrders';
import { R, naira, StatusPill, callPhone, openDirections } from '../../components/rider/ui';
import type { RiderStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RiderStackParamList>;

const STEPS = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'in_transit', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
];

const stepIndex = (status: string) =>
  status === 'delivered' ? 3 : status === 'in_transit' ? 2 : status === 'picked_up' ? 1 : 0;

export function RiderDeliveryScreen() {
  const navigation = useNavigation<Nav>();
  const { orderId } = useRoute<RouteProp<RiderStackParamList, 'RiderDelivery'>>().params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { acceptOrder, refresh: refreshJobs } = useRider();

  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await fetchOrder(orderId, user?.id));
    } catch (error) {
      console.error('Error loading delivery:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, user?.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`rider-order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, load)
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [orderId, load]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(async ({ status }) => {
      if (status !== 'granted') return;
      const pos = await Location.getLastKnownPositionAsync();
      if (pos) setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const run = async (fn: () => Promise<void>, success: string) => {
    if (!user) return;
    setBusy(true);
    try {
      await fn();
      Toast.show({ type: 'success', text1: success });
      await load();
      refreshJobs();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Something went wrong', text2: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!order) return;
    setBusy(true);
    const res = await acceptOrder(order);
    setBusy(false);
    if (res.ok) {
      Toast.show({ type: 'success', text1: 'Order accepted', text2: `Head to ${order.vendor.name}` });
      load();
    } else if (res.message) {
      Toast.show({ type: 'error', text1: res.message });
    }
  };

  const confirmPickup = () =>
    Alert.alert('Confirm pickup', `Have you collected all ${order?.item_count} item(s) from ${order?.vendor.name}?`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Yes, picked up', onPress: () => run(() => markPickedUp(orderId, user!.id), 'Marked as picked up') },
    ]);

  const handleStartTrip = () => run(() => startTrip(orderId, user!.id), 'Trip started. The customer has been notified.');

  const submitCode = async () => {
    if (!user || code.trim().length < 4) {
      setCodeError('Enter the code from the customer');
      return;
    }
    setBusy(true);
    setCodeError(null);
    const res = await completeDelivery(orderId, user.id, code);
    setBusy(false);
    if (!res.ok) {
      setCodeError(res.message || 'Could not verify the code');
      return;
    }
    setCodeOpen(false);
    setCode('');
    Toast.show({ type: 'success', text1: 'Delivered!', text2: `${naira(order?.rider_earnings || 0)} added to your earnings` });
    await load();
    refreshJobs();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={R.orange} />
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Feather name="alert-circle" size={36} color={R.muted} />
        <Text style={styles.missing}>This order is no longer available.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.missingBtn}>
          <Text style={styles.missingBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isMine = order.rider_id === user?.id;
  const isClaimable = !order.rider_id && CLAIMABLE_STATUSES.includes(order.status);
  const takenByOther = !!order.rider_id && !isMine;
  const isCash = order.payment_method === 'cash';
  const current = stepIndex(order.status);
  const showContacts = isMine && order.status !== 'delivered';

  // Bottom action for the current state.
  let action: { label: string; icon: React.ComponentProps<typeof Feather>['name']; onPress?: () => void; disabled?: boolean; hint?: string } | null = null;
  if (isClaimable) action = { label: `Accept · earn ${naira(order.rider_earnings)}`, icon: 'check', onPress: handleAccept };
  else if (isMine && (order.status === 'confirmed' || order.status === 'preparing'))
    action = { label: 'Waiting for the restaurant', icon: 'clock', disabled: true, hint: "Head to the restaurant. You can pick up once they mark the order ready." };
  else if (isMine && order.status === 'ready') action = { label: 'Confirm pickup', icon: 'package', onPress: confirmPickup };
  else if (isMine && order.status === 'picked_up') action = { label: 'Start trip to customer', icon: 'navigation', onPress: handleStartTrip };
  else if (isMine && order.status === 'in_transit')
    action = { label: 'Complete delivery', icon: 'check-circle', onPress: () => setCodeOpen(true), hint: 'Ask the customer for the delivery code in their app.' };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={20} color={R.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Order #{order.order_number}</Text>
            <Text style={styles.headerSub}>{order.vendor.name}</Text>
          </View>
          <StatusPill status={order.status} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: action ? 140 + insets.bottom : 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={R.orange} />}
      >
        {order.vendor.latitude && order.vendor.longitude && Platform.OS !== 'web' ? (
          <View style={styles.map}>
            <GoogleTrackingMap
              vendorLat={order.vendor.latitude}
              vendorLng={order.vendor.longitude}
              deliveryLat={order.dropoff.latitude ?? undefined}
              deliveryLng={order.dropoff.longitude ?? undefined}
              riderLat={myLocation?.lat}
              riderLng={myLocation?.lng}
              orderStatus={order.status}
            />
          </View>
        ) : null}

        <View style={styles.body}>
          {takenByOther && (
            <View style={styles.notice}>
              <Feather name="info" size={16} color={R.muted} />
              <Text style={styles.noticeText}>Another rider has taken this order.</Text>
            </View>
          )}

          {/* Progress */}
          {isMine && (
            <View style={styles.card}>
              <View style={styles.steps}>
                {STEPS.map((s, i) => {
                  const done = i <= current;
                  return (
                    <React.Fragment key={s.key}>
                      <View style={styles.step}>
                        <View style={[styles.stepDot, done && styles.stepDotOn]}>
                          {done && <Feather name="check" size={12} color="#fff" />}
                        </View>
                        <Text style={[styles.stepLabel, done && { color: R.text }]}>{s.label}</Text>
                      </View>
                      {i < STEPS.length - 1 && <View style={[styles.stepBar, i < current && styles.stepBarOn]} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          )}

          {/* Money */}
          <View style={styles.moneyRow}>
            <View style={[styles.moneyBox, { borderColor: 'rgba(16,185,129,0.3)' }]}>
              <Text style={styles.moneyLabel}>You earn</Text>
              <Text style={[styles.moneyValue, { color: R.green }]}>{naira(order.rider_earnings)}</Text>
            </View>
            <View style={[styles.moneyBox, isCash && { borderColor: 'rgba(245,158,11,0.35)' }]}>
              <Text style={styles.moneyLabel}>{isCash ? 'Collect cash' : 'Payment'}</Text>
              <Text style={[styles.moneyValue, { color: isCash ? R.amber : R.text, fontSize: isCash ? 20 : 16 }]}>
                {isCash ? naira(order.total) : 'Paid online'}
              </Text>
            </View>
          </View>

          {/* Pickup */}
          <StopCard
            kind="pickup"
            title={order.vendor.name}
            address={order.vendor.address}
            active={isMine && current === 0}
            onCall={showContacts && order.vendor.phone ? () => callPhone(order.vendor.phone) : undefined}
            onChat={showContacts ? () => navigation.navigate('Messaging') : undefined}
            onDirections={() => openDirections(order.vendor.latitude, order.vendor.longitude, order.vendor.address)}
          />

          {/* Drop-off */}
          <StopCard
            kind="dropoff"
            title={isMine || order.status === 'delivered' ? order.customer.name : 'Customer'}
            address={order.dropoff.address}
            note={order.dropoff.landmark}
            active={isMine && (current === 1 || current === 2)}
            onCall={showContacts && order.customer.phone ? () => callPhone(order.customer.phone) : undefined}
            onChat={showContacts ? () => navigation.navigate('Messaging') : undefined}
            onDirections={() => openDirections(order.dropoff.latitude, order.dropoff.longitude, order.dropoff.address)}
          />

          {/* Items */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Items ({order.item_count})</Text>
            {order.items.map((item, idx) => (
              <View key={idx} style={[styles.item, idx > 0 && styles.itemBorder]}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.itemImg} />
                ) : (
                  <View style={[styles.itemImg, styles.itemImgFallback]}>
                    <Feather name="coffee" size={16} color={R.orange} />
                  </View>
                )}
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.itemQty}>×{item.quantity}</Text>
              </View>
            ))}
            {order.notes ? (
              <View style={styles.noteBox}>
                <Feather name="file-text" size={14} color={R.amber} />
                <Text style={styles.noteText}>{order.notes}</Text>
              </View>
            ) : null}
          </View>

          {order.status === 'delivered' && (
            <View style={[styles.notice, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }]}>
              <Feather name="check-circle" size={16} color={R.green} />
              <Text style={[styles.noticeText, { color: R.green }]}>Delivered. Nice work!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {action && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {action.hint ? <Text style={styles.hint}>{action.hint}</Text> : null}
          <TouchableOpacity disabled={action.disabled || busy} onPress={action.onPress} activeOpacity={0.85}>
            <LinearGradient
              colors={action.disabled ? ['#2a2a2a', '#2a2a2a'] : R.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtn}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name={action.icon} size={18} color={action.disabled ? R.muted : '#fff'} />
                  <Text style={[styles.actionText, action.disabled && { color: R.muted }]}>{action.label}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Delivery code */}
      <Modal visible={codeOpen} transparent animationType="slide" onRequestClose={() => setCodeOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setCodeOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.grabber} />
            <View style={styles.sheetIcon}>
              <Feather name="lock" size={22} color={R.orange} />
            </View>
            <Text style={styles.sheetTitle}>Enter delivery code</Text>
            <Text style={styles.sheetBody}>
              Ask {order.customer.name.split(' ')[0]} for the code shown in their Vesphe app.
              {isCash ? ` Collect ${naira(order.total)} in cash first.` : ''}
            </Text>
            <TextInput
              value={code}
              onChangeText={t => {
                setCode(t.replace(/[^0-9A-Za-z]/g, ''));
                setCodeError(null);
              }}
              placeholder="••••"
              placeholderTextColor={R.faint}
              style={[styles.codeInput, codeError && { borderColor: R.red }]}
              maxLength={6}
              autoFocus
              autoCapitalize="characters"
              keyboardType="number-pad"
            />
            {codeError ? <Text style={styles.codeError}>{codeError}</Text> : null}
            <TouchableOpacity onPress={submitCode} disabled={busy} activeOpacity={0.85}>
              <LinearGradient colors={R.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtn}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Confirm delivery</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StopCard({
  kind,
  title,
  address,
  note,
  active,
  onCall,
  onChat,
  onDirections,
}: {
  kind: 'pickup' | 'dropoff';
  title: string;
  address: string;
  note?: string | null;
  active?: boolean;
  onCall?: () => void;
  onChat?: () => void;
  onDirections: () => void;
}) {
  const color = kind === 'pickup' ? R.orange : R.green;
  return (
    <View style={[styles.card, active && { borderColor: color + '66' }]}>
      <View style={styles.stopHead}>
        <View style={[styles.stopIcon, { backgroundColor: color + '1f' }]}>
          <Feather name={kind === 'pickup' ? 'shopping-bag' : 'map-pin'} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stopKind, { color }]}>{kind === 'pickup' ? 'PICKUP' : 'DROP-OFF'}</Text>
          <Text style={styles.stopTitle}>{title}</Text>
        </View>
      </View>
      <Text style={styles.stopAddress}>{address}</Text>
      {note ? <Text style={styles.stopNote}>{note}</Text> : null}
      <View style={styles.stopActions}>
        <TouchableOpacity style={[styles.stopBtn, styles.stopBtnWide]} onPress={onDirections}>
          <Feather name="navigation" size={15} color={R.text} />
          <Text style={styles.stopBtnText}>Directions</Text>
        </TouchableOpacity>
        {onCall && (
          <TouchableOpacity style={styles.stopBtn} onPress={onCall}>
            <Feather name="phone" size={15} color={R.text} />
          </TouchableOpacity>
        )}
        {onChat && (
          <TouchableOpacity style={styles.stopBtn} onPress={onChat}>
            <Feather name="message-circle" size={15} color={R.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: R.bg },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  missing: { color: R.muted, fontSize: 15, marginTop: 12, textAlign: 'center' },
  missingBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: R.card },
  missingBtnText: { color: R.orange, fontWeight: '600' },
  headerWrap: { backgroundColor: R.bg, borderBottomWidth: 1, borderBottomColor: R.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: R.card, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: R.text, fontSize: 16, fontWeight: '700' },
  headerSub: { color: R.muted, fontSize: 12, marginTop: 1 },
  map: { height: 230, backgroundColor: R.card, overflow: 'hidden' },
  body: { padding: 16, gap: 12 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: R.card,
    borderWidth: 1,
    borderColor: R.border,
  },
  noticeText: { color: R.muted, fontSize: 13, flex: 1 },
  card: { backgroundColor: R.card, borderRadius: 18, borderWidth: 1, borderColor: R.border, padding: 16 },
  cardTitle: { color: R.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { alignItems: 'center', width: 64 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotOn: { backgroundColor: R.orange, borderColor: R.orange },
  stepLabel: { color: R.faint, fontSize: 11, marginTop: 6, textAlign: 'center' },
  stepBar: { flex: 1, height: 2, backgroundColor: '#333', marginTop: 11 },
  stepBarOn: { backgroundColor: R.orange },
  moneyRow: { flexDirection: 'row', gap: 12 },
  moneyBox: { flex: 1, backgroundColor: R.card, borderRadius: 18, borderWidth: 1, borderColor: R.border, padding: 14 },
  moneyLabel: { color: R.muted, fontSize: 12 },
  moneyValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  stopHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stopIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stopKind: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  stopTitle: { color: R.text, fontSize: 15, fontWeight: '700', marginTop: 1 },
  stopAddress: { color: '#d4d4d4', fontSize: 14, marginTop: 12, lineHeight: 20 },
  stopNote: { color: R.muted, fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  stopActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stopBtn: {
    height: 40,
    minWidth: 44,
    borderRadius: 12,
    backgroundColor: R.cardRaised,
    borderWidth: 1,
    borderColor: R.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  stopBtnWide: { flex: 1 },
  stopBtnText: { color: R.text, fontSize: 13, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  itemBorder: { borderTopWidth: 1, borderTopColor: R.border },
  itemImg: { width: 40, height: 40, borderRadius: 10 },
  itemImgFallback: { backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },
  itemName: { color: R.text, fontSize: 14, flex: 1 },
  itemQty: { color: R.orange, fontSize: 14, fontWeight: '700' },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  noteText: { color: '#e5e5e5', fontSize: 13, flex: 1, lineHeight: 19 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(10,10,10,0.96)',
    borderTopWidth: 1,
    borderTopColor: R.border,
  },
  hint: { color: R.muted, fontSize: 12, textAlign: 'center', marginBottom: 10, lineHeight: 17 },
  actionBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#151515',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: R.border,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#333', marginBottom: 18 },
  sheetIcon: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(249,115,22,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: { color: R.text, fontSize: 19, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  sheetBody: { color: R.muted, fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  codeInput: {
    marginTop: 20,
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#333',
    backgroundColor: R.bg,
    color: R.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  codeError: { color: R.red, fontSize: 13, textAlign: 'center', marginTop: -6, marginBottom: 14 },
});
