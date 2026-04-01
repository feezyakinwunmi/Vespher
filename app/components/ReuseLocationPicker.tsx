// app/components/VendorLocationPicker.tsx
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
import Mapbox from '@rnmapbox/maps';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { geocodingService, DEFAULT_CENTER, SEARCH_COUNTRIES, extractAddressComponents, isMapboxConfigured } from '../config/mapbox';

const { width, height } = Dimensions.get('window');

interface ReuseLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  initialLocation?: { latitude: number; longitude: number };
}

export default function VendorLocationPicker({
  visible,
  onClose,
  onLocationSelect,
  initialLocation,
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
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const [mapReady, setMapReady] = useState(false);

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

  const selectAddress = (place: any) => {
    const [longitude, latitude] = place.center;
    setSelectedLocation({ latitude, longitude });
    setSelectedAddress(place.place_name);
    setSearchText(place.place_name);
    setPredictions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();

    // Animate camera to selected location
    if (cameraRef.current && mapReady) {
      cameraRef.current.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 16,
        animationDuration: 500,
      });
    }
  };

  const handleMapPress = (event: any) => {
    const { geometry } = event.features[0];
    const { coordinates } = geometry;
    const [longitude, latitude] = coordinates;
    
    setSelectedLocation({ latitude, longitude });
    
    // Reverse geocode to get address
    reverseGeocode(latitude, longitude);
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
        setSelectedAddress(place.place_name);
        setSearchText(place.place_name);
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
  };

  const confirmLocation = () => {
    if (selectedLocation) {
      onLocationSelect({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: selectedAddress,
      });
      onClose();
    }
  };

  const getInitialCenter = () => {
    if (selectedLocation) {
      return [selectedLocation.longitude, selectedLocation.latitude];
    }
    return DEFAULT_CENTER.longitude ? [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude] : [8.6753, 9.0820];
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
          <Text style={styles.title}>Set Business Location</Text>
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
              placeholder="Search business location..."
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setShowSuggestions(true);
              }}
              onFocus={() => searchText.length >= 2 && setShowSuggestions(true)}
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
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => selectAddress(item)}
                >
                  <Feather name="map-pin" size={16} color="#f97316" />
                  <Text style={styles.suggestionText}>{item.place_name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map */}
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          styleURL="mapbox://styles/mapbox/streets-v12"
          onDidFinishLoadingMap={() => setMapReady(true)}
          logoEnabled={false}
          attributionEnabled={false}
          onPress={handleMapPress}
        >
          <Mapbox.Camera
            ref={cameraRef}
            centerCoordinate={getInitialCenter()}
            zoomLevel={15}
            animationDuration={1000}
          />
          
          {selectedLocation && (
            <Mapbox.PointAnnotation
              id="vendor-location"
              coordinate={[selectedLocation.longitude, selectedLocation.latitude]}
              title="Your Business Location"
            >
              <View style={styles.vendorMarker}>
                <Feather name="coffee" size={20} color="#fff" />
                <View style={styles.vendorPulse} />
              </View>
            </Mapbox.PointAnnotation>
          )}
        </Mapbox.MapView>

        {/* Instruction Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 Tap on map or search to set your business location
          </Text>
        </View>

        {/* Selected Address Info */}
        {selectedAddress && (
          <View style={styles.addressInfo}>
            <Feather name="map-pin" size={14} color="#f97316" />
            <Text style={styles.addressText} numberOfLines={2}>
              {selectedAddress}
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
    top: 120,
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
    top: 180,
    left: 16,
    right: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    elevation: 5,
    maxHeight: 250,
    zIndex: 2,
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
  vendorMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f97316',
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
  vendorPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(249,115,22,0.3)',
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
  addressInfo: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#fff',
  },
});