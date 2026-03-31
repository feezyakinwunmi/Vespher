// app/components/AddressSearchMap.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useLocation } from '../contexts/LocationContext';
import { 
  geocodingService, 
  MAPBOX_TOKEN, 
  DEFAULT_CENTER,
  SEARCH_COUNTRIES,
  extractAddressComponents,
  isMapboxConfigured,
  AddressComponents
} from '../config/mapbox';

interface Address {
  fullAddress: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

interface AddressSearchMapProps {
  visible: boolean;
  onClose: () => void;
  onAddressSelect: (address: Address) => void;
  initialLocation?: { latitude: number; longitude: number };
  title?: string;
  placeholder?: string;
  countryRestriction?: string[];
}

export default function AddressSearchMap({ 
  visible,
  onClose,
  onAddressSelect, 
  initialLocation, 
  title = "Select Location",
  placeholder = "Search address, city, or place...",
  countryRestriction = SEARCH_COUNTRIES
}: AddressSearchMapProps) {
  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Region | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Region | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const mapRef = useRef<MapView>(null);
  const { userLocation } = useLocation(); // Use your existing location context

  // Check if Mapbox is configured
  useEffect(() => {
    if (!isMapboxConfigured()) {
      Alert.alert(
        'Configuration Error',
        'Mapbox token is missing. Please contact support.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  }, []);

  // Get current location from your context or request it
  useEffect(() => {
    (async () => {
      if (userLocation) {
        const region = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setCurrentLocation(region);
        
        if (!initialLocation && !selectedLocation) {
          setSelectedLocation(region);
          reverseGeocode(userLocation.latitude, userLocation.longitude);
        }
      } else {
        // Request location if not available
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
      }
    })();
  }, [userLocation]);

  // Set initial location if provided
  useEffect(() => {
    if (initialLocation && !selectedLocation) {
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
  }, [initialLocation]);

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
          countries: countryRestriction,
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
        setSearchText(place.place_name);
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
  };

  const selectAddress = (place: any) => {
    const [longitude, latitude] = place.center;
    const fullAddress = place.place_name;
    const components = extractAddressComponents(place);
    
    const region = {
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    setSelectedLocation(region);
    setSearchText(fullAddress);
    setPredictions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
    
    mapRef.current?.animateToRegion(region, 1000);
    
    onAddressSelect({
      fullAddress,
      latitude,
      longitude,
      placeId: place.id,
      streetNumber: components.streetNumber,
      street: components.street,
      city: components.city,
      state: components.state,
      country: components.country,
      zipCode: components.zipCode,
    });
    
    onClose();
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
    if (selectedLocation) {
      onAddressSelect({
        fullAddress: searchText,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
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
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={confirmLocation} style={styles.confirmButton}>
            <Text style={styles.confirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor="#999"
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setShowSuggestions(true);
              }}
              onFocus={() => searchText.length >= 2 && setShowSuggestions(true)}
            />
            {loading && (
              <ActivityIndicator style={styles.loader} color="#4285F4" />
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
          <Text style={styles.currentLocationText}>📍</Text>
        </TouchableOpacity>

        {/* Instruction Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 Tap on map or search to select location
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
    color: '#666',
  },
  confirmButton: {
    padding: 8,
  },
  confirmText: {
    fontSize: 16,
    color: '#4285F4',
    fontWeight: '600',
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 16,
    right: 16,
    zIndex: 1,
    backgroundColor: 'white',
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
  },
  searchInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
    borderRadius: 12,
  },
  loader: {
    marginRight: 16,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 180 : 160,
    left: 16,
    right: 16,
    backgroundColor: 'white',
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
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: 'white',
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
  currentLocationText: {
    fontSize: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 12,
  },
});