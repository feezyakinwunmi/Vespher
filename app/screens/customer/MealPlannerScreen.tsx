// app/screens/customer/MealPlannerScreen.tsx
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

interface NutritionSummary {
  totalCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

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

// Only used for AUTO-suggestions, NOT for manual selection
const AUTO_SUGGEST_RULES = {
  breakfast: {
    allowed: ['toast', 'bread', 'egg', 'cereal', 'oatmeal', 'pancake', 'waffle', 'yogurt', 'fruit', 'smoothie', 'akara', 'moi moi', 'pap', 'coffee', 'tea'],
    notAllowed: ['rice', 'pasta', 'noodles', 'burger', 'pizza', 'fries', 'steak', 'fried chicken', 'eba', 'fufu', 'pounded yam']
  },
  lunch: {
    allowed: ['rice', 'jollof', 'fried rice', 'beans', 'pasta', 'noodles', 'burger', 'shawarma', 'salad', 'soup', 'stew', 'protein'],
    notAllowed: ['cereal', 'pancake', 'oatmeal', 'donut', 'pastry']
  },
  dinner: {
    allowed: ['steak', 'grill', 'seafood', 'fish', 'pepper soup', 'pizza', 'pasta', 'soup', 'swallow', 'rice'],
    notAllowed: ['cereal', 'pancake', 'heavy fried foods']
  },
  snack: {
    allowed: ['fries', 'chips', 'samosa', 'spring roll', 'puff puff', 'cake', 'ice cream', 'fruit', 'smoothie', 'drink'],
    notAllowed: []
  }
};

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
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary>({
    totalCalories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });

  // Get all products
  const allProducts = vendors.flatMap(vendor =>
    (vendor.products || []).map(product => ({
      ...product,
      vendorName: vendor.name,
      vendorId: vendor.id,
    }))
  );

