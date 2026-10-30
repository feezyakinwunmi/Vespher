// app/screens/customer/VendorDetailsScreen.tsx
import type { ScrollViewInstance } from 'react-native';
import { imageSource } from '../../utils/images';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useVendors } from '../../hooks/customer/useVendors';
import { useFavorites } from '../../hooks/customer/useFavorites';
import { ProductCard } from '../../components/customer/ProductCard';
import { RootStackParamList } from '../../navigation/types';
import { VendorMap } from '../../components/VendorMap';
import { useLocation } from '../../contexts/LocationContext';
import { HealthWarningModal } from '../../components/customer/HealthWarningModal';
import { ProductDetailsModal } from '../../components/customer/ProductDetailsModal';
import { HealthCheckResult } from '../../hooks/customer/useHealthCheck';
import Toast from 'react-native-toast-message';
const { width } = Dimensions.get('window');

type VendorDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function VendorDetailsScreen() {
  const navigation = useNavigation<VendorDetailsScreenNavigationProp>();
  const route = useRoute();
  const { vendorId } = route.params as { vendorId: string };
  
  const { user } = useAuth();
  const { allVendors: vendors } = useVendors();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { items, getSubtotal, vendorId: cartVendorId, addItem } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [coverImageError, setCoverImageError] = useState(false);
  const [logoImageError, setLogoImageError] = useState(false);
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const [healthModalVisible, setHealthModalVisible] = useState(false);
const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);
const [pendingProduct, setPendingProduct] = useState<any>(null);
const [detailsProduct, setDetailsProduct] = useState<any>(null);

  const vendor = vendors.find(v => v.id === vendorId);
  const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState(vendor?.deliveryFee || 500);

  const handleDistanceCalculated = (distance: number, fee: number) => {
    setDynamicDeliveryFee(fee);
  };

  useEffect(() => {
    if (!vendor && vendors.length > 0) {
      const timer = setTimeout(() => {
        navigation.goBack();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [vendor, vendors.length, navigation]);

  if (!vendor) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading vendor...</Text>
      </View>
    );
  }

  // Opened from a favourite, old link or notification while the shop is closed.
  if (!vendor.isOpen) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { paddingHorizontal: 32 }]}>
        <Feather name="moon" size={40} color="#f97316" />
        <Text style={[styles.loadingText, { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16 }]}>{vendor.name} is closed</Text>
        <Text style={[styles.loadingText, { textAlign: 'center', marginTop: 6 }]}>
          They aren't taking orders right now. Check back later or order from another shop.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f97316' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Browse other shops</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
// Add this function before your component
const getCoverImageUrl = (vendorId: string) => {
  // You can either:
  // Option 1: Return a default cover
  return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800';
  
  // Option 2: Try to construct the URL if you know the filename pattern
  // But since filenames have timestamps, you can't guess it
};

const handleHealthWarning = (product: any, result: any) => {
  setPendingProduct(product);
  setHealthCheckResult(result);
  setHealthModalVisible(true);
};

const handleOrderAnyway = async () => {
  if (pendingProduct) {
    await addItem(pendingProduct, 1);
    Toast.show({
      type: 'success',
      text1: `${pendingProduct.name} added to cart`,
      position: 'bottom',
      visibilityTime: 2000,
    });
  }
  setHealthModalVisible(false);
  setPendingProduct(null);
  setHealthCheckResult(null);
};

const handleGoBack = () => {
  setHealthModalVisible(false);
  setPendingProduct(null);
  setHealthCheckResult(null);
};
  const isFav = isFavorite(vendor.id);
  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = getSubtotal();

  // Get unique categories from products
  const categories = ['All', ...new Set(vendor.products.map(p => p.category))];

  // Filter products
  const filteredProducts = vendor.products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory && product.isAvailable;
  });

  // Group products by category
  const groupedProducts = selectedCategory === 'All'
    ? categories.slice(1).reduce((acc, category) => {
        const products = filteredProducts.filter(p => p.category === category);
        if (products.length > 0) {
          acc[category] = products;
        }
        return acc;
      }, {} as Record<string, typeof filteredProducts>)
    : { [selectedCategory]: filteredProducts };

  const handleFavoriteClick = async () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    await toggleFavorite(vendor.id);
  };

  // ✅ Use separate images for cover and logo
