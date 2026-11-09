// app/screens/customer/HomeScreen.tsx
import { imageSource } from '../../utils/images';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import {  Modal } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useHealth } from '../../contexts/HealthContext';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { TimedFoodSuggestions } from '../../components/customer/TimedFoodSuggestions';
import { LockInHintBanner } from '../../components/customer/LockInHintBanner';
import { MEAL_TIME_ICONS } from '../../components/customer/TimedFoodSuggestions';
import { HealthWarningModal } from '../../components/customer/HealthWarningModal';
import { useCategories } from '../../hooks/customer/useCategories';
import { useVendors } from '../../hooks/customer/useVendors';
import { getMealTimeGreeting } from '../../hooks/customer/useAIFoodSuggestions';
import { useRecommendations } from '../../hooks/customer/useRecommendations';
import { useHealthCheck, HealthCheckResult } from '../../hooks/customer/useHealthCheck';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { HealthCondition, HEALTH_CONDITIONS } from '../../contexts/HealthContext';
import { SafetyVerdict } from '../../hooks/customer/useHealthCheck';
import { useLocation } from '../../contexts/LocationContext';
import { calculateDistance } from '../../services/locationService';
import { PRO_SUBSCRIPTIONS_ENABLED } from '../../config/features';


const { width } = Dimensions.get('window');

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Promotion {
  id: string;
  title: string;
  description: string;
  image_url: string;
  promotion_type: 'flyer' | 'product_offer' | 'combo';
  vendor_id: string;
  vendor_name?: string;
  product_id?: string;
  discounted_price?: number;
  original_price?: number;
  product_name?: string;
  main_product_id?: string;
  main_product_name?: string;
  main_product_original_price?: number;
  free_product_id?: string;
  free_product_name?: string;
  free_product_original_price?: number;
  buy_quantity?: number;
  get_quantity?: number;
  max_per_customer?: number;
}

// Pending cart add — held while health check modal is open
interface PendingCartAction {
  product: any;
  quantity: number;
}

export function HomeScreen() {

  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { addItem, items, vendorId: cartVendorId, clearCart } = useCart();
  const { healthProfile } = useHealth();
  const { checkProduct } = useHealthCheck();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [unreadCount, setUnreadCount] = useState(0);
const [showFoodInfoModal, setShowFoodInfoModal] = useState(false);
const [isCheckingHealth, setIsCheckingHealth] = useState(false);
const { userLocation, requestLocation } = useLocation();
const [nearbyProducts, setNearbyProducts] = useState<any[]>([]);
const [isLoadingNearby, setIsLoadingNearby] = useState(false);



  // Health warning modal state
  const [healthModalVisible, setHealthModalVisible] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);
  const [pendingCartAction, setPendingCartAction] = useState<PendingCartAction | null>(null);
  const [pendingProductName, setPendingProductName] = useState('');

  // Promo slides
  const verticalPromoSlides = [
    { id: 'promo_1', title: '🎁 Refer & Earn', subtitle: 'Refer a friend and you both get ₦500 off!', buttonText: 'Invite Now', icon: 'users', gradientColors: ['#f97316', '#f43f5e'], action: 'referral', backgroundColor: 'rgba(249,115,22,0.15)' },
    { id: 'promo_2', title: '🚚 Free Delivery', subtitle: 'Order 5 times and get free delivery on your next order!', buttonText: 'View Rewards', icon: 'truck', gradientColors: ['#10b981', '#059669'], action: 'rewards', backgroundColor: 'rgba(16,185,129,0.15)' },
    { id: 'promo_3', title: '💰 Earn Cashback', subtitle: 'Get cashback on every order. Save more!', buttonText: 'Learn More', icon: 'dollar-sign', gradientColors: ['#8b5cf6', '#6d28d9'], action: 'rewards', backgroundColor: 'rgba(139,92,246,0.15)' },
    { id: 'promo_4', title: '⭐ Loyalty Rewards', subtitle: 'Every 5th order = Free delivery. Keep ordering!', buttonText: 'Check Status', icon: 'star', gradientColors: ['#f59e0b', '#d97706'], action: 'rewards', backgroundColor: 'rgba(245,158,11,0.15)' },
    { id: 'promo_5', title: '🏪 New Vendors', subtitle: 'Discover amazing restaurants near you!', buttonText: 'Explore', icon: 'home', gradientColors: ['#3b82f6', '#1d4ed8'], action: 'Vendors', backgroundColor: 'rgba(59,130,246,0.15)' },
  ];

  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [currentVerticalIndex, setCurrentVerticalIndex] = useState(0);
  const promoFlatListRef = useRef<FlatList>(null);


