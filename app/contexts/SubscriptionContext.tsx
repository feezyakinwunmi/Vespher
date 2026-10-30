// app/contexts/SubscriptionContext.tsx
// Vesphe Pro / Pro Max: who is subscribed, current admin-set prices, and the purchase flow.
// Pro Max = everything in Pro + voice ordering.
// Payment goes through Paystack; activation happens server-side in verify-payment.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { usePaystackCheckout } from './PaystackCheckoutContext';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type ProPlan = 'monthly' | 'yearly';
export type ProTier = 'pro' | 'pro_max';

export interface ProPricing {
  monthly: number;
  yearly: number;
  maxMonthly: number;
  maxYearly: number;
  freeRecommendationLimit: number;
  voiceTrialOrders: number;
}

interface SubscriptionContextValue {
  isPro: boolean; // Pro or Pro Max
  isProMax: boolean;
  tier: ProTier | null;
  plan: ProPlan | null;
  expiresAt: string | null;
  pricing: ProPricing;
  isLoading: boolean;
  isPurchasing: boolean;
  refresh: () => Promise<void>;
  purchase: (plan: ProPlan, tier?: ProTier) => Promise<void>;
}

const DEFAULT_PRICING: ProPricing = { monthly: 1500, yearly: 15000, maxMonthly: 4500, maxYearly: 45000, freeRecommendationLimit: 3, voiceTrialOrders: 3 };

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { pay } = usePaystackCheckout();
  const [isPro, setIsPro] = useState(false);
  const [plan, setPlan] = useState<ProPlan | null>(null);
  const [tier, setTier] = useState<ProTier | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [pricing, setPricing] = useState<ProPricing>(DEFAULT_PRICING);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('pro_monthly_price, pro_yearly_price, pro_max_monthly_price, pro_max_yearly_price, free_recommendation_limit, voice_free_trial_orders')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (settings) {
        setPricing({
          monthly: Number(settings.pro_monthly_price) || DEFAULT_PRICING.monthly,
          yearly: Number(settings.pro_yearly_price) || DEFAULT_PRICING.yearly,
          maxMonthly: Number(settings.pro_max_monthly_price) || DEFAULT_PRICING.maxMonthly,
          maxYearly: Number(settings.pro_max_yearly_price) || DEFAULT_PRICING.maxYearly,
          voiceTrialOrders: settings.voice_free_trial_orders ?? DEFAULT_PRICING.voiceTrialOrders,
          freeRecommendationLimit: settings.free_recommendation_limit ?? DEFAULT_PRICING.freeRecommendationLimit,
        });
      }

      if (!user || user.role !== 'customer') {
        setIsPro(false);
        setTier(null);
        setPlan(null);
        setExpiresAt(null);
        return;
      }

      const { data: actives } = await supabase
        .from('subscriptions')
        .select('plan, tier, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false });
      // Pro Max wins when both are active.
      const active = (actives || []).find(a => a.tier === 'pro_max') || (actives || [])[0] || null;

      setIsPro(!!active);
      setTier((active?.tier as ProTier) || null);
      setPlan((active?.plan as ProPlan) || null);
      setExpiresAt(active?.expires_at || null);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const purchase = useCallback(async (selectedPlan: ProPlan, selectedTier: ProTier = 'pro') => {
    if (!user?.email) {
      Alert.alert('Vesphe Pro', 'Please sign in to subscribe.');
      return;
    }

    setIsPurchasing(true);
    // The database sets the amount from the admin's current prices.
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .insert({ user_id: user.id, plan: selectedPlan, tier: selectedTier })
      .select('id, amount')
      .single();

    if (error || !sub) {
      setIsPurchasing(false);
      Alert.alert('Vesphe Pro', 'Could not start your subscription. Please try again.');
      return;
    }

    const result = await pay('subscription', sub.id);
    setIsPurchasing(false);
    if (result.status === 'paid') {
      await refresh();
      Alert.alert(
        selectedTier === 'pro_max' ? 'Welcome to Vesphe Pro Max' : 'Welcome to Vesphe Pro',
        selectedTier === 'pro_max'
          ? 'Voice ordering, personalised recommendations and your meal timetable are unlocked. Say "Hey Vesphe" or tap the mic.'
          : 'Your personalised recommendations and meal timetable are now unlocked.'
      );
    } else if (result.status === 'pending') {
      Alert.alert('Payment pending', `${result.message || 'We could not confirm your payment yet.'} Reference: ${result.reference}`);
    } else if (result.status === 'failed') {
      Alert.alert('Vesphe Pro', result.message || 'Could not start payment.');
    }
  }, [user?.id, user?.email, pay, refresh]);

  return (
    <SubscriptionContext.Provider value={{ isPro, isProMax: tier === 'pro_max', tier, plan, expiresAt, pricing, isLoading, isPurchasing, refresh, purchase }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within SubscriptionProvider');
  return context;
}
