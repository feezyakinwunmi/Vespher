// app/components/customer/AddressModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

const LOCATIONIQ_KEY = 'pk.0af27b1ba256a5946cc3366d07bc90d7'; // Replace with your key
const { height } = Dimensions.get('window');

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: any) => Promise<void>;
  address?: {
    id?: string;
    label?: string;
    street?: string;
    area?: string;
    landmark?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    is_default?: boolean;
  } | null;
}

const labelOptions = [
  { value: 'Home', label: 'Home' },
  { value: 'School', label: 'School' },
  { value: 'Work', label: 'Work' },
  { value: 'Other', label: 'Other' },
];

export function AddressModal({ isOpen, onClose, onSave, address }: AddressModalProps) {
  const [formData, setFormData] = useState({
    label: address?.label || '',
    street: address?.street || '',
    area: address?.area || '',
    landmark: address?.landmark || '',
    phone: address?.phone || '',
    latitude: address?.latitude || null,
    longitude: address?.longitude || null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Address picker states
  const [showPicker, setShowPicker] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedAddressDetails, setSelectedAddressDetails] = useState<any>(null);
  const [debounceTimeout, setDebounceTimeout] = useState<any>(null);
  
  const mapRef = useRef<MapView>(null);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: address?.latitude || 6.5244,
    longitude: address?.longitude || 3.3792,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  // Search using LocationIQ
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&limit=5&countrycodes=ng&dedupe=1`
      );
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        const formattedPredictions = data.map((item: any) => ({
          place_id: item.place_id,
          description: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        }));
        setPredictions(formattedPredictions);
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get reverse geocode for a location
  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(
        `https://api.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lon}&format=json`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Reverse geocode error:', error);
      return null;
    }
  };

  // Handle map tap - user drops a pin
  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    
    // Animate to the dropped pin
    mapRef.current?.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
    
    // Get address for the dropped pin
    setLoading(true);
    try {
      const details = await reverseGeocode(latitude, longitude);
      
      let street = '';
      let area = '';
      let city = '';
      
      if (details) {
        street = details.address?.road || details.address?.pedestrian || '';
        area = details.address?.suburb || details.address?.city_district || '';
        city = details.address?.city || details.address?.town || details.address?.village || '';
      }
      
      const addressData = {
        street: street || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        area: area || city || 'Selected Location',
        fullAddress: details?.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        latitude,
        longitude,
      };
      
      setSelectedAddressDetails(addressData);
      setSearchText(addressData.fullAddress);
    } catch (error) {
      console.error('Error getting address:', error);
      setSelectedAddressDetails({
        street: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        area: 'Selected Location',
        fullAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        latitude,
        longitude,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle search selection
  const handleSelectSearchResult = async (prediction: any) => {
    setLoading(true);
    try {
      const location = { latitude: prediction.lat, longitude: prediction.lon };
      setSelectedLocation(location);
      
      // Move map to selected location
      mapRef.current?.animateToRegion({
        latitude: prediction.lat,
        longitude: prediction.lon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
      
      // Get full address details
      const details = await reverseGeocode(prediction.lat, prediction.lon);
      
      let street = '';
      let area = '';
      let city = '';
      
      if (details) {
        street = details.address?.road || details.address?.pedestrian || '';
        area = details.address?.suburb || details.address?.city_district || '';
        city = details.address?.city || details.address?.town || details.address?.village || '';
      }
      
      const addressData = {
        street: street || prediction.description.split(',')[0],
        area: area || city,
        fullAddress: prediction.description,
        latitude: prediction.lat,
        longitude: prediction.lon,
      };
      
      setSelectedAddressDetails(addressData);
      setSearchText(prediction.description);
      setPredictions([]);
    } catch (error) {
      console.error('Error getting address details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLocation = () => {
    if (selectedAddressDetails) {
      setFormData({
        ...formData,
        street: selectedAddressDetails.street,
        area: selectedAddressDetails.area,
        latitude: selectedAddressDetails.latitude,
        longitude: selectedAddressDetails.longitude,
      });
      setShowPicker(false);
      setSearchText('');
      setSelectedLocation(null);
      setSelectedAddressDetails(null);
      setPredictions([]);
    }
  };

  const handleCancelPicker = () => {
    setShowPicker(false);
    setSearchText('');
    setSelectedLocation(null);
    setSelectedAddressDetails(null);
    setPredictions([]);
  };

  const handleSubmit = async () => {
    if (!formData.label) {
      Alert.alert('Error', 'Please select a label');
      return;
    }
    if (!formData.street) {
      Alert.alert('Error', 'Please enter street address or pick on map');
      return;
    }
    if (!formData.area) {
      Alert.alert('Error', 'Please enter area');
      return;
    }
    if (!formData.phone) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      const addressToSave = {
        label: formData.label,
        street: formData.street,
        area: formData.area,
        landmark: formData.landmark,
        phone: formData.phone,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };
      await onSave(addressToSave);
      onClose();
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (showPicker) {
      const timeout = setTimeout(() => {
        if (searchText.length >= 3 && !selectedLocation) {
          searchAddress(searchText);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [searchText, showPicker, selectedLocation]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {address?.id ? 'Edit Address' : 'Add New Address'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Show Address Picker or Form */}
          {!showPicker ? (
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              {/* Label Select */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Label *</Text>
                <View style={styles.optionsContainer}>
                  {labelOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setFormData({ ...formData, label: option.value })}
                      style={[
                        styles.optionButton,
                        formData.label === option.value && styles.optionButtonSelected,
                      ]}
                    >
                      <Text style={[
                        styles.optionText,
                        formData.label === option.value && styles.optionTextSelected,
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Map Picker Button */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Pick Location on Map *</Text>
                <TouchableOpacity
                  style={styles.mapPickerButton}
                  onPress={() => setShowPicker(true)}
                >
                  <Feather name="map" size={20} color="#f97316" />
                  <Text style={styles.mapPickerText}>
                    {formData.street && formData.area 
                      ? `${formData.street}, ${formData.area}`
                      : 'Tap to pick location on map'}
                  </Text>
                  <Feather name="chevron-right" size={20} color="#666" />
                </TouchableOpacity>
                {(formData.latitude && formData.longitude) && (
                  <Text style={styles.coordsText}>
                    📍 Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                  </Text>
                )}
              </View>

              {/* Street Address */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Street Address *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="map-pin" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.street}
                    onChangeText={(text) => setFormData({ ...formData, street: text })}
                    placeholder="e.g., 15 University Road"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Area */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Area *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="navigation" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.area}
                    onChangeText={(text) => setFormData({ ...formData, area: text })}
                    placeholder="e.g., Epe"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Landmark */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Landmark (Optional)</Text>
                <View style={styles.inputContainer}>
                  <Feather name="flag" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.landmark}
                    onChangeText={(text) => setFormData({ ...formData, landmark: text })}
                    placeholder="e.g., Beside the market"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Phone Number */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Phone Number *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="phone" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.phone}
                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                    placeholder="Phone number for delivery"
                    placeholderTextColor="#666"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </ScrollView>
          ) : (
            // Map Picker View
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={handleCancelPicker} style={styles.pickerBackButton}>
                  <Feather name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Drop a Pin</Text>
                <TouchableOpacity onPress={handleConfirmLocation} style={styles.pickerConfirmButton}>
                  <LinearGradient
                    colors={['#f97316', '#f43f5e']}
                    style={styles.pickerConfirmGradient}
                  >
                    <Text style={styles.pickerConfirmText}>Confirm</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <View style={styles.searchWrapper}>
                  <Feather name="search" size={20} color="#666" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search address..."
                    placeholderTextColor="#666"
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                  {loading && <ActivityIndicator size="small" color="#f97316" />}
                </View>
              </View>

              {/* Search Suggestions */}
              {predictions.length > 0 && !selectedLocation && (
                <FlatList
                  data={predictions}
                  keyExtractor={(item) => item.place_id?.toString() || Math.random().toString()}
                  style={styles.suggestionsList}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => handleSelectSearchResult(item)}
                    >
                      <Feather name="map-pin" size={16} color="#f97316" />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}

              {/* Map View with Pin */}
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={mapRegion}
                  onPress={handleMapPress}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                >
                  {selectedLocation && (
                    <Marker
                      coordinate={selectedLocation}
                      draggable
                      onDragEnd={(e) => {
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        handleMapPress({ nativeEvent: { coordinate: { latitude, longitude } } });
                      }}
                    >
                      <View style={styles.markerPin}>
                        <Feather name="map-pin" size={28} color="#f97316" />
                      </View>
                    </Marker>
                  )}
                </MapView>
                <View style={styles.mapHint}>
                  <Feather name="info" size={14} color="#666" />
                  <Text style={styles.mapHintText}>
                    Tap anywhere on map to drop a pin
                  </Text>
                </View>
              </View>

              {/* Selected Address Info */}
              {selectedAddressDetails && (
                <View style={styles.selectedAddressCard}>
                  <Feather name="check-circle" size={18} color="#10b981" />
                  <View style={styles.selectedAddressContent}>
                    <Text style={styles.selectedAddressLabel}>Selected Location</Text>
                    <Text style={styles.selectedAddressText} numberOfLines={2}>
                      {selectedAddressDetails.fullAddress}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Footer - Only show when not in picker mode */}
          {!showPicker && (
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={styles.saveButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveGradient}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveText}>
                      {address?.id ? 'Update Address' : 'Save Address'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  form: {
    flex: 1,
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextSelected: {
    color: '#f97316',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 14,
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  mapPickerText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  coordsText: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    marginLeft: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Picker styles
  pickerContainer: {
    flex: 1,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pickerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  pickerConfirmButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickerConfirmGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickerConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  suggestionsList: {
    maxHeight: 200,
    paddingHorizontal: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    marginTop: 8,
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
    paddingVertical: 6,
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
  selectedAddressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)',
    margin: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  selectedAddressContent: {
    flex: 1,
  },
  selectedAddressLabel: {
    fontSize: 11,
    color: '#10b981',
    marginBottom: 2,
  },
  selectedAddressText: {
    fontSize: 12,
    color: '#fff',
  },
});