// Function to find healthier alternatives from nearby vendors
const getHealthierAlternatives = (triggeredConditions: string[], currentProductName: string) => {
  // Define which keywords to look for based on condition
  const alternativeKeywords: Record<string, string[]> = {
    low_sugar: ['grilled', 'vegetable', 'salad', 'unsweetened', 'natural', 'fresh', 'baked'],
    diabetic: ['brown rice', 'whole grain', 'vegetable', 'grilled', 'baked', 'low carb'],
    hypertensive: ['low sodium', 'unsalted', 'fresh', 'steamed', 'grilled', 'herb seasoned'],
    high_cholesterol: ['grilled', 'baked', 'steamed', 'vegetable', 'lean', 'fish', 'omega'],
    weight_loss: ['grilled', 'salad', 'vegetable', 'lean', 'light', 'steamed'],
    workout_mode: ['protein', 'chicken', 'fish', 'grilled', 'healthy', 'lean'],
    nut_allergy: ['nut free', 'seed', 'no nuts', 'allergy friendly'],
  };

  // Get keywords for triggered conditions
  let keywords: string[] = ['healthy', 'grilled', 'fresh']; // default
  for (const condition of triggeredConditions) {
    if (alternativeKeywords[condition]) {
      keywords = [...keywords, ...alternativeKeywords[condition]];
    }
  }
  keywords = [...new Set(keywords)]; // remove duplicates

  // Filter products from vendors that match the keywords
  const alternatives = allProducts
    .filter(product => {
      // Don't suggest the same product
      if (product.name.toLowerCase() === currentProductName.toLowerCase()) return false;
      
      // Check if product matches any keyword
      const productText = `${product.name} ${product.category || ''}`.toLowerCase();
      return keywords.some(keyword => productText.includes(keyword));
    })
    .slice(0, 6) // Get top 6 alternatives
    .map(product => ({
      id: product.id,
      name: product.name,
      image: product.image || product.image_url || '',
      price: product.price,
      vendorName: product.vendorName,
      reason: `Better for ${triggeredConditions.map(c => 
        HEALTH_CONDITIONS.find(h => h.id === c)?.label || c
      ).join(', ')}`,
      onPress: () => {
        setHealthModalVisible(false);
        // Navigate to vendor details or add to cart
        navigation.navigate('VendorDetails', { vendorId: product.vendorId });
      }
    }));

  return alternatives;
};
  const referralPromotion = {
    id: 'referral', title: 'Invite friends, earn ₦500',
    description: 'Share your referral code. Your friend gets ₦500 off their first order and you earn ₦500 when they order.',
    promotion_type: 'referral', vendor_id: null,
  };

  const firstOrderPromotion = {
    id: 'first-order', title: 'First Order Offer',
    description: 'Get 10% off + FREE delivery on your first order',
    image_url: require('../../assets/buggerbg.jpg'),
    promotion_type: 'first_order', vendor_id: null, vendor_name: null,
    discounted_price: null, original_price: null, is_first_order: true,
    discount_percentage: 10, min_order_amount: 10000,
  };

  const { categories, isLoading: categoriesLoading } = useCategories();
  const {
    vendors,
    isLoading: vendorsLoading,
    error: vendorsError,
    refresh: refreshVendors,
    getVendorsByCategory,
  } = useVendors();

  // Flatten all products for AI suggestions
  const allProducts = vendors.flatMap(v =>
    (v.products || []).map((p: any) => ({
      ...p,
      vendorId: v.id,
      vendorName: v.name,
    }))
  );

  const {
    suggestions,
    isLoading: suggestionsLoading,
    mealTime,
    lockedCount,
    isPersonalised,
  } = useRecommendations(allProducts);

  // Dynamic greeting driven by meal time
  const firstName = user?.name?.split(' ')[0] || 'there';
  const { greeting, subtitle } = getMealTimeGreeting(mealTime, firstName);

