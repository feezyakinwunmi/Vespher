// app/screens/customer/HomeScreen.tsx
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { useCategories } from '../../hooks/customer/useCategories';
import { useVendors } from '../../hooks/customer/useVendors';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';


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
  original_price?: number; // From the product table
  product_name?: string;
  // Combo fields
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

export function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { addItem, items, vendorId: cartVendorId, clearCart } = useCart();
  const [greeting, setGreeting] = useState('Good afternoon');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
const [isFirstOrder, setIsFirstOrder] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [unreadCount, setUnreadCount] = useState(0);

// First order promotion object
const firstOrderPromotion = {
  id: 'first-order',
  title: 'First Order Offer',
  description: 'Get 10% off + FREE delivery on your first order',
  image_url: require('../../assets/buggerbg.jpg'),
  promotion_type: 'first_order',
  vendor_id: null,
  vendor_name: null,
  discounted_price: null,
  original_price: null,
  is_first_order: true,
  discount_percentage: 10,
  min_order_amount: 10000,
};
  // Use your hooks
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { 
    vendors, 
    isLoading: vendorsLoading, 
    error: vendorsError,
    refresh: refreshVendors,
    getVendorsByCategory 
  } = useVendors();


// Fetch active promotions
const fetchPromotions = async () => {
  try {
    setLoadingPromotions(true);
    const { data, error } = await supabase
      .from('promotions')
      .select(`
        *,
        vendor:vendor_id (name),
        products:product_id (id, name, price),
        main_product:main_product_id (id, name, price),
        free_product:free_product_id (id, name, price)
      `)
      .eq('status', 'active')
      .lte('start_date', new Date().toISOString())
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('📢 Promotions fetched:', data?.length);
    
    const processedPromos = data?.map(promo => {
      console.log(`Processing promotion: ${promo.title}`, {
        type: promo.promotion_type,
        product_id: promo.product_id,
        product_price: promo.products?.price,
        discounted_price: promo.discounted_price,
        main_product_price: promo.main_product?.price,
        main_product_id: promo.main_product_id
      });
      
      // For combo promotions, if main_product is null but we have main_product_original_price,
      // create a placeholder name using the price
      let mainProductName = promo.main_product?.name;
      let freeProductName = promo.free_product?.name;
      
      if (promo.promotion_type === 'combo') {
        if (!mainProductName && promo.main_product_original_price) {
          mainProductName = `Item (₦${promo.main_product_original_price.toLocaleString()})`;
        }
        if (!freeProductName && promo.free_product_original_price) {
          freeProductName = `Free Item (₦${promo.free_product_original_price.toLocaleString()})`;
        }
      }
      
      return {
        ...promo,
        vendor_name: promo.vendor?.name,
        product_name: promo.products?.name,
        // For product offer: original price from the product table
        original_price: promo.products?.price, 
        discounted_price: promo.discounted_price,
        // For combo: get prices from main_product or use stored values
        main_product_name: mainProductName,
        main_product_original_price: promo.main_product?.price || promo.main_product_original_price,
        free_product_name: freeProductName,
        free_product_original_price: promo.free_product?.price || promo.free_product_original_price,
      };
    }) || [];

    setPromotions(processedPromos);
    
    // Log final processed data
    processedPromos.forEach(promo => {
      console.log(`🎯 Final Promotion: ${promo.title}`, {
        type: promo.promotion_type,
        original_price: promo.original_price,
        discounted_price: promo.discounted_price,
        main_product_original_price: promo.main_product_original_price,
        main_product_name: promo.main_product_name
      });
    });
    
  } catch (error) {
    console.error('Error fetching promotions:', error);
  } finally {
    setLoadingPromotions(false);
  }
};


