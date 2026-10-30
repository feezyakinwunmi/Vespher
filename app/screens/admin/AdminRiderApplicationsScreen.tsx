// app/screens/admin/AdminRiderApplicationsScreen.tsx
// Review rider applications: see every detail and document, then approve or reject.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  TextInput,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format, formatDistanceToNow } from 'date-fns';
import Toast from 'react-native-toast-message';
import {
  ApplicationStatus,
  RiderApplication,
  VEHICLE_TYPES,
  OWNERSHIP_TYPES,
  ID_TYPES,
  labelFor,
  fetchApplications,
  reviewApplication,
} from '../../services/riderApplications';
import { ModalSafeArea } from '../../components/ModalSafeArea';

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

const TABS: { key: ApplicationStatus; label: string }[] = [
  { key: 'pending', label: 'To review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const QUICK_REASONS = [
  'Photos are unclear',
  'ID does not match your details',
  'Licence is expired or invalid',
  'Vehicle papers missing or invalid',
  'Guarantor could not be reached',
];

const STATUS_COLOR: Record<ApplicationStatus, string> = { pending: C.amber, approved: C.green, rejected: C.red };

export function AdminRiderApplicationsScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<ApplicationStatus>('pending');
  const [items, setItems] = useState<RiderApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<RiderApplication | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchApplications(tab));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not load applications', text2: e?.message });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const close = () => {
    setSelected(null);
    setRejecting(false);
    setReason('');
  };

  const decide = async (approve: boolean) => {
    if (!selected) return;
    if (!approve && !reason.trim()) {
      Toast.show({ type: 'error', text1: 'Add a reason so the applicant knows what to fix' });
      return;
    }
    setBusy(true);
    try {
      await reviewApplication(selected.id, approve, approve ? undefined : reason.trim());
      Toast.show({ type: 'success', text1: approve ? `${selected.full_name} is now a rider` : 'Application rejected' });
      close();
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not save review', text2: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmApprove = () =>
    Alert.alert('Approve rider', `Approve ${selected?.full_name}? They will be able to go online and accept deliveries.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => decide(true) },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Rider applications</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabOn]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && { color: '#fff' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={a => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.orange} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={28} color={C.faint} />
              <Text style={styles.emptyText}>{tab === 'pending' ? 'No applications waiting. Nice!' : 'Nothing here yet.'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => setSelected(item)} activeOpacity={0.85}>
              {item.selfie_url ? (
                <Image source={{ uri: item.selfie_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}><Feather name="user" size={18} color={C.orange} /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.full_name || 'Applicant'}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {labelFor(VEHICLE_TYPES, item.vehicle_type)}
                  {item.vehicle_number ? ` · ${item.vehicle_number}` : ''}
                  {item.city ? ` · ${item.city}` : ''}
                </Text>
                <Text style={styles.time}>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.faint} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Detail */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={close}>
        {selected && (
          <ModalSafeArea style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.back} onPress={close}>
                <Feather name="x" size={20} color={C.text} />
              </TouchableOpacity>
              <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{selected.full_name}</Text>
              <View style={[styles.pill, { backgroundColor: STATUS_COLOR[selected.status] + '22' }]}>
                <Text style={[styles.pillText, { color: STATUS_COLOR[selected.status] }]}>{selected.status}</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
              <View style={styles.top}>
                <TouchableOpacity onPress={() => selected.selfie_url && setViewer(selected.selfie_url)}>
                  {selected.selfie_url ? (
                    <Image source={{ uri: selected.selfie_url }} style={styles.bigAvatar} />
                  ) : (
                    <View style={[styles.bigAvatar, styles.avatarFallback]}><Feather name="user" size={30} color={C.orange} /></View>
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1, gap: 6 }}>
                  <Action icon="phone" text={selected.phone} onPress={() => Linking.openURL(`tel:${selected.phone}`)} />
                  <Action icon="mail" text={selected.email} onPress={() => Linking.openURL(`mailto:${selected.email}`)} />
                </View>
              </View>

              {selected.status === 'rejected' && selected.rejection_reason && (
                <View style={styles.rejected}>
                  <Text style={styles.rejectedText}>Rejected: {selected.rejection_reason}</Text>
                </View>
              )}

              <Section title="Personal">
                <Info k="Date of birth" v={selected.date_of_birth ? format(new Date(selected.date_of_birth), 'd MMM yyyy') : null} />
                <Info k="Address" v={[selected.address, selected.city].filter(Boolean).join(', ')} />
                <Info k="Applied" v={format(new Date(selected.created_at), 'd MMM yyyy, h:mm a')} />
              </Section>

              <Section title="Vehicle">
                <Info k="Type" v={labelFor(VEHICLE_TYPES, selected.vehicle_type)} />
                <Info k="Make / model" v={[selected.vehicle_make, selected.vehicle_model].filter(Boolean).join(' ')} />
                <Info k="Year" v={selected.vehicle_year ? String(selected.vehicle_year) : null} />
                <Info k="Colour" v={selected.vehicle_color} />
                <Info k="Plate" v={selected.vehicle_number} />
                <Info k="Ownership" v={labelFor(OWNERSHIP_TYPES, selected.vehicle_ownership)} />
                {selected.vehicle_owner_name && <Info k="Owner" v={`${selected.vehicle_owner_name} · ${selected.vehicle_owner_phone || ''}`} />}
              </Section>

              <Section title="Licence & ID">
                <Info k="Licence no." v={selected.license_number} />
                <Info k="Expires" v={selected.license_expiry ? format(new Date(selected.license_expiry), 'd MMM yyyy') : null} />
                <Info k="ID" v={selected.id_type ? `${labelFor(ID_TYPES, selected.id_type)} · ${selected.id_number || ''}` : null} />
              </Section>

              <Section title="Documents">
                <View style={styles.docs}>
                  {[
                    ['Vehicle', selected.vehicle_photo_url],
                    ['Papers', selected.vehicle_papers_url],
                    ['Licence', selected.license_photo_url],
                    ['ID', selected.id_card_url],
                  ].map(([label, url]) => (
                    <TouchableOpacity key={label} style={styles.doc} disabled={!url} onPress={() => url && setViewer(url)}>
                      {url ? <Image source={{ uri: url }} style={styles.docImg} /> : <Feather name="minus" size={18} color={C.faint} />}
                      <Text style={styles.docLabel}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>

              <Section title="Guarantor">
                <Info k="Name" v={selected.guarantor_name} />
                <Info k="Relationship" v={selected.guarantor_relationship} />
                <Info k="Address" v={selected.guarantor_address} />
                {selected.guarantor_phone && <Action icon="phone" text={selected.guarantor_phone} onPress={() => Linking.openURL(`tel:${selected.guarantor_phone}`)} />}
              </Section>

              <Section title="Bank">
                <Info k="Account" v={selected.account_name} />
                <Info k="Bank" v={selected.bank_name} />
                <Info k="Number" v={selected.account_number} />
              </Section>

              {rejecting && (
                <Section title="Reason for rejecting">
                  <View style={styles.reasons}>
                    {QUICK_REASONS.map(r => (
                      <TouchableOpacity key={r} style={[styles.reason, reason === r && styles.reasonOn]} onPress={() => setReason(r)}>
                        <Text style={[styles.reasonText, reason === r && { color: '#fff' }]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Or write your own (the applicant will see this)"
                    placeholderTextColor={C.faint}
                    style={styles.reasonInput}
                    multiline
                  />
                </Section>
              )}
            </ScrollView>

            {selected.status === 'pending' && (
              <View style={styles.footer}>
                {busy ? (
                  <ActivityIndicator color={C.orange} style={{ height: 50, flex: 1 }} />
                ) : rejecting ? (
                  <>
                    <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setRejecting(false)}>
                      <Text style={styles.btnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: C.red, flex: 2 }]} onPress={() => decide(false)}>
                      <Text style={styles.btnText}>Reject application</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setRejecting(true)}>
                      <Text style={[styles.btnText, { color: C.red }]}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: C.green, flex: 2 }]} onPress={confirmApprove}>
                      <Text style={styles.btnText}>Approve rider</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ModalSafeArea>
        )}

        {/* Full-screen photo */}
        <Modal visible={!!viewer} transparent onRequestClose={() => setViewer(null)}>
          <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewer(null)}>
            {viewer && <Image source={{ uri: viewer }} style={styles.viewerImg} resizeMode="contain" />}
            <Text style={styles.viewerHint}>Tap anywhere to close</Text>
          </TouchableOpacity>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Info({ k, v }: { k: string; v?: string | null }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoKey}>{k}</Text>
      <Text style={styles.infoVal}>{v || '—'}</Text>
    </View>
  );
}

function Action({ icon, text, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; text?: string | null; onPress: () => void }) {
  if (!text) return null;
  return (
    <TouchableOpacity style={styles.action} onPress={onPress}>
      <Feather name={icon} size={14} color={C.orange} />
      <Text style={styles.actionText} numberOfLines={1}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 19, fontWeight: '800' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.card, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  tabOn: { backgroundColor: C.orange },
  tabText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 10, marginTop: 60 },
  emptyText: { color: C.muted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },
  name: { color: C.text, fontSize: 15, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  time: { color: C.faint, fontSize: 11.5, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  top: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  bigAvatar: { width: 84, height: 84, borderRadius: 42 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  actionText: { color: C.text, fontSize: 14, flex: 1 },
  rejected: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)' },
  rejectedText: { color: '#fca5a5', fontSize: 13 },
  sectionTitle: { color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  info: { flexDirection: 'row', paddingVertical: 5, gap: 12 },
  infoKey: { color: C.muted, fontSize: 13, width: 100 },
  infoVal: { color: C.text, fontSize: 13.5, flex: 1 },
  docs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  doc: { width: '47%', height: 110, borderRadius: 12, backgroundColor: '#1c1c1c', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  docImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  docLabel: { position: 'absolute', bottom: 6, left: 8, color: '#fff', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  reason: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#2a2a2a' },
  reasonOn: { backgroundColor: C.red, borderColor: C.red },
  reasonText: { color: C.text, fontSize: 12.5 },
  reasonInput: { minHeight: 70, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', color: C.text, padding: 12, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: C.border },
  btn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  btnGhost: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerImg: { width: '100%', height: '80%' },
  viewerHint: { color: C.muted, marginTop: 12 },
});