// Replace line 113 with this:
const coverImage = vendor.coverImage || vendor.businessCover || vendor.coverImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800';
const logoImage = vendor.logo || vendor.image_url || vendor.image || vendor.businessLogo || null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
          {/* Cover Image */}
          <View style={styles.coverContainer}>
            <Image 
              source={{ uri: coverImage }} 
              style={styles.coverImage}
 onError={(e) => {
    console.log('Cover image failed to load:', coverImage, e.nativeEvent.error);
    setCoverImageError(true);
  }}            />
            <LinearGradient
              colors={['transparent', '#0a0a0a']}
              style={styles.coverGradient}
            />
            
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={handleFavoriteClick}
                style={[styles.actionButton, isFav && styles.favoriteButton]}
              >
                <Feather 
                  name="heart" 
                  size={20} 
                  color={isFav ? '#fff' : '#fff'} 
                  style={isFav && styles.favoriteIcon}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Feather name="share-2" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Vendor Info Overlay - Now shows logo image */}
            <View style={styles.vendorOverlay}>
              <View style={styles.vendorLogoContainer}>
                <Image 
                  source={imageSource(logoImage)} 
                  style={styles.vendorLogo}
                  onError={() => setLogoImageError(true)}
                />
              </View>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{vendor.name}</Text>
                <Text style={styles.vendorCategory}>{vendor.category}</Text>
              </View>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Feather name="star" size={16} color="#fbbf24" />
              <Text style={styles.statText}>{vendor.rating?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.statSubtext}>({vendor.reviewCount || 0})</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Feather name="clock" size={16} color="#666" />
              <Text style={styles.statText}>{vendor.deliveryTime || '30-45 min'}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowInfo(true)}
              style={styles.infoButton}
            >
              <Feather name="info" size={16} color="#f97316" />
              <Text style={styles.infoButtonText}>More Info</Text>
            </TouchableOpacity>
          </View>

          {/* Search & Categories */}
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search menu..."
                placeholderTextColor="#666"
              />
            </View>
            
            {/* Category Tabs */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
            >
              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[
                    styles.categoryTab,
                    selectedCategory === category && styles.categoryTabActive,
                  ]}
                >
                  <Text style={[
                    styles.categoryTabText,
                    selectedCategory === category && styles.categoryTabTextActive,
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Menu */}
          <View style={styles.menuSection}>
            {Object.entries(groupedProducts).map(([category, products]) => (
              <View key={category} style={styles.categoryGroup}>
                <Text style={styles.categoryTitle}>{category}</Text>
                <View style={styles.productsGrid}>
                  {products.map(product => (
                   <ProductCard 
  key={product.id} 
  product={product} 
  variant="horizontal"
  onPress={() => setDetailsProduct(product)}
  onHealthWarning={handleHealthWarning}
/>
                  ))}
                </View>
              </View>
            ))}

            {filteredProducts.length === 0 && (
              <View style={styles.emptyContainer}>
                <Feather name="search" size={48} color="#666" />
                <Text style={styles.emptyTitle}>No items found</Text>
                <Text style={styles.emptyText}>
                  Try a different search term or category
                </Text>
              </View>
            )}
          </View>
          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Cart Floating Button */}
        {cartItemCount > 0 && cartVendorId === vendor.id && (
          <TouchableOpacity 
            onPress={() => navigation.navigate('Cart')}
            style={styles.cartButton}
          >
            <LinearGradient
              colors={['#f97316', '#10b981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cartGradient}
            >
              <View style={styles.cartLeft}>
                <View style={styles.cartCount}>
                  <Text style={styles.cartCountText}>{cartItemCount}</Text>
                </View>
                <Text style={styles.cartText}>View Cart</Text>
              </View>
              <View style={styles.cartRight}>
                <Text style={styles.cartTotal}>₦{cartSubtotal.toLocaleString()}</Text>
                <Feather name="chevron-up" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Info Modal */}
        <Modal
          visible={showInfo}
          transparent
          animationType="slide"
          onRequestClose={() => setShowInfo(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>About {vendor.name}</Text>
                <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.modalCloseButton}>
                  <Feather name="x" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalSection}>
                  <VendorMap
                    vendorId={vendor.id}
                    onDistanceCalculated={handleDistanceCalculated}
                  />
                  <Text style={styles.modalSectionTitle}>Description</Text>
                  <Text style={styles.modalText}>
                    {vendor.description || 'No description available'}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Address</Text>
                  <View style={styles.modalAddress}>
                    <Feather name="map-pin" size={16} color="#f97316" />
                    <Text style={styles.modalText}>{vendor.address}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Contact</Text>
                  <TouchableOpacity style={styles.modalContact}>
                    <Feather name="phone" size={16} color="#f97316" />
                    <Text style={styles.modalContactText}>{vendor.phone}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Delivery Information</Text>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Delivery Time</Text>
                    <Text style={styles.modalInfoValue}>{vendor.deliveryTime}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Delivery Fee</Text>
                    <Text style={styles.modalInfoValue}>₦{vendor.deliveryFee}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Minimum Order</Text>
                    <Text style={styles.modalInfoValue}>₦{vendor.minOrder}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Opening Hours</Text>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Monday - Friday</Text>
                    <Text style={styles.modalInfoValue}>8:00 AM - 10:00 PM</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Saturday - Sunday</Text>
                    <Text style={styles.modalInfoValue}>9:00 AM - 11:00 PM</Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>

      <ProductDetailsModal
        product={detailsProduct}
        onClose={() => setDetailsProduct(null)}
        onHealthWarning={handleHealthWarning}
      />

      <HealthWarningModal
  visible={healthModalVisible}
  productName={pendingProduct?.name || ''}
  checkResult={healthCheckResult}
  onOrderAnyway={handleOrderAnyway}
  onGoBack={handleGoBack}
/>
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
  coverContainer: {
    height: 200,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    backgroundColor: '#f97316',
  },
  favoriteIcon: {
    color: '#fff',
  },
  vendorOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vendorLogoContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#0a0a0a',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  vendorLogo: {
    width: '100%',
    height: '100%',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  vendorCategory: {
    fontSize: 13,
    color: '#666',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  statSubtext: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  infoButtonText: {
    fontSize: 12,
    color: '#f97316',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#fff',
    fontSize: 14,
  },
  categoriesList: {
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginRight: 8,
  },
  categoryTabActive: {
    backgroundColor: '#f97316',
  },
  categoryTabText: {
    fontSize: 13,
    color: '#666',
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  menuSection: {
    padding: 16,
  },
  categoryGroup: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  productsGrid: {
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
  },
  bottomPadding: {
    height: 80,
  },
  cartButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cartGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  cartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartCount: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cartText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  cartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartTotal: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalAddress: {
    flexDirection: 'row',
    gap: 8,
  },
  modalContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalContactText: {
    fontSize: 14,
    color: '#f97316',
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalInfoLabel: {
    fontSize: 13,
    color: '#666',
  },
  modalInfoValue: {
    fontSize: 13,
    color: '#fff',
  },
});