// Fetch unread messages for customer
const fetchUnreadMessages = async () => {
  if (!user?.id) return;
  
  try {
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .contains('participants', [user.id]);

    if (convError || !conversations || conversations.length === 0) {
      setUnreadCount(0);
      return;
    }

    const conversationIds = conversations.map(c => c.id);

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .eq('read', false)
      .neq('sender_id', user.id);

    if (!error) {
      setUnreadCount(count || 0);
    }
  } catch (error) {
    console.error('Error fetching unread messages:', error);
  }
};
// Combine promotions with first order offer
const allSlides = isFirstOrder ? [firstOrderPromotion, ...promotions] : promotions;
// Check if user is first time
useEffect(() => {
  const checkFirstOrder = async () => {
    if (!user?.id) return;
    
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', user.id);
    
    setIsFirstOrder(count === 0);
  };
  
  checkFirstOrder();
}, [user?.id]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    
    fetchPromotions();
  }, []);

  // Auto-slide effect
  useEffect(() => {
    if (promotions.length <= 1) return;
    
    const interval = setInterval(() => {
      let nextSlide = currentSlide + 1;
      if (nextSlide >= promotions.length) {
        nextSlide = 0;
      }
      flatListRef.current?.scrollToIndex({ index: nextSlide, animated: true });
      setCurrentSlide(nextSlide);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [currentSlide, promotions.length]);



  // Fetch unread messages on mount
useEffect(() => {
  fetchUnreadMessages();
  
  // Real-time subscription for new messages
  const subscription = supabase
    .channel('customer-messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      () => {
        fetchUnreadMessages();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [user?.id]);

// Refresh unread count when screen comes into focus
useFocusEffect(
  React.useCallback(() => {
    fetchUnreadMessages();
  }, [])
);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshVendors();
    await fetchPromotions();
    setRefreshing(false);
  };

  const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  const firstName = user?.name?.split(' ')[0] || 'there';

  // Get filtered vendors based on selected category
  const filteredVendors = getVendorsByCategory(selectedCategory);
  
  // Get featured vendors (top 4 rated)
  const featuredVendors = vendors.slice(0, 4);

  // Get popular products from all vendors
  const popularProducts = vendors
    .flatMap(v => v.products)
    .filter(p => p.isPopular)
    .slice(0, 4);

  const isLoading = categoriesLoading || vendorsLoading;


const handlePromotionPress = async (promotion: Promotion) => {
  // Increment click count
  await supabase.rpc('increment_promotion_click', { promo_id: promotion.id });
  
  if (promotion.promotion_type === 'flyer') {
    // Flyer: open vendor page
    navigation.navigate('VendorDetails', { vendorId: promotion.vendor_id });
  } else if (promotion.promotion_type === 'product_offer' && promotion.product_id) {
    // Product offer: add to cart with discounted price
    if (cartVendorId && cartVendorId !== promotion.vendor_id) {
      Alert.alert(
        'Clear Cart?',
        'Your cart already has items from another vendor. Clear cart and add this item?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Add',
            onPress: async () => {
              clearCart();
              await addPromotionToCart(promotion);
            }
          }
        ]
      );
    } else {
      await addPromotionToCart(promotion);
    }
  } else if (promotion.promotion_type === 'combo') {
    // Combo: add combo items to cart
    if (cartVendorId && cartVendorId !== promotion.vendor_id) {
      Alert.alert(
        'Clear Cart?',
        'Your cart already has items from another vendor. Clear cart and add this combo?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Add',
            onPress: async () => {
              clearCart();
              await addComboToCart(promotion);
            }
          }
        ]
      );
    } else {
      await addComboToCart(promotion);
    }
  }
};

const addPromotionToCart = async (promotion: Promotion) => {
  // Ensure we have a valid price - use discounted_price, fallback to original_price, fallback to 0
  const discountedPrice = promotion.discounted_price || promotion.original_price || 0;
  const originalPrice = promotion.original_price || discountedPrice;
  
  console.log('🔍 Adding promotion to cart:', {
    id: promotion.product_id,
    name: promotion.product_name,
    discountedPrice,
    originalPrice,
    promotion_discounted_price: promotion.discounted_price,
    promotion_original_price: promotion.original_price,
    type: promotion.promotion_type
  });
  
  // Create a product object that matches the Product interface
  const promoProduct = {
    id: promotion.product_id || '',
    name: promotion.product_name || promotion.title,
    description: promotion.description || '',
    price: discountedPrice, // This is the key field for cart price
    originalPrice: originalPrice,
    original_price: originalPrice, // For compatibility
    image: promotion.image_url,
    image_url: promotion.image_url, // For compatibility
    category: 'promotion',
    isAvailable: true,
    is_available: true, // For compatibility
    vendorId: promotion.vendor_id,
    vendorName: promotion.vendor_name,
    is_popular: false,
    preparation_time: 20,
    preparationTime: 20, // For compatibility
    options: [],
    // Promo tracking fields
    is_promotion: true,
    promotion_id: promotion.id,
    promotion_price: discountedPrice,
    max_quantity: promotion.max_per_customer || 1
  };
  
  console.log('📦 Adding to cart product:', promoProduct);
  console.log('💰 Price being added:', promoProduct.price);
  
  addItem(promoProduct, 1);
  showToast(`Added ${promotion.product_name || promotion.title} to cart for ₦${discountedPrice.toLocaleString()}!`);
  
  // Increment conversion count
  await supabase.rpc('increment_promotion_conversion', { promo_id: promotion.id });
  
  // Navigate to cart
  navigation.navigate('Cart');
};

