// app/screens/customer/ProScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSubscription, ProPlan } from '../../contexts/SubscriptionContext';

const BENEFITS: { icon: React.ComponentProps<typeof Feather>['name']; title: string; text: string }[] = [
  { icon: 'star', title: 'Unlimited personalised picks', text: 'Every breakfast, lunch, dinner and snack recommendation, matched to your health profile with the reason for each pick.' },
  { icon: 'calendar', title: 'Weekly meal timetable', text: 'A full week planned for you – right dishes for each time of day, safe for your conditions, with variety across vendors.' },
  { icon: 'refresh-cw', title: 'Fresh plans anytime', text: 'Regenerate your week, swap any meal and order straight from your plan.' },
];

export function ProScreen() {
  const navigation = useNavigation();
  const { isPro, plan, expiresAt, pricing, isPurchasing, purchase } = useSubscription();
  const [selected, setSelected] = useState<ProPlan>('yearly');

  const yearlySaving = pricing.monthly > 0
    ? Math.round((1 - pricing.yearly / (pricing.monthly * 12)) * 100)
    : 0;

  const plans: { id: ProPlan; label: string; price: number; period: string; note?: string }[] = [
    { id: 'monthly', label: 'Monthly', price: pricing.monthly, period: '/month' },
    { id: 'yearly', label: 'Yearly', price: pricing.yearly, period: '/year', note: yearlySaving > 0 ? `Save ${yearlySaving}%` : undefined },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vesphe Pro</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Feather name="award" size={36} color="#fff" />
          <Text style={styles.heroTitle}>Eat right for you, every day</Text>
          <Text style={styles.heroText}>
            Personalised food recommendations and a weekly timetable built around your health and your day.
          </Text>
        </LinearGradient>

        {isPro && (
          <View style={styles.activeCard}>
            <Feather name="check-circle" size={18} color="#10b981" />
            <Text style={styles.activeText}>
              You're on Pro ({plan}) until {expiresAt ? new Date(expiresAt).toLocaleDateString() : '—'}. Buying again extends your plan.
            </Text>
          </View>
        )}

        {BENEFITS.map(b => (
          <View key={b.title} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Feather name={b.icon} size={18} color="#f97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          </View>
        ))}

        <View style={styles.freeNote}>
          <Feather name="shield" size={14} color="#10b981" />
          <Text style={styles.freeNoteText}>
            Allergy and health warnings before you order stay free for everyone.
          </Text>
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

        <TouchableOpacity onPress={() => purchase(selected)} disabled={isPurchasing} style={styles.cta}>
          <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>
                {isPro ? 'Extend Pro' : 'Get Pro'} · ₦{(selected === 'yearly' ? pricing.yearly : pricing.monthly).toLocaleString()}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.legal}>
          One-time payment via Paystack for the selected period. It does not renew automatically.
        </Text>
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
