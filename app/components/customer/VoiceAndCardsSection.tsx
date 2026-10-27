// app/components/customer/VoiceAndCardsSection.tsx
// Profile settings for voice ordering (Pro Max / free trial, "Hey Vesphe", Siri
// shortcut) and the cards saved for one-tap and voice checkout. Matches the Profile
// screen's 16px side padding and card style.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { supabase } from '../../lib/supabase';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useVoiceAssistant } from '../../voice/VoiceAssistantContext';
import { wakeWordConfigured } from '../../voice/native';
import { getWakeWordEnabled, setWakeWordEnabled } from '../../voice/wakeWordSetting';
import { loadSavedCards, type SavedCard } from '../../services/voiceOrder';
import type { RootStackParamList } from '../../navigation/types';

const ORANGE = '#f97316';
const PURPLE = '#a78bfa';

export function VoiceAndCardsSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const voice = useVoiceAssistant();
  const { isProMax, pricing } = useSubscription();
  const [wakeOn, setWakeOn] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [trialLeft, setTrialLeft] = useState<number | null>(null);
  const wakeReady = voice.available && wakeWordConfigured();

  useEffect(() => {
    getWakeWordEnabled().then(setWakeOn);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedCards().then(setCards);
      supabase.rpc('voice_access').then(({ data }) => setTrialLeft(data && !data.pro_max ? Number(data.trial_orders_left) : null));
    }, [])
  );

  const toggleWake = (on: boolean) => {
    setWakeOn(on);
    setWakeWordEnabled(on);
    if (on) Toast.show({ type: 'success', text1: 'Say "Hey Vesphe" any time the app is open', position: 'bottom' });
  };

  const removeCard = (card: SavedCard) =>
    Alert.alert('Remove card?', `${card.brand || 'Card'} ending ${card.last4} will no longer be used for quick or voice checkout.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('saved_cards').delete().eq('id', card.id);
          if (error) Toast.show({ type: 'error', text1: 'Could not remove card', position: 'bottom' });
          else setCards(prev => prev.filter(c => c.id !== card.id));
        },
      },
    ]);

  const planLine = isProMax
    ? 'Included in your Pro Max plan'
    : trialLeft !== null && trialLeft > 0
    ? `Free trial: ${trialLeft} voice order${trialLeft === 1 ? '' : 's'} left`
    : `Part of Pro Max · from ₦${pricing.maxMonthly.toLocaleString()}/month`;

  return (
    <>
      <View style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Voice ordering</Text>
          <View style={styles.maxBadge}>
            <Feather name="mic" size={11} color="#fff" />
            <Text style={styles.maxBadgeText}>PRO MAX</Text>
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={voice.open} activeOpacity={0.7}>
            <View style={[styles.icon, styles.iconPurple]}><Feather name="mic" size={18} color={PURPLE} /></View>
            <View style={styles.rowText}>
              <Text style={styles.label}>Order by voice</Text>
              <Text style={styles.sub}>{voice.available ? planLine : 'Needs the Vesphe app from the store (not Expo Go)'}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#666" />
          </TouchableOpacity>

          {!isProMax && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Pro', { tier: 'pro_max' })} activeOpacity={0.7}>
                <View style={[styles.icon, styles.iconPurple]}><Feather name="zap" size={18} color={PURPLE} /></View>
                <View style={styles.rowText}>
                  <Text style={styles.label}>Get Pro Max</Text>
                  <Text style={styles.sub}>Unlimited voice ordering + everything in Pro</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#666" />
              </TouchableOpacity>
            </>
          )}

          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.icon}><Feather name="radio" size={18} color={ORANGE} /></View>
            <View style={styles.rowText}>
              <Text style={styles.label}>"Hey Vesphe"</Text>
              <Text style={styles.sub}>{wakeReady ? 'Start hands-free while the app is open' : 'Coming soon · use the mic button for now'}</Text>
            </View>
            <Switch
              value={wakeOn && wakeReady}
              onValueChange={toggleWake}
              disabled={!wakeReady}
              trackColor={{ false: '#333', true: 'rgba(249,115,22,0.5)' }}
              thumbColor={wakeOn && wakeReady ? ORANGE : '#888'}
            />
          </View>

          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => setShowHelp(v => !v)} activeOpacity={0.7}>
            <View style={styles.icon}><Feather name="smartphone" size={18} color={ORANGE} /></View>
            <View style={styles.rowText}>
              <Text style={styles.label}>Use with {Platform.OS === 'ios' ? 'Siri' : 'Google Assistant'}</Text>
              <Text style={styles.sub}>Start Vesphe voice from anywhere</Text>
            </View>
            <Feather name={showHelp ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
          </TouchableOpacity>
          {showHelp && (
            <Text style={styles.help}>
              {Platform.OS === 'ios'
                ? '1. Open the Shortcuts app and tap +.\n2. Add the action "Open URLs" with vesphe://voice\n3. Name it "Vesphe order".\n\nNow say "Hey Siri, Vesphe order". You can also long-press the Vesphe icon and tap "Order by voice".'
                : 'Say "Hey Google, open Vesphe". With "Hey Vesphe" on, just say "Hey Vesphe" once the app opens.\n\nYou can also long-press the Vesphe icon and tap "Order by voice".'}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Saved cards</Text>
        </View>
        {cards.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Feather name="credit-card" size={22} color="#666" />
            <Text style={styles.emptyText}>No saved cards yet</Text>
            <Text style={styles.sub}>Pay by card once and tick "Save this card" for one-tap and voice checkout.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {cards.map((card, i) => (
              <View key={card.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <View style={styles.icon}><Feather name="credit-card" size={18} color={ORANGE} /></View>
                  <View style={styles.rowText}>
                    <Text style={styles.label}>{(card.brand || 'Card').toUpperCase()} •••• {card.last4}</Text>
                    <Text style={styles.sub}>Stored securely by Paystack</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeCard(card)} accessibilityLabel="Remove card" style={styles.removeBtn}>
                    <Feather name="trash-2" size={17} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff' },
  maxBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7c3aed', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  maxBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowText: { flex: 1, minWidth: 0 },
  divider: { height: 1, backgroundColor: '#262626', marginLeft: 52 },
  icon: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  iconPurple: { backgroundColor: 'rgba(124,58,237,0.15)' },
  label: { color: '#fff', fontSize: 14, fontWeight: '500' },
  sub: { color: '#888', fontSize: 12, marginTop: 2, lineHeight: 17 },
  help: { color: '#bbb', fontSize: 13, lineHeight: 20, paddingBottom: 14, paddingLeft: 52, paddingRight: 4 },
  emptyCard: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, gap: 4 },
  emptyText: { color: '#fff', fontSize: 14, fontWeight: '500', marginTop: 6 },
  removeBtn: { padding: 8 },
});
