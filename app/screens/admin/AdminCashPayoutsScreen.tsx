// app/screens/admin/AdminCashPayoutsScreen.tsx
// Cash orders: the rider collects the money, so the vendor's share is sent by
// bank transfer. Record each transfer here with its reference and receipt.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Image,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { format, formatDistanceToNow } from 'date-fns';
import Toast from 'react-native-toast-message';
import { ModalSafeArea } from '../../components/ModalSafeArea';
import { BANKS } from '../../constants/banks';
import {
  CashOwed,
  CashPayout,
  UnpaidCashOrder,
  fetchCashOwed,
  fetchCashPayouts,
  fetchUnpaidCashOrders,
  recordCashPayout,
} from '../../services/cashPayouts';

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
  red: '#ef4444',
};

const naira = (n: number) => `₦${Math.round(n || 0).toLocaleString()}`;
const bankLabel = (v?: string | null) => BANKS.find(b => b.value === v || b.label === v)?.label || v || '—';

export function AdminCashPayoutsScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<'owed' | 'paid'>('owed');
  const [owed, setOwed] = useState<CashOwed[]>([]);
  const [paid, setPaid] = useState<CashPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState<CashOwed | null>(null);
  const [orders, setOrders] = useState<UnpaidCashOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([fetchCashOwed(), fetchCashPayouts()]);
      setOwed(o);
      setPaid(p);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not load cash payouts', text2: e?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (v: CashOwed) => {
    setSelected(v);
    setReference('');
    setNote('');
    setReceipt(null);
    setLoadingOrders(true);
    try {
      setOrders(await fetchUnpaidCashOrders(v.vendor_id));
    } finally {
      setLoadingOrders(false);
    }
  };

  const pickReceipt = () =>
    Alert.alert('Transfer receipt', undefined, [
      { text: 'Take photo', onPress: () => pick('camera') },
      { text: 'Choose from gallery', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const pick = async (source: 'camera' | 'library') => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!res.canceled && res.assets?.[0]?.uri) setReceipt(res.assets[0].uri);
  };

  const total = orders.reduce((s, o) => s + o.vendor_payout, 0);

  const save = () => {
    if (!selected) return;
    if (!reference.trim()) return Toast.show({ type: 'error', text1: 'Add the transfer reference' });
    if (!receipt) return Toast.show({ type: 'error', text1: 'Attach the transfer receipt' });
    Alert.alert('Confirm payout', `Mark ${naira(total)} as sent to ${selected.vendor_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark as paid',
        onPress: async () => {
          setSaving(true);
          try {
            await recordCashPayout(selected.vendor_id, reference, receipt, note);
            Toast.show({ type: 'success', text1: 'Payout recorded', text2: `${selected.vendor_name} has been notified.` });
            setSelected(null);
            load();
          } catch (e: any) {
            Toast.show({ type: 'error', text1: 'Could not record payout', text2: e?.message });
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const totalOwed = owed.reduce((s, v) => s + v.owed, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Cash payouts</Text>
          <Text style={styles.subtitle}>Send vendors their share of cash orders</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Owed to vendors</Text>
        <Text style={styles.summaryValue}>{naira(totalOwed)}</Text>
        <Text style={styles.summarySub}>{owed.length} vendor{owed.length === 1 ? '' : 's'} waiting</Text>
      </View>

      <View style={styles.tabs}>
        {(['owed', 'paid'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && { color: '#fff' }]}>{t === 'owed' ? `To pay (${owed.length})` : 'Paid'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} />
      ) : tab === 'owed' ? (
        <FlatList
          data={owed}
          keyExtractor={v => v.vendor_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.orange} />}
          ListEmptyComponent={<Empty text="All cash orders are paid out." />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => open(item)} activeOpacity={0.85}>
              <View style={styles.rowIcon}><Feather name="home" size={18} color={C.orange} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.vendor_name}</Text>
                <Text style={styles.rowSub}>
                  {item.order_count} cash order{item.order_count === 1 ? '' : 's'}
                  {item.oldest_order_at ? ` · oldest ${formatDistanceToNow(new Date(item.oldest_order_at), { addSuffix: true })}` : ''}
                </Text>
              </View>
              <Text style={styles.amount}>{naira(item.owed)}</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={paid}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.orange} />}
          ListEmptyComponent={<Empty text="No payouts recorded yet." />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}><Feather name="check" size={18} color={C.green} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.vendor_name}</Text>
                <Text style={styles.rowSub}>{format(new Date(item.paid_at), 'd MMM yyyy, h:mm a')} · Ref {item.reference}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={[styles.amount, { color: C.green }]}>{naira(item.amount)}</Text>
                {item.receipt_url && (
                  <TouchableOpacity onPress={() => setViewer(item.receipt_url)}>
                    <Text style={styles.link}>Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Record a payout */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          <ModalSafeArea style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.back} onPress={() => setSelected(null)}>
                <Feather name="x" size={20} color={C.text} />
              </TouchableOpacity>
              <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{selected.vendor_name}</Text>
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                <View style={[styles.summary, { marginHorizontal: 0 }]}>
                  <Text style={styles.summaryLabel}>Amount to send</Text>
                  <Text style={styles.summaryValue}>{naira(total)}</Text>
                  <Text style={styles.summarySub}>Vendor's share of {orders.length} delivered cash order{orders.length === 1 ? '' : 's'}</Text>
                </View>

                <Text style={styles.section}>Send to</Text>
                <View style={styles.card}>
                  {selected.account_number ? (
                    <>
                      <Text style={styles.bankName}>{selected.account_name || selected.vendor_name}</Text>
                      <Text style={styles.rowSub}>{bankLabel(selected.bank_name)}</Text>
                      <TouchableOpacity
                        style={styles.copyRow}
                        onPress={() => {
                          Clipboard.setStringAsync(selected.account_number || '');
                          Toast.show({ type: 'success', text1: 'Account number copied' });
                        }}
                      >
                        <Text style={styles.accountNo}>{selected.account_number}</Text>
                        <Feather name="copy" size={15} color={C.orange} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={{ color: C.amber }}>This vendor hasn't added a bank account yet. Ask them to add one in Settings.</Text>
                  )}
                </View>

                <Text style={styles.section}>Orders included</Text>
                <View style={styles.card}>
                  {loadingOrders ? (
                    <ActivityIndicator color={C.orange} />
                  ) : (
                    orders.map((o, i) => (
                      <View key={o.id} style={[styles.orderRow, i > 0 && styles.rowBorder]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.orderNo}>#{o.order_number || o.id.slice(0, 8)}</Text>
                          <Text style={styles.rowSub}>{format(new Date(o.delivered_at || o.created_at), 'd MMM, h:mm a')} · customer paid {naira(o.total)}</Text>
                        </View>
                        <Text style={styles.orderAmt}>{naira(o.vendor_payout)}</Text>
                      </View>
                    ))
                  )}
                </View>

                <Text style={styles.section}>After you've made the transfer</Text>
                <Text style={styles.label}>Transfer reference</Text>
                <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="From your bank app" placeholderTextColor={C.faint} autoCapitalize="characters" />
                <Text style={styles.label}>Receipt</Text>
                <TouchableOpacity style={[styles.receipt, receipt && { borderStyle: 'solid' }]} onPress={pickReceipt}>
                  {receipt ? (
                    <Image source={{ uri: receipt }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <>
                      <Feather name="image" size={22} color={C.orange} />
                      <Text style={styles.link}>Add screenshot or photo</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.label}>Note (optional)</Text>
                <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 12 }]} value={note} onChangeText={setNote} multiline placeholderTextColor={C.faint} placeholder="Visible to the vendor" />
              </ScrollView>
              <View style={styles.footer}>
                <TouchableOpacity style={[styles.btn, (!orders.length || saving) && { opacity: 0.5 }]} disabled={!orders.length || saving} onPress={save}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Mark {naira(total)} as paid</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </ModalSafeArea>
        )}
      </Modal>

      <Modal visible={!!viewer} transparent onRequestClose={() => setViewer(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <Text style={{ color: C.muted, marginTop: 12 }}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, marginTop: 50 }}>
      <Feather name="check-circle" size={28} color={C.faint} />
      <Text style={{ color: C.muted }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 19, fontWeight: '800' },
  subtitle: { color: C.muted, fontSize: 12, marginTop: 1 },
  summary: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 16, backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)' },
  summaryLabel: { color: C.muted, fontSize: 12.5 },
  summaryValue: { color: C.text, fontSize: 28, fontWeight: '800', marginTop: 4 },
  summarySub: { color: C.muted, fontSize: 12, marginTop: 2 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.card, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  tabOn: { backgroundColor: C.orange },
  tabText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  amount: { color: C.text, fontSize: 15, fontWeight: '800' },
  link: { color: C.orange, fontSize: 13, fontWeight: '600' },
  section: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  bankName: { color: C.text, fontSize: 15, fontWeight: '700' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.1)' },
  accountNo: { color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  orderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  orderNo: { color: C.text, fontSize: 14, fontWeight: '600' },
  orderAmt: { color: C.text, fontSize: 14, fontWeight: '700' },
  label: { color: C.muted, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: C.card, color: C.text, paddingHorizontal: 14, fontSize: 15, marginBottom: 12 },
  receipt: { height: 160, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#333', backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', gap: 6, overflow: 'hidden', marginBottom: 12 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: C.border },
  btn: { height: 52, borderRadius: 14, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
});
