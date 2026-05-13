// app/screens/customer/ProfileScreen.tsx
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
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { HEALTH_CONDITIONS, HealthCondition } from '../../contexts/HealthContext';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import type { Address } from '../../types';
import Toast from 'react-native-toast-message';

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
  { icon: 'calendar', label: 'Meal Planner', path: 'MealPlanner', color: '#10b981' },  // ← ADD THIS
  { icon: 'heart', label: 'Favorites', path: 'Favorites', color: '#ef4444' },
  { icon: 'map-pin', label: 'Saved Addresses', path: 'Addresses', color: '#f97316' },
  { icon: 'shield', label: 'Privacy & Security', path: 'Privacy', color: '#10b981' },
  { icon: 'help-circle', label: 'Help & Support', path: 'Support', color: '#f59e0b' },
];

export function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, signOut } = useAuth();

  // Direct state from database
  const [healthConditions, setHealthConditions] = useState<HealthCondition[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [enableWarnings, setEnableWarnings] = useState(true);
  const [lockInGoal, setLockInGoal] = useState<string | null>(null);
  const [lockInEndDate, setLockInEndDate] = useState<string | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
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
  const fetchHealthProfile = async () => {
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

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from('users').update({ name: editedName }).eq('id', user.id);
      if (error) throw error;
      showToast('Profile updated successfully');
      setShowEditProfile(false);
      fetchUserData();
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
      showToast('Health Lock-In saved successfully! 🔒');
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
      'Remove Condition',
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
  console.log('🔴 Profile render - healthConditions:', healthConditions);
  console.log('🔴 isLocked:', isLocked);
  console.log('🔴 lockInGoal:', lockInGoal);
  console.log('🔴 lockInEndDate:', lockInEndDate);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notLoggedInContainer}>
          <View style={styles.notLoggedInIcon}><Feather name="user" size={40} color="#666" /></View>
          <Text style={styles.notLoggedInTitle}>Sign in to continue</Text>
          <Text style={styles.notLoggedInText}>Access your orders, saved addresses, and more</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.signInButton}>
            <LinearGradient colors={['#f97316', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.signInGradient}>
              <Text style={styles.signInText}>Sign In</Text>
            </LinearGradient>
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
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity onPress={() => { setEditedName(user.name); setShowEditProfile(true); }} style={styles.editButton}>
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
              <LinearGradient colors={['#f97316', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{getUserInitials()}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            {user.phone && <View style={styles.profileDetail}><Feather name="phone" size={14} color="#666" /><Text style={styles.profileDetailText}>{user.phone}</Text></View>}
            {user.email && <View style={styles.profileDetail}><Feather name="mail" size={14} color="#666" /><Text style={styles.profileDetailText} numberOfLines={1}>{user.email}</Text></View>}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')} style={styles.statItem}>
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
                      <Text style={styles.conditionPillIcon}>{meta.icon}</Text>
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
                  trackColor={{ false: '#2a2a2a', true: 'rgba(16,185,129,0.4)' }}
                  thumbColor={isLocked ? '#10b981' : '#666'}
                />
              </View>

              {/* Warnings toggle */}
              {isLocked && (
                <View style={[styles.lockInToggleRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginTop: 4, paddingTop: 12 }]}>
                  <View style={styles.lockInToggleInfo}>
                    <Feather name="bell" size={16} color="#666" />
                    <View>
                      <Text style={styles.lockInToggleTitle}>Show modal warnings</Text>
                      <Text style={styles.lockInToggleSubtitle}>Pop-up before adding flagged foods</Text>
                    </View>
                  </View>
                  <Switch
                    value={enableWarnings}
                    onValueChange={handleToggleWarnings}
                    trackColor={{ false: '#2a2a2a', true: 'rgba(249,115,22,0.4)' }}
                    thumbColor={enableWarnings ? '#f97316' : '#666'}
                  />
                </View>
              )}

              {/* Clear All button */}
              <TouchableOpacity style={styles.clearAllButton} onPress={handleClearAll}>
                <Feather name="trash-2" size={14} color="#ef4444" />
                <Text style={styles.clearAllButtonText}>Clear All Conditions</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.lockInEmptyCard} onPress={() => setShowLockInModal(true)} activeOpacity={0.85}>
              <LinearGradient
                colors={['rgba(249,115,22,0.1)', 'rgba(249,115,22,0.03)']}
                style={styles.lockInEmptyGradient}
              >
                <View style={styles.lockInEmptyIcon}>
                  <Text style={styles.lockInEmptyEmoji}>🔒</Text>
                </View>
                <Text style={styles.lockInEmptyTitle}>Set Up Health Lock-In</Text>
                <Text style={styles.lockInEmptySubtitle}>
                  Tell us about your health goals or conditions. We'll warn you before you order something that doesn't suit you.
                </Text>
                <View style={styles.lockInEmptyExamples}>
                  {['💪 Workout Mode', '🩺 Diabetic', '🥜 Nut Allergy', '🌱 Vegan'].map(tag => (
                    <View key={tag} style={styles.lockInExampleTag}>
                      <Text style={styles.lockInExampleTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.lockInSetupButton}>
                  <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.lockInSetupGradient}>
                    <Feather name="shield" size={16} color="#fff" />
                    <Text style={styles.lockInSetupButtonText}>Set Up Now</Text>
                  </LinearGradient>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Saved Addresses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Addresses' as never)} style={styles.addAddressBtn}>
              <Feather name="plus" size={16} color="#f97316" />
              <Text style={styles.addAddressBtnText}>Add New</Text>
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
              <Feather name="map-pin" size={24} color="#666" />
              <Text style={styles.emptyAddressesText}>No saved addresses</Text>
              <Text style={styles.emptyAddressesSubtext}>Tap to add your first address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} onPress={() => navigation.navigate(item.path as never)} style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                <Feather name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <View style={styles.logoutIcon}><Feather name="log-out" size={20} color="#ef4444" /></View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Name</Text>
                <TextInput style={styles.modalInput} value={editedName} onChangeText={setEditedName} placeholder="Your name" placeholderTextColor="#666" />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Phone</Text>
                <TextInput style={[styles.modalInput, styles.modalInputDisabled]} value={user.phone} editable={false} />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Email</Text>
                <TextInput style={[styles.modalInput, styles.modalInputDisabled]} value={user.email} editable={false} />
              </View>
              <TouchableOpacity onPress={handleSaveProfile} style={styles.modalButton}>
                <LinearGradient colors={['#f97316', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalButtonGradient}>
                  <Text style={styles.modalButtonText}>Save Changes</Text>
                </LinearGradient>
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
                    <Feather name="arrow-left" size={18} color="#fff" />
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
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Step progress bar */}
            <View style={styles.stepProgressBar}>
              {[1, 2, 3].map(step => (
                <View
                  key={step}
                  style={[styles.stepSegment, { backgroundColor: step <= lockInStep ? '#f97316' : '#2a2a2a' }]}
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
                        <Text style={styles.goalIcon}>{goal.icon}</Text>
                        <Text style={[styles.goalLabel, selectedGoal === goal.id && styles.goalLabelSelected]}>
                          {goal.label}
                        </Text>
                        {selectedGoal === goal.id && (
                          <View style={styles.goalCheck}>
                            <Feather name="check" size={12} color="#fff" />
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
                  <Text style={styles.conditionGroupLabel}>🏃 Lifestyle & Goals</Text>
                  <View style={styles.conditionsGrid}>
                    {HEALTH_CONDITIONS.filter(c => LIFESTYLE_CONDITIONS.includes(c.id)).map(cond => {
                      const isSelected = selectedConditions.includes(cond.id);
                      return (
                        <TouchableOpacity
                          key={cond.id}
                          style={[styles.conditionCard, isSelected && { borderColor: cond.color, backgroundColor: `${cond.color}15` }]}
                          onPress={() => toggleCondition(cond.id)}
                        >
                          <Text style={styles.conditionCardIcon}>{cond.icon}</Text>
                          <Text style={[styles.conditionCardLabel, isSelected && { color: cond.color }]}>{cond.label}</Text>
                          <Text style={styles.conditionCardDesc} numberOfLines={2}>{cond.description}</Text>
                          {isSelected && (
                            <View style={[styles.conditionCheckmark, { backgroundColor: cond.color }]}>
                              <Feather name="check" size={10} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Health conditions */}
                  <Text style={[styles.conditionGroupLabel, { marginTop: 20 }]}>🩺 Health Conditions & Allergies</Text>
                  <View style={styles.conditionsGrid}>
                    {HEALTH_CONDITIONS.filter(c => !LIFESTYLE_CONDITIONS.includes(c.id)).map(cond => {
                      const isSelected = selectedConditions.includes(cond.id);
                      return (
                        <TouchableOpacity
                          key={cond.id}
                          style={[styles.conditionCard, isSelected && { borderColor: cond.color, backgroundColor: `${cond.color}15` }]}
                          onPress={() => toggleCondition(cond.id)}
                        >
                          <Text style={styles.conditionCardIcon}>{cond.icon}</Text>
                          <Text style={[styles.conditionCardLabel, isSelected && { color: cond.color }]}>{cond.label}</Text>
                          <Text style={styles.conditionCardDesc} numberOfLines={2}>{cond.description}</Text>
                          {isSelected && (
                            <View style={[styles.conditionCheckmark, { backgroundColor: cond.color }]}>
                              <Feather name="check" size={10} color="#fff" />
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
                              color={selectedDuration?.label === option.label ? '#f97316' : '#666'}
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
                              <Feather name="check" size={14} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Summary of what's being saved */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Lock-In Summary</Text>
                    <View style={styles.summaryConditions}>
                      {selectedConditions.map(id => {
                        const meta = HEALTH_CONDITIONS.find(c => c.id === id);
                        return meta ? (
                          <View key={id} style={[styles.summaryPill, { borderColor: meta.color }]}>
                            <Text style={styles.summaryPillText}>{meta.icon} {meta.label}</Text>
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
                  <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextStepGradient}>
                    <Text style={styles.nextStepText}>Continue</Text>
                    <Feather name="arrow-right" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.nextStepBtn} onPress={handleSaveLockIn} disabled={isSavingLockIn}>
                  <LinearGradient colors={isSavingLockIn ? ['#555', '#444'] : ['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextStepGradient}>
                    {isSavingLockIn ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="lock" size={18} color="#fff" />
                        <Text style={styles.nextStepText}>Activate Lock-In</Text>
                      </>
                    )}
                  </LinearGradient>
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
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingBottom: 60 },
  content: { flex: 1 },

  notLoggedInContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  notLoggedInIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  notLoggedInTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  notLoggedInText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  signInButton: { width: '100%', height: 48, borderRadius: 12, overflow: 'hidden' },
  signInGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  signInText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  editButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, margin: 16, padding: 16, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  avatarContainer: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', borderWidth: 3, borderColor: '#0a0a0a' },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  profileDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  profileDetailText: { fontSize: 13, color: '#666' },

  statsContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 24, padding: 12, backgroundColor: '#1a1a1a', borderRadius: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '700', color: '#f97316', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#666' },
  statDivider: { width: 1, height: '60%', backgroundColor: 'rgba(255,255,255,0.05)', alignSelf: 'center' },

  section: { marginBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  lockInStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  lockInStatusText: { fontSize: 11, fontWeight: '700' },

  lockInActiveCard: { marginHorizontal: 16, backgroundColor: '#111', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', gap: 12 },
  
  activeConditionsTitle: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 4 },
  lockInConditionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  conditionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#1a1a1a' },
  conditionPillIcon: { fontSize: 13 },
  conditionPillLabel: { fontSize: 12, fontWeight: '600' },
  conditionDeleteButton: { marginLeft: 2, padding: 2, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  
  addMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#f97316', marginTop: 4 },
  addMoreButtonText: { fontSize: 13, color: '#f97316', fontWeight: '600' },
  
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 },
  
  lockInToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lockInToggleInfo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lockInToggleTitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 },
  lockInToggleSubtitle: { fontSize: 11, color: '#555', lineHeight: 15 },
  
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
  lockInEmptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center' },
  lockInEmptySubtitle: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18 },
  lockInEmptyExamples: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  lockInExampleTag: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  lockInExampleTagText: { fontSize: 11, color: '#f97316' },
  lockInSetupButton: { width: '100%', borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  lockInSetupGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  lockInSetupButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  addAddressBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addAddressBtnText: { fontSize: 13, color: '#f97316' },
  addressesList: { paddingHorizontal: 16, gap: 8 },
  addressCard: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, gap: 12 },
  addressIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center' },
  addressInfo: { flex: 1 },
  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  addressLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  defaultBadge: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 4 },
  defaultBadgeText: { fontSize: 9, color: '#f97316', fontWeight: '500' },
  addressText: { fontSize: 12, color: '#666', marginBottom: 2 },
  addressDetail: { fontSize: 11, color: '#666' },
  emptyAddresses: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#1a1a1a', marginHorizontal: 16, borderRadius: 12, gap: 8 },
  emptyAddressesText: { fontSize: 14, color: '#666' },
  emptyAddressesSubtext: { fontSize: 12, color: '#f97316' },

  menuSection: { paddingHorizontal: 16, marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  menuIcon: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 14, color: '#fff' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 24, padding: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, gap: 12 },
  logoutIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center', alignItems: 'center' },
  logoutText: { fontSize: 14, color: '#ef4444', fontWeight: '500' },
  bottomPadding: { height: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  modalCloseButton: { padding: 4 },
  modalBody: { padding: 16, gap: 16 },
  modalField: { gap: 6 },
  modalFieldLabel: { fontSize: 13, color: '#666', marginLeft: 4 },
  modalInput: { height: 44, backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 12, color: '#fff', fontSize: 14 },
  modalInputDisabled: { backgroundColor: '#1a1a1a', color: '#666' },
  modalButton: { height: 44, borderRadius: 8, overflow: 'hidden', marginTop: 8 },
  modalButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  lockInModal: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  lockInModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  lockInModalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backStepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  lockInModalTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  lockInModalSubtitle: { fontSize: 12, color: '#555', marginTop: 1 },
  stepProgressBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, marginBottom: 4 },
  stepSegment: { flex: 1, height: 3, borderRadius: 2 },
  lockInModalBody: { paddingHorizontal: 16 },
  stepContent: { paddingVertical: 16 },
  stepDescription: { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 20 },

  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard: { width: '47%', padding: 14, borderRadius: 14, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', alignItems: 'center', gap: 6, position: 'relative' },
  goalCardSelected: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)' },
  goalIcon: { fontSize: 26 },
  goalLabel: { fontSize: 13, fontWeight: '600', color: '#888', textAlign: 'center' },
  goalLabelSelected: { color: '#f97316' },
  goalCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' },

  conditionGroupLabel: { fontSize: 12, fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  conditionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  conditionCard: { width: '47%', padding: 12, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', gap: 4, position: 'relative' },
  conditionCardIcon: { fontSize: 22 },
  conditionCardLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  conditionCardDesc: { fontSize: 10, color: '#555', lineHeight: 14 },
  conditionCheckmark: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  durationList: { gap: 10, marginBottom: 20 },
  durationOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', gap: 12 },
  durationOptionSelected: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)' },
  durationOptionLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  durationLabel: { fontSize: 14, fontWeight: '600', color: '#888' },
  durationLabelSelected: { color: '#f97316' },
  durationDate: { fontSize: 11, color: '#555' },
  durationCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' },

  summaryCard: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, gap: 10, marginTop: 8 },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryConditions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  summaryPill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  summaryPillText: { fontSize: 12, color: '#ccc' },
  summaryExpiry: { fontSize: 12, color: '#f97316', marginTop: 2 },

  lockInModalFooter: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  nextStepBtn: { borderRadius: 14, overflow: 'hidden' },
  nextStepBtnDisabled: { opacity: 0.5 },
  nextStepGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  nextStepText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});