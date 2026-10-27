// app/screens/customer/ProScreen.tsx
// Vesphe Pro and Pro Max (Pro + voice ordering). Opened with { tier: 'pro_max' } from
// the voice assistant when the free voice trial is used up.
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSubscription, ProPlan, ProTier } from '../../contexts/SubscriptionContext';
import type { RootStackParamList } from '../../navigation/types';

type Benefit = { icon: React.ComponentProps<typeof Feather>['name']; title: string; text: string };

const PRO_BENEFITS: Benefit[] = [
  { icon: 'star', title: 'Unlimited personalised picks', text: 'Every breakfast, lunch, dinner and snack recommendation, matched to your health profile with the reason for each pick.' },
  { icon: 'calendar', title: 'Weekly meal timetable', text: 'A full week planned for you – right dishes for each time of day, safe for your conditions, with variety across vendors.' },
  { icon: 'refresh-cw', title: 'Fresh plans anytime', text: 'Regenerate your week, swap any meal and order straight from your plan.' },
];

const MAX_BENEFITS: Benefit[] = [
  { icon: 'mic', title: 'Order by voice, hands-free', text: 'Say "Hey Vesphe" and just talk: Vesphe suggests what suits you, fills your cart and places the order.' },
  { icon: 'shield', title: 'Health-aware voice assistant', text: 'It knows your allergies and conditions and warns you before anything unsafe reaches your cart.' },
  { icon: 'zap', title: 'One-tap pay by voice', text: 'Pay with your saved card or cash on delivery – just say "yes, place it".' },
  { icon: 'award', title: 'Everything in Pro', text: 'Unlimited personalised picks and your weekly meal timetable.' },
];

const GRADIENTS: Record<ProTier, [string, string]> = {
  pro: ['#f97316', '#f43f5e'],
  pro_max: ['#7c3aed', '#f97316'],
};

export function ProScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Pro'>>();
  const { isPro, isProMax, tier: activeTier, plan, expiresAt, pricing, isPurchasing, purchase } = useSubscription();
  const [tier, setTier] = useState<ProTier>(route.params?.tier || (isPro && !isProMax ? 'pro_max' : 'pro'));
  const [selected, setSelected] = useState<ProPlan>('yearly');

  const monthly = tier === 'pro_max' ? pricing.maxMonthly : pricing.monthly;
  const yearly = tier === 'pro_max' ? pricing.maxYearly : pricing.yearly;
  const yearlySaving = monthly > 0 ? Math.round((1 - yearly / (monthly * 12)) * 100) : 0;
  const benefits = tier === 'pro_max' ? MAX_BENEFITS : PRO_BENEFITS;
  const tierName = tier === 'pro_max' ? 'Pro Max' : 'Pro';
  const ownsThisTier = (tier === 'pro_max' && isProMax) || (tier === 'pro' && activeTier === 'pro');

  const plans: { id: ProPlan; label: string; price: number; period: string; note?: string }[] = [
    { id: 'monthly', label: 'Monthly', price: monthly, period: '/month' },
    { id: 'yearly', label: 'Yearly', price: yearly, period: '/year', note: yearlySaving > 0 ? `Save ${yearlySaving}%` : undefined },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vesphe {tierName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tierSwitch}>
          {(['pro', 'pro_max'] as ProTier[]).map(t => (
            <TouchableOpacity key={t} onPress={() => setTier(t)} style={[styles.tierTab, tier === t && styles.tierTabActive]}>
              {t === 'pro_max' && <Feather name="mic" size={13} color={tier === t ? '#fff' : '#aaa'} />}
              <Text style={[styles.tierTabText, tier === t && styles.tierTabTextActive]}>{t === 'pro' ? 'Pro' : 'Pro Max'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <LinearGradient colors={GRADIENTS[tier]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Feather name={tier === 'pro_max' ? 'mic' : 'award'} size={36} color="#fff" />
          <Text style={styles.heroTitle}>{tier === 'pro_max' ? 'Just say what you want to eat' : 'Eat right for you, every day'}</Text>
          <Text style={styles.heroText}>
            {tier === 'pro_max'
              ? `Order hands-free with Vesphe's voice assistant, plus everything in Pro. Try ${pricing.voiceTrialOrders} voice orders free.`
              : 'Personalised food recommendations and a weekly timetable built around your health and your day.'}
          </Text>
        </LinearGradient>

        {isPro && (
          <View style={styles.activeCard}>
            <Feather name="check-circle" size={18} color="#10b981" />
            <Text style={styles.activeText}>
              You're on {activeTier === 'pro_max' ? 'Pro Max' : 'Pro'} ({plan}) until {expiresAt ? new Date(expiresAt).toLocaleDateString() : '—'}.
              {ownsThisTier ? ' Buying again extends your plan.' : tier === 'pro_max' ? ' Upgrading starts Pro Max today.' : ''}
            </Text>
          </View>
        )}

        {benefits.map(b => (
          <View key={b.title} style={styles.benefit}>
            <View style={[styles.benefitIcon, tier === 'pro_max' && { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
              <Feather name={b.icon} size={18} color={tier === 'pro_max' ? '#a78bfa' : '#f97316'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          </View>
        ))}

        <View style={styles.freeNote}>
          <Feather name="shield" size={14} color="#10b981" />
          <Text style={styles.freeNoteText}>Allergy and health warnings before you order stay free for everyone.</Text>
        </View>

        <View style={styles.plans}>
          {plans.map(p => {
            const active = selected === p.id;
            return (
              <TouchableOpacity key={p.id} onPress={() => setSelected(p.id)} style={[styles.planCard, active && styles.planCardActive]}>
                {p.note && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{p.note}</Text>
                  </View>
                )}
                <Text style={styles.planLabel}>{p.label}</Text>
                <Text style={styles.planPrice}>
                  ₦{p.price.toLocaleString()}
                  <Text style={styles.planPeriod}>{p.period}</Text>
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={() => purchase(selected, tier)} disabled={isPurchasing} style={styles.cta}>
          <LinearGradient colors={GRADIENTS[tier]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>
                {ownsThisTier ? `Extend ${tierName}` : isPro && tier === 'pro_max' ? 'Upgrade to Pro Max' : `Get ${tierName}`} · ₦
                {(selected === 'yearly' ? yearly : monthly).toLocaleString()}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.legal}>One-time payment via Paystack for the selected period. It does not renew automatically.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40 },
  tierSwitch: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 4, marginBottom: 16 },
  tierTab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 9 },
  tierTabActive: { backgroundColor: '#2a2a2a' },
  tierTabText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  tierTabTextActive: { color: '#fff' },
  hero: { borderRadius: 16, padding: 20, marginBottom: 20, gap: 8 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  heroText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  activeCard: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.1)', marginBottom: 16, alignItems: 'center' },
  activeText: { flex: 1, color: '#a7f3d0', fontSize: 13 },
  benefit: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  benefitIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.12)', justifyContent: 'center', alignItems: 'center' },
  benefitTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  benefitText: { color: '#aaa', fontSize: 13, lineHeight: 18 },
  freeNote: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 20 },
  freeNoteText: { flex: 1, color: '#888', fontSize: 12 },
  plans: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  planCard: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: 'transparent' },
  planCardActive: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)' },
  planBadge: { position: 'absolute', top: -10, right: 10, backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  planBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  planLabel: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  planPrice: { color: '#fff', fontSize: 20, fontWeight: '700' },
  planPeriod: { color: '#888', fontSize: 12, fontWeight: '400' },
  cta: { borderRadius: 12, overflow: 'hidden' },
  ctaGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  legal: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 10 },
});
