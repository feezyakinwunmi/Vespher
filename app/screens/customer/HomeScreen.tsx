// screens/customer/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
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
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [greeting, setGreeting] = useState('Good afternoon');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  // Use your hooks
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { 
    vendors, 
    isLoading: vendorsLoading, 
    error: vendorsError,
    refresh: refreshVendors,
    getVendorsByCategory 
  } = useVendors();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshVendors();
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

  const handleAddToCart = (product: any, event: any) => {
    event.stopPropagation(); // Prevent triggering the parent press
    addItem(product, 1);
    showToast( `${product.name} added to cart`);
  };

  const handleVendorPress = (vendorId: string) => {
    navigation.navigate('VendorDetails', { vendorId });
  };

  const handleProductPress = (vendorId: string) => {
    navigation.navigate('VendorDetails', { vendorId });
  };

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
          <Text style={styles.greetingText}>{greeting},</Text>
          <Text style={styles.nameText}>
            {firstName}! <Text style={styles.cravingText}>What's your craving?</Text>
          </Text>
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

        {/* Promotional Banner */}
        <LinearGradient
          colors={['#f97316', '#f43f5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>New User Offer</Text>
            </View>
            <Text style={styles.bannerTitle}>Get 20% OFF</Text>
            <Text style={styles.bannerSubtitle}>On your first order above ₦3000</Text>
            <TouchableOpacity style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>Order Now</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bannerDecoration1} />
          <View style={styles.bannerDecoration2} />
        </LinearGradient>

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
                    name={item.icon as any} 
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

        {/* Featured Vendors - Now Clickable */}
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
                  onPress={() => handleVendorPress(item.id)}
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

        {/* Popular Items - Now with Add to Cart Button */}
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
                  onPress={() => handleProductPress(product.vendorId)}
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
                          onPress={(e) => handleAddToCart(product, e)}
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
                onPress={() => handleVendorPress(vendor.id)}
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
  },
  scrollContent: {
    paddingBottom: 100,
    paddingTop:30,
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
  greetingSection: {
    flexDirection: 'column',
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
  banner: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
  },
  bannerContent: {
    position: 'relative',
    zIndex: 10,
  },
  bannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  bannerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  bannerButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '600',
  },
  bannerDecoration1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bannerDecoration2: {
    position: 'absolute',
    bottom: -20,
    right: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
});