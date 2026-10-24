// app/screens/customer/ExploreScreen.tsx
import { imageSource } from '../../utils/images';
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { useVendors } from '../../hooks/customer/useVendors';
import { useCategories } from '../../hooks/customer/useCategories';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { HealthWarningModal } from '../../components/customer/HealthWarningModal';
import { ProductDetailsModal } from '../../components/customer/ProductDetailsModal';
import { HealthCheckResult } from '../../hooks/customer/useHealthCheck';
import { supabase } from '../../lib/supabase';
import { HEALTH_CONDITIONS, HealthCondition } from '../../contexts/HealthContext';
import { RootStackParamList, CustomerTabParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';
import { useLocation } from '../../contexts/LocationContext';
import { calculateDistance } from '../../services/locationService';

type ExploreScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ExploreScreenRouteProp = RouteProp<CustomerTabParamList, 'Explore'>;

interface FilterState {
  categories: string[];
  vendors: string[];
  priceRange: {
    min: number;
    max: number;
  };
  sortBy: 'popular' | 'price_low' | 'price_high' | 'newest';
}

interface PendingCartAction {
  product: any;
  quantity: number;
}

type SuggestionTab = 'all' | 'workout' | 'weight_loss' | 'diabetic' | 'heart_healthy' | 'low_sugar';
type MealTimeTab = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Health focused tabs (existing)
const SUGGESTION_TABS: { id: SuggestionTab; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All', icon: 'grid', color: '#f97316' },
  { id: 'workout', label: '💪 Workout', icon:'activity', color: '#f97316' },
  { id: 'weight_loss', label: '⚖️ Weight Loss', icon: 'trending-down', color: '#10b981' },
  { id: 'diabetic', label: '🩺 Diabetic', icon: 'activity', color: '#3b82f6' },
  { id: 'heart_healthy', label: '❤️ Heart', icon: 'heart', color: '#ef4444' },
  { id: 'low_sugar', label: '🍬 Low Sugar', icon: 'coffee', color: '#f59e0b' },
];

// NEW: Meal Time tabs (for time-based filtering)
const MEAL_TIME_TABS: { id: MealTimeTab; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All', icon: 'grid', color: '#f97316' },
  { id: 'breakfast', label: 'Breakfast', icon: 'sun', color: '#f59e0b' },
  { id: 'lunch', label: 'Lunch', icon: 'sun', color: '#f97316' },
  { id: 'dinner', label: 'Dinner', icon: 'moon', color: '#8b5cf6' },
  { id: 'snack', label: 'Snack', icon: 'coffee', color: '#10b981' },
];

// Meal time food rules for filtering
const MEAL_TIME_FOOD_RULES = {
  breakfast: ['toast', 'bread', 'egg', 'cereal', 'oatmeal', 'pancake', 'waffle', 'yogurt', 'fruit', 'smoothie', 'akara', 'moi moi', 'pap', 'coffee', 'tea'],
  lunch: ['rice', 'jollof', 'fried rice', 'beans', 'pasta', 'noodles', 'burger', 'shawarma', 'salad', 'soup', 'stew', 'protein'],
  dinner: ['steak', 'grill', 'seafood', 'fish', 'pepper soup', 'pizza', 'pasta', 'soup', 'swallow', 'rice'],
  snack: ['fries', 'chips', 'samosa', 'spring roll', 'puff puff', 'cake', 'ice cream', 'fruit', 'smoothie', 'drink']
};

// SPECIFIC FOODS FOR EACH TAB - MANUALLY CURATED
const TAB_FOODS = {
  workout: [
    'grilled chicken', 'chicken breast', 'fried chicken', 'roast chicken', 'baked chicken',
    'grilled fish', 'baked fish', 'tilapia', 'croaker', 'catfish grill',
    'egg', 'boiled egg', 'scrambled egg', 'omelette',
    'brown rice', 'ofada rice', 'basmati rice',
    'yam', 'boiled yam', 'roasted yam',
    'protein shake', 'smoothie', 'fruit smoothie',
    'salad', 'garden salad', 'chicken salad', 'tuna salad',
    'steak', 'grilled steak', 'beef steak',
    'turkey', 'grilled turkey',
    'quinoa', 'oatmeal', 'porridge',
    'beans', 'ewa', 'brown beans',
    'plantain', 'roasted plantain', 'baked plantain',
    'vegetable soup', 'efo riro',
    'moin moin', 'moi moi'
  ],
  weight_loss: [
    'salad', 'garden salad', 'caesar salad', 'chicken salad',
    'grilled chicken', 'grilled fish', 'grilled tilapia',
    'steamed vegetables', 'mixed vegetables', 'broccoli', 'carrots',
    'vegetable soup', 'clear soup', 'broth',
    'brown rice', 'ofada rice',
    'fish', 'baked fish', 'steamed fish',
    'egg white', 'omelette',
    'smoothie bowl', 'fruit bowl',
    'water', 'infused water',
    'green tea', 'herbal tea',
    'zobo (unsweetened)', 'kunu (unsweetened)',
    'moi moi', 'steamed bean pudding'
  ],
  diabetic: [
    'brown rice', 'ofada rice', 'basmati rice',
    'whole wheat bread', 'multigrain bread', 'oat bread',
    'oatmeal', 'rolled oats', 'steel cut oats',
    'beans', 'brown beans', 'black beans', 'kidney beans',
    'lentils', 'brown lentils', 'green lentils',
    'vegetables', 'spinach', 'kale', 'broccoli', 'cauliflower',
    'fish', 'grilled fish', 'baked fish', 'salmon', 'mackerel',
    'chicken breast', 'turkey breast',
    'bitter leaf soup', 'ofe onugbu',
    'vegetable soup', 'efo riro (light oil)',
    'moin moin', 'steamed moin moin',
    'ugwu', 'pumpkin leaves',
    'water', 'unsweetened tea'
  ],
  heart_healthy: [
    'fish', 'salmon', 'mackerel', 'sardines', 'tilapia', 'croaker',
    'grilled fish', 'baked fish', 'steamed fish',
    'avocado', 'avocado salad', 'avocado toast',
    'olive oil', 'vegetable oil (small amount)',
    'nuts', 'walnuts', 'almonds', 'cashews (unsalted)',
    'seeds', 'chia seeds', 'flax seeds', 'pumpkin seeds',
    'oatmeal', 'rolled oats',
    'brown rice', 'ofada rice',
    'leafy greens', 'spinach', 'kale', 'ugwu', 'efo',
    'beans', 'black beans', 'kidney beans',
    'tomatoes', 'fresh tomatoes',
    'garlic', 'ginger',
    'green tea', 'hibiscus tea', 'zobo (unsweetened)'
  ],
  low_sugar: [
    'water', 'plain water',
    'unsweetened tea', 'green tea', 'black tea', 'herbal tea',
    'black coffee', 'espresso', 'american coffee',
    'zobo (unsweetened)', 'kunu (unsweetened)',
    'vegetables', 'all fresh vegetables',
    'meat', 'grilled chicken', 'roast beef', 'steak',
    'fish', 'grilled fish', 'baked fish',
    'eggs', 'boiled eggs', 'scrambled eggs',
    'cheese', 'hard cheese',
    'nuts', 'unsalted nuts', 'almonds', 'walnuts',
    'seeds', 'pumpkin seeds', 'sunflower seeds',
    'salad', 'garden salad', 'chicken salad (no sugar dressing)',
    'moi moi (unsweetened)', 'steamed moi moi'
  ]
};

// FOODS TO NEVER SHOW IN EACH TAB
const EXCLUDED_FOODS = {
  workout: ['eba', 'fufu', 'amala', 'semo', 'pounded yam', 'egusi', 'ogbono', 'puff puff', 'buns', 'cake', 'ice cream', 'soda', 'coke', 'fanta', 'sprite', 'milkshake', 'donut', 'chocolate', 'candy'],
  weight_loss: ['fried rice', 'jollof rice', 'eba', 'fufu', 'amala', 'pounded yam', 'egusi', 'ogbono', 'puff puff', 'buns', 'cake', 'ice cream', 'soda', 'fried chicken', 'fried fish', 'chips', 'fries'],
  diabetic: ['sugar', 'coke', 'fanta', 'sprite', 'milo', 'bobo', 'chivita', 'sweet juice', 'cake', 'ice cream', 'candy', 'chocolate', 'honey', 'syrup', 'sweetened yogurt', 'milkshake'],
  heart_healthy: ['fried food', 'fried chicken', 'fried fish', 'butter', 'margarine', 'palm oil (excessive)', 'coconut oil (excessive)', 'fatty meat', 'processed meat', 'sausage', 'bacon'],
  low_sugar: ['sugar', 'coke', 'fanta', 'sprite', 'milo', 'sweet juice', 'cake', 'ice cream', 'candy', 'chocolate', 'honey', 'syrup', 'sweetened yogurt', 'milkshake', 'sweetened zobo', 'sweetened kunu']
};

export function ExploreScreen() {
  const navigation = useNavigation<ExploreScreenNavigationProp>();
  const route = useRoute<ExploreScreenRouteProp>();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { vendors, isLoading: vendorsLoading, refresh: refreshVendors } = useVendors();
  const { categories, isLoading: categoriesLoading } = useCategories();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSuggestionTab, setSelectedSuggestionTab] = useState<SuggestionTab>('all');
  const [selectedMealTimeTab, setSelectedMealTimeTab] = useState<MealTimeTab>('all');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  
  // Health warning modal state
  const [healthModalVisible, setHealthModalVisible] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);
  const [pendingCartAction, setPendingCartAction] = useState<PendingCartAction | null>(null);
  const [pendingProductName, setPendingProductName] = useState('');
  const [detailsProduct, setDetailsProduct] = useState<any>(null);
  const [deliveryFees, setDeliveryFees] = useState<Record<string, number>>({});
  const [isLoadingFees, setIsLoadingFees] = useState(false);
  const { userLocation, calculateDeliveryToVendor } = useLocation();

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    vendors: [],
    priceRange: { min: 0, max: 1000000000 },
    sortBy: 'popular',
  });

  const [tempFilters, setTempFilters] = useState<FilterState>(filters);

  // Handle route param for meal time filter
  useEffect(() => {
    const mealTimeFilter = route.params?.mealTimeFilter;
    if (mealTimeFilter && ['breakfast', 'lunch', 'dinner', 'snack'].includes(mealTimeFilter)) {
      setSelectedMealTimeTab(mealTimeFilter as MealTimeTab);
      setSelectedSuggestionTab('all'); // Reset health tab when selecting meal time
    }
  }, [route.params?.mealTimeFilter]);

  // Calculate delivery fees
  useEffect(() => {
    const calculateAllDeliveryFees = async () => {
      if (!userLocation || !vendors.length) return;
      
      setIsLoadingFees(true);
      const fees: Record<string, number> = {};
      
      for (const vendor of vendors) {
        if (vendor.latitude && vendor.longitude) {
          try {
            const fee = await calculateDeliveryToVendor(
              vendor.latitude,
              vendor.longitude,
              userLocation.latitude,
              userLocation.longitude
            );
            fees[vendor.id] = fee;
          } catch (error) {
            fees[vendor.id] = 500;
          }
        } else {
          fees[vendor.id] = 500;
        }
      }
      
      setDeliveryFees(fees);
      setIsLoadingFees(false);
    };
    
    calculateAllDeliveryFees();
  }, [userLocation, vendors]);

  // All products with delivery fees
  const allProducts = useMemo(() => {
    if (!vendors.length) return [];
    
    const products: any[] = [];
    
    for (const vendor of vendors) {
      const deliveryFee = deliveryFees[vendor.id] || 500;
      
      if (vendor.products && vendor.products.length) {
        for (const product of vendor.products) {
          products.push({
            ...product,
            vendorName: vendor.name,
            vendorId: vendor.id,
            vendorImage: vendor.image,
            vendorRating: vendor.rating,
            vendorDeliveryFee: deliveryFee,
            vendorCategory: vendor.category,
          });
        }
      }
    }
    
    return products;
  }, [vendors, deliveryFees]);

  // Filter products by meal time
  const filterByMealTime = (products: any[], mealTime: MealTimeTab): any[] => {
    if (mealTime === 'all') return products;
    
    const keywords = MEAL_TIME_FOOD_RULES[mealTime as keyof typeof MEAL_TIME_FOOD_RULES];
    if (!keywords) return products;
    
    return products.filter(product => {
      const productName = product.name.toLowerCase();
      return keywords.some(keyword => productName.includes(keyword));
    });
  };

  // Filter by health tab
  const filterByHealthTab = (products: any[], tab: SuggestionTab): any[] => {
    if (tab === 'all') return products;
    
    const allowedFoods = TAB_FOODS[tab as keyof typeof TAB_FOODS] || [];
    const excludedFoods = EXCLUDED_FOODS[tab as keyof typeof EXCLUDED_FOODS] || [];
    
    return products.filter(product => {
      const fullText = `${product.name.toLowerCase()} ${(product.description || '').toLowerCase()}`;
      
      for (const exclude of excludedFoods) {
        if (fullText.includes(exclude.toLowerCase())) return false;
      }
      
      for (const allowed of allowedFoods) {
        if (fullText.includes(allowed.toLowerCase())) return true;
      }
      
      return false;
    });
  };

  // Get suggested products based on selected tab (health or meal time)
  const suggestedProducts = useMemo(() => {
    let result = [...allProducts];
    
    // Apply meal time filter if selected
    if (selectedMealTimeTab !== 'all') {
      result = filterByMealTime(result, selectedMealTimeTab);
    }
    
    // Apply health tab filter if selected
    if (selectedSuggestionTab !== 'all') {
      result = filterByHealthTab(result, selectedSuggestionTab);
    }
    
    return result.slice(0, 10);
  }, [allProducts, selectedSuggestionTab, selectedMealTimeTab]);

  // Filter and sort main products
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query) ||
        p.vendorName?.toLowerCase().includes(query)
      );
    }

    if (filters.categories.length > 0) {
      result = result.filter(p => filters.categories.includes(p.category));
    }

    if (filters.vendors.length > 0) {
      result = result.filter(p => filters.vendors.includes(p.vendorId));
    }

    result = result.filter(p => p.price >= filters.priceRange.min && p.price <= filters.priceRange.max);

    switch (filters.sortBy) {
      case 'popular':
        result.sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0));
        break;
      case 'price_low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        result.sort((a, b) => b.price - a.price);
        break;
    }

    return result;
  }, [allProducts, searchQuery, filters]);

  // Health-aware add to cart
  const safeAddItem = async (product: any, quantity: number) => {
    if (!user?.id) {
      addItem(product, quantity);
      showToast(`${product.name} added to cart`);
      return;
    }

    if (isCheckingHealth) return;
    setIsCheckingHealth(true);
    
    try {
      const { data: profile, error } = await supabase
        .from('customer_health_profiles')
        .select('conditions, is_locked, enable_warnings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !profile || !profile.is_locked || !profile.enable_warnings || !profile.conditions?.length) {
        addItem(product, quantity);
        showToast(`${product.name} added to cart`);
        return;
      }

      const searchText = `${product.name} ${product.description || ''}`.toLowerCase();
      const triggeredConditions: HealthCondition[] = [];
      const effects: string[] = [];

      for (const conditionId of profile.conditions) {
        const conditionMeta = HEALTH_CONDITIONS.find(c => c.id === conditionId);
        if (!conditionMeta) continue;
        
        for (const tag of conditionMeta.avoidTags) {
          if (searchText.includes(tag.toLowerCase())) {
            triggeredConditions.push(conditionId);
            effects.push(`Contains "${tag}"`);
            break;
          }
        }
      }

      if (triggeredConditions.length > 0) {
        const conditionNames = triggeredConditions.map(c => 
          HEALTH_CONDITIONS.find(h => h.id === c)?.label || c
        ).join(', ');
        
        setHealthCheckResult({
          verdict: 'caution',
          reason: `This item may not be suitable for your ${conditionNames} condition(s).`,
          effects: effects,
          conditions: triggeredConditions,
        });
        setPendingCartAction({ product, quantity });
        setPendingProductName(product.name);
        setHealthModalVisible(true);
        return;
      }
      
      addItem(product, quantity);
      showToast(`${product.name} added to cart`);
      
    } catch (err) {
      console.error('Health check error:', err);
      addItem(product, quantity);
      showToast(`${product.name} added to cart`);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleOrderAnyway = () => {
    if (pendingCartAction) {
      addItem(pendingCartAction.product, pendingCartAction.quantity);
      showToast(`${pendingCartAction.product.name} added to cart`);
    }
    setHealthModalVisible(false);
    setPendingCartAction(null);
    setHealthCheckResult(null);
  };

  const handleGoBack = () => {
    setHealthModalVisible(false);
    setPendingCartAction(null);
    setHealthCheckResult(null);
  };

  const showToast = (message: string) => {
    Toast.show({ type: 'success', text1: message, position: 'bottom', visibilityTime: 2000 });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshVendors();
    setRefreshing(false);
  };

  const isLoading = vendorsLoading || categoriesLoading;

  const applyFilters = () => {
    setFilters(tempFilters);
    setShowFilters(false);
  };

  const resetFilters = () => {
    setTempFilters({
      categories: [],
      vendors: [],
      priceRange: { min: 0, max: 1000000000 },
      sortBy: 'popular',
    });
  };

  const toggleCategory = (category: string) => {
    setTempFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category) ? prev.categories.filter(c => c !== category) : [...prev.categories, category],
    }));
  };

  const toggleVendor = (vendorId: string) => {
    setTempFilters(prev => ({
      ...prev,
      vendors: prev.vendors.includes(vendorId) ? prev.vendors.filter(v => v !== vendorId) : [...prev.vendors, vendorId],
    }));
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.categories.length > 0) count += filters.categories.length;
    if (filters.vendors.length > 0) count += filters.vendors.length;
    if (filters.priceRange.min > 0 || filters.priceRange.max < 1000000000) count += 1;
    if (filters.sortBy !== 'popular') count += 1;
    return count;
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading delicious food...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomerHeader showSearch={false} />

      <HealthWarningModal
        visible={healthModalVisible}
        productName={pendingProductName}
        checkResult={healthCheckResult}
        onOrderAnyway={handleOrderAnyway}
        onGoBack={handleGoBack}
      />

      <ProductDetailsModal
        product={detailsProduct}
        vendorName={detailsProduct?.vendorName}
        onClose={() => setDetailsProduct(null)}
        onHealthWarning={(product, result) => {
          setHealthCheckResult(result);
          setPendingCartAction({ product, quantity: 1 });
          setPendingProductName(product.name);
          setHealthModalVisible(true);
        }}
      />

      {/* Meal Time Tabs (NEW - above health tabs) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {MEAL_TIME_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => {
              setSelectedMealTimeTab(tab.id);
              setSelectedSuggestionTab('all'); // Reset health tab when meal time is selected
            }}
            style={[
              styles.tabChip,
              selectedMealTimeTab === tab.id && { backgroundColor: `${tab.color}20`, borderColor: tab.color }
            ]}
          >
            <Feather name={tab.icon as any} size={14} color={selectedMealTimeTab === tab.id ? tab.color : '#666'} />
            <Text style={[styles.tabChipText, selectedMealTimeTab === tab.id && { color: tab.color }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Health Suggestion Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {SUGGESTION_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => {
              setSelectedSuggestionTab(tab.id);
              if (tab.id !== 'all') setSelectedMealTimeTab('all'); // Reset meal time when health tab is selected
            }}
            style={[
              styles.tabChip,
              selectedSuggestionTab === tab.id && { backgroundColor: `${tab.color}20`, borderColor: tab.color }
            ]}
          >
            <Feather name={tab.icon as any} size={14} color={selectedSuggestionTab === tab.id ? tab.color : '#666'} />
            <Text style={[styles.tabChipText, selectedSuggestionTab === tab.id && { color: tab.color }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Suggested For You Section */}
      {(selectedSuggestionTab !== 'all' || selectedMealTimeTab !== 'all') && suggestedProducts.length > 0 && (
        <View style={styles.suggestedSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedSuggestionTab !== 'all' 
                ? SUGGESTION_TABS.find(t => t.id === selectedSuggestionTab)?.label 
                : MEAL_TIME_TABS.find(t => t.id === selectedMealTimeTab)?.label} Picks
            </Text>
            <Text style={styles.sectionSubtitle}>Recommended for you</Text>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={suggestedProducts}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.horizontalProductCard}
                onPress={() => setDetailsProduct(item)}
                activeOpacity={0.8}
              >
                <Image source={imageSource(item.image)} style={styles.horizontalProductImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.productGradient}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.productVendor} numberOfLines={1}>{item.vendorName}</Text>
                    <View style={styles.productFooter}>
                      <View style={styles.productPriceContainer}>
                        <Text style={styles.productPrice}>₦{item.price?.toLocaleString()}</Text>
                        <View style={styles.deliveryBadge}>
                          <Feather name="truck" size={8} color="#10b981" />
                          <Text style={styles.deliveryText}>₦{item.vendorDeliveryFee?.toLocaleString() || '500'}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => safeAddItem(item, 1)}
                        style={styles.addButton}
                        disabled={isCheckingHealth}
                      >
                        <Feather name="plus" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.suggestedList}
          />
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for food, vendors..."
              placeholderTextColor="#666"
            />
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Feather name="x" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            onPress={() => { setTempFilters(filters); setShowFilters(true); }}
            style={[styles.filterButton, getActiveFilterCount() > 0 && styles.filterButtonActive]}
          >
            <Feather name="sliders" size={18} color={getActiveFilterCount() > 0 ? '#f97316' : '#666'} />
            {getActiveFilterCount() > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredProducts.length} item{filteredProducts.length !== 1 ? 's' : ''} found
        </Text>
        {(searchQuery || getActiveFilterCount() > 0) && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); resetFilters(); setFilters({ categories: [], vendors: [], priceRange: { min: 0, max: 1000000000 }, sortBy: 'popular' }); }}>
            <Text style={styles.clearFiltersText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Products Grid */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
      >
        {filteredProducts.length > 0 ? (
          <View style={styles.productsGrid}>
            {filteredProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                onPress={() => setDetailsProduct(product)}
                activeOpacity={0.8}
              >
                <Image source={imageSource(product.image)} style={styles.productImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.productGradient}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                    <Text style={styles.productVendor} numberOfLines={1}>{product.vendorName}</Text>
                    <View style={styles.productFooter}>
                      <View style={styles.productPriceContainer}>
                        <Text style={styles.productPrice}>₦{product.price?.toLocaleString()}</Text>
                        <View style={styles.deliveryBadge}>
                          <Feather name="truck" size={8} color="#10b981" />
                          <Text style={styles.deliveryText}>₦{product.vendorDeliveryFee?.toLocaleString() || '500'}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => safeAddItem(product, 1)}
                        style={styles.addButton}
                        disabled={isCheckingHealth}
                      >
                        <Feather name="plus" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}><Feather name="search" size={40} color="#666" /></View>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptyText}>Try adjusting your search or filters</Text>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Filter Modal - keep existing */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Items</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Sort By</Text>
                <View style={styles.sortOptions}>
                  {[{ value: 'popular', label: 'Most Popular' }, { value: 'price_low', label: 'Price: Low to High' }, { value: 'price_high', label: 'Price: High to Low' }, { value: 'newest', label: 'Newest First' }].map((option) => (
                    <TouchableOpacity key={option.value} onPress={() => setTempFilters(prev => ({ ...prev, sortBy: option.value as any }))} style={[styles.sortOption, tempFilters.sortBy === option.value && styles.sortOptionSelected]}>
                      <Text style={[styles.sortOptionLabel, tempFilters.sortBy === option.value && styles.sortOptionLabelSelected]}>{option.label}</Text>
                      {tempFilters.sortBy === option.value && <Feather name="check" size={16} color="#f97316" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Categories</Text>
                <View style={styles.categoryOptions}>
                  {categories.map((category) => (
                    <TouchableOpacity key={category.id} onPress={() => toggleCategory(category.name)} style={[styles.categoryOption, tempFilters.categories.includes(category.name) && styles.categoryOptionSelected]}>
                      <Text style={[styles.categoryOptionText, tempFilters.categories.includes(category.name) && styles.categoryOptionTextSelected]}>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Vendors</Text>
                <View style={styles.vendorOptions}>
                  {vendors.map((vendor) => (
                    <TouchableOpacity key={vendor.id} onPress={() => toggleVendor(vendor.id)} style={[styles.vendorOption, tempFilters.vendors.includes(vendor.id) && styles.vendorOptionSelected]}>
                      <Image source={imageSource(vendor.image)} style={styles.vendorOptionImage} />
                      <View style={styles.vendorOptionInfo}>
                        <Text style={styles.vendorOptionName}>{vendor.name}</Text>
                        <Text style={styles.vendorOptionRating}>⭐ {vendor.rating.toFixed(1)}</Text>
                      </View>
                      {tempFilters.vendors.includes(vendor.id) && <Feather name="check" size={18} color="#f97316" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Price Range</Text>
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceInputLabel}>Min</Text>
                    <TextInput style={styles.priceInput} value={tempFilters.priceRange.min.toString()} onChangeText={(text) => setTempFilters(prev => ({ ...prev, priceRange: { ...prev.priceRange, min: parseInt(text) || 0 } }))} keyboardType="numeric" placeholder="0" placeholderTextColor="#666" />
                  </View>
                  <View style={styles.priceSeparator}><Text style={styles.priceSeparatorText}>to</Text></View>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceInputLabel}>Max</Text>
                    <TextInput style={styles.priceInput} value={tempFilters.priceRange.max.toString()} onChangeText={(text) => setTempFilters(prev => ({ ...prev, priceRange: { ...prev.priceRange, max: parseInt(text) || 1000000000 } }))} keyboardType="numeric" placeholder="₦" placeholderTextColor="#666" />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={resetFilters} style={styles.resetButton}><Text style={styles.resetButtonText}>Reset</Text></TouchableOpacity>
              <TouchableOpacity onPress={applyFilters} style={styles.applyButton}>
                <LinearGradient colors={['#f97316', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.applyGradient}>
                  <Text style={styles.applyText}>Apply Filters</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingBottom: 60 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#666', marginTop: 12, fontSize: 14 },
  
  tabsContainer: { maxHeight: 44, marginTop: 12, marginBottom: 8 },
  tabsContent: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#1a1a1a', borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a' },
  tabChipText: { fontSize: 13, color: '#666' },
  
  suggestedSection: { marginBottom: 16 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sectionSubtitle: { fontSize: 11, color: '#666', marginTop: 2 },
  suggestedList: { paddingLeft: 16, gap: 12 },
  
  horizontalProductCard: { width: 160, height: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a1a', marginRight: 12 },
  horizontalProductImage: { width: '100%', height: '100%', position: 'absolute' },
  
  productCard: { width: '47%', height: 200, marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  productImage: { width: '100%', height: '100%', position: 'absolute' },
  
  productGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, paddingBottom: 8 },
  productInfo: { gap: 4 },
  productName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  productVendor: { fontSize: 10, color: '#aaa' },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  productPriceContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  productPrice: { fontSize: 13, fontWeight: '700', color: '#f97316' },
  deliveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  deliveryText: { fontSize: 9, color: '#10b981' },
  addButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  searchWrapper: { flexDirection: 'row', gap: 8 },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: '#fff', fontSize: 14 },
  clearButton: { padding: 4 },
  
  filterButton: { width: 44, height: 44, backgroundColor: '#1a1a1a', borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  filterButtonActive: { borderWidth: 1, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)' },
  filterBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#f97316', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  
  resultsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  resultsText: { fontSize: 13, color: '#666' },
  clearFiltersText: { fontSize: 13, color: '#f97316' },
  
  content: { flex: 1 },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
  bottomPadding: { height: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  modalCloseButton: { padding: 4 },
  modalBody: { flex: 1, padding: 16 },
  modalSection: { marginBottom: 24 },
  modalSectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  sortOptions: { gap: 8 },
  sortOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#2a2a2a', borderRadius: 8 },
  sortOptionSelected: { backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: '#f97316' },
  sortOptionLabel: { fontSize: 14, color: '#fff' },
  sortOptionLabelSelected: { color: '#f97316' },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryOption: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#2a2a2a', borderRadius: 20 },
  categoryOptionSelected: { backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: '#f97316' },
  categoryOptionText: { fontSize: 13, color: '#fff' },
  categoryOptionTextSelected: { color: '#f97316' },
  vendorOptions: { gap: 8 },
  vendorOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#2a2a2a', borderRadius: 8 },
  vendorOptionSelected: { backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: '#f97316' },
  vendorOptionImage: { width: 40, height: 40, borderRadius: 8 },
  vendorOptionInfo: { flex: 1 },
  vendorOptionName: { fontSize: 14, fontWeight: '500', color: '#fff', marginBottom: 2 },
  vendorOptionRating: { fontSize: 12, color: '#666' },
  priceRangeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInputContainer: { flex: 1 },
  priceInputLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  priceInput: { height: 44, backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 12, color: '#fff', fontSize: 14 },
  priceSeparator: { paddingHorizontal: 8 },
  priceSeparatorText: { color: '#666', fontSize: 14 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  resetButton: { flex: 1, height: 48, backgroundColor: '#2a2a2a', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  resetButtonText: { color: '#666', fontSize: 15, fontWeight: '600' },
  applyButton: { flex: 2, height: 48, borderRadius: 12, overflow: 'hidden' },
  applyGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  applyText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});