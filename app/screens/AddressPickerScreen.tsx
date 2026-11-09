// app/screens/AddressPickerScreen.tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';

const LOCATIONIQ_KEY = 'pk.0af27b1ba256a5946cc3366d07bc90d7';

export function AddressPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { onSelectAddress, initialLocation } = route.params as any;
  
  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [debounceTimeout, setDebounceTimeout] = useState<any>(null);

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (debounceTimeout) clearTimeout(debounceTimeout);
    if (text.length < 3) {
      setPredictions([]);
      return;
    }
    const timeout = setTimeout(() => searchAddress(text), 500);
    setDebounceTimeout(timeout);
  };

  const searchAddress = async (query: string) => {
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
          lat: item.lat,
          lon: item.lon,
          address: item.address,
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

  const getPlaceDetails = async (lat: number, lon: number) => {
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

  const handleSelectAddress = async (prediction: any) => {
    setLoading(true);
    try {
      const details = await getPlaceDetails(prediction.lat, prediction.lon);
      
      let street = '';
      let area = '';
      let city = '';
      
      if (details) {
        street = details.address?.road || details.address?.pedestrian || '';
        area = details.address?.suburb || details.address?.city_district || '';
        city = details.address?.city || details.address?.town || details.address?.village || '';
      }
      
      if (!street && prediction.description) {
        const parts = prediction.description.split(',');
        street = parts[0] || '';
        area = parts[1]?.trim() || city;
      }

      const addressData = {
        street: street,
        area: area || city,
        fullAddress: prediction.description,
        latitude: parseFloat(prediction.lat),
        longitude: parseFloat(prediction.lon),
      };
      
      setSelectedAddress(addressData);
      setSearchText(prediction.description);
      setPredictions([]);
    } catch (error) {
      console.error('Error getting address details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedAddress) {
      // Call the callback to update the modal
      if (onSelectAddress) {
        onSelectAddress(selectedAddress);
      }
      // Go back to the modal
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Pick Location</Text>
        <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            style={styles.confirmGradient}
          >
            <Text style={styles.confirmText}>Confirm</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Feather name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search address, street, or city..."
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={handleSearch}
            autoFocus={true}
          />
          {loading && <ActivityIndicator size="small" color="#f97316" />}
        </View>
      </View>

      {predictions.length > 0 && (
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.place_id.toString()}
          style={styles.suggestionsList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => handleSelectAddress(item)}
            >
              <Feather name="map-pin" size={16} color="#f97316" />
              <View style={styles.suggestionTextContainer}>
                <Text style={styles.suggestionMainText} numberOfLines={1}>
                  {item.description.split(',')[0]}
                </Text>
                <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                  {item.description.split(',').slice(1).join(',')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {selectedAddress && (
        <View style={styles.selectedPreview}>
          <Feather name="check-circle" size={20} color="#10b981" />
          <View style={styles.selectedTextContainer}>
            <Text style={styles.selectedTitle}>Selected Address</Text>
            <Text style={styles.selectedAddress} numberOfLines={2}>
              {selectedAddress.fullAddress}
            </Text>
          </View>
        </View>
      )}

      {predictions.length === 0 && !loading && searchText.length > 2 && (
        <View style={styles.infoContainer}>
          <Feather name="info" size={20} color="#f97316" />
          <Text style={styles.infoText}>
            No addresses found. Try a different search term.
          </Text>
        </View>
      )}

      <View style={styles.noteContainer}>
        <Feather name="alert-circle" size={12} color="#666" />
        <Text style={styles.noteText}>
          Search for street names, areas, or landmarks in Nigeria
        </Text>
      </View>
    </SafeAreaView>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
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
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  suggestionsList: {
    flex: 1,
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
  selectedPreview: {
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
  selectedTextContainer: {
    flex: 1,
  },
  selectedTitle: {
    fontSize: 11,
    color: '#10b981',
    marginBottom: 2,
  },
  selectedAddress: {
    fontSize: 13,
    color: '#fff',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249,115,22,0.1)',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#f97316',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  noteText: {
    fontSize: 11,
    color: '#666',
  },
});