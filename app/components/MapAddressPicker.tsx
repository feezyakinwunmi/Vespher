// app/components/MapAddressPicker.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  geocodingService, 
  DEFAULT_CENTER,
  SEARCH_COUNTRIES,
  extractAddressComponents,
  isMapboxConfigured,
} from '../config/mapbox';

interface MapAddressPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (address: {
    street: string;
    area: string;
    landmark?: string;
    fullAddress: string;
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  }) => void;
  initialLocation?: { latitude: number; longitude: number };
  title?: string;
}

export default function MapAddressPicker({ 
  visible,
  onClose,
  onSelectAddress,
  initialLocation,
  title = "Pick Location on Map"
}: MapAddressPickerProps) {
  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Region | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Region | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddressDetails, setSelectedAddressDetails] = useState<any>(null);
  const mapRef = useRef<MapView>(null);

  // Check if Mapbox is configured
  useEffect(() => {
    if (visible && !isMapboxConfigured()) {
      Alert.alert(
        'Configuration Error',
        'Mapbox token is missing. Please contact support.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  }, [visible]);

  // Get current location on mount
  useEffect(() => {
    if (visible) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const region = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setCurrentLocation(region);
          
          if (!initialLocation && !selectedLocation) {
            setSelectedLocation(region);
            reverseGeocode(location.coords.latitude, location.coords.longitude);
          }
        }
      })();
    }
  }, [visible]);

  // Set initial location if provided
  useEffect(() => {
    if (initialLocation && !selectedLocation && visible) {
      const region = {
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setSelectedLocation(region);
      reverseGeocode(initialLocation.latitude, initialLocation.longitude);
      mapRef.current?.animateToRegion(region, 1000);
    }
  }, [initialLocation, visible]);

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchText.length >= 2) {
        searchAddress(searchText);
      } else {
        setPredictions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchText]);

  const searchAddress = async (query: string) => {
    setLoading(true);
    try {
      const response = await geocodingService
        .forwardGeocode({
          query: query,
          limit: 8,
          countries: SEARCH_COUNTRIES,
          types: ['address', 'place', 'locality', 'neighborhood']
        })
        .send();

      setPredictions(response.body.features);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const response = await geocodingService
        .reverseGeocode({
          query: [longitude, latitude],
          limit: 1
        })
        .send();

      if (response.body.features.length > 0) {
        const place = response.body.features[0];
        const components = extractAddressComponents(place);
        
        // Extract street and area from the address
        const addressParts = place.place_name.split(',');
        const street = addressParts[0] || '';
        const area = addressParts[1]?.trim() || components.city || '';
        
        setSelectedAddressDetails({
          street: street,
          area: area,
          fullAddress: place.place_name,
          city: components.city,
          state: components.state,
          country: components.country,
          zipCode: components.zipCode,
          latitude,
          longitude,
        });
        
        setSearchText(place.place_name);
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
  };

  const selectAddress = (place: any) => {
    const [longitude, latitude] = place.center;
    const components = extractAddressComponents(place);
    
    // Extract street and area
    const addressParts = place.place_name.split(',');
    const street = addressParts[0] || '';
    const area = addressParts[1]?.trim() || components.city || '';
    
    const region = {
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    setSelectedLocation(region);
    setSelectedAddressDetails({
      street: street,
      area: area,
      fullAddress: place.place_name,
      city: components.city,
      state: components.state,
      country: components.country,
      zipCode: components.zipCode,
      latitude,
      longitude,
    });
    setSearchText(place.place_name);
    setPredictions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
    
    mapRef.current?.animateToRegion(region, 1000);
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    setSelectedLocation({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    
    await reverseGeocode(latitude, longitude);
  };

  const confirmLocation = () => {
    if (selectedAddressDetails) {
      onSelectAddress({
        street: selectedAddressDetails.street,
        area: selectedAddressDetails.area,
        landmark: '',
        fullAddress: selectedAddressDetails.fullAddress,
        latitude: selectedAddressDetails.latitude,
        longitude: selectedAddressDetails.longitude,
        city: selectedAddressDetails.city,
        state: selectedAddressDetails.state,
        country: selectedAddressDetails.country,
        zipCode: selectedAddressDetails.zipCode,
      });
      onClose();
    } else {
      Alert.alert('No Location', 'Please select a location on the map or search for an address');
    }
  };

  const goToCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      const region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setSelectedLocation(region);
      mapRef.current?.animateToRegion(region, 1000);
      await reverseGeocode(location.coords.latitude, location.coords.longitude);
    } else {
      Alert.alert(
        'Location Permission',
        'Please enable location access to use this feature',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={confirmLocation} style={styles.confirmButton}>
            <LinearGradient
              colors={['#3b82f6', '#10b981']}
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
              placeholder="Search address, city, or place..."
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setShowSuggestions(true);
              }}
              onFocus={() => searchText.length >= 2 && setShowSuggestions(true)}
            />
            {loading && (
              <ActivityIndicator style={styles.loader} color="#3b82f6" />
            )}
          </View>
        </View>

        {/* Suggestions Dropdown */}
        {showSuggestions && predictions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => selectAddress(item)}
                >
                  <Feather name="map-pin" size={16} color="#3b82f6" />
                  <Text style={styles.suggestionText}>{item.place_name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={selectedLocation || currentLocation || DEFAULT_CENTER}
          onPress={handleMapPress}
          showsUserLocation={true}
          showsMyLocationButton={false}
          zoomControlEnabled={true}
        >
          {selectedLocation && (
            <Marker
              coordinate={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
              }}
              draggable
              onDragEnd={async (e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setSelectedLocation({
                  ...selectedLocation,
                  latitude,
                  longitude,
                });
                await reverseGeocode(latitude, longitude);
              }}
            />
          )}
        </MapView>

        {/* Current Location Button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={goToCurrentLocation}
        >
          <Feather name="navigation" size={24} color="#3b82f6" />
        </TouchableOpacity>

        {/* Selected Address Info */}
        {selectedAddressDetails && (
          <View style={styles.addressInfo}>
            <Text style={styles.addressInfoTitle}>Selected Location</Text>
            <Text style={styles.addressInfoText} numberOfLines={2}>
              {selectedAddressDetails.fullAddress}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
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
    padding: 8,
    marginLeft: -8,
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
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 16,
    right: 16,
    zIndex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#fff',
  },
  loader: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 180 : 160,
    left: 16,
    right: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    elevation: 5,
    maxHeight: 250,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2a2a2a',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addressInfo: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 12,
  },
  addressInfoTitle: {
    fontSize: 12,
    color: '#3b82f6',
    marginBottom: 4,
  },
  addressInfoText: {
    fontSize: 14,
    color: '#fff',
  },
});