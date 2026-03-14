// app/screens/customer/VendorsScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { VendorCard } from '../../components/customer/VendorCard';
import { CategoryPills } from '../../components/customer/CategoryPills';
import { useVendors } from '../../hooks/customer/useVendors';
import { useCategories } from '../../hooks/customer/useCategories';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type VendorsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SortOption = 'rating' | 'delivery' | 'price';

export function VendorsScreen() {
      const navigation = useNavigation<VendorsScreenNavigationProp>(); // Add type

  const { vendors, isLoading, error, refresh } = useVendors();
  const { categories } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

   const handleVendorPress = (vendorId: string) => {
    navigation.navigate('VendorDetails', { vendorId });
  };
  // Filter and sort vendors
  const filteredVendors = useMemo(() => {
    if (!vendors.length) return [];

    let result = [...vendors];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v => 
        v.name.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query) ||
        v.category.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      result = result.filter(v => 
        v.products.some(p => p.category === selectedCategory)
      );
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'delivery':
        result.sort((a, b) => {
          const aTime = parseInt(a.deliveryTime) || 999;
          const bTime = parseInt(b.deliveryTime) || 999;
          return aTime - bTime;
        });
        break;
      case 'price':
        result.sort((a, b) => (a.deliveryFee || 999) - (b.deliveryFee || 999));
        break;
    }

    return result;
  }, [vendors, searchQuery, selectedCategory, sortBy]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading vendors...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconContainer}>
          <Feather name="x" size={40} color="#ef4444" />
        </View>
        <Text style={styles.errorTitle}>Failed to load vendors</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={refresh} style={styles.retryButton}>
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.retryGradient}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomerHeader showSearch={false} />

      {/* Search & Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search vendors, cuisines..."
              placeholderTextColor="#666"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Feather name="x" size={16} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={[
              styles.filterButton,
              sortBy !== 'rating' && styles.filterButtonActive,
            ]}
          >
            <Feather 
              name="sliders" 
              size={18} 
              color={sortBy !== 'rating' ? '#f97316' : '#666'} 
            />
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <View style={styles.categoriesContainer}>
          <CategoryPills 
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </View>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} found
        </Text>
        {(searchQuery || selectedCategory !== 'All') && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
          >
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Vendors List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredVendors.length > 0 ? (
          <View style={styles.vendorsGrid}>
            {filteredVendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
    onPress={() => handleVendorPress(vendor.id)} 
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="search" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>No vendors found</Text>
            <Text style={styles.emptyText}>
              Try adjusting your search or filters
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>Clear Filters</Text>
            </TouchableOpacity>
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
              <Text style={styles.modalTitle}>Filter & Sort</Text>
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
                    { value: 'rating', label: 'Highest Rated', icon: '⭐' },
                    { value: 'delivery', label: 'Fastest Delivery', icon: '⚡' },
                    { value: 'price', label: 'Lowest Delivery Fee', icon: '💰' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSortBy(option.value as SortOption)}
                      style={[
                        styles.sortOption,
                        sortBy === option.value && styles.sortOptionSelected,
                      ]}
                    >
                      <Text style={styles.sortOptionIcon}>{option.icon}</Text>
                      <Text style={[
                        styles.sortOptionLabel,
                        sortBy === option.value && styles.sortOptionLabelSelected,
                      ]}>
                        {option.label}
                      </Text>
                      {sortBy === option.value && (
                        <View style={styles.sortOptionDot} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Price Range */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Price Range</Text>
                <View style={styles.priceOptions}>
                  {['₦', '₦₦', '₦₦₦'].map((price, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.priceOption}
                    >
                      <Text style={styles.priceOptionText}>{price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dietary */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Dietary</Text>
                <View style={styles.dietaryOptions}>
                  {['Halal', 'Vegetarian', 'Vegan', 'Gluten-Free'].map((diet) => (
                    <TouchableOpacity
                      key={diet}
                      style={styles.dietaryOption}
                    >
                      <Text style={styles.dietaryOptionText}>{diet}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                style={styles.applyButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  retryGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  categoriesContainer: {
    marginTop: 12,
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
  vendorsGrid: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 16,
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
    marginBottom: 20,
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '500',
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
    gap: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortOptionSelected: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  sortOptionIcon: {
    fontSize: 16,
  },
  sortOptionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  sortOptionLabelSelected: {
    color: '#f97316',
  },
  sortOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  priceOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  priceOption: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  priceOptionText: {
    fontSize: 14,
    color: '#fff',
  },
  dietaryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dietaryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
  },
  dietaryOptionText: {
    fontSize: 13,
    color: '#fff',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  applyButton: {
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