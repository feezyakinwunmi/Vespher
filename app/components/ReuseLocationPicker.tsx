// app/components/ReuseLocationPicker.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TextInput,
  FlatList,
  Keyboard,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { ModalSafeArea } from './ModalSafeArea';

const { width, height } = Dimensions.get('window');

// Use LocationIQ (free, no credit card needed)
// Get your key from locationiq.com
const LOCATIONIQ_KEY = 'pk.0af27b1ba256a5946cc3366d07bc90d7'; // Replace with your key

// Default center (Lagos, Nigeria)
const DEFAULT_CENTER = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

interface ReuseLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  initialLocation?: { latitude: number; longitude: number };
  title?: string;
}

export default function ReuseLocationPicker({
  visible,
  onClose,
  onLocationSelect,
  initialLocation,
  title = "Set Your Location"
}: ReuseLocationPickerProps) {
  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation || null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState<Region>(
    initialLocation 
      ? { ...initialLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : DEFAULT_CENTER
  );

  // Debounced search using LocationIQ
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchText.length >= 3) {
        searchAddress(searchText);
      } else {
        setPredictions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchText]);

  // Search using LocationIQ Autocomplete API (free)
  const searchAddress = async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&limit=5&countrycodes=ng&dedupe=1`
      );
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        setPredictions(data);
        setShowSuggestions(true);
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get place details and reverse geocode
  const getLocationDetails = async (lat: number, lon: number, description?: string) => {
    try {
      const response = await fetch(
        `https://api.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lon}&format=json`
      );
      const data = await response.json();
      
      let street = '';
      let area = '';
      let city = '';
      
      if (data.address) {
        street = data.address.road || data.address.pedestrian || '';
        area = data.address.suburb || data.address.city_district || '';
        city = data.address.city || data.address.town || data.address.village || '';
      }
      
      const formattedAddress = data.display_name || description || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      const streetAddress = street || formattedAddress.split(',')[0] || '';
      const areaName = area || city || 'Selected Location';
      
      setSelectedAddress(formattedAddress);
      setSearchText(formattedAddress);
      
      return { formattedAddress, street: streetAddress, area: areaName };
    } catch (error) {
      console.error('Reverse geocode error:', error);
      return { 
        formattedAddress: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        street: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        area: 'Selected Location'
      };
    }
  };

  // Handle map tap - user drops a pin
  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    setSelectedLocation({ latitude, longitude });
    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    
    setLoading(true);
    const details = await getLocationDetails(latitude, longitude);
    setLoading(false);
  };

  // Handle search selection
  const selectAddress = async (prediction: any) => {
    setLoading(true);
    const lat = parseFloat(prediction.lat);
    const lon = parseFloat(prediction.lon);
    
    setSelectedLocation({ latitude: lat, longitude: lon });
    setRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    
    // Animate map to selected location
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
    
    await getLocationDetails(lat, lon, prediction.display_name);
    
    setPredictions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
    setLoading(false);
  };

  const confirmLocation = () => {
    if (selectedLocation && selectedAddress) {
      // Extract street and area from selected address
      const addressParts = selectedAddress.split(',');
      const street = addressParts[0] || '';
      const area = addressParts[1]?.trim() || '';
      
      onLocationSelect({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: selectedAddress,
      });
      onClose();
    }
  };

  const getInitialRegion = () => {
    if (selectedLocation) {
      return {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return DEFAULT_CENTER;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <ModalSafeArea style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={confirmLocation} style={styles.confirmButton}>
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGradient}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search address, street, or city..."
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setShowSuggestions(true);
              }}
              autoFocus={true}
            />
            {loading && (
              <ActivityIndicator style={styles.loader} color="#f97316" />
            )}
          </View>
        </View>

        {/* Suggestions Dropdown */}
        {showSuggestions && predictions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.place_id?.toString() || Math.random().toString()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => selectAddress(item)}
                >
                  <Feather name="map-pin" size={16} color="#f97316" />
                  <View style={styles.suggestionTextContainer}>
                    <Text style={styles.suggestionMainText} numberOfLines={1}>
                      {item.display_name?.split(',')[0] || item.display_place || 'Address'}
                    </Text>
                    <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                      {item.display_name?.split(',').slice(1, 3).join(',') || ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map View */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={getInitialRegion()}
            region={region}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={true}
            onMapReady={() => setMapReady(true)}
            zoomControlEnabled={true}
          >
            {selectedLocation && (
              <Marker
                coordinate={selectedLocation}
                draggable
                onDragEnd={async (e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setSelectedLocation({ latitude, longitude });
                  setRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  });
                  setLoading(true);
                  await getLocationDetails(latitude, longitude);
                  setLoading(false);
                }}
              >
                <View style={styles.markerPin}>
                  <Feather name="map-pin" size={28} color="#f97316" />
                </View>
              </Marker>
            )}
          </MapView>
          
          {/* Map Hint */}
          <View style={styles.mapHint}>
            <Feather name="info" size={14} color="#fff" />
            <Text style={styles.mapHintText}>
              Tap anywhere on map to drop a pin
            </Text>
          </View>
        </View>

        {/* Selected Address Info */}
        {selectedAddress && (
          <View style={styles.addressCard}>
            <Feather name="check-circle" size={18} color="#10b981" />
            <View style={styles.addressTextContainer}>
              <Text style={styles.addressLabel}>Selected Location</Text>
              <Text style={styles.addressValue} numberOfLines={2}>
                {selectedAddress}
              </Text>
            </View>
          </View>
        )}
      </ModalSafeArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  confirmGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#0a0a0a',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  loader: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginHorizontal: 16,
    maxHeight: 250,
    zIndex: 2,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  suggestionSecondaryText: {
    fontSize: 12,
    color: '#666',
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mapHintText: {
    fontSize: 11,
    color: '#fff',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 11,
    color: '#10b981',
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 13,
    color: '#fff',
  },
});