// Shared health check (vendor ingredients/allergens + user's conditions) before adding.
const safeAddItem = async (product: any, quantity: number) => {
  if (!user?.id) {
    addItem(product, quantity);
    showToast(`${product.name} added to cart`);
    return;
  }

  // Don't allow multiple simultaneous checks
  if (isCheckingHealth) return;
  setIsCheckingHealth(true);

  try {
    const result = await checkProduct(product.id, product.name, product.description || '', product.category || '');
    if (result) {
      setHealthCheckResult(result);
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


const loadNearbyProducts = async () => {
  if (!vendors.length) return;
  
  // If no location, request it
  if (!userLocation) {
    setIsLoadingNearby(true);
    await requestLocation();
    setIsLoadingNearby(false);
    return;
  }

  setIsLoadingNearby(true);
  
  try {
    // Get all vendors with distance
    const vendorsWithDistance: any[] = [];
    
    for (const vendor of vendors) {
      if (vendor.latitude && vendor.longitude) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          vendor.latitude,
          vendor.longitude
        );
        
        if (distance <= 10) { // Within 10km radius
          vendorsWithDistance.push({ ...vendor, distance });
        }
      }
    }
    
    // Sort by distance (nearest first)
    vendorsWithDistance.sort((a, b) => a.distance - b.distance);
    
    // Collect products from all nearby vendors
    const allNearbyProducts: any[] = [];
    
    for (const vendor of vendorsWithDistance) {
      if (vendor.products && vendor.products.length > 0) {
        // Take up to 3 products from each vendor
        const vendorProducts = vendor.products
          .slice(0, 3)
          .map((product: any) => ({
            ...product,
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorDistance: vendor.distance,
            // Prioritize products with images
            hasImage: !!product.image,
          }));
        allNearbyProducts.push(...vendorProducts);
      }
    }
    
    // Sort: products with images first, then by distance
    allNearbyProducts.sort((a, b) => {
      if (a.hasImage && !b.hasImage) return -1;
      if (!a.hasImage && b.hasImage) return 1;
      return a.vendorDistance - b.vendorDistance;
    });
    
    // Take top 10 products max
    const finalProducts = allNearbyProducts.slice(0, 10);
    
    setNearbyProducts(finalProducts);
    
    console.log(`📍 Found ${vendorsWithDistance.length} nearby vendors, showing ${finalProducts.length} products`);
    
  } catch (error) {
    console.error('Error loading nearby products:', error);
  } finally {
    setIsLoadingNearby(false);
  }
};

// Load nearby products when vendors or location changes
useEffect(() => {
  if (vendors.length > 0) {
    loadNearbyProducts();
  }
}, [vendors, userLocation]);

// Also refresh when screen comes into focus
useFocusEffect(
  React.useCallback(() => {
    if (vendors.length > 0) {
      loadNearbyProducts();
    }
  }, [vendors, userLocation])
);




// Helper function for effect messages
function getEffectMessage(conditionId: string, label: string): string {
  const effects: Record<string, string> = {
    'low_sugar': 'High in sugar',
    'diabetic_type1': 'May spike blood sugar levels',
    'diabetic_type2': 'May spike blood sugar levels',
    'hypertensive': 'May increase blood pressure',
    'workout_mode': 'May slow fitness progress',
    'nut_allergy': 'Severe allergic reaction possible',
    'lactose_intolerant': 'May cause digestive discomfort',
  };
  return effects[conditionId] || `May be unsuitable for ${label}`;
}

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
  // ────────────────────────────────────────────────────────────────────────

  const fetchPromotions = async () => {
    try {
      setLoadingPromotions(true);
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          vendor:vendor_id (name, is_open),
          products:product_id (id, name, price),
          main_product:main_product_id (id, name, price),
          free_product:free_product_id (id, name, price)
        `)
        .eq('status', 'active')
        .lte('start_date', new Date().toISOString())
        .gte('end_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedPromos = data?.filter(promo => promo.vendor?.is_open !== false).map(promo => {
        let mainProductName = promo.main_product?.name;
        let freeProductName = promo.free_product?.name;
        if (promo.promotion_type === 'combo') {
          if (!mainProductName && promo.main_product_original_price) mainProductName = `Item (₦${promo.main_product_original_price.toLocaleString()})`;
          if (!freeProductName && promo.free_product_original_price) freeProductName = `Free Item (₦${promo.free_product_original_price.toLocaleString()})`;
        }
        return {
          ...promo,
          vendor_name: promo.vendor?.name,
          product_name: promo.products?.name,
          original_price: promo.products?.price,
          discounted_price: promo.discounted_price,
          main_product_name: mainProductName,
          main_product_original_price: promo.main_product?.price || promo.main_product_original_price,
          free_product_name: freeProductName,
          free_product_original_price: promo.free_product?.price || promo.free_product_original_price,
        };
      }) || [];

      setPromotions(processedPromos);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoadingPromotions(false);
    }
  };

  const fetchUnreadMessages = async () => {
    if (!user?.id) return;
    try {
      const { data: conversations, error: convError } = await supabase
        .from('conversations').select('id').contains('participants', [user.id]);
      if (convError || !conversations || conversations.length === 0) { setUnreadCount(0); return; }
      const conversationIds = conversations.map(c => c.id);
      const { count, error } = await supabase
        .from('messages').select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds).eq('read', false).neq('sender_id', user.id);
      if (!error) setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread messages:', error);
    }
  };

  // The referral slide is always there; vendor promotions follow it in the slider.
  const allSlides = [referralPromotion, ...(isFirstOrder ? [firstOrderPromotion] : []), ...promotions];

  useEffect(() => {
    const checkFirstOrder = async () => {
      if (!user?.id) return;
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('customer_id', user.id);
      setIsFirstOrder(count === 0);
    };
    checkFirstOrder();
  }, [user?.id]);

  useEffect(() => {
    fetchPromotions();
  }, []);

  // Auto-advance through every slide (referral, first-order offer, vendor promotions).
  const slideCount = allSlides.length;
  useEffect(() => {
    if (slideCount <= 1) return;
    const interval = setInterval(() => {
      let nextSlide = currentSlide + 1;
      if (nextSlide >= slideCount) nextSlide = 0;
      flatListRef.current?.scrollToIndex({ index: nextSlide, animated: true });
      setCurrentSlide(nextSlide);
    }, 4000);
    return () => clearInterval(interval);
  }, [currentSlide, slideCount]);

  useEffect(() => {
    if (verticalPromoSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentVerticalIndex(prev => (prev + 1) % verticalPromoSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentVerticalIndex]);

  useEffect(() => {
    fetchUnreadMessages();
  }, [user?.id]);

  useFocusEffect(React.useCallback(() => { fetchUnreadMessages(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshVendors();
    await fetchPromotions();
    setRefreshing(false);
  };

  const showToast = (message: string) => {
    Toast.show({ type: 'success', text1: message, position: 'bottom', visibilityTime: 2000 });
  };

  const filteredVendors = getVendorsByCategory(selectedCategory);
  const featuredVendors = vendors.slice(0, 4);
  const popularProducts = vendors.flatMap(v => v.products).filter((p: any) => p.isPopular).slice(0, 4);
  const isLoading = categoriesLoading || vendorsLoading;

  const handlePromotionPress = async (promotion: Promotion) => {
    await supabase.rpc('increment_promotion_click', { promo_id: promotion.id });
    if (promotion.promotion_type === 'flyer') {
      navigation.navigate('VendorDetails', { vendorId: promotion.vendor_id });
    } else if (promotion.promotion_type === 'product_offer' && promotion.product_id) {
      if (cartVendorId && cartVendorId !== promotion.vendor_id) {
        Alert.alert('Clear Cart?', 'Your cart already has items from another vendor. Clear cart and add this item?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear & Add', onPress: async () => { clearCart(); await addPromotionToCart(promotion); } },
        ]);
      } else { await addPromotionToCart(promotion); }
    } else if (promotion.promotion_type === 'combo') {
      if (cartVendorId && cartVendorId !== promotion.vendor_id) {
        Alert.alert('Clear Cart?', 'Your cart already has items from another vendor. Clear cart and add this combo?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear & Add', onPress: async () => { clearCart(); await addComboToCart(promotion); } },
        ]);
      } else { await addComboToCart(promotion); }
    }
  };

  const addPromotionToCart = async (promotion: Promotion) => {
    const discountedPrice = promotion.discounted_price || promotion.original_price || 0;
    const originalPrice = promotion.original_price || discountedPrice;
    const promoProduct = {
      id: promotion.product_id || '', name: promotion.product_name || promotion.title,
      description: promotion.description || '', price: discountedPrice,
      originalPrice, original_price: originalPrice, image: promotion.image_url,
      image_url: promotion.image_url, category: 'promotion', isAvailable: true,
      is_available: true, vendorId: promotion.vendor_id, vendorName: promotion.vendor_name,
      is_popular: false, preparation_time: 20, preparationTime: 20, options: [],
      is_promotion: true, promotion_id: promotion.id, promotion_price: discountedPrice,
      max_quantity: promotion.max_per_customer || 1,
    };
    await safeAddItem(promoProduct, 1);
    showToast(`Added ${promotion.product_name || promotion.title} to cart for ₦${discountedPrice.toLocaleString()}!`);
    await supabase.rpc('increment_promotion_conversion', { promo_id: promotion.id });
    navigation.navigate('Cart');
  };

  const addComboToCart = async (promotion: Promotion) => {
    const mainProductPrice = promotion.main_product_original_price || 0;
    const mainProductName = promotion.main_product_name || `Item (₦${mainProductPrice.toLocaleString()})`;
    const freeProductName = promotion.free_product_name || 'Free Item';
    const mainProduct = {
      id: promotion.main_product_id || `combo_main_${promotion.id}`, name: mainProductName,
      description: promotion.description || `Buy ${promotion.buy_quantity} get ${promotion.get_quantity} ${freeProductName} free`,
      price: mainProductPrice, originalPrice: mainProductPrice, original_price: mainProductPrice,
      image: promotion.image_url, image_url: promotion.image_url, category: 'promotion',
      isAvailable: true, is_available: true, vendorId: promotion.vendor_id, vendorName: promotion.vendor_name,
      is_popular: false, preparation_time: 20, preparationTime: 20, options: [],
      promotion_id: promotion.id, is_promotion: true, is_combo_main: true, is_free_item: false,
      max_quantity: promotion.max_per_customer || 1,
      combo_details: { buy_quantity: promotion.buy_quantity || 1, get_quantity: promotion.get_quantity || 1, free_product_name: freeProductName },
    };
    const freeProduct = {
      id: promotion.free_product_id || `combo_free_${promotion.id}`, name: freeProductName,
      description: `Free with purchase of ${mainProductName}`, price: 0,
      originalPrice: promotion.free_product_original_price || 0, original_price: promotion.free_product_original_price || 0,
      image: promotion.image_url, image_url: promotion.image_url, category: 'promotion',
      isAvailable: true, is_available: true, vendorId: promotion.vendor_id, vendorName: promotion.vendor_name,
      is_popular: false, preparation_time: 20, preparationTime: 20, options: [],
      promotion_id: promotion.id, is_promotion: true, is_combo_main: false, is_free_item: true,
      max_quantity: promotion.max_per_customer || 1,
    };
    addItem(mainProduct, promotion.buy_quantity || 1);
    if (freeProduct && promotion.get_quantity) addItem(freeProduct, promotion.get_quantity);
    const totalPrice = mainProductPrice * (promotion.buy_quantity || 1);
    showToast(`Combo added to cart! Total: ₦${totalPrice.toLocaleString()}`);
    await supabase.rpc('increment_promotion_conversion', { promo_id: promotion.id });
    navigation.navigate('Cart');
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentSlide(viewableItems[0].index);
  }).current;

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading delicious food...</Text>
      </View>
    );
  }

  if (vendorsError) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={50} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load vendors</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshVendors}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomerHeader />

   <HealthWarningModal
  visible={healthModalVisible}
  productName={pendingProductName}
  checkResult={healthCheckResult}
  onOrderAnyway={handleOrderAnyway}
  onGoBack={handleGoBack}
  suggestions={
    healthCheckResult?.conditions && allProducts.length > 0
      ? getHealthierAlternatives(healthCheckResult.conditions, pendingProductName)
      : []
  }
/>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
      >
        {/* ── Dynamic Greeting ── */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingTextGroup}>
            <View style={styles.greetingRow}>
              <Feather name={MEAL_TIME_ICONS[mealTime]} size={20} color="#f97316" />
              <Text style={styles.greetingText}>{greeting}</Text>
            </View>
            <Text style={styles.subtitleText}>{subtitle}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Messaging')} style={styles.messageButton}>
            <Feather name="message-circle" size={22} color="#f97316" />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Lock-In Hint Banner ── */}
        <LockInHintBanner onPress={() => navigation.navigate('Profile')} />

        {/* ── Quick Actions ── */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('CustomerTabs', { screen: 'Vendors' })}>
            <LinearGradient colors={['rgba(249,115,22,0.2)', 'rgba(249,115,22,0.05)']} style={styles.quickActionGradient}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(249,115,22,0.2)' }]}>
                <Feather name="zap" size={20} color="#f97316" />
              </View>
              <Text style={styles.quickActionTitle}>Order Food</Text>
              <Text style={styles.quickActionSubtitle}>From {vendors.length}+ vendors</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.verticalPromoContainer}>
            <TouchableOpacity
              style={styles.verticalPromoCard}
              onPress={() => {
                const action = verticalPromoSlides[currentVerticalIndex].action;
                if (action === 'Vendors') navigation.navigate('CustomerTabs', { screen: 'Vendors' });
                else navigation.navigate('Rewards');
              }}
            >
              <LinearGradient colors={verticalPromoSlides[currentVerticalIndex].gradientColors as any} style={styles.verticalPromoGradient}>
                <View style={styles.verticalPromoIconContainer}>
                  <Feather name={verticalPromoSlides[currentVerticalIndex].icon as any} size={28} color="#fff" />
                </View>
                <Text style={styles.verticalPromoTitle}>{verticalPromoSlides[currentVerticalIndex].title}</Text>
                <Text style={styles.verticalPromoSubtitle}>{verticalPromoSlides[currentVerticalIndex].subtitle}</Text>
                <View style={styles.verticalPromoArrow}>
                  <Feather name="arrow-right" size={14} color="#fff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.verticalPaginationContainer}>
              {verticalPromoSlides.map((_, index) => (
                <View key={index} style={[styles.verticalPaginationDot, currentVerticalIndex === index && styles.verticalPaginationDotActive]} />
              ))}
            </View>
          </View>
        </View>

        {/* ── Promotions Slider ── */}
        {!loadingPromotions && allSlides.length > 0 && (
          <View style={styles.sliderContainer}>
            <FlatList
              ref={flatListRef}
              data={allSlides}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                if (item.promotion_type === 'referral') {
                  return (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Rewards')} style={styles.slide}>
                      <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.slideOverlay, styles.referralSlide]}>
                        <View style={styles.referralArt}>
                          <Feather name="users" size={64} color="rgba(255,255,255,0.18)" />
                        </View>
                        <View style={styles.slideContent}>
                          <View style={styles.textContent}>
                            <View style={[styles.badgeContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                              <Feather name="gift" size={14} color="#fff" />
                              <Text style={[styles.badgeText, { color: '#fff' }]}>REFERRAL BONUS</Text>
                            </View>
                            <Text style={styles.title}>{item.title}</Text>
                            <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
                            <View style={styles.buttonContainer}>
                              <View style={[styles.orderButton, { backgroundColor: '#fff' }]}>
                                <Text style={[styles.orderButtonText, { color: '#f97316' }]}>Get my code</Text>
                                <Feather name="arrow-right" size={16} color="#f97316" />
                              </View>
                            </View>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                }

                if (item.promotion_type === 'first_order') {
                  return (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('CustomerTabs', { screen: 'Explore' })} style={styles.slide}>
                      <Image source={item.image_url} style={styles.slideImage} resizeMode="cover" />
                      <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.slideOverlay}>
                        <View style={styles.slideContent}>
                          <View style={styles.textContent}>
                            <View style={styles.badgeContainer}>
                              <Feather name="gift" size={14} color="#f97316" />
                              <Text style={styles.badgeText}>WELCOME OFFER</Text>
                            </View>
                            <Text style={styles.title}>{item.title}</Text>
                            <Text style={styles.description}>{item.description}</Text>
                            <View style={styles.priceSection}>
                              <Text style={styles.discountedPrice}>10% OFF</Text>
                              <Text style={styles.originalPriceStrikethrough}>+ FREE Delivery</Text>
                            </View>
                            <Text style={styles.minOrderText}>On orders above ₦{item.min_order_amount.toLocaleString()}</Text>
                            <View style={styles.buttonContainer}>
                              <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.orderButton}>
                                <Text style={styles.orderButtonText}>Order Now</Text>
                                <Feather name="arrow-right" size={16} color="#fff" />
                              </LinearGradient>
                            </View>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                }

                const hasDiscount = item.promotion_type === 'product_offer' && item.original_price && item.discounted_price && item.original_price > item.discounted_price;

                return (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => handlePromotionPress(item)} style={styles.slide}>
                    <Image source={{ uri: item.image_url }} style={styles.slideImage} resizeMode="cover" />
                    <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.slideOverlay}>
                      <View style={styles.slideContent}>
                        <View style={styles.textContent}>
                          <View style={styles.badgeContainer}>
                            <Feather name="zap" size={14} color="#f97316" />
                            <Text style={styles.badgeText}>HOT DEAL</Text>
                          </View>
                          <Text style={styles.title}>{item.title}</Text>
                          {item.description && <Text style={styles.description} numberOfLines={2}>{item.description}</Text>}
                          {item.promotion_type === 'product_offer' && (
                            <View>
                              {item.product_name && <Text style={styles.productNameText}>{item.product_name}</Text>}
                              <View style={styles.priceSection}>
                                {item.original_price && item.discounted_price && item.original_price > item.discounted_price ? (
                                  <>
                                    <Text style={styles.originalPriceStrikethrough}>₦{item.original_price.toLocaleString()}</Text>
                                    <Text style={styles.discountedPrice}>₦{item.discounted_price.toLocaleString()}</Text>
                                  </>
                                ) : (
                                  <Text style={styles.discountedPrice}>₦{(item.discounted_price || item.original_price || 0).toLocaleString()}</Text>
                                )}
                              </View>
                            </View>
                          )}
                          {item.promotion_type === 'combo' && (
                            <View style={styles.comboSection}>
                              <View style={styles.comboItems}>
                                <View style={styles.comboItem}>
                                  <Feather name="shopping-bag" size={12} color="#f97316" />
                                  <Text style={styles.comboItemText}>{item.buy_quantity}x {item.main_product_name}</Text>
                                </View>
                                <View style={styles.comboPlus}><Feather name="plus" size={10} color="#fff" /></View>
                                <View style={styles.comboItem}>
                                  <Feather name="gift" size={12} color="#10b981" />
                                  <Text style={[styles.comboItemText, styles.freeText]}>{item.get_quantity}x {item.free_product_name} FREE</Text>
                                </View>
                              </View>
                              {item.main_product_original_price && (
                                <View style={styles.comboPriceRow}>
                                  <Text style={styles.comboPriceLabel}>Price:</Text>
                                  <Text style={styles.comboPrice}>₦{item.main_product_original_price.toLocaleString()}</Text>
                                </View>
                              )}
                            </View>
                          )}
                          {item.promotion_type !== 'flyer' && (
                            <View style={styles.buttonContainer}>
                              <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.orderButton}>
                                <Text style={styles.orderButtonText}>Order Now</Text>
                                <Feather name="arrow-right" size={16} color="#fff" />
                              </LinearGradient>
                            </View>
                          )}
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.sliderContent}
            />
            {allSlides.length > 1 && (
              <View style={styles.paginationContainer}>
                {allSlides.map((_, index) => {
                  const inputRange = [(index - 1) * (width - 32), index * (width - 32), (index + 1) * (width - 32)];
                  const dotWidth = scrollX.interpolate({ inputRange, outputRange: [6, 20, 6], extrapolate: 'clamp' });
                  const opacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
                  return <Animated.View key={index} style={[styles.paginationDot, { width: dotWidth, opacity }]} />;
                })}
              </View>
            )}
          </View>
        )}

        {/* ── AI Time-Based Food Suggestions ── */}
        <TimedFoodSuggestions
          suggestions={suggestions}
          isLoading={suggestionsLoading}
          mealTime={mealTime}
          onProductPress={(product) => navigation.navigate('VendorDetails', { vendorId: product.vendorId })}
          onViewAll={() => navigation.navigate('CustomerTabs', { screen: 'Explore', params: { mealTimeFilter: mealTime } })}
          lockedCount={PRO_SUBSCRIPTIONS_ENABLED ? lockedCount : 0}
          isPersonalised={isPersonalised}
          onUnlock={() => navigation.navigate('Pro')}
        />

        {/* ── Categories ── */}
        {categories.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Categories</Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryChip, selectedCategory === item.name && styles.categoryChipSelected]}
                  onPress={() => setSelectedCategory(item.name)}
                >
                  <Feather name="box" size={16} color={selectedCategory === item.name ? '#f97316' : '#666'} />
                  <Text style={[styles.categoryChipText, selectedCategory === item.name && styles.categoryChipTextSelected]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.categoriesList}
            />
          </>
        )}

        {/* ── Featured Vendors ── */}
        {featuredVendors.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Feather name="star" size={18} color="#f97316" />
                <Text style={styles.sectionTitle}>Featured Vendors</Text>
              </View>
              <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('CustomerTabs', { screen: 'Vendors' })}>
                <Text style={styles.seeAllText}>See All</Text>
                <Feather name="arrow-right" size={16} color="#f97316" />
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal showsHorizontalScrollIndicator={false} data={featuredVendors}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.vendorCard} onPress={() => navigation.navigate('VendorDetails', { vendorId: item.id })}>
                  <Image source={imageSource(item.image)} style={styles.vendorImage} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.vendorGradient}>
                    <View style={styles.vendorInfo}>
                      <Text style={styles.vendorName}>{item.name}</Text>
                      <View style={styles.vendorMeta}>
                        <View style={styles.ratingContainer}>
                          <Feather name="star" size={12} color="#fbbf24" />
                          <Text style={styles.ratingText}>{item.rating?.toFixed(1)}</Text>
                        </View>
                        <Text style={styles.vendorMetaText}>• {item.deliveryTime}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.vendorsList}
            />
          </>
        )}

        {/* ── Popular Items ──
        {popularProducts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Feather name="trending-up" size={18} color="#f97316" />
                <Text style={styles.sectionTitle}>Popular Near You</Text>
              </View>
              <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('CustomerTabs', { screen: 'Explore' })}>
                <Text style={styles.seeAllText}>See All</Text>
                <Feather name="arrow-right" size={16} color="#f97316" />
              </TouchableOpacity>
            </View>
            <View style={styles.productsGrid}>
              {popularProducts.map((product: any) => (
                <TouchableOpacity key={product.id} style={styles.productCard} onPress={() => navigation.navigate('VendorDetails', { vendorId: product.vendorId })}>
                  <Image source={imageSource(product.image)} style={styles.productImage} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.productGradient}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      <View style={styles.productFooter}>
                        <Text style={styles.productPrice}>₦{product.price?.toLocaleString()}</Text>
<TouchableOpacity
  onPress={async (e) => {
    e.stopPropagation();
    await safeAddItem(product, 1);
  }}
  style={styles.addButton}
  disabled={isCheckingHealth}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  {isCheckingHealth ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : (
    <Feather name="plus" size={16} color="#fff" />
  )}
</TouchableOpacity>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )} */}



        {/* ── NEARBY PRODUCTS SECTION (REPLACE Popular Near You) ── */}
{/* ── NEARBY PRODUCTS SECTION ── */}
<View style={styles.sectionHeader}>
  <View style={styles.sectionTitleContainer}>
    <Feather name="map-pin" size={18} color="#f97316" />
    <Text style={styles.sectionTitle}>Near You</Text>
  </View>
  <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('AllVendorsMap')}>
    <Text style={styles.seeAllText}>See Map</Text>
    <Feather name="arrow-right" size={16} color="#f97316" />
  </TouchableOpacity>
</View>

{isLoadingNearby ? (
  <View style={styles.loadingNearbyContainer}>
    <ActivityIndicator size="small" color="#f97316" />
    <Text style={styles.loadingNearbyText}>Finding restaurants near you...</Text>
  </View>
) : !userLocation ? (
  <TouchableOpacity style={styles.enableLocationCard} onPress={requestLocation}>
    <Feather name="map-pin" size={20} color="#f97316" />
    <Text style={styles.enableLocationText}>Enable location to see nearby restaurants</Text>
    <Feather name="chevron-right" size={16} color="#f97316" />
  </TouchableOpacity>
) : nearbyProducts.length > 0 ? (
  <FlatList
    horizontal
    showsHorizontalScrollIndicator={false}
    data={nearbyProducts}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => (
      <TouchableOpacity 
        style={styles.nearbyProductCard}
        onPress={() => navigation.navigate('VendorDetails', { vendorId: item.vendorId })}
        activeOpacity={0.8}
      >
        <Image 
          source={imageSource(item.image)} 
          style={styles.nearbyProductImage} 
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.nearbyProductGradient}
        >
          <View style={styles.nearbyProductInfo}>
            <Text style={styles.nearbyProductName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.nearbyProductVendor} numberOfLines={1}>{item.vendorName}</Text>
            <View style={styles.nearbyProductFooter}>
              <Text style={styles.nearbyProductPrice}>₦{item.price?.toLocaleString()}</Text>
              {item.vendorDistance && (
                <View style={styles.distanceBadge}>
                  <Feather name="map-pin" size={10} color="#fff" />
                  <Text style={styles.distanceText}>{item.vendorDistance.toFixed(1)} km</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
        <TouchableOpacity
          onPress={async (e) => {
            e.stopPropagation();
            await safeAddItem(item, 1);
          }}
          style={styles.nearbyAddButton}
        >
          <Feather name="plus" size={14} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    )}
    contentContainerStyle={styles.nearbyProductsList}
  />
) : (
  <View style={styles.noNearbyContainer}>
    <Feather name="map-pin" size={24} color="#666" />
    <Text style={styles.noNearbyText}>No restaurants found nearby</Text>
    <Text style={styles.noNearbySubtext}>Try adjusting your location</Text>
  </View>
)}



        {/* ── All Vendors ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{selectedCategory === 'All' ? 'All Vendors' : `${selectedCategory} Vendors`}</Text>
          <Text style={styles.vendorCount}>{filteredVendors.length} vendors</Text>
        </View>

        {filteredVendors.length > 0 ? (
          <View style={styles.allVendorsList}>
            {filteredVendors.map((vendor: any) => (
              <TouchableOpacity key={vendor.id} style={styles.vendorListItem} onPress={() => navigation.navigate('VendorDetails', { vendorId: vendor.id })}>
                <Image source={imageSource(vendor.image)} style={styles.vendorListImage} />
                <View style={styles.vendorListInfo}>
                  <Text style={styles.vendorListName}>{vendor.name}</Text>
                  <View style={styles.vendorListMeta}>
                    <View style={styles.ratingContainer}>
                      <Feather name="star" size={12} color="#fbbf24" />
                      <Text style={styles.ratingText}>{vendor.rating?.toFixed(1)}</Text>
                    </View>
                    <Text style={styles.vendorListMetaText}>• {vendor.deliveryTime}</Text>
                    <Text style={styles.vendorListMetaText}>• Min ₦{vendor.minOrder}</Text>
                  </View>
                  <Text style={styles.vendorCuisine}>{vendor.category}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="alert-circle" size={40} color="#666" />
            <Text style={styles.emptyText}>No vendors found in this category</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingBottom: 60 },
  scrollContent: { paddingBottom: 100, paddingTop: 35 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  loadingText: { color: '#666', marginTop: 12, fontSize: 14 },
  errorContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#ef4444', fontSize: 16, marginTop: 12, marginBottom: 20 },
  retryButton: { backgroundColor: '#f97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Greeting
  greetingSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  greetingTextGroup: { flex: 1, marginRight: 12 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greetingText: { fontSize: 20, fontWeight: '700', color: '#fff', flexShrink: 1 },
  subtitleText: { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },
  messageButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  unreadBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  unreadBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },

  // Quick Actions
  quickActions: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24, height: 120 },
  quickActionCard: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  quickActionGradient: { padding: 16, flex: 1 },
  quickActionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  quickActionTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 4 },
  quickActionSubtitle: { fontSize: 11, color: '#666' },
  verticalPromoContainer: { flex: 1, position: 'relative' },
  verticalPromoCard: { borderRadius: 16, overflow: 'hidden', height: '100%' },
  verticalPromoGradient: { padding: 10, alignItems: 'center', justifyContent: 'center', flex: 1 },
  verticalPromoIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  verticalPromoTitle: { fontSize: 13, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 2 },
  verticalPromoSubtitle: { fontSize: 10, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 6 },
  verticalPromoArrow: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  verticalPaginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 8, left: 0, right: 0, gap: 4 },
  verticalPaginationDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  verticalPaginationDotActive: { width: 12, height: 4, borderRadius: 2, backgroundColor: '#fff' },

  // Slider
  sliderContainer: { marginBottom: 24, paddingHorizontal: 16 },
  sliderContent: { paddingHorizontal: 0 },
  slide: { width: width - 32, height: 220, borderRadius: 20, overflow: 'hidden' },
  slideImage: { width: '100%', height: '100%' },
  slideOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
  referralSlide: { overflow: 'hidden' },
  referralArt: { position: 'absolute', right: -6, bottom: -6 },
  slideContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  textContent: { flex: 1, gap: 8 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(249,115,22,0.2)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#f97316', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  description: { fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 16, marginBottom: 4 },
  priceSection: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  originalPriceStrikethrough: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecorationLine: 'line-through' },
  discountedPrice: { fontSize: 24, fontWeight: 'bold', color: '#f97316', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  minOrderText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: 8 },
  productNameText: { fontSize: 14, fontWeight: '500', color: '#fff', marginBottom: 4 },
  comboSection: { marginTop: 4, gap: 6 },
  comboItems: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  comboItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16 },
  comboItemText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  freeText: { color: '#10b981' },
  comboPlus: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  comboPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  comboPriceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  comboPrice: { fontSize: 24, fontWeight: 'bold', color: '#f97316' },
  buttonContainer: { marginTop: 12 },
  orderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, alignSelf: 'flex-start' },
  orderButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 10, left: 0, right: 0 },
  paginationDot: { height: 6, borderRadius: 3, backgroundColor: '#f97316', marginHorizontal: 4 },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontSize: 13, color: '#f97316' },
  categoriesList: { paddingHorizontal: 20, gap: 8, marginBottom: 24 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, gap: 6 },
  categoryChipSelected: { backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: '#f97316' },
  categoryChipText: { fontSize: 13, color: '#666' },
  categoryChipTextSelected: { color: '#f97316' },
  vendorsList: { paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  vendorCard: { width: 200, height: 150, borderRadius: 16, marginRight: 12, overflow: 'hidden' },
  vendorImage: { width: '100%', height: '100%', position: 'absolute' },
  vendorGradient: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  vendorInfo: { gap: 4 },
  vendorName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  vendorMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, color: '#fff' },
  vendorMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 24 },
  productCard: { width: '47%', height: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  productImage: { width: '100%', height: '100%', position: 'absolute' },
  productGradient: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  productInfo: { gap: 4 },
  productName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 13, fontWeight: '600', color: '#f97316' },
  addButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' },
  allVendorsList: { paddingHorizontal: 20, gap: 12 },
  vendorListItem: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, gap: 12 },
  vendorListImage: { width: 60, height: 60, borderRadius: 8 },
  vendorListInfo: { flex: 1, justifyContent: 'center' },
  vendorListName: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 4 },
  vendorListMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  vendorListMetaText: { fontSize: 11, color: '#666' },
  vendorCuisine: { fontSize: 11, color: '#f97316' },
  vendorCount: { fontSize: 13, color: '#666' },
  emptyContainer: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 8 },
  // Add these styles to your existing styles object:

loadingNearbyContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 30,
  gap: 10,
},
loadingNearbyText: {
  color: '#666',
  fontSize: 13,
},
enableLocationCard: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  backgroundColor: '#1a1a1a',
  marginHorizontal: 16,
  padding: 16,
  borderRadius: 12,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: 'rgba(249,115,22,0.3)',
},
enableLocationText: {
  color: '#f97316',
  fontSize: 13,
  fontWeight: '500',
},

nearbyProductsList: {
  paddingLeft: 16,
  paddingRight: 8,
  gap: 12,
},
nearbyProductCard: {
  width: 160,
  height: 220, // Increased height to fit everything
  borderRadius: 16,
  overflow: 'hidden',
  backgroundColor: '#1a1a1a',
  marginRight: 12,
  position: 'relative',
},
nearbyProductImage: {
  width: '100%',
  height: '100%',
  position: 'absolute',
},
nearbyProductGradient: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: 12,
  paddingBottom: 40, // Space for add button
},
nearbyProductInfo: {
  gap: 4,
},
nearbyProductName: {
  fontSize: 14,
  fontWeight: '600',
  color: '#fff',
},
nearbyProductVendor: {
  fontSize: 11,
  color: '#aaa',
},
nearbyProductFooter: {
  flexDirection: 'column',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 4,
  flexWrap: 'wrap',
  gap: 4,
},
nearbyProductPrice: {
  fontSize: 13,
  fontWeight: '700',
  color: '#f97316',
},
distanceBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 3,
  backgroundColor: 'rgba(0,0,0,0.6)',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 10,
},
distanceText: {
  fontSize: 9,
  color: '#fff',
},
nearbyAddButton: {
  position: 'absolute',
  bottom: 12,
  right: 12,
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: '#f97316',
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
  zIndex: 10,
}, 
noNearbyContainer:{
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},

noNearbyText:{
  color: '#666',
  fontSize: 16,
  marginTop: 8,
},
noNearbySubtext:{
  color: '#666',
  fontSize: 13,
  marginTop: 4,
  textAlign: 'center',
}


});