  // Calculate nutrition for the entire week
  const calculateWeeklyNutrition = (plan: WeeklyMealPlan): NutritionSummary => {
    let totalCalories = 0;
    let protein = 0, carbs = 0, fat = 0, fiber = 0;
    let mealCount = 0;
    
    for (const day of DAYS) {
      const dayPlan = plan[day.id];
      for (const meal of MEAL_COLUMNS) {
        const product = dayPlan[meal.id];
        if (product) {
          const estimatedCalories = Math.min(800, Math.max(200, product.price * 0.3));
          totalCalories += estimatedCalories;
          mealCount++;
          
          const name = product.name.toLowerCase();
          if (name.includes('chicken') || name.includes('fish') || name.includes('meat') || name.includes('egg') || name.includes('beef')) {
            protein += 15;
          }
          if (name.includes('rice') || name.includes('bread') || name.includes('pasta') || name.includes('yam') || name.includes('noodles')) {
            carbs += 25;
          }
          if (name.includes('fried') || name.includes('cheese') || name.includes('butter') || name.includes('oil') || name.includes('cream')) {
            fat += 12;
          }
          if (name.includes('vegetable') || name.includes('salad') || name.includes('fruit') || name.includes('green')) {
            fiber += 8;
          }
        }
      }
    }
    
    const daysWithMeals = Math.max(1, mealCount / 4);
    const avgCalories = Math.round(totalCalories / daysWithMeals);
    
    const totalMacros = protein + carbs + fat + fiber;
    if (totalMacros > 0) {
      return {
        totalCalories: avgCalories,
        protein: Math.round((protein / totalMacros) * 100),
        carbs: Math.round((carbs / totalMacros) * 100),
        fat: Math.round((fat / totalMacros) * 100),
        fiber: Math.round((fiber / totalMacros) * 100),
      };
    }
    
    return { totalCalories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  };

  useEffect(() => {
    if (weeklyPlan) {
      const nutrition = calculateWeeklyNutrition(weeklyPlan);
      setNutritionSummary(nutrition);
    }
  }, [weeklyPlan]);

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





  const hasHealthWarning = (productName: string, productDescription: string): boolean => {
    if (!userHealthProfile.isLocked || userHealthProfile.conditions.length === 0) {
      return false;
    }
    
    const searchText = `${productName} ${productDescription}`.toLowerCase();
    
    for (const conditionId of userHealthProfile.conditions) {
      const conditionMeta = HEALTH_CONDITIONS.find(c => c.id === conditionId);
      if (conditionMeta) {
        for (const tag of conditionMeta.avoidTags) {
          if (searchText.includes(tag.toLowerCase())) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // For AUTO-suggest only - filter by meal time rules
  const filterForAutoSuggest = (products: any[], mealTime: MealTime): any[] => {
    const rules = AUTO_SUGGEST_RULES[mealTime];
    if (!rules) return products;
    
    return products.filter(product => {
      const productName = product.name.toLowerCase();
      const isAllowed = rules.allowed.some(term => productName.includes(term));
      const isNotAllowed = rules.notAllowed.some(term => productName.includes(term));
      return isAllowed && !isNotAllowed;
    });
  };

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

  // Get random product from list (for variety in auto-suggest)
  const getRandomProduct = (products: any[], usedProductIds: Set<string> = new Set()): any | null => {
    if (products.length === 0) return null;
    
    let available = products;
    if (usedProductIds.size > 0 && products.length > usedProductIds.size) {
      available = products.filter(p => !usedProductIds.has(p.id));
    }
    
    if (available.length === 0) return products[0];
    
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
  };

  // Auto-suggest meals for the entire week with VARIETY
  const autoSuggestWeek = async () => {
    if (!weeklyPlan) return;
    
    setIsResuggesting(true);
    
    try {
      const newPlan = { ...weeklyPlan };
      const usedProductsPerMealType: Record<string, Set<string>> = {
        breakfast: new Set(),
        lunch: new Set(),
        dinner: new Set(),
        snack: new Set(),
      };
      
      // Get suitable products for auto-suggest (filtered by meal appropriateness)
      const suitableProductsByMeal: Record<MealTime, any[]> = {
        breakfast: filterForAutoSuggest(allProducts, 'breakfast'),
        lunch: filterForAutoSuggest(allProducts, 'lunch'),
        dinner: filterForAutoSuggest(allProducts, 'dinner'),
        snack: filterForAutoSuggest(allProducts, 'snack'),
      };
      
      const shuffledVendors = [...vendors].sort(() => Math.random() - 0.5);
      
      for (const day of DAYS) {
        for (const mealTime of MEAL_COLUMNS) {
          let suitable = [...suitableProductsByMeal[mealTime.id]];
          
          let bestProduct = null;
          
          for (const vendor of shuffledVendors) {
            const vendorProducts = suitable.filter(p => p.vendorId === vendor.id);
            if (vendorProducts.length > 0) {
              const available = vendorProducts.filter(p => !usedProductsPerMealType[mealTime.id].has(p.id));
              if (available.length > 0) {
                bestProduct = getRandomProduct(available, usedProductsPerMealType[mealTime.id]);
                if (bestProduct) break;
              }
            }
          }
          
          if (!bestProduct) {
            bestProduct = getRandomProduct(suitable, usedProductsPerMealType[mealTime.id]);
          }
          
          if (bestProduct) {
            newPlan[day.id][mealTime.id] = bestProduct;
            usedProductsPerMealType[mealTime.id].add(bestProduct.id);
          } else {
            newPlan[day.id][mealTime.id] = null;
          }
        }
      }
      
      setWeeklyPlan(newPlan);
      
      Toast.show({
        type: 'success',
        text1: 'Weekly meal plan suggested!',
        text2: 'Based on your health preferences',
        position: 'bottom',
        visibilityTime: 3000,
      });
      
    } catch (error) {
      console.error('Auto-suggest error:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to suggest meals',
        position: 'bottom',
        visibilityTime: 2000,
      });
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
    
    if (hasHealthWarning(product.name, product.description || '')) {
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

      {/* Nutrition Summary */}
      <LinearGradient
        colors={['rgba(249,115,22,0.15)', 'rgba(16,185,129,0.05)']}
        style={styles.nutritionCard}
      >
        <Text style={styles.nutritionTitle}>Daily Nutrition Goal</Text>
        <Text style={styles.caloriesText}>{nutritionSummary.totalCalories} / 2000 kcal</Text>
        
        <View style={styles.macroContainer}>
          <View style={styles.macroItem}>
            <View style={[styles.macroBar, { width: `${nutritionSummary.protein}%`, backgroundColor: '#f97316' }]} />
            <Text style={styles.macroLabel}>Protein {nutritionSummary.protein}%</Text>
          </View>
          <View style={styles.macroItem}>
            <View style={[styles.macroBar, { width: `${nutritionSummary.carbs}%`, backgroundColor: '#10b981' }]} />
            <Text style={styles.macroLabel}>Carbs {nutritionSummary.carbs}%</Text>
          </View>
          <View style={styles.macroItem}>
            <View style={[styles.macroBar, { width: `${nutritionSummary.fat}%`, backgroundColor: '#f59e0b' }]} />
            <Text style={styles.macroLabel}>Fat {nutritionSummary.fat}%</Text>
          </View>
          <View style={styles.macroItem}>
            <View style={[styles.macroBar, { width: `${nutritionSummary.fiber}%`, backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.macroLabel}>Fiber {nutritionSummary.fiber}%</Text>
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
            <Text style={styles.tableHeaderText}>{meal.label}</Text>
          </View>
        ))}
      </View>

      {/* Table Body */}
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {DAYS.map(day => {
          const dayPlan = weeklyPlan[day.id];
          
          return (
            <View key={day.id} style={styles.tableRow}>
              <View style={styles.dayColumn}>
                <Text style={styles.dayText}>{day.short}</Text>
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
                          source={{ uri: product.image || 'https://via.placeholder.com/50' }} 
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
                        {hasHealthWarning(product.name, product.description || '') && (
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
                    source={{ uri: item.image || 'https://via.placeholder.com/50' }} 
                    style={styles.productImage}
                  />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productVendor}>{item.vendorName}</Text>
                    <Text style={styles.productPrice}>₦{item.price.toLocaleString()}</Text>
                    {hasHealthWarning(item.name, item.description || '') && (
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