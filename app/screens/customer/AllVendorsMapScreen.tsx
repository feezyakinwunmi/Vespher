import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region, LatLng } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useVendors } from '../../hooks/customer/useVendors';
import { useLocation } from '../../contexts/LocationContext';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

const { width, height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const categories: Category[] = [
  { id: 'all', name: 'All', icon: 'grid', color: '#f97316' },
  { id: 'restaurant', name: 'Restaurants', icon: 'coffee', color: '#f43f5e' },
  { id: 'fastfood', name: 'Fast Food', icon: 'zap', color: '#f97316' },
  { id: 'pharmacy', name: 'Pharmacy', icon: 'crosshair', color: '#10b981' },
  { id: 'groceries', name: 'Groceries', icon: 'shopping-bag', color: '#f43f5e' },
  { id: 'local', name: 'Local Cuisine', icon: 'home', color: '#f97316' },
  { id: 'seafood', name: 'Seafood', icon: 'anchor', color: '#10b981' },
];

export function AllVendorsMapScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vendors, isLoading } = useVendors();
  const { userLocation, requestLocation } = useLocation();
  
  const mapRef = useRef<MapView>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [showVendorModal, setShowVendorModal] = useState<boolean>(false);
  const [region, setRegion] = useState<Region>({
    latitude: 6.5244,
    longitude: 3.3792,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [mapReady, setMapReady] = useState<boolean>(false);

  // Filter vendors based on category and search - only those with coordinates
  const filteredVendors = vendors.filter(vendor => {
    const hasCoordinates = vendor.latitude && vendor.longitude;
    const matchesCategory = selectedCategory === 'all' || vendor.category === selectedCategory;
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (vendor.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    return hasCoordinates && matchesCategory && matchesSearch;
  });

  // Fit map to show all markers
  const fitToMarkers = () => {
    if (!mapReady || filteredVendors.length === 0) return;
    
    const points: LatLng[] = filteredVendors
      .filter(v => v.latitude && v.longitude)
      .map(v => ({ latitude: v.latitude!, longitude: v.longitude! }));
    
    if (userLocation) {
      points.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
    }
    
    if (points.length === 0) return;
    
    let minLat = points[0].latitude;
    let maxLat = points[0].latitude;
    let minLng = points[0].longitude;
    let maxLng = points[0].longitude;
    
    points.forEach(point => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });
    
    const padding = 0.05;
    const newRegion: Region = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) + padding,
      longitudeDelta: (maxLng - minLng) + padding,
    };
    
    mapRef.current?.animateToRegion(newRegion, 500);
  };

  // Center on user location
  const centerOnUser = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    } else {
      requestLocation();
    }
  };

  // Handle vendor press
  const handleVendorPress = (vendor: any) => {
    setSelectedVendor(vendor);
    setShowVendorModal(true);
    
    // Animate to vendor location
    if (vendor.latitude && vendor.longitude) {
      mapRef.current?.animateToRegion({
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const navigateToVendorDetails = () => {
    if (selectedVendor) {
      setShowVendorModal(false);
      navigation.navigate('VendorDetails', { vendorId: selectedVendor.id });
    }
  };

  const getCategoryIcon = (categoryName: string): any => {
    const category = categories.find(c => c.name.toLowerCase() === (categoryName || '').toLowerCase());
    return category?.icon || 'coffee';
  };

  const getCategoryColor = (categoryName: string): string => {
    const category = categories.find(c => c.name.toLowerCase() === (categoryName || '').toLowerCase());
    return category?.color || '#f97316';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading vendors...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nearby Vendors</Text>
        <TouchableOpacity onPress={fitToMarkers} style={styles.fitButton}>
          <Feather name="maximize-2" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search vendors..."
            placeholderTextColor="#666"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Feather name="x" size={16} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={centerOnUser} style={styles.locationButton}>
          <Feather name="navigation" size={18} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Categories ScrollView */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            onPress={() => setSelectedCategory(category.id)}
            style={[
              styles.categoryChip,
              selectedCategory === category.id && styles.categoryChipActive,
            ]}
          >
            <Feather 
              name={category.icon as any} 
              size={14} 
              color={selectedCategory === category.id ? '#fff' : category.color} 
            />
            <Text style={[
              styles.categoryChipText,
              selectedCategory === category.id && styles.categoryChipTextActive,
            ]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={region}
          onMapReady={() => {
            setMapReady(true);
            setTimeout(fitToMarkers, 500);
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
        >
          {/* Vendor Markers */}
          {filteredVendors.map((vendor) => (
            vendor.latitude && vendor.longitude && (
              <Marker
                key={vendor.id}
                coordinate={{
                  latitude: vendor.latitude,
                  longitude: vendor.longitude,
                }}
                onPress={() => handleVendorPress(vendor)}
                tracksViewChanges={false}
              >
                <View style={styles.markerContainer}>
                  <LinearGradient
                    colors={[getCategoryColor(vendor.category), `${getCategoryColor(vendor.category)}CC`]}
                    style={styles.markerGradient}
                  >
                    <Feather name={getCategoryIcon(vendor.category)} size={16} color="#fff" />
                  </LinearGradient>
                  <View style={styles.markerLabel}>
                    <Text style={styles.markerLabelText} numberOfLines={1}>
                      {vendor.name}
                    </Text>
                  </View>
                </View>
              </Marker>
            )
          ))}
        </MapView>

        {/* Results Count */}
        <View style={styles.resultsBadge}>
          <Text style={styles.resultsBadgeText}>
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} nearby
          </Text>
        </View>

        {/* Center Button */}
        <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
          <Feather name="navigation" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Vendor Detail Modal */}
      <Modal
        visible={showVendorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVendorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowVendorModal(false)}
            >
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>

            {selectedVendor && (
              <>
                {/* Cover Image */}
                <View style={styles.modalCoverContainer}>
                  <Image 
                    source={{ uri: selectedVendor.coverImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800' }} 
                    style={styles.modalCover}
                  />
                  <LinearGradient
                    colors={['transparent', '#0a0a0a']}
                    style={styles.modalCoverGradient}
                  />
                  
                  {/* Logo */}
                  <View style={styles.modalLogoContainer}>
                    <Image 
                      source={{ uri: selectedVendor.image || selectedVendor.logo || 'https://via.placeholder.com/60' }} 
                      style={styles.modalLogo}
                    />
                  </View>
                </View>

                {/* Vendor Info */}
                <View style={styles.modalInfo}>
                  <Text style={styles.modalVendorName}>{selectedVendor.name}</Text>
                  <View style={styles.modalStats}>
                    <View style={styles.modalStat}>
                      <Feather name="star" size={14} color="#fbbf24" />
                      <Text style={styles.modalStatText}>{selectedVendor.rating?.toFixed(1) || '0.0'}</Text>
                    </View>
                    <View style={styles.modalStat}>
                      <Feather name="clock" size={14} color="#666" />
                      <Text style={styles.modalStatText}>{selectedVendor.deliveryTime || '30-45 min'}</Text>
                    </View>
                    <View style={styles.modalStat}>
                      <Feather name="truck" size={14} color="#666" />
                      <Text style={styles.modalStatText}>₦{selectedVendor.deliveryFee || 500}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.modalDescription} numberOfLines={2}>
                    {selectedVendor.description || 'Discover delicious meals from this vendor'}
                  </Text>

                  <TouchableOpacity 
                    style={styles.viewDetailsButton}
                    onPress={navigateToVendorDetails}
                  >
                    <LinearGradient
                      colors={['#f97316', '#f43f5e']}
                      style={styles.viewDetailsGradient}
                    >
                      <Text style={styles.viewDetailsText}>View Menu & Order</Text>
                      <Feather name="arrow-right" size={16} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  fitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
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
  locationButton: {
    width: 44,
    height: 44,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesContainer: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryChipActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#666',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    marginTop:12,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerLabel: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    maxWidth: 100,
  },
  markerLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  resultsBadge: {
    position: 'absolute',
    top: 12,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resultsBadgeText: {
    color: '#fff',
    fontSize: 12,
  },
  centerButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
    borderTopRightRadius: 40,
    borderTopLeftRadius: 40,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    height: height * 0.5,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    
    zIndex: 10,
  },
  modalCoverContainer: {
    height: 140,
    position: 'relative',
  },
  modalCover: {
    width: '100%',
    height: '100%',
       borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
  },
  modalCoverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    
  },
  modalLogoContainer: {
    position: 'absolute',
    bottom: -30,
    left: 16,
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  modalLogo: {
    width: '100%',
    height: '100%',
  },
  modalInfo: {
    padding: 16,
    paddingTop: 40,
  },
  modalVendorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  modalStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalStatText: {
    fontSize: 12,
    color: '#666',
  },
  modalDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 20,
  },
  viewDetailsButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewDetailsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  viewDetailsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});