const addComboToCart = async (promotion: Promotion) => {
  const mainProductPrice = promotion.main_product_original_price || 0;
  const mainProductName = promotion.main_product_name || `Item (₦${mainProductPrice.toLocaleString()})`;
  const freeProductName = promotion.free_product_name || `Free Item`;
  
  const mainProduct = {
    id: promotion.main_product_id || `combo_main_${promotion.id}`,
    name: mainProductName,
    description: promotion.description || `Buy ${promotion.buy_quantity} get ${promotion.get_quantity} ${freeProductName} free`,
    price: mainProductPrice,
    originalPrice: mainProductPrice,
    original_price: mainProductPrice,
    image: promotion.image_url,
    image_url: promotion.image_url,
    category: 'promotion',
    isAvailable: true,
    is_available: true,
    vendorId: promotion.vendor_id,
    vendorName: promotion.vendor_name,
    is_popular: false,
    preparation_time: 20,
    preparationTime: 20,
    options: [],
    promotion_id: promotion.id,
    is_promotion: true,
    is_combo_main: true,  // Important: Marks this as the main combo item
    is_free_item: false,
    max_quantity: promotion.max_per_customer || 1,
    combo_details: {
      buy_quantity: promotion.buy_quantity || 1,
      get_quantity: promotion.get_quantity || 1,
      free_product_name: freeProductName
    }
  };
  
  const freeProduct = {
    id: promotion.free_product_id || `combo_free_${promotion.id}`,
    name: freeProductName,
    description: `Free with purchase of ${mainProductName}`,
    price: 0,
    originalPrice: promotion.free_product_original_price || 0,
    original_price: promotion.free_product_original_price || 0,
    image: promotion.image_url,
    image_url: promotion.image_url,
    category: 'promotion',
    isAvailable: true,
    is_available: true,
    vendorId: promotion.vendor_id,
    vendorName: promotion.vendor_name,
    is_popular: false,
    preparation_time: 20,
    preparationTime: 20,
    options: [],
    promotion_id: promotion.id,
    is_promotion: true,
    is_combo_main: false,
    is_free_item: true,  // Important: Marks this as the free combo item
    max_quantity: promotion.max_per_customer || 1
  };
  
  // Add both items
  addItem(mainProduct, promotion.buy_quantity || 1);
  if (freeProduct && promotion.get_quantity) {
    addItem(freeProduct, promotion.get_quantity);
  }
  
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
    if (viewableItems.length > 0) {
      setCurrentSlide(viewableItems[0].index);
    }
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

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <View><Text style={styles.greetingText}>{greeting},</Text>
          <Text style={styles.nameText}>
            {firstName}! <Text style={styles.cravingText}>What's your craving?</Text>
          </Text>
          </View>
          

           <TouchableOpacity 
      onPress={() => navigation.navigate('Messaging')}
      style={styles.messageButton}
    >
      <Feather name="message-circle" size={22} color="#f97316" />
      {unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Vendors')}
          >
            <LinearGradient
              colors={['rgba(249,115,22,0.2)', 'rgba(249,115,22,0.05)']}
              style={styles.quickActionGradient}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(249,115,22,0.2)' }]}>
                <Feather name="zap" size={20} color="#f97316" />
              </View>
              <Text style={styles.quickActionTitle}>Order Food</Text>
              <Text style={styles.quickActionSubtitle}>From {vendors.length}+ vendors</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Orders')}
          >
            <LinearGradient
              colors={['rgba(244,63,94,0.2)', 'rgba(244,63,94,0.05)']}
              style={styles.quickActionGradient}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(244,63,94,0.2)' }]}>
                <Feather name="clock" size={20} color="#f43f5e" />
              </View>
              <Text style={styles.quickActionTitle}>Track Order</Text>
              <Text style={styles.quickActionSubtitle}>See live updates</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>


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
        // Handle first order promotion
        if (item.promotion_type === 'first_order') {
          return (
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => navigation.navigate('Explore')}
              style={styles.slide}
            >
              <Image
                source={item.image_url}
                style={styles.slideImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.slideOverlay}
              >
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
                      <LinearGradient
                        colors={['#f97316', '#f43f5e']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.orderButton}
                      >
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
        
        // Calculate if there's a discount to show original price
        const hasDiscount = item.promotion_type === 'product_offer' && 
                           item.original_price && 
                           item.discounted_price && 
                           item.original_price > item.discounted_price;
        
        return (
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => handlePromotionPress(item)}
            style={styles.slide}
          >
            <Image
              source={{ uri: item.image_url }}
              style={styles.slideImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.slideOverlay}
            >
              <View style={styles.slideContent}>
                <View style={styles.textContent}>
                  <View style={styles.badgeContainer}>
                    <Feather name="zap" size={14} color="#f97316" />
                    <Text style={styles.badgeText}>HOT DEAL</Text>
                  </View>
                  
                  <Text style={styles.title}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.description} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  
                  {/* Price Section for Product Offer */}
                 {/* Price Section for Product Offer */}
{item.promotion_type === 'product_offer' && (
  <View>
    {/* Show Product Name */}
    {item.product_name && (
      <Text style={styles.productNameText}>{item.product_name}</Text>
    )}
    <View style={styles.priceSection}>
      {item.original_price && item.discounted_price && item.original_price > item.discounted_price ? (
        <>
          <Text style={styles.originalPriceStrikethrough}>
            ₦{item.original_price.toLocaleString()}
          </Text>
          <Text style={styles.discountedPrice}>
            ₦{item.discounted_price.toLocaleString()}
          </Text>
        </>
      ) : (
        <Text style={styles.discountedPrice}>
          ₦{(item.discounted_price || item.original_price || 0).toLocaleString()}
        </Text>
      )}
    </View>
  </View>
)}

                  {/* Combo Section */}
                  {item.promotion_type === 'combo' && (
                    <View style={styles.comboSection}>
                      <View style={styles.comboItems}>
                        <View style={styles.comboItem}>
                          <Feather name="shopping-bag" size={12} color="#f97316" />
                          <Text style={styles.comboItemText}>
                            {item.buy_quantity}x {item.main_product_name}
                          </Text>
                        </View>
                        <View style={styles.comboPlus}>
                          <Feather name="plus" size={10} color="#fff" />
                        </View>
                        <View style={styles.comboItem}>
                          <Feather name="gift" size={12} color="#10b981" />
                          <Text style={[styles.comboItemText, styles.freeText]}>
                            {item.get_quantity}x {item.free_product_name} FREE
                          </Text>
                        </View>
                      </View>
                      
                      {item.main_product_original_price && (
                        <View style={styles.comboPriceRow}>
                          <Text style={styles.comboPriceLabel}>Price:</Text>
                          <Text style={styles.comboPrice}>
                            ₦{item.main_product_original_price.toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {/* Order Now Button */}
                  {item.promotion_type !== 'flyer' && (
                    <View style={styles.buttonContainer}>
                      <LinearGradient
                        colors={['#f97316', '#f43f5e']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.orderButton}
                      >
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
    
    {/* Pagination Dots */}
    {allSlides.length > 1 && (
      <View style={styles.paginationContainer}>
        {allSlides.map((_, index) => {
          const inputRange = [(index - 1) * (width - 32), index * (width - 32), (index + 1) * (width - 32)];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [6, 20, 6],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={index}
              style={[styles.paginationDot, { width: dotWidth, opacity }]}
            />
          );
        })}
      </View>
    )}
  </View>
)}

        {/* Categories */}
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
                  style={[
                    styles.categoryChip,
                    selectedCategory === item.name && styles.categoryChipSelected,
                  ]}
                  onPress={() => setSelectedCategory(item.name)}
                >
                  <Feather 
                    name='box'
                    size={16} 
                    color={selectedCategory === item.name ? '#f97316' : '#666'} 
                  />
                  <Text style={[
                    styles.categoryChipText,
                    selectedCategory === item.name && styles.categoryChipTextSelected,
                  ]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.categoriesList}
            />
          </>
        )}

        {/* Featured Vendors */}
        {featuredVendors.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Feather name="star" size={18} color="#f97316" />
                <Text style={styles.sectionTitle}>Featured Vendors</Text>
              </View>
              <TouchableOpacity 
                style={styles.seeAllButton}
                onPress={() => navigation.navigate('Vendors')}
              >
                <Text style={styles.seeAllText}>See All</Text>
                <Feather name="arrow-right" size={16} color="#f97316" />
              </TouchableOpacity>
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={featuredVendors}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.vendorCard}
                  onPress={() => navigation.navigate('VendorDetails', { vendorId: item.id })}
                >
                  <Image 
                    source={{ uri: item.image || 'https://via.placeholder.com/200x150' }} 
                    style={styles.vendorImage} 
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.vendorGradient}
                  >
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

        {/* Popular Items */}
        {popularProducts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Feather name="trending-up" size={18} color="#f97316" />
                <Text style={styles.sectionTitle}>Popular Near You</Text>
              </View>
              <TouchableOpacity 
                style={styles.seeAllButton}
                onPress={() => navigation.navigate('Explore')}
              >
                <Text style={styles.seeAllText}>See All</Text>
                <Feather name="arrow-right" size={16} color="#f97316" />
              </TouchableOpacity>
            </View>

            <View style={styles.productsGrid}>
              {popularProducts.map((product) => (
                <TouchableOpacity 
                  key={product.id} 
                  style={styles.productCard}
                  onPress={() => navigation.navigate('VendorDetails', { vendorId: product.vendorId })}
                >
                  <Image 
                    source={{ uri: product.image || 'https://via.placeholder.com/100' }} 
                    style={styles.productImage} 
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.productGradient}
                  >
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      <View style={styles.productFooter}>
                        <Text style={styles.productPrice}>₦{product.price?.toLocaleString()}</Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            addItem(product, 1);
                            showToast(`${product.name} added to cart`);
                          }}
                          style={styles.addButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Feather name="plus" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* All Vendors by Category */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'All' ? 'All Vendors' : `${selectedCategory} Vendors`}
          </Text>
          <Text style={styles.vendorCount}>{filteredVendors.length} vendors</Text>
        </View>

        {filteredVendors.length > 0 ? (
          <View style={styles.allVendorsList}>
            {filteredVendors.map((vendor) => (
              <TouchableOpacity 
                key={vendor.id} 
                style={styles.vendorListItem}
                onPress={() => navigation.navigate('VendorDetails', { vendorId: vendor.id })}
              >
                <Image 
                  source={{ uri: vendor.image || 'https://via.placeholder.com/60' }} 
                  style={styles.vendorListImage} 
                />
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
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingBottom: 60,
  },
  messageHeader: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  paddingHorizontal: 16,
  paddingVertical: 8,
  backgroundColor: 'white',
  marginTop:20,
},
messageButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: '#1a1a1a',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
},
unreadBadge: {
  position: 'absolute',
  top: -2,
  right: -2,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: '#ef4444',
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 4,
},
unreadBadgeText: {
  fontSize: 10,
  fontWeight: 'bold',
  color: '#fff',
},
  scrollContent: {
    paddingBottom: 100,
    paddingTop: 35,
  },
  minOrderText: {
  fontSize: 12,
  color: 'rgba(255,255,255,0.8)',
  marginTop: 4,
  marginBottom: 8,
},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
  },
  productNameText: {
  fontSize: 14,
  fontWeight: '500',
  color: '#fff',
  marginBottom: 4,
},
  comboContainer: {
  alignItems: 'center',
  marginBottom: 12,
  gap: 6,
},
comboPriceRow: {
  flexDirection: 'row',
  alignItems: 'baseline',
  gap: 8,
},
comboPriceLabel: {
  fontSize: 14,
  color: 'rgba(255,255,255,0.8)',
},
comboPrice: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#f97316',
},
comboFreeText: {
  fontSize: 12,
  color: '#10b981',
  fontWeight: '500',
},
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greetingText: {
    fontSize: 14,
    color: '#666',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  cravingText: {
    color: '#f97316',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickActionGradient: {
    padding: 16,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 11,
    color: '#666',
  },
  slideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
  },
  slideBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
  },
  slideSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  slideButtonContainer: {
    marginTop: 8,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  slideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    gap: 8,
  },
  slideButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
  },
  
  paginationDot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316',
    marginHorizontal: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: '#f97316',
  },
  categoriesList: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#f97316',
  },
  vendorsList: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  vendorCard: {
    width: 200,
    height: 150,
    borderRadius: 16,
    marginRight: 12,
    overflow: 'hidden',
  },
  vendorImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  vendorGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  vendorInfo: {
    gap: 4,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  vendorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#fff',
  },
  vendorMetaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  productCard: {
    width: '47%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  productImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  productGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  productInfo: {
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allVendorsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  vendorListItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  vendorListImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  vendorListInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  vendorListName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  vendorListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  vendorListMetaText: {
    fontSize: 11,
    color: '#666',
  },
  vendorCuisine: {
    fontSize: 11,
    color: '#f97316',
  },
  vendorCount: {
    fontSize: 13,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 8,
  },


priceContainer: {
  flexDirection: 'row',
  alignItems: 'baseline',
  gap: 8,
  marginBottom: 12,
},
originalPrice: {
  fontSize: 14,
  color: 'rgba(255,255,255,0.6)',
  textDecorationLine: 'line-through',
},
discountedPrice: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#f97316',
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 1, height: 1 },
  textShadowRadius: 3,
},
comboBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(16,185,129,0.3)',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 20,
  marginBottom: 12,
  gap: 6,
},
comboBadgeText: {
  fontSize: 12,
  fontWeight: '600',
  color: '#10b981',
},
sliderContainer: {
  marginBottom: 24,
  paddingHorizontal: 16,
},
sliderContent: {
  paddingHorizontal: 0,
},
slide: {
  width: width - 32,
  height: 220,
  borderRadius: 20,
  overflow: 'hidden',
},
slideImage: {
  width: '100%',
  height: '100%',
},
slideOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'center',
},
slideContent: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 20,
},
textContent: {
  flex: 1,
  gap: 8,
},
badgeContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  backgroundColor: 'rgba(249,115,22,0.2)',
  alignSelf: 'flex-start',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 20,
},
badgeText: {
  fontSize: 10,
  fontWeight: 'bold',
  color: '#f97316',
  letterSpacing: 0.5,
},
title: {
  fontSize: 22,
  fontWeight: 'bold',
  color: '#fff',
  marginTop: 4,
  textShadowColor: 'rgba(0,0,0,0.3)',
  textShadowOffset: { width: 1, height: 1 },
  textShadowRadius: 2,
},
description: {
  fontSize: 12,
  color: 'rgba(255,255,255,0.9)',
  lineHeight: 16,
  marginBottom: 4,
},
priceSection: {
  flexDirection: 'row',
  alignItems: 'baseline',
  gap: 8,
  marginTop: 4,
},

originalPriceStrikethrough: {
  fontSize: 14,
  color: 'rgba(255,255,255,0.6)',
  textDecorationLine: 'line-through',
},


price: {
  fontSize: 28,
  fontWeight: 'bold',
  color: '#f97316',
},
comboSection: {
  marginTop: 4,
  gap: 6,
},
comboItems: {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
},
comboItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  backgroundColor: 'rgba(0,0,0,0.5)',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 16,
},
comboItemText: {
  fontSize: 11,
  color: '#fff',
  fontWeight: '500',
},
freeText: {
  color: '#10b981',
},
comboPlus: {
  width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: 'rgba(255,255,255,0.2)',
  justifyContent: 'center',
  alignItems: 'center',
},

buttonContainer: {
  marginTop: 12,
},
orderButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 30,
  alignSelf: 'flex-start',
},
orderButtonText: {
  color: '#fff',
  fontSize: 13,
  fontWeight: '600',
},

});