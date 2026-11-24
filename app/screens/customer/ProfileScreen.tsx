// app/screens/customer/ProfileScreen.tsx
import { useHealth } from '../../contexts/HealthContext';
import { useProfileSetup, SetupStepId } from '../../hooks/customer/useProfileSetup';
import { useSubscription } from '../../contexts/SubscriptionContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { HEALTH_CONDITIONS, HealthCondition } from '../../contexts/HealthContext';
import { supabase } from '../../lib/supabase';
import { confirmDeleteAccount } from '../../utils/account';
import { RootStackParamList } from '../../navigation/types';
import { VoiceAndCardsSection } from '../../components/customer/VoiceAndCardsSection';
import type { Address } from '../../types';
import Toast from 'react-native-toast-message';
import { EmojiIcon } from '../../components/EmojiIcon';
import { PRO_SUBSCRIPTIONS_ENABLED } from '../../config/features';
import { MEDICAL_DISCLAIMER } from '../../config/legal';
import { ensureHealthConsent, recordHealthConsent } from '../../utils/healthConsent';
import { TC } from '../../theme/palette';
import { AppearanceSetting } from '../../components/AppearanceSetting';

const formatDate = (date: Date): string => {
  try {
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }
};

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UserStats {
  orders: number;
  favorites: number;
  rewards: number;
}

// Update LIFESTYLE_CONDITIONS in ProfileScreen.tsx
const LIFESTYLE_CONDITIONS: HealthCondition[] = [
  // Fitness & Wellness Goals
  'workout_mode',
  'muscle_gain',
  'weight_loss',
  'weight_gain',
  'endurance_training',
  'post_workout_recovery',
  
  // Dietary & Lifestyle
  'vegetarian',
  'vegan',
  'pescatarian',
  'keto',
  'paleo',
  'low_carb',
  'low_fat',
  'low_sugar',
  'low_sodium',
  'halal',
  'kosher',
];

const GOAL_OPTIONS = [
  { id: 'lose_weight', label: 'Lose Weight', icon: '⚖️' },
  { id: 'gain_weight', label: 'Gain Weight', icon: '💪' },
  { id: 'get_fit', label: 'Get Fit', icon: '🏃' },
  { id: 'eat_healthy', label: 'Eat Healthier', icon: '🥗' },
  { id: 'manage_condition', label: 'Manage Condition', icon: '🩺' },
  { id: 'allergies', label: 'Avoid Allergens', icon: '🚫' },
];

const DURATION_OPTIONS = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'No End Date', days: null },
];

const menuItems = [
  { icon: 'award', label: 'Vesphe Pro', path: 'Pro', color: '#f97316' },
  { icon: 'calendar', label: 'Meal Planner', path: 'MealPlanner', color: '#10b981' },
  { icon: 'heart', label: 'Favorites', path: 'Favorites', color: '#ef4444' },
  { icon: 'map-pin', label: 'Saved Addresses', path: 'Addresses', color: '#f97316' },
  { icon: 'truck', label: 'Become a rider', path: 'RiderApplication', color: '#3b82f6' },
  { icon: 'shield', label: 'Privacy & Security', path: 'Privacy', color: '#10b981' },
  { icon: 'help-circle', label: 'Help & Support', path: 'Support', color: '#f59e0b' },
];

