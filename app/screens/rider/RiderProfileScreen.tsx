// app/screens/rider/RiderProfileScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useRider } from '../../contexts/RiderContext';
import { useNotifications } from '../../hooks/useNotifications';
import { supportLinks, SUPPORT } from '../../config/support';
import { confirmDeleteAccount } from '../../utils/account';
import { R } from '../../components/rider/ui';
import type { RiderStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RiderStackParamList>;
type IconName = React.ComponentProps<typeof Feather>['name'];

function Row({ icon, label, sub, onPress, badge, danger }: { icon: IconName; label: string; sub?: string; onPress: () => void; badge?: number; danger?: boolean }) {
  const color = danger ? R.red : R.text;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, danger && { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
        <Feather name={icon} size={17} color={danger ? R.red : R.orange} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      {!danger && <Feather name="chevron-right" size={18} color={R.faint} />}
    </TouchableOpacity>
  );
}

export function RiderProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuth();
  const { delivered, active, setOnline } = useRider();
  const { unreadCount } = useNotifications();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = delivered.filter(o => new Date(o.delivered_at || o.created_at) >= monthStart).length;

  const handleSignOut = () => {
    if (active.length > 0) {
      Toast.show({ type: 'error', text1: 'Finish your active deliveries first' });
      return;
    }
    Alert.alert('Sign out', 'You will stop receiving delivery requests.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await setOnline(false);
          await signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profile}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{(user?.name || 'R').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || 'Rider'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.phone ? <Text style={styles.email}>{user.phone}</Text> : null}
          </View>
          <View style={styles.rolePill}>
            <Feather name="truck" size={12} color={R.orange} />
            <Text style={styles.roleText}>Rider</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{delivered.length >= 200 ? '200+' : delivered.length}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{active.length}</Text>
            <Text style={styles.statLabel}>Active now</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{thisMonth}</Text>
            <Text style={styles.statLabel}>This month</Text>
          </View>
        </View>

        <Text style={styles.group}>Activity</Text>
        <View style={styles.card}>
          <Row icon="bell" label="Notifications" badge={unreadCount} onPress={() => navigation.navigate('Notifications')} />
          <Row icon="message-circle" label="Messages" sub="Chat with customers, restaurants and support" onPress={() => navigation.navigate('Messaging')} />
          <Row icon="credit-card" label="Withdraw & bank account" onPress={() => navigation.navigate('RiderWithdraw')} />
        </View>

        <Text style={styles.group}>Help</Text>
        <View style={styles.card}>
          <Row icon="alert-triangle" label="Report a problem" sub="Issues with an order, customer or payout" onPress={() => navigation.navigate('Complaints')} />
          <Row icon="phone" label="Call support" sub={SUPPORT.phoneDisplay} onPress={() => Linking.openURL(supportLinks.call)} />
          <Row icon="message-square" label="WhatsApp support" onPress={() => Linking.openURL(supportLinks.whatsapp)} />
          <Row icon="shield" label="Privacy & terms" onPress={() => navigation.navigate('Privacy')} />
        </View>

        <View style={[styles.card, { marginTop: 18 }]}>
          <Row icon="log-out" label="Sign out" danger onPress={handleSignOut} />
          <Row icon="trash-2" label="Delete account" danger onPress={() => confirmDeleteAccount(signOut)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: R.bg },
  content: { padding: 16, paddingBottom: 110 },
  title: { color: R.text, fontSize: 26, fontWeight: '800', marginTop: 8, marginBottom: 14 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: R.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: R.border,
    padding: 16,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarFallback: { backgroundColor: R.orange, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  name: { color: R.text, fontSize: 18, fontWeight: '700' },
  email: { color: R.muted, fontSize: 13, marginTop: 2 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249,115,22,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  roleText: { color: R.orange, fontSize: 11, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: R.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: R.border,
    paddingVertical: 16,
    marginTop: 12,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: R.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: R.muted, fontSize: 12, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: R.border },
  group: { color: R.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: R.card, borderRadius: 18, borderWidth: 1, borderColor: R.border, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { color: R.muted, fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: R.rose, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginRight: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
