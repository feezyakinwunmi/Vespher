// app/screens/customer/MealPlannerScreen.tsx
import { imageSource } from '../../utils/images';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useVendors } from '../../hooks/customer/useVendors';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';
import { HealthCondition, HEALTH_CONDITIONS } from '../../contexts/HealthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { assessFood } from '../../services/foodSafety';
import { planWeek } from '../../services/recommendations';
import { getCurrentMealTime } from '../../hooks/customer/useAIFoodSuggestions';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface WeeklyMealPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  monday: { breakfast: any | null; lunch: any | null; dinner: any | null; snack: any | null };
  tuesday: { breakfast: any | null; lunch: any | null; dinner: any | null; snack: any | null };
  wednesday: { breakfast: any | null; lunch: any | null; dinner: any | null; snack: any | null };
  thursday: { breakfast: any | null; lunch: any | null; dinner: any | null; snack: any | null };
  friday: { breakfast: any | null; lunch: any | null; dinner: any | null; snack: any | null };
  saturday: { breakfast: any | null; lunch: any | null; dinner: any | null; snack: any | null };
  sunday: { breakfast: any | null; lunch: any | null; dinner: any | null; snack: any | null };
  created_at?: string;
  updated_at?: string;
}

interface PlanSummary {
  planned: number;
  fitsProfile: number;
  needsAttention: number;
  vendors: number;
}

// JS getDay(): 0 = Sunday
const TODAY_ID: DayOfWeek = (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as DayOfWeek[])[new Date().getDay()];

const DAYS: { id: DayOfWeek; label: string; short: string }[] = [
  { id: 'monday', label: 'Monday', short: 'Mon' },
  { id: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { id: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { id: 'thursday', label: 'Thursday', short: 'Thu' },
  { id: 'friday', label: 'Friday', short: 'Fri' },
  { id: 'saturday', label: 'Saturday', short: 'Sat' },
  { id: 'sunday', label: 'Sunday', short: 'Sun' },
];

const MEAL_COLUMNS: { id: MealTime; label: string; icon: string; color: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: '☀️', color: '#f59e0b' },
  { id: 'lunch', label: 'Lunch', icon: '🍽️', color: '#f97316' },
  { id: 'dinner', label: 'Dinner', icon: '🌙', color: '#8b5cf6' },
  { id: 'snack', label: 'Snack', icon: '🍿', color: '#10b981' },
];

const DEFAULT_WEEKLY_PLAN = (userId: string): WeeklyMealPlan => ({
  id: '',
  user_id: userId,
  week_start_date: new Date().toISOString().split('T')[0],
  monday: { breakfast: null, lunch: null, dinner: null, snack: null },
  tuesday: { breakfast: null, lunch: null, dinner: null, snack: null },
  wednesday: { breakfast: null, lunch: null, dinner: null, snack: null },
  thursday: { breakfast: null, lunch: null, dinner: null, snack: null },
  friday: { breakfast: null, lunch: null, dinner: null, snack: null },
  saturday: { breakfast: null, lunch: null, dinner: null, snack: null },
  sunday: { breakfast: null, lunch: null, dinner: null, snack: null },
});

export function MealPlannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { vendors, isLoading: vendorsLoading } = useVendors();
  
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResuggesting, setIsResuggesting] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);
  const [selectedMealTime, setSelectedMealTime] = useState<MealTime | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [userHealthProfile, setUserHealthProfile] = useState<{ conditions: HealthCondition[]; isLocked: boolean }>({
    conditions: [],
    isLocked: false,
  });
  const { isPro, isLoading: subscriptionLoading } = useSubscription();
  const [planSummary, setPlanSummary] = useState<PlanSummary>({ planned: 0, fitsProfile: 0, needsAttention: 0, vendors: 0 });
  const currentMealTime = getCurrentMealTime();

  // Get all products
  const allProducts = vendors.flatMap(vendor =>
    (vendor.products || []).map(product => ({
      ...product,
      vendorName: vendor.name,
      vendorId: vendor.id,
    }))
  );

  // Plan check: what we can state truthfully from the dishes and the user's profile.
  useEffect(() => {
    if (!weeklyPlan) return;
    let planned = 0;
    let needsAttention = 0;
    const vendorIds = new Set<string>();
    for (const day of DAYS) {
      for (const meal of MEAL_COLUMNS) {
        const product = weeklyPlan[day.id][meal.id];
        if (!product) continue;
        planned++;
        if (product.vendorId) vendorIds.add(product.vendorId);
        if (hasHealthWarning(product)) needsAttention++;
      }
    }
    setPlanSummary({ planned, fitsProfile: planned - needsAttention, needsAttention, vendors: vendorIds.size });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyPlan, userHealthProfile.conditions.join(',')]);

  const fetchHealthProfile = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('customer_health_profiles')
      .select('conditions, is_locked')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!error && data) {
      setUserHealthProfile({
        conditions: data.conditions || [],
        isLocked: data.is_locked || false,
      });
    }
  };

