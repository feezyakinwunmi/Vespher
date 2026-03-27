// app/screens/customer/ExploreScreen.tsx
import React, { useState, useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { ProductCard } from '../../components/customer/ProductCard';
import { useVendors } from '../../hooks/customer/useVendors';
import { useCategories } from '../../hooks/customer/useCategories';
import { RootStackParamList } from '../../navigation/types';

type ExploreScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FilterState {
  categories: string[];
  vendors: string[];
  priceRange: {
    min: number;
    max: number;
  };
  sortBy: 'popular' | 'price_low' | 'price_high' | 'newest';
}

export function ExploreScreen() {
  const navigation = useNavigation<ExploreScreenNavigationProp>();
  const { vendors, isLoading: vendorsLoading, refresh: refreshVendors } = useVendors();
  console.log('🔍 Vendors from useVendors:', vendors.map(v => ({
  name: v.name,
  productsCount: v.products?.length || 0,
  products: v.products?.map(p => p.name)
})));

  const { categories, isLoading: categoriesLoading } = useCategories();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    vendors: [],
    priceRange: { min: 0, max: 1000000000 },
    sortBy: 'popular',
  });

  // Temporary filter state while modal is open
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);

  // Get all available products from vendors
  const allProducts = useMemo(() => {
  const products = vendors.flatMap(vendor => 
    vendor.products.map(product => ({
      ...product,
      vendorName: vendor.name,
      vendorId: vendor.id,
      vendorImage: vendor.image,
      vendorRating: vendor.rating,
    }))
  );
  console.log('📦 All products count:', products.length);
  console.log('📦 All products:', products.map(p => p.name));
  return products;
}, [vendors]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.vendorName?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filters.categories.length > 0) {
      result = result.filter(p => 
        filters.categories.includes(p.category)
      );
    }

    // Vendor filter
    if (filters.vendors.length > 0) {
      result = result.filter(p => 
        filters.vendors.includes(p.vendorId)
      );
    }

    // Price range filter
    result = result.filter(p => 
      p.price >= filters.priceRange.min && p.price <= filters.priceRange.max
    );

    // Sorting
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
      case 'newest':
        result.sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        break;
    }

    return result;
  }, [allProducts, searchQuery, filters]);

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
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const toggleVendor = (vendorId: string) => {
    setTempFilters(prev => ({
      ...prev,
      vendors: prev.vendors.includes(vendorId)
        ? prev.vendors.filter(v => v !== vendorId)
        : [...prev.vendors, vendorId],
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
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Feather name="x" size={16} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <TouchableOpacity
            onPress={() => {
              setTempFilters(filters);
              setShowFilters(true);
            }}
            style={[
              styles.filterButton,
              getActiveFilterCount() > 0 && styles.filterButtonActive,
            ]}
          >
            <Feather 
              name="sliders" 
              size={18} 
              color={getActiveFilterCount() > 0 ? '#f97316' : '#666'} 
            />
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
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              resetFilters();
              setFilters({
                categories: [],
                vendors: [],
                priceRange: { min: 0, max: 1000000000 },
                sortBy: 'popular',
              });
            }}
          >
            <Text style={styles.clearFiltersText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Products Grid */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredProducts.length > 0 ? (
          <View style={styles.productsGrid}>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="compact"
                onPress={() => navigation.navigate('VendorDetails', { vendorId: product.vendorId })}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="search" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptyText}>
              Try adjusting your search or filters
            </Text>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Items</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Sort By */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Sort By</Text>
                <View style={styles.sortOptions}>
                  {[
                    { value: 'popular', label: 'Most Popular' },
                    { value: 'price_low', label: 'Price: Low to High' },
                    { value: 'price_high', label: 'Price: High to Low' },
                    { value: 'newest', label: 'Newest First' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setTempFilters(prev => ({ ...prev, sortBy: option.value as any }))}
                      style={[
                        styles.sortOption,
                        tempFilters.sortBy === option.value && styles.sortOptionSelected,
                      ]}
                    >
                      <Text style={[
                        styles.sortOptionLabel,
                        tempFilters.sortBy === option.value && styles.sortOptionLabelSelected,
                      ]}>
                        {option.label}
                      </Text>
                      {tempFilters.sortBy === option.value && (
                        <Feather name="check" size={16} color="#f97316" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Categories */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Categories</Text>
                <View style={styles.categoryOptions}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => toggleCategory(category.name)}
                      style={[
                        styles.categoryOption,
                        tempFilters.categories.includes(category.name) && styles.categoryOptionSelected,
                      ]}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        tempFilters.categories.includes(category.name) && styles.categoryOptionTextSelected,
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Vendors */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Vendors</Text>
                <View style={styles.vendorOptions}>
                  {vendors.map((vendor) => (
                    <TouchableOpacity
                      key={vendor.id}
                      onPress={() => toggleVendor(vendor.id)}
                      style={[
                        styles.vendorOption,
                        tempFilters.vendors.includes(vendor.id) && styles.vendorOptionSelected,
                      ]}
                    >
                      <Image 
                        source={{ uri: vendor.image || 'https://via.placeholder.com/40' }} 
                        style={styles.vendorOptionImage}
                      />
                      <View style={styles.vendorOptionInfo}>
                        <Text style={styles.vendorOptionName}>{vendor.name}</Text>
                        <Text style={styles.vendorOptionRating}>⭐ {vendor.rating.toFixed(1)}</Text>
                      </View>
                      {tempFilters.vendors.includes(vendor.id) && (
                        <Feather name="check" size={18} color="#f97316" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Price Range */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Price Range</Text>
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceInputLabel}>Min</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={tempFilters.priceRange.min.toString()}
                      onChangeText={(text) => setTempFilters(prev => ({
                        ...prev,
                        priceRange: { ...prev.priceRange, min: parseInt(text) || 0 }
                      }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#666"
                    />
                  </View>
                  <View style={styles.priceSeparator}>
                    <Text style={styles.priceSeparatorText}>to</Text>
                  </View>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceInputLabel}>Max</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={tempFilters.priceRange.max.toString()}
                      onChangeText={(text) => setTempFilters(prev => ({
                        ...prev,
                        priceRange: { ...prev.priceRange, max: parseInt(text) || 1000000000 }
                      }))}
                      keyboardType="numeric"
                      placeholder="1000000000"
                      placeholderTextColor="#666"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyFilters} style={styles.applyButton}>
                <LinearGradient
                  colors={['#f97316', '#10b981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.applyGradient}
                >
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
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
        paddingBottom:60,

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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginTop:10,
  },
  searchWrapper: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
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
  clearButton: {
    padding: 4,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f97316',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsText: {
    fontSize: 13,
    color: '#666',
  },
  clearFiltersText: {
    fontSize: 13,
    color: '#f97316',
  },
  content: {
    flex: 1,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
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
    height: '90%',
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
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  sortOptions: {
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  sortOptionSelected: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  sortOptionLabel: {
    fontSize: 14,
    color: '#fff',
  },
  sortOptionLabelSelected: {
    color: '#f97316',
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
  },
  categoryOptionSelected: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  categoryOptionText: {
    fontSize: 13,
    color: '#fff',
  },
  categoryOptionTextSelected: {
    color: '#f97316',
  },
  vendorOptions: {
    gap: 8,
  },
  vendorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  vendorOptionSelected: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  vendorOptionImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  vendorOptionInfo: {
    flex: 1,
  },
  vendorOptionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  vendorOptionRating: {
    fontSize: 12,
    color: '#666',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priceInput: {
    height: 44,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 14,
  },
  priceSeparator: {
    paddingHorizontal: 8,
  },
  priceSeparatorText: {
    color: '#666',
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  resetButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  applyGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});