export function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, signOut, refreshProfile } = useAuth();

  // Direct state from database
  const [healthConditions, setHealthConditions] = useState<HealthCondition[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [enableWarnings, setEnableWarnings] = useState(true);
  const [lockInGoal, setLockInGoal] = useState<string | null>(null);
  const [lockInEndDate, setLockInEndDate] = useState<string | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [editedPhone, setEditedPhone] = useState(user?.phone || '');
  const setup = useProfileSetup();
  const { refreshProfile: refreshHealthContext } = useHealth();
  const { isPro } = useSubscription();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [stats, setStats] = useState<UserStats>({ orders: 0, favorites: 0, rewards: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Lock-In modal state
  const [showLockInModal, setShowLockInModal] = useState(false);
  const [selectedConditions, setSelectedConditions] = useState<HealthCondition[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<{ label: string; days: number | null } | null>(null);
  const [lockInEndDateState, setLockInEndDateState] = useState<Date | null>(null);
  const [lockInStep, setLockInStep] = useState<1 | 2 | 3>(1);
  const [isSavingLockIn, setIsSavingLockIn] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({ type, text1: message, position: 'bottom', visibilityTime: 2000 });
  };

  // Fetch health profile directly from Supabase
  // Also refreshes the app-wide health context (Home picks, add-to-cart checks).
  const fetchHealthProfile = async () => {
    refreshHealthContext();
    if (!user?.id) {
      setIsLoadingHealth(false);
      return;
    }

    try {
      console.log('🟢 Fetching health profile for user:', user.id);
      const { data, error } = await supabase
        .from('customer_health_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching health profile:', error);
        return;
      }

      console.log('🟢 Health profile data:', data);

      if (data) {
        setHealthConditions(data.conditions || []);
        setIsLocked(data.is_locked || false);
        setEnableWarnings(data.enable_warnings ?? true);
        setLockInGoal(data.lock_in_goal || null);
        setLockInEndDate(data.lock_in_end_date || null);
      } else {
        setHealthConditions([]);
        setIsLocked(false);
        setEnableWarnings(true);
        setLockInGoal(null);
        setLockInEndDate(null);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  // Fetch user data
  const fetchUserData = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const { data: addressesData } = await supabase
        .from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false });
      setAddresses(addressesData || []);

      const { count: ordersCount } = await supabase
        .from('orders').select('*', { count: 'exact', head: true }).eq('customer_id', user.id);
      const { count: favoritesCount } = await supabase
        .from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      const { data: rewardsData } = await supabase
        .from('customer_rewards').select('free_delivery_earned, free_delivery_used')
        .eq('customer_id', user.id).maybeSingle();

      const rewardsCount = rewardsData
        ? (rewardsData.free_delivery_earned || 0) - (rewardsData.free_delivery_used || 0)
        : 0;

      setStats({ orders: ordersCount || 0, favorites: favoritesCount || 0, rewards: rewardsCount });
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount and when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchUserData();
        fetchHealthProfile();
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchHealthProfile();
    }
  }, [user]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { try { await signOut(); } catch (e) {} } },
    ]);
  };

  const openEditProfile = () => {
    setEditedName(user?.name || '');
    setEditedPhone(user?.phone || '');
    setShowEditProfile(true);
  };

  const handleSetupStep = (id: SetupStepId) => {
    if (id === 'phone') openEditProfile();
    else if (id === 'address') navigation.navigate('Addresses');
    else setShowLockInModal(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const name = editedName.trim();
      if (name.length < 2) { showToast('Please enter your name', 'error'); return; }
      const phone = editedPhone.replace(/[\s-]/g, '');
      if (phone && !/^(\+?234|0)[789][01]\d{8}$/.test(phone)) {
        showToast('Enter a valid Nigerian phone number', 'error');
        return;
      }
      const { error } = await supabase.from('users').update({ name: name.slice(0, 80), phone: phone || null }).eq('id', user.id);
      if (error) throw error;
      showToast('Profile updated successfully');
      setShowEditProfile(false);
      fetchUserData();
      refreshProfile();
    } catch { showToast('Failed to update profile', 'error'); }
  };

  // ── Lock-In Handlers ───────────────────────────────────────────────────

  const toggleCondition = (id: HealthCondition) => {
    setSelectedConditions(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleDurationSelect = (option: { label: string; days: number | null }) => {
    setSelectedDuration(option);
    if (option.days) {
      const end = new Date();
      end.setDate(end.getDate() + option.days);
      setLockInEndDateState(end);
    } else {
      setLockInEndDateState(null);
    }
  };

  const handleSaveLockIn = async () => {
    if (selectedConditions.length === 0) {
      showToast('Please select at least one condition', 'error');
      return;
    }

    if (user?.id && !(await ensureHealthConsent(user.id))) return;

    setIsSavingLockIn(true);

    try {
      const dataToSave = {
        conditions: selectedConditions,
        is_locked: true,
        enable_warnings: enableWarnings,
        lock_in_goal: selectedGoal,
        lock_in_end_date: lockInEndDateState ? lockInEndDateState.toISOString() : null,
      };
      
      console.log('Saving lock-in data:', dataToSave);
      
      if (!user?.id) {
        showToast('User not found', 'error');
        return;
      }
      
      // Check if record exists
      const { data: existing } = await supabase
        .from('customer_health_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      let result;
      
      if (existing) {
        result = await supabase
          .from('customer_health_profiles')
          .update(dataToSave)
          .eq('user_id', user.id);
      } else {
        result = await supabase
          .from('customer_health_profiles')
          .insert({
            user_id: user.id,
            ...dataToSave,
          });
      }
      
      if (result.error) {
        console.error('Save error:', result.error);
        showToast(`Save failed: ${result.error.message}`, 'error');
        return;
      }
      
      console.log('Save successful');
      
      // Refresh the health profile data
      await fetchHealthProfile();
      
      setShowLockInModal(false);
      if (user?.id) await recordHealthConsent(user.id);
      showToast('Health Lock-In saved successfully');
    } catch (error) {
      console.error('Error saving lock-in:', error);
      showToast('Failed to save settings. Please try again.', 'error');
    } finally {
      setIsSavingLockIn(false);
    }
  };

  // Toggle lock-in on/off
  const handleToggleLockIn = async () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    
    await supabase
      .from('customer_health_profiles')
      .update({ is_locked: newLockState })
      .eq('user_id', user?.id);
    
    showToast(newLockState ? 'Lock-In enabled' : 'Lock-In disabled');
    await fetchHealthProfile();
  };

  // Toggle warnings on/off
  const handleToggleWarnings = async () => {
    const newValue = !enableWarnings;
    setEnableWarnings(newValue);
    
    await supabase
      .from('customer_health_profiles')
      .update({ enable_warnings: newValue })
      .eq('user_id', user?.id);
    
    showToast(newValue ? 'Warnings enabled' : 'Warnings disabled');
    await fetchHealthProfile();
  };

  // Delete a single condition
  const handleDeleteCondition = async (conditionId: HealthCondition) => {
    const conditionMeta = HEALTH_CONDITIONS.find(c => c.id === conditionId);
    
    Alert.alert(
      'Remove condition',
      `Remove "${conditionMeta?.label}" from your active conditions?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const newConditions = healthConditions.filter(c => c !== conditionId);
            setHealthConditions(newConditions);
            
            await supabase
              .from('customer_health_profiles')
              .update({ conditions: newConditions })
              .eq('user_id', user?.id);
            
            await fetchHealthProfile();
            showToast(`${conditionMeta?.label} removed`);
          },
        },
      ]
    );
  };

  // Clear all conditions
  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Conditions?',
      'This will remove all your health conditions and disable Lock-In.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setHealthConditions([]);
            setIsLocked(false);
            setLockInGoal(null);
            setLockInEndDate(null);
            
            await supabase
              .from('customer_health_profiles')
              .update({ 
                conditions: [], 
                is_locked: false,
                lock_in_goal: null,
                lock_in_end_date: null 
              })
              .eq('user_id', user?.id);
            
            await fetchHealthProfile();
            showToast('All conditions cleared');
          },
        },
      ]
    );
  };

  // Edit existing profile (open modal with current values)
  const handleEditConditions = () => {
    setSelectedConditions([...healthConditions]);
    setSelectedGoal(lockInGoal);
    
    if (lockInEndDate) {
      try {
        const existingEndDate = new Date(lockInEndDate);
        if (existingEndDate > new Date()) {
          setLockInEndDateState(existingEndDate);
          const daysRemaining = Math.ceil((existingEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysRemaining <= 7) setSelectedDuration(DURATION_OPTIONS[0]);
          else if (daysRemaining <= 14) setSelectedDuration(DURATION_OPTIONS[1]);
          else if (daysRemaining <= 30) setSelectedDuration(DURATION_OPTIONS[2]);
          else if (daysRemaining <= 90) setSelectedDuration(DURATION_OPTIONS[3]);
          else setSelectedDuration(DURATION_OPTIONS[4]);
        }
      } catch (e) {}
    } else {
      setLockInEndDateState(null);
      setSelectedDuration(null);
    }
    
    setLockInStep(1);
    setShowLockInModal(true);
  };

// In ProfileScreen.tsx, update this function:
// In ProfileScreen.tsx, update this function:
const isLifestyleCondition = (id: HealthCondition) => {
  // Conditions that can have end dates (lifestyle choices)
  const lifestyleIds: HealthCondition[] = [
    'workout_mode', 'muscle_gain', 'weight_loss', 'weight_gain', 
    'endurance_training', 'post_workout_recovery',
    'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 
    'low_carb', 'low_fat', 'low_sugar', 'low_sodium', 'halal', 'kosher'
  ];
  return lifestyleIds.includes(id);
};


  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getDaysRemaining = () => {
    if (!lockInEndDate) return null;
    try {
      const endDate = new Date(lockInEndDate);
      const diff = endDate.getTime() - Date.now();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return null;
    }
  };

  // Debug log

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notLoggedInContainer}>
          <View style={styles.notLoggedInIcon}><Feather name="user" size={40} color={TC.muted} /></View>
          <Text style={styles.notLoggedInTitle}>Sign in to continue</Text>
          <Text style={styles.notLoggedInText}>Access your orders, saved addresses, and more</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.signInButton}>
            <View style={[styles.signInGradient, { backgroundColor: '#ea580c' }]}>
              <Text style={styles.signInText}>Sign in</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={TC.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity onPress={openEditProfile} style={styles.editButton}>
          <Feather name="edit-2" size={18} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: '#ea580c' }]}>
                <Text style={styles.avatarInitials}>{getUserInitials()}</Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            {user.phone && <View style={styles.profileDetail}><Feather name="phone" size={14} color={TC.muted} /><Text style={styles.profileDetailText}>{user.phone}</Text></View>}
            {user.email && <View style={styles.profileDetail}><Feather name="mail" size={14} color={TC.muted} /><Text style={styles.profileDetailText} numberOfLines={1}>{user.email}</Text></View>}
          </View>
        </View>

        {/* Getting started checklist */}
        {!setup.isComplete && (
          <View style={styles.setupCard}>
            <View style={styles.setupHeader}>
              <Text style={styles.setupTitle}>Finish setting up</Text>
              <Text style={styles.setupProgress}>{setup.completed}/{setup.total}</Text>
            </View>
            <View style={styles.setupBar}>
              <View style={[styles.setupBarFill, { width: `${(setup.completed / setup.total) * 100}%` }]} />
            </View>
            {setup.steps.map(step => (
              <TouchableOpacity
                key={step.id}
                style={styles.setupStep}
                onPress={() => handleSetupStep(step.id)}
                disabled={step.done}
              >
                <Feather
                  name={step.done ? 'check-circle' : 'circle'}
                  size={20}
                  color={step.done ? '#10b981' : '#f97316'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.setupStepTitle, step.done && styles.setupStepDone]}>{step.title}</Text>
                  {!step.done && <Text style={styles.setupStepText}>{step.description}</Text>}
                </View>
                {!step.done && <Feather name="chevron-right" size={18} color={TC.muted} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Vesphe Pro */}
        {PRO_SUBSCRIPTIONS_ENABLED && !isPro && (
          <TouchableOpacity onPress={() => navigation.navigate('Pro')} style={styles.proCard} activeOpacity={0.85}>
            <View style={[styles.proCardGradient, { backgroundColor: '#ea580c' }]}>
              <Feather name="award" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.proCardTitle}>Try Vesphe Pro</Text>
                <Text style={styles.proCardText}>Unlimited personalised picks and a weekly meal timetable</Text>
              </View>
              <Feather name="chevron-right" size={20} color={TC.text} />
            </View>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('CustomerTabs', { screen: 'Orders' })} style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.orders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity onPress={() => navigation.navigate('Favorites')} style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.favorites}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity onPress={() => navigation.navigate('Rewards')} style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.rewards}</Text>
            <Text style={styles.statLabel}>Rewards</Text>
          </TouchableOpacity>
        </View>

        {/* ── HEALTH LOCK-IN SECTION ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Health Lock-In</Text>
              {healthConditions.length > 0 && (
                <View style={[
                  styles.lockInStatusBadge,
                  { backgroundColor: isLocked ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }
                ]}>
                  <View style={[styles.statusDot, { backgroundColor: isLocked ? '#10b981' : '#f59e0b' }]} />
                  <Text style={[styles.lockInStatusText, { color: isLocked ? '#10b981' : '#f59e0b' }]}>
                    {isLocked ? 'Active' : 'Paused'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {healthConditions.length > 0 ? (
            <View style={styles.lockInActiveCard}>
              {/* Show expiry info if exists */}
              {lockInEndDate && (() => {
                const daysLeft = getDaysRemaining();
                if (daysLeft !== null && daysLeft > 0) {
                  return (
                    <View style={styles.expiryInfo}>
                      <Feather name="calendar" size={12} color="#f59e0b" />
                      <Text style={styles.expiryText}>
                        Active until {formatDate(new Date(lockInEndDate))} ({daysLeft} days left)
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Show goal if exists */}
              {lockInGoal && (
                <View style={styles.goalInfo}>
                  <Feather name="target" size={12} color="#10b981" />
                  <Text style={styles.goalText}>
                    Goal: {GOAL_OPTIONS.find(g => g.id === lockInGoal)?.label || lockInGoal}
                  </Text>
                </View>
              )}

              {/* Active Conditions Title */}
              <Text style={styles.activeConditionsTitle}>Active Conditions:</Text>
              
              {/* Active conditions list with delete buttons */}
              <View style={styles.lockInConditionsGrid}>
                {healthConditions.map(condId => {
                  const meta = HEALTH_CONDITIONS.find(c => c.id === condId);
                  if (!meta) return null;
                  return (
                    <View key={condId} style={[styles.conditionPill, { borderColor: meta.color }]}>
                      <EmojiIcon emoji={meta.icon} size={13} color={meta.color} />
                      <Text style={[styles.conditionPillLabel, { color: meta.color }]}>{meta.label}</Text>
                      <TouchableOpacity 
                        onPress={() => handleDeleteCondition(condId)}
                        style={styles.conditionDeleteButton}
                      >
                        <Feather name="x" size={12} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {/* Add More Conditions Button */}
              <TouchableOpacity style={styles.addMoreButton} onPress={handleEditConditions}>
                <Feather name="plus" size={14} color="#f97316" />
                <Text style={styles.addMoreButtonText}>Add or Edit Conditions</Text>
              </TouchableOpacity>

              {/* Separator */}
              <View style={styles.separator} />

              {/* Lock-In toggle row */}
              <View style={styles.lockInToggleRow}>
                <View style={styles.lockInToggleInfo}>
                  <Feather name={isLocked ? 'lock' : 'unlock'} size={16} color={isLocked ? '#10b981' : '#f59e0b'} />
                  <View>
                    <Text style={styles.lockInToggleTitle}>
                      {isLocked ? 'Warnings enabled' : 'Warnings paused'}
                    </Text>
                    <Text style={styles.lockInToggleSubtitle}>
                      {isLocked
                        ? 'You\'ll be warned before ordering conflicting food'
                        : 'Tap to enable health warnings'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isLocked}
                  onValueChange={handleToggleLockIn}
                  trackColor={{ false: TC.raised, true: 'rgba(16,185,129,0.4)' }}
                  thumbColor={isLocked ? '#10b981' : TC.muted}
                />
              </View>

              {/* Warnings toggle */}
              {isLocked && (
                <View style={[styles.lockInToggleRow, { borderTopWidth: 1, borderTopColor: TC.hairline, marginTop: 4, paddingTop: 12 }]}>
                  <View style={styles.lockInToggleInfo}>
                    <Feather name="bell" size={16} color={TC.muted} />
                    <View>
                      <Text style={styles.lockInToggleTitle}>Show modal warnings</Text>
                      <Text style={styles.lockInToggleSubtitle}>Pop-up before adding flagged foods</Text>
                    </View>
                  </View>
                  <Switch
                    value={enableWarnings}
                    onValueChange={handleToggleWarnings}
                    trackColor={{ false: TC.raised, true: 'rgba(249,115,22,0.4)' }}
                    thumbColor={enableWarnings ? '#f97316' : TC.muted}
                  />
                </View>
              )}

              {/* Clear All button */}
              <TouchableOpacity style={styles.clearAllButton} onPress={handleClearAll}>
                <Feather name="trash-2" size={14} color="#ef4444" />
                <Text style={styles.clearAllButtonText}>Clear all conditions</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.lockInEmptyCard} onPress={() => setShowLockInModal(true)} activeOpacity={0.85}>
              <View style={[styles.lockInEmptyGradient, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                <View style={styles.lockInEmptyIcon}>
                  <Feather name="lock" size={26} color="#f97316" />
                </View>
                <Text style={styles.lockInEmptyTitle}>Set up health Lock-In</Text>
                <Text style={styles.lockInEmptySubtitle}>
                  Tell us about your health goals or conditions. We'll warn you before you order something that doesn't suit you.
                </Text>
                <View style={styles.lockInEmptyExamples}>
                  {['Workout Mode', 'Diabetic', 'Nut Allergy', 'Vegan'].map(tag => (
                    <View key={tag} style={styles.lockInExampleTag}>
                      <Text style={styles.lockInExampleTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.lockInSetupButton}>
                  <View style={[styles.lockInSetupGradient, { backgroundColor: '#ea580c' }]}>
                    <Feather name="shield" size={16} color="#fff" />
                    <Text style={styles.lockInSetupButtonText}>Set up now</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Saved Addresses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved addresses</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Addresses' as never)} style={styles.addAddressBtn}>
              <Feather name="plus" size={16} color="#f97316" />
              <Text style={styles.addAddressBtnText}>Add new</Text>
            </TouchableOpacity>
          </View>
          {addresses.length > 0 ? (
            <View style={styles.addressesList}>
              {addresses.map(address => (
                <View key={address.id} style={styles.addressCard}>
                  <View style={styles.addressIcon}><Feather name="map-pin" size={20} color="#f97316" /></View>
                  <View style={styles.addressInfo}>
                    <View style={styles.addressHeader}>
                      <Text style={styles.addressLabel}>{address.label}</Text>
                      {address.is_default && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>}
                    </View>
                    <Text style={styles.addressText}>{address.street}, {address.area}</Text>
                    {address.landmark && <Text style={styles.addressDetail}>Landmark: {address.landmark}</Text>}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('Addresses' as never)} style={styles.emptyAddresses}>
              <Feather name="map-pin" size={24} color={TC.muted} />
              <Text style={styles.emptyAddressesText}>No saved addresses</Text>
              <Text style={styles.emptyAddressesSubtext}>Tap to add your first address</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.medicalNote}>{MEDICAL_DISCLAIMER}</Text>

        <VoiceAndCardsSection />

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.filter(item => PRO_SUBSCRIPTIONS_ENABLED || (item.path !== 'Pro' && item.path !== 'MealPlanner')).map((item, index) => (
            <TouchableOpacity key={index} onPress={() => navigation.navigate(item.path as never)} style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                <Feather name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={20} color={TC.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <AppearanceSetting style={{ marginHorizontal: 20, marginBottom: 16 }} />

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <View style={styles.logoutIcon}><Feather name="log-out" size={20} color="#ef4444" /></View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => confirmDeleteAccount(signOut)} style={styles.deleteAccountButton}>
          <Text style={styles.deleteAccountText}>Delete account</Text>
        </TouchableOpacity>
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color={TC.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Name</Text>
                <TextInput style={styles.modalInput} value={editedName} onChangeText={setEditedName} placeholder="Your name" placeholderTextColor={TC.muted} />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Phone</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editedPhone}
                  onChangeText={setEditedPhone}
                  placeholder="e.g. 08012345678"
                  placeholderTextColor={TC.muted}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Email</Text>
                <TextInput style={[styles.modalInput, styles.modalInputDisabled]} value={user.email} editable={false} />
              </View>
              <TouchableOpacity onPress={handleSaveProfile} style={styles.modalButton}>
                <View style={[styles.modalButtonGradient, { backgroundColor: '#ea580c' }]}>
                  <Text style={styles.modalButtonText}>Save changes</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Lock-In Setup Modal (3-step wizard) ── */}
      <Modal visible={showLockInModal} transparent animationType="slide" onRequestClose={() => setShowLockInModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.lockInModal}>
            {/* Modal Header */}
            <View style={styles.lockInModalHeader}>
              <View style={styles.lockInModalHeaderLeft}>
                {lockInStep > 1 && (
                  <TouchableOpacity onPress={() => setLockInStep(prev => (prev - 1) as 1 | 2 | 3)} style={styles.backStepBtn}>
                    <Feather name="arrow-left" size={18} color={TC.text} />
                  </TouchableOpacity>
                )}
                <View>
                  <Text style={styles.lockInModalTitle}>
                    {lockInStep === 1 ? 'Your Goal' : lockInStep === 2 ? 'Your Conditions' : 'Lock-In Duration'}
                  </Text>
                  <Text style={styles.lockInModalSubtitle}>Step {lockInStep} of 3</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowLockInModal(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color={TC.text} />
              </TouchableOpacity>
            </View>

            {/* Step progress bar */}
            <View style={styles.stepProgressBar}>
              {[1, 2, 3].map(step => (
                <View
                  key={step}
                  style={[styles.stepSegment, { backgroundColor: step <= lockInStep ? '#f97316' : TC.raised }]}
                />
              ))}
            </View>

            <ScrollView style={styles.lockInModalBody} showsVerticalScrollIndicator={false}>

              {/* Step 1: Goal */}
              {lockInStep === 1 && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepDescription}>
                    What are you working towards? This helps us understand your food needs.
                  </Text>
                  <View style={styles.goalGrid}>
                    {GOAL_OPTIONS.map(goal => (
                      <TouchableOpacity
                        key={goal.id}
                        style={[styles.goalCard, selectedGoal === goal.id && styles.goalCardSelected]}
                        onPress={() => setSelectedGoal(goal.id)}
                      >
                        <EmojiIcon emoji={goal.icon} size={26} color={selectedGoal === goal.id ? '#f97316' : TC.subtle} />
                        <Text style={[styles.goalLabel, selectedGoal === goal.id && styles.goalLabelSelected]}>
                          {goal.label}
                        </Text>
                        {selectedGoal === goal.id && (
                          <View style={styles.goalCheck}>
                            <Feather name="check" size={12} color={TC.text} />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Step 2: Conditions */}
              {lockInStep === 2 && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepDescription}>
                    Select all that apply to you. These help us flag conflicting foods while you order.
                  </Text>

                  {/* Lifestyle conditions */}
                  <Text style={styles.conditionGroupLabel}>Lifestyle & goals</Text>
                  <View style={styles.conditionsGrid}>
                    {HEALTH_CONDITIONS.filter(c => LIFESTYLE_CONDITIONS.includes(c.id)).map(cond => {
                      const isSelected = selectedConditions.includes(cond.id);
                      return (
                        <TouchableOpacity
                          key={cond.id}
                          style={[styles.conditionCard, isSelected && { borderColor: cond.color, backgroundColor: `${cond.color}15` }]}
                          onPress={() => toggleCondition(cond.id)}
                        >
                          <EmojiIcon emoji={cond.icon} size={22} color={cond.color} />
                          <Text style={[styles.conditionCardLabel, isSelected && { color: cond.color }]}>{cond.label}</Text>
                          <Text style={styles.conditionCardDesc} numberOfLines={2}>{cond.description}</Text>
                          {isSelected && (
                            <View style={[styles.conditionCheckmark, { backgroundColor: cond.color }]}>
                              <Feather name="check" size={10} color={TC.text} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Health conditions */}
                  <Text style={[styles.conditionGroupLabel, { marginTop: 20 }]}>Health conditions & allergies</Text>
                  <View style={styles.conditionsGrid}>
                    {HEALTH_CONDITIONS.filter(c => !LIFESTYLE_CONDITIONS.includes(c.id)).map(cond => {
                      const isSelected = selectedConditions.includes(cond.id);
                      return (
                        <TouchableOpacity
                          key={cond.id}
                          style={[styles.conditionCard, isSelected && { borderColor: cond.color, backgroundColor: `${cond.color}15` }]}
                          onPress={() => toggleCondition(cond.id)}
                        >
                          <EmojiIcon emoji={cond.icon} size={22} color={cond.color} />
                          <Text style={[styles.conditionCardLabel, isSelected && { color: cond.color }]}>{cond.label}</Text>
                          <Text style={styles.conditionCardDesc} numberOfLines={2}>{cond.description}</Text>
                          {isSelected && (
                            <View style={[styles.conditionCheckmark, { backgroundColor: cond.color }]}>
                              <Feather name="check" size={10} color={TC.text} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Step 3: Duration */}
              {lockInStep === 3 && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepDescription}>
                    {selectedConditions.some(c => LIFESTYLE_CONDITIONS.includes(c))
                      ? 'Set a duration for your lifestyle Lock-In. Health conditions like allergies never expire.'
                      : 'Your health conditions will be active indefinitely. You can always edit or disable them.'}
                  </Text>

                  {/* Only show duration picker for lifestyle conditions */}
                  {selectedConditions.some(c => LIFESTYLE_CONDITIONS.includes(c)) && (
                    <View style={styles.durationList}>
                      {DURATION_OPTIONS.map(option => (
                        <TouchableOpacity
                          key={option.label}
                          style={[styles.durationOption, selectedDuration?.label === option.label && styles.durationOptionSelected]}
                          onPress={() => handleDurationSelect(option)}
                        >
                          <View style={styles.durationOptionLeft}>
                            <Feather
                              name={option.days ? 'calendar' : 'bookmark'}
                              size={18}
                              color={selectedDuration?.label === option.label ? '#f97316' : TC.muted}
                            />
                            <Text style={[styles.durationLabel, selectedDuration?.label === option.label && styles.durationLabelSelected]}>
                              {option.label}
                            </Text>
                          </View>
                          {option.days && (
                            <Text style={styles.durationDate}>
                              {selectedDuration?.label === option.label && lockInEndDateState
                                ? `Ends ${formatDate(lockInEndDateState)}`
                                : `Until ${formatDate(new Date(Date.now() + option.days * 86400000))}`}
                            </Text>
                          )}
                          {selectedDuration?.label === option.label && (
                            <View style={styles.durationCheck}>
                              <Feather name="check" size={14} color={TC.text} />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Summary of what's being saved */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Lock-In summary</Text>
                    <View style={styles.summaryConditions}>
                      {selectedConditions.map(id => {
                        const meta = HEALTH_CONDITIONS.find(c => c.id === id);
                        return meta ? (
                          <View key={id} style={[styles.summaryPill, { borderColor: meta.color }]}>
                            <Text style={styles.summaryPillText}><EmojiIcon emoji={meta.icon} size={12} color={meta.color} /> {meta.label}</Text>
                          </View>
                        ) : null;
                      })}
                    </View>
                    {lockInEndDateState && (
                      <Text style={styles.summaryExpiry}>
                        Expires: {formatDate(lockInEndDateState)}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Bottom CTA */}
            <View style={styles.lockInModalFooter}>
              {lockInStep < 3 ? (
                <TouchableOpacity
                  style={[styles.nextStepBtn, selectedConditions.length === 0 && lockInStep === 2 && styles.nextStepBtnDisabled]}
                  onPress={() => {
                    if (lockInStep === 2 && selectedConditions.length === 0) {
                      showToast('Select at least one condition', 'error');
                      return;
                    }
                    setLockInStep(prev => (prev + 1) as 2 | 3);
                  }}
                >
                  <View style={[styles.nextStepGradient, { backgroundColor: '#ea580c' }]}>
                    <Text style={styles.nextStepText}>Continue</Text>
                    <Feather name="arrow-right" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.nextStepBtn} onPress={handleSaveLockIn} disabled={isSavingLockIn}>
                  <View style={[styles.nextStepGradient, { backgroundColor: isSavingLockIn ? TC.muted : '#10b981' }]}>
                    {isSavingLockIn ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="lock" size={18} color={TC.text} />
                        <Text style={styles.nextStepText}>Activate Lock-In</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TC.bg, paddingBottom: 60 },
  content: { flex: 1 },

  notLoggedInContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  notLoggedInIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: TC.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  notLoggedInTitle: { fontSize: 18, fontWeight: '600', color: TC.text, marginBottom: 8 },
  notLoggedInText: { fontSize: 14, color: TC.muted, textAlign: 'center', marginBottom: 24 },
  signInButton: { width: '100%', height: 48, borderRadius: 12, overflow: 'hidden' },
  signInGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  signInText: { color: TC.text, fontSize: 15, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: TC.hairline },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: TC.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: TC.text },
  editButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, margin: 16, padding: 16, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  avatarContainer: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', borderWidth: 3, borderColor: TC.bg },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 24, fontWeight: '600', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: TC.text, marginBottom: 4 },
  profileDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  profileDetailText: { fontSize: 13, color: TC.muted },

  statsContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 24, padding: 12, backgroundColor: TC.surface, borderRadius: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '600', color: '#f97316', marginBottom: 2 },
  statLabel: { fontSize: 11, color: TC.muted },
  statDivider: { width: 1, height: '60%', backgroundColor: TC.hairline, alignSelf: 'center' },

  section: { marginBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: TC.text },
  lockInStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  lockInStatusText: { fontSize: 11, fontWeight: '600' },

  lockInActiveCard: { marginHorizontal: 16, backgroundColor: TC.surface2, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', gap: 12 },
  
  activeConditionsTitle: { fontSize: 12, fontWeight: '600', color: TC.subtle, marginBottom: 4 },
  lockInConditionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  conditionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: TC.surface },
  conditionPillIcon: { fontSize: 13 },
  conditionPillLabel: { fontSize: 12, fontWeight: '600' },
  conditionDeleteButton: { marginLeft: 2, padding: 2, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  
  addMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#f97316', marginTop: 4 },
  addMoreButtonText: { fontSize: 13, color: '#f97316', fontWeight: '600' },
  
  separator: { height: 1, backgroundColor: TC.hairline2, marginVertical: 8 },
  
  lockInToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lockInToggleInfo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lockInToggleTitle: { fontSize: 13, fontWeight: '600', color: TC.text, marginBottom: 2 },
  lockInToggleSubtitle: { fontSize: 11, color: TC.muted, lineHeight: 15 },
  
  clearAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)', marginTop: 4 },
  clearAllButtonText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },

  expiryInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 8 },
  expiryText: { fontSize: 11, color: '#f59e0b' },
  goalInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 8 },
  goalText: { fontSize: 11, color: '#10b981' },

  lockInEmptyCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  lockInEmptyGradient: { padding: 20, alignItems: 'center', gap: 10 },
  lockInEmptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  lockInEmptyEmoji: { fontSize: 28 },
  lockInEmptyTitle: { fontSize: 16, fontWeight: '600', color: TC.text, textAlign: 'center' },
  lockInEmptySubtitle: { fontSize: 13, color: TC.muted, textAlign: 'center', lineHeight: 18 },
  lockInEmptyExamples: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  lockInExampleTag: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  lockInExampleTagText: { fontSize: 11, color: '#f97316' },
  lockInSetupButton: { width: '100%', borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  lockInSetupGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  lockInSetupButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  addAddressBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addAddressBtnText: { fontSize: 13, color: '#f97316' },
  addressesList: { paddingHorizontal: 16, gap: 8 },
  addressCard: { flexDirection: 'row', backgroundColor: TC.surface, borderRadius: 12, padding: 12, gap: 12 },
  addressIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },
  addressInfo: { flex: 1 },
  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  addressLabel: { fontSize: 14, fontWeight: '600', color: TC.text },
  defaultBadge: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 4 },
  defaultBadgeText: { fontSize: 9, color: '#f97316', fontWeight: '500' },
  addressText: { fontSize: 12, color: TC.muted, marginBottom: 2 },
  addressDetail: { fontSize: 11, color: TC.muted },
  emptyAddresses: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: TC.surface, marginHorizontal: 16, borderRadius: 12, gap: 8 },
  emptyAddressesText: { fontSize: 14, color: TC.muted },
  emptyAddressesSubtext: { fontSize: 12, color: '#f97316' },

  menuSection: { paddingHorizontal: 16, marginBottom: 24 },
  medicalNote: { color: TC.muted, fontSize: 11.5, lineHeight: 17, marginHorizontal: 20, marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  menuIcon: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 14, color: TC.text },
  logoutButton: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 24, padding: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, gap: 12 },
  logoutIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center', alignItems: 'center' },
  logoutText: { fontSize: 14, color: '#ef4444', fontWeight: '500' },
  setupCard: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 14, backgroundColor: TC.surface, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', gap: 10 },
  setupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  setupTitle: { color: TC.text, fontSize: 16, fontWeight: '600' },
  setupProgress: { color: '#f97316', fontSize: 13, fontWeight: '600' },
  setupBar: { height: 6, borderRadius: 3, backgroundColor: TC.hairline2, overflow: 'hidden' },
  setupBarFill: { height: '100%', backgroundColor: '#ea580c' },
  setupStep: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  setupStepTitle: { color: TC.text, fontSize: 14, fontWeight: '500' },
  setupStepDone: { color: TC.muted, textDecorationLine: 'line-through' },
  setupStepText: { color: TC.subtle, fontSize: 12, marginTop: 2 },
  proCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden' },
  proCardGradient: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  proCardTitle: { color: TC.text, fontSize: 15, fontWeight: '600' },
  proCardText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  deleteAccountButton: { alignItems: 'center', paddingVertical: 8, marginHorizontal: 16, marginTop: -12, marginBottom: 16 },
  deleteAccountText: { fontSize: 13, color: TC.subtle, textDecorationLine: 'underline' },
  bottomPadding: { height: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: TC.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: TC.hairline },
  modalTitle: { fontSize: 18, fontWeight: '600', color: TC.text },
  modalCloseButton: { padding: 4 },
  modalBody: { padding: 16, gap: 16 },
  modalField: { gap: 6 },
  modalFieldLabel: { fontSize: 13, color: TC.muted, marginLeft: 4 },
  modalInput: { height: 44, backgroundColor: TC.raised, borderRadius: 8, paddingHorizontal: 12, color: TC.text, fontSize: 14 },
  modalInputDisabled: { backgroundColor: TC.surface, color: TC.muted },
  modalButton: { height: 44, borderRadius: 8, overflow: 'hidden', marginTop: 8 },
  modalButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  lockInModal: { backgroundColor: TC.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  lockInModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  lockInModalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backStepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: TC.surface, justifyContent: 'center', alignItems: 'center' },
  lockInModalTitle: { fontSize: 17, fontWeight: '600', color: TC.text },
  lockInModalSubtitle: { fontSize: 12, color: TC.muted, marginTop: 1 },
  stepProgressBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, marginBottom: 4 },
  stepSegment: { flex: 1, height: 3, borderRadius: 2 },
  lockInModalBody: { paddingHorizontal: 16 },
  stepContent: { paddingVertical: 16 },
  stepDescription: { fontSize: 13, color: TC.subtle, lineHeight: 20, marginBottom: 20 },

  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard: { width: '47%', padding: 14, borderRadius: 14, backgroundColor: TC.surface, borderWidth: 1.5, borderColor: TC.raised, alignItems: 'center', gap: 6, position: 'relative' },
  goalCardSelected: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)' },
  goalIcon: { fontSize: 26 },
  goalLabel: { fontSize: 13, fontWeight: '600', color: TC.subtle, textAlign: 'center' },
  goalLabelSelected: { color: '#f97316' },
  goalCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#ea580c', justifyContent: 'center', alignItems: 'center' },

  conditionGroupLabel: { fontSize: 12, fontWeight: '600', color: TC.muted, marginBottom: 10 },
  conditionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  conditionCard: { width: '47%', padding: 12, borderRadius: 12, backgroundColor: TC.surface, borderWidth: 1.5, borderColor: TC.raised, gap: 4, position: 'relative' },
  conditionCardIcon: { fontSize: 22 },
  conditionCardLabel: { fontSize: 13, fontWeight: '600', color: TC.text },
  conditionCardDesc: { fontSize: 10, color: TC.muted, lineHeight: 14 },
  conditionCheckmark: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  durationList: { gap: 10, marginBottom: 20 },
  durationOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: TC.surface, borderWidth: 1.5, borderColor: TC.raised, gap: 12 },
  durationOptionSelected: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)' },
  durationOptionLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  durationLabel: { fontSize: 14, fontWeight: '600', color: TC.subtle },
  durationLabelSelected: { color: '#f97316' },
  durationDate: { fontSize: 11, color: TC.muted },
  durationCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ea580c', justifyContent: 'center', alignItems: 'center' },

  summaryCard: { backgroundColor: TC.surface, borderRadius: 14, padding: 14, gap: 10, marginTop: 8 },
  summaryTitle: { fontSize: 12, fontWeight: '600', color: TC.muted },
  summaryConditions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  summaryPill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  summaryPillText: { fontSize: 12, color: TC.text2 },
  summaryExpiry: { fontSize: 12, color: '#f97316', marginTop: 2 },

  lockInModalFooter: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: TC.surface },
  nextStepBtn: { borderRadius: 14, overflow: 'hidden' },
  nextStepBtnDisabled: { opacity: 0.5 },
  nextStepGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  nextStepText: { color: TC.text, fontSize: 16, fontWeight: '600' },
});