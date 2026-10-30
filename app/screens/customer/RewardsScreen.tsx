// app/screens/customer/RewardsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Share,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export function RewardsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchRewards();
  }, []);

const fetchRewards = async () => {
  if (!user?.id) return;

  try {
    // Fetch customer rewards
    const { data: rewardsData, error: rewardsError } = await supabase
      .from('customer_rewards')
      .select('*')
      .eq('customer_id', user.id)
      .maybeSingle();

    if (rewardsError) throw rewardsError;

    // If no rewards record exists, create one
    if (!rewardsData) {
      const newReferralCode = generateReferralCode();
      const { data: newRewards, error: insertError } = await supabase
        .from('customer_rewards')
        .insert({
          customer_id: user.id,
          total_orders: 0,
          free_delivery_earned: 0,
          free_delivery_used: 0,
          referral_code: newReferralCode,
          referral_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      setRewards(newRewards);
      setReferralCode(newRewards.referral_code);
    } else {
      setRewards(rewardsData);
      setReferralCode(rewardsData.referral_code);
    }

    // Fetch completed referrals (friends who joined) - simplified without nested select
const { data: referralsData, error: referralsError } = await supabase
  .from('referrals')
  .select('*')
  .eq('referrer_id', user.id)
  .eq('status', 'completed')
  .eq('referrer_reward_claimed', false)  // Only count unclaimed
  .order('completed_at', { ascending: false });

    if (referralsError) throw referralsError;
    setReferrals(referralsData || []);

  } catch (error) {
    console.error('Error fetching rewards:', error);
  } finally {
    setIsLoading(false);
    setRefreshing(false);
  }
};

const generateReferralCode = () => {
  const name = user?.name?.replace(/\s/g, '').toUpperCase().slice(0, 6) || 'USER';
  const random = Math.floor(100 + Math.random() * 900);
  return `VSP-${name}-${random}`;
};
// Example: VSP-JOHNDOE-456

  const onRefresh = () => {
    setRefreshing(true);
    fetchRewards();
  };

  const handleShareReferral = async () => {
    const message = `Join me on Vespher! Use my referral code: ${referralCode}\n\nGet ₦500 off your first order! Download the app: [Your App Link]`;
    
    try {
      await Share.share({
        message: message,
        title: 'Invite Friends to Vespher',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyCode = () => {
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate total savings (only from referral bonuses - each completed referral = ₦500)
const totalSavings = (referrals.length) * 500;  // Use actual referrals array length
  const availableFreeDeliveries = (rewards?.free_delivery_earned || 0) - (rewards?.free_delivery_used || 0);
const availableReferralBonus = Math.min(referrals.length * 500, 2000);

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Rewards</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {/* Total Savings Card - Only from referrals */}
<LinearGradient
  colors={['#f97316', '#f43f5e']}
  style={styles.savingsCard}
>
  <Text style={styles.savingsLabel}>Available Referral Savings</Text>
  <Text style={styles.savingsAmount}>₦{totalSavings.toLocaleString()}</Text>
  <Text style={styles.savingsSubtext}>
    From {referrals.length} unclaimed referral{referrals.length !== 1 ? 's' : ''}
  </Text>
</LinearGradient>

        {/* Referral Code Section */}
        <View style={styles.referralCodeCard}>
          <Text style={styles.referralCodeTitle}>Your Referral Code</Text>
          <View style={styles.referralCodeContainer}>
            <Text style={styles.referralCode}>{referralCode}</Text>
            <TouchableOpacity onPress={handleCopyCode} style={styles.copyButton}>
              <Feather name={copied ? 'check' : 'copy'} size={18} color={copied ? '#10b981' : '#f97316'} />
              <Text style={[styles.copyText, copied && styles.copyTextSuccess]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.referralCodeDescription}>
            Share this code with friends. They get ₦500 off their first order, and you get ₦500 when they complete their first order!
          </Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareReferral}
          >
            <LinearGradient colors={['#f97316', '#f43f5e']} style={styles.shareGradient}>
              <Feather name="share-2" size={16} color="#fff" />
              <Text style={styles.shareText}>Invite Friends</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Free Delivery Rewards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="truck" size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>Free Delivery Rewards</Text>
          </View>

          <View style={styles.rewardCard}>
            <View style={styles.rewardCardHeader}>
              <Text style={styles.rewardCardTitle}>Available Free Deliveries</Text>
              <Text style={styles.rewardCardCount}>{availableFreeDeliveries}</Text>
            </View>
            
            <Text style={styles.rewardCardDescription}>
              Use a free delivery reward on any order to save on delivery fees. Earned every 5th order.
            </Text>
            
            {rewards?.free_delivery_expires_at && availableFreeDeliveries > 0 && (
              <View style={styles.rewardCardFooter}>
                <Feather name="calendar" size={12} color="#f59e0b" />
                <Text style={styles.rewardCardExpiry}>
                  Expires {new Date(rewards.free_delivery_expires_at).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>

          {/* Used Deliveries */}
          {(rewards?.free_delivery_used || 0) > 0 && (
            <View style={styles.usedCard}>
              <Text style={styles.usedTitle}>Used</Text>
              <Text style={styles.usedCount}>{rewards.free_delivery_used} free deliver{rewards.free_delivery_used !== 1 ? 'ies' : 'y'}</Text>
            </View>
          )}
        </View>

        {/* Referral Rewards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="users" size={20} color="#f97316" />
            <Text style={styles.sectionTitle}>Referral Rewards</Text>
          </View>

          <View style={styles.rewardCard}>
            <View style={styles.rewardCardHeader}>
              <Text style={styles.rewardCardTitle}>Referral Bonus Available</Text>
              <Text style={styles.rewardCardCount}>₦{availableReferralBonus.toLocaleString()}</Text>
            </View>
            
            <Text style={styles.rewardCardDescription}>
              Get ₦500 for each friend who completes their first order. Max ₦2,000. Bonus automatically applies at checkout.
            </Text>
          </View>

          {/* Friends Who Joined */}
          {referrals.length > 0 && (
            <View style={styles.referralList}>
              <Text style={styles.referralListTitle}>
                Friends who joined ({referrals.length})
              </Text>
              {referrals.map((referral, index) => (
                <View key={index} style={styles.referralItem}>
                  <Feather name="check-circle" size={16} color="#10b981" />
                  <View style={styles.referralItemInfo}>
                    <Text style={styles.referralItemText}>
                      Friend completed their first order
                    </Text>
                    <Text style={styles.referralItemDate}>
                      {formatDistanceToNow(new Date(referral.completed_at), { addSuffix: true })}
                    </Text>
                  </View>
                  <Text style={styles.referralItemBonus}>+₦500</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* How it works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Rewards Work</Text>
          <View style={styles.infoItem}>
            <Feather name="gift" size={14} color="#f97316" />
            <Text style={styles.infoText}>Free delivery earned every 5th order</Text>
          </View>
          <View style={styles.infoItem}>
            <Feather name="users" size={14} color="#f97316" />
            <Text style={styles.infoText}>₦500 bonus when friends complete first order</Text>
          </View>
          <View style={styles.infoItem}>
            <Feather name="calendar" size={14} color="#f97316" />
            <Text style={styles.infoText}>Free delivery rewards expire after 30 days</Text>
          </View>
          <View style={styles.infoItem}>
            <Feather name="dollar-sign" size={14} color="#f97316" />
            <Text style={styles.infoText}>Referral bonuses never expire (up to ₦2,000)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  savingsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  savingsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  savingsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  savingsSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  referralCodeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  referralCodeTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  referralCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  referralCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f97316',
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 8,
  },
  copyText: {
    fontSize: 12,
    color: '#f97316',
  },
  copyTextSuccess: {
    color: '#10b981',
  },
  referralCodeDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
  },
  shareButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  shareText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  rewardCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rewardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardCardTitle: {
    fontSize: 14,
    color: '#666',
  },
  rewardCardCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f97316',
  },
  rewardCardDescription: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    marginBottom: 12,
  },
  rewardCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardCardExpiry: {
    fontSize: 11,
    color: '#f59e0b',
  },
  usedCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usedTitle: {
    fontSize: 12,
    color: '#666',
  },
  usedCount: {
    fontSize: 12,
    color: '#10b981',
  },
  referralList: {
    marginTop: 12,
  },
  referralListTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  referralItemInfo: {
    flex: 1,
  },
  referralItemText: {
    fontSize: 13,
    color: '#fff',
  },
  referralItemDate: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  referralItemBonus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#999',
  },
});