const loadSavedPlan = async () => {
  if (!user?.id) return;
  
  setIsLoading(true);
  
  console.log('🔍 Loading saved plan for user:', user.id);
  
  const { data, error } = await supabase
    .from('weekly_meal_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('❌ Load error:', error);
  }
  
  if (!error && data) {
    console.log('✅ Loaded existing plan:', data.id);
    setWeeklyPlan(data);
  } else {
    console.log('📝 Creating default plan');
    const defaultPlan = DEFAULT_WEEKLY_PLAN(user.id);
    setWeeklyPlan(defaultPlan);
  }
  
  setIsLoading(false);
};

 const savePlan = async () => {
  if (!user?.id || !weeklyPlan) return;
  
  setIsSaving(true);
  
  try {
    // First, check if a plan already exists for this user
    const { data: existingPlan, error: fetchError } = await supabase
      .from('weekly_meal_plans')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    let error;
    
    if (existingPlan) {
      // Update existing plan
      const { error: updateError } = await supabase
        .from('weekly_meal_plans')
        .update({
          monday: weeklyPlan.monday,
          tuesday: weeklyPlan.tuesday,
          wednesday: weeklyPlan.wednesday,
          thursday: weeklyPlan.thursday,
          friday: weeklyPlan.friday,
          saturday: weeklyPlan.saturday,
          sunday: weeklyPlan.sunday,
          week_start_date: weeklyPlan.week_start_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPlan.id);
      
      error = updateError;
    } else {
      // Insert new plan
      const { error: insertError } = await supabase
        .from('weekly_meal_plans')
        .insert({
          user_id: user.id,
          week_start_date: weeklyPlan.week_start_date,
          monday: weeklyPlan.monday,
          tuesday: weeklyPlan.tuesday,
          wednesday: weeklyPlan.wednesday,
          thursday: weeklyPlan.thursday,
          friday: weeklyPlan.friday,
          saturday: weeklyPlan.saturday,
          sunday: weeklyPlan.sunday,
        });
      
      error = insertError;
    }
    
    if (error) {
      console.error('Save error:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to save plan',
        text2: error.message,
        position: 'bottom',
        visibilityTime: 3000,
      });
    } else {
      Toast.show({
        type: 'success',
        text1: 'Meal plan saved!',
        position: 'bottom',
        visibilityTime: 2000,
      });
    }
  } catch (err) {
    console.error('Save error:', err);
    Toast.show({
      type: 'error',
      text1: 'Failed to save plan',
      position: 'bottom',
      visibilityTime: 2000,
    });
  } finally {
    setIsSaving(false);
  }
};





  const hasHealthWarning = (product: any): boolean =>
    userHealthProfile.conditions.length > 0 && !!assessFood(product, userHealthProfile.conditions);

  // FOR MANUAL SELECTION - show ALL products (no restrictions)
  const getAllProductsForManual = (search: string = ''): any[] => {
    let filtered = [...allProducts];
    
    // Only filter by health conditions for manual selection (just warn, don't hide)
    // We still show them but with warning badge
    
    if (search) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    return filtered.slice(0, 30);
  };

  // Auto-plan the week: right dishes for each meal time, safe for the user's
  // conditions, no repeats in the week and different vendors within a day.
  const autoSuggestWeek = async () => {
    if (!weeklyPlan) return;
    setIsResuggesting(true);
    try {
      const plan = planWeek(allProducts, DAYS.map(d => d.id), userHealthProfile.conditions);
      const newPlan = { ...weeklyPlan };
      for (const day of DAYS) {
        newPlan[day.id] = {
          breakfast: plan[day.id].breakfast?.product ?? null,
          lunch: plan[day.id].lunch?.product ?? null,
          dinner: plan[day.id].dinner?.product ?? null,
          snack: plan[day.id].snack?.product ?? null,
        };
      }
      setWeeklyPlan(newPlan);
      Toast.show({
        type: 'success',
        text1: 'Your week is planned',
        text2: userHealthProfile.conditions.length ? 'Matched to your health profile' : 'Set your health profile for personalised picks',
        position: 'bottom',
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error('Auto-suggest error:', error);
      Toast.show({ type: 'error', text1: 'Failed to suggest meals', position: 'bottom', visibilityTime: 2000 });
    } finally {
      setIsResuggesting(false);
    }
  };

  const openProductPicker = (day: DayOfWeek, mealTime: MealTime) => {
    setSelectedDay(day);
    setSelectedMealTime(mealTime);
    setSearchQuery('');
    setShowProductPicker(true);
  };

  const selectProduct = (product: any) => {
    if (!selectedDay || !selectedMealTime || !weeklyPlan) return;
    
    if (hasHealthWarning(product)) {
      Alert.alert(
        'Health Warning',
        `This item may not be suitable for your health conditions. Are you sure you want to add it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add Anyway', 
            onPress: () => addProductToSlot(product),
            style: 'destructive'
          }
        ]
      );
    } else {
      addProductToSlot(product);
    }
  };
  
  const addProductToSlot = (product: any) => {
    if (!selectedDay || !selectedMealTime || !weeklyPlan) return;
    
    const newPlan = { ...weeklyPlan };
    newPlan[selectedDay][selectedMealTime] = product;
    setWeeklyPlan(newPlan);
    
    setShowProductPicker(false);
    setSelectedDay(null);
    setSelectedMealTime(null);
    
    Toast.show({
      type: 'success',
      text1: `${product.name} added`,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  const removeMeal = (day: DayOfWeek, mealTime: MealTime) => {
    if (!weeklyPlan) return;
    
    Alert.alert(
      'Remove Meal',
      `Remove this meal from your plan?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const newPlan = { ...weeklyPlan };
            newPlan[day][mealTime] = null;
            setWeeklyPlan(newPlan);
          },
        },
      ]
    );
  };

  const addToCart = (product: any, day: string, mealTime: string) => {
    addItem(product, 1);
    Toast.show({
      type: 'success',
      text1: `${product.name} added to cart`,
      text2: `${day} ${mealTime}`,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  // FOR MANUAL PICKER - show ALL products (no meal time restrictions)
  useEffect(() => {
    if (showProductPicker) {
      const allAvailable = getAllProductsForManual(searchQuery);
      setFilteredProducts(allAvailable);
    }
  }, [showProductPicker, searchQuery, allProducts]);

  useEffect(() => {
    fetchHealthProfile();
    loadSavedPlan();
  }, [user?.id]);

  if (!subscriptionLoading && !isPro) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Weekly Meal Planner</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.gate}>
          <View style={styles.gateIcon}>
            <Feather name="calendar" size={32} color="#f97316" />
          </View>
          <Text style={styles.gateTitle}>Your week, planned around you</Text>
          <Text style={styles.gateText}>
            Vesphe Pro builds a full weekly timetable – the right dishes for breakfast, lunch, dinner and snacks, matched to your health profile, with variety across vendors.
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Pro')} style={styles.gateButton}>
            <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gateButtonGradient}>
              <Feather name="award" size={18} color="#fff" />
              <Text style={styles.gateButtonText}>Unlock with Vesphe Pro</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (vendorsLoading || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading meal planner...</Text>
      </View>
    );
  }

  if (!weeklyPlan) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Meal Planner</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={autoSuggestWeek} style={styles.autoButton} disabled={isResuggesting}>
            {isResuggesting ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <Feather name="refresh-cw" size={20} color="#f97316" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={savePlan} style={styles.saveButton} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#10b981" />
            ) : (
              <Feather name="save" size={20} color="#10b981" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Plan check */}
      <LinearGradient
        colors={['rgba(249,115,22,0.15)', 'rgba(16,185,129,0.05)']}
        style={styles.nutritionCard}
      >
        <Text style={styles.nutritionTitle}>This week's plan</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{planSummary.planned}/28</Text>
            <Text style={styles.summaryLabel}>Meals planned</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>{planSummary.fitsProfile}</Text>
            <Text style={styles.summaryLabel}>Fit your profile</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: planSummary.needsAttention ? '#f59e0b' : '#fff' }]}>{planSummary.needsAttention}</Text>
            <Text style={styles.summaryLabel}>Need attention</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{planSummary.vendors}</Text>
            <Text style={styles.summaryLabel}>Vendors</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Health Info Banner */}
      <View style={styles.healthBanner}>
        <View style={styles.healthBannerContent}>
          <Feather name="heart" size={14} color="#f97316" />
          <Text style={styles.healthBannerText}>
            Suggestions aligned with your health profile
          </Text>
        </View>
        {userHealthProfile.conditions.length > 0 && (
          <View style={styles.healthConditionsRow}>
            {userHealthProfile.conditions.slice(0, 3).map(cond => {
              const meta = HEALTH_CONDITIONS.find(c => c.id === cond);
              return meta ? (
                <View key={cond} style={[styles.healthChip, { backgroundColor: `${meta.color}20` }]}>
                  <Text style={[styles.healthChipText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              ) : null;
            })}
            {userHealthProfile.conditions.length > 3 && (
              <Text style={styles.healthMore}>+{userHealthProfile.conditions.length - 3} more</Text>
            )}
          </View>
        )}
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <View style={styles.dayColumnHeader}>
          <Text style={styles.tableHeaderText}>Day</Text>
        </View>
        {MEAL_COLUMNS.map(meal => (
          <View key={meal.id} style={styles.mealColumnHeader}>
            <Text style={styles.mealIcon}>{meal.icon}</Text>
            <Text style={[styles.tableHeaderText, meal.id === currentMealTime && { color: meal.color }]}>{meal.label}</Text>
            {meal.id === currentMealTime && <Text style={[styles.nowLabel, { color: meal.color }]}>Now</Text>}
          </View>
        ))}
      </View>

      {/* Table Body */}
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {DAYS.map(day => {
          const dayPlan = weeklyPlan[day.id];
          
          return (
            <View key={day.id} style={[styles.tableRow, day.id === TODAY_ID && styles.todayRow]}>
              <View style={styles.dayColumn}>
                <Text style={[styles.dayText, day.id === TODAY_ID && { color: '#f97316' }]}>{day.id === TODAY_ID ? 'Today' : day.short}</Text>
                <Text style={styles.dayFull}>{day.label}</Text>
              </View>
              
              {MEAL_COLUMNS.map(meal => {
                const product = dayPlan[meal.id];
                const hasProduct = product !== null;
                
                return (
                  <TouchableOpacity
                    key={meal.id}
                    style={[styles.mealCell, hasProduct && styles.mealCellFilled]}
                    onPress={() => openProductPicker(day.id, meal.id)}
                    activeOpacity={0.7}
                  >
                    {hasProduct && product ? (
                      <View style={styles.mealCellContent}>
                        <Image 
                          source={imageSource(product.image)} 
                          style={styles.mealCellImage}
                        />
                        <Text style={styles.mealCellName} numberOfLines={2}>
                          {product.name}
                        </Text>
                        <Text style={styles.mealCellPrice}>₦{product.price.toLocaleString()}</Text>
                        <View style={styles.mealCellActions}>
                          <TouchableOpacity
                            onPress={() => addToCart(product, day.label, meal.label)}
                            style={styles.cartIcon}
                          >
                            <Feather name="shopping-bag" size={12} color="#f97316" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => removeMeal(day.id, meal.id)}
                            style={styles.removeIcon}
                          >
                            <Feather name="x" size={12} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                        {hasHealthWarning(product) && (
                          <View style={styles.warningDot} />
                        )}
                      </View>
                    ) : (
                      <View style={styles.emptyCell}>
                        <Feather name="plus-circle" size={20} color={meal.color} />
                        <Text style={[styles.emptyCellText, { color: meal.color }]}>Add</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Product Picker Modal - Shows ALL products (no restrictions) */}
      <Modal
        visible={showProductPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select for {selectedMealTime} - {selectedDay}
              </Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search all products..."
                placeholderTextColor="#666"
              />
            </View>
            
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productItem}
                  onPress={() => selectProduct(item)}
                >
                  <Image 
                    source={imageSource(item.image)} 
                    style={styles.productImage}
                  />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productVendor}>{item.vendorName}</Text>
                    <Text style={styles.productPrice}>₦{item.price.toLocaleString()}</Text>
                    {hasHealthWarning(item) && (
                      <View style={styles.warningBadge}>
                        <Feather name="alert-triangle" size={10} color="#f59e0b" />
                        <Text style={styles.warningText}>May not suit your health</Text>
                      </View>
                    )}
                  </View>
                  <Feather name="plus" size={20} color="#f97316" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyPicker}>
                  <Text style={styles.emptyPickerText}>No products found</Text>
                  <Text style={styles.emptyPickerSubtext}>Try a different search</Text>
                </View>
              }
              contentContainerStyle={styles.productList}
            />
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
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
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  autoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  nutritionCard: {
    margin: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
  },
  nutritionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  caloriesText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 8,
  },
  macroContainer: {
    gap: 6,
  },
  macroItem: {
    height: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    overflow: 'hidden',
  },
  macroBar: {
    height: '100%',
    borderRadius: 10,
  },
  macroLabel: {
    position: 'absolute',
    left: 8,
    top: 3,
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#999',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  todayRow: {
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderLeftWidth: 2,
    borderLeftColor: '#f97316',
  },
  nowLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  gateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(249,115,22,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gateTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  gateText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  gateButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  gateButtonGradient: {
    height: 50,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  healthBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.15)',
  },
  healthBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthBannerText: {
    fontSize: 11,
    color: '#888',
    flex: 1,
  },
  healthConditionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  healthChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  healthChipText: {
    fontSize: 9,
    fontWeight: '500',
  },
  healthMore: {
    fontSize: 9,
    color: '#666',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dayColumnHeader: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealColumnHeader: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tableHeaderText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '500',
  },
  mealIcon: {
    fontSize: 14,
  },
  tableBody: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: 100,
  },
  dayColumn: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  dayFull: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  mealCell: {
    flex: 1,
    padding: 5,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.05)',
    minHeight: 100,
  },
  mealCellFilled: {
    backgroundColor: 'rgba(249,115,22,0.05)',
  },
  mealCellContent: {
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  mealCellImage: {
    width: 35,
    height: 35,
    borderRadius: 6,
  },
  mealCellName: {
    fontSize: 8,
    color: '#fff',
    textAlign: 'center',
  },
  mealCellPrice: {
    fontSize: 8,
    color: '#f97316',
    fontWeight: '600',
  },
  mealCellActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  cartIcon: {
    padding: 2,
  },
  removeIcon: {
    padding: 2,
  },
  warningDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  emptyCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 90,
  },
  emptyCellText: {
    fontSize: 9,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    margin: 16,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 14,
  },
  productList: {
    padding: 16,
    gap: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  productVendor: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f97316',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  warningText: {
    fontSize: 9,
    color: '#f59e0b',
  },
  emptyPicker: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyPickerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyPickerSubtext: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
  },
});