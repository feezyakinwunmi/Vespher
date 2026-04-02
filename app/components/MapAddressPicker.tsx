// // app/components/MapAddressPicker.tsx
// import React, { useState, useEffect, useRef } from 'react';
// import {
//   View,
//   Text,
//   Modal,
//   TouchableOpacity,
//   TextInput,
//   StyleSheet,
//   FlatList,
//   ActivityIndicator,
//   Keyboard,
//   Platform,
//   Alert,
// } from 'react-native';
// import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
// import * as Location from 'expo-location';
// import { Feather } from '@expo/vector-icons';
// import { LinearGradient } from 'expo-linear-gradient';

// // Google Places API key
// const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// interface MapAddressPickerProps {
//   visible: boolean;
//   onClose: () => void;
//   onSelectAddress: (address: {
//     street: string;
//     area: string;
//     landmark?: string;
//     fullAddress: string;
//     latitude: number;
//     longitude: number;
//     city?: string;
//     state?: string;
//     country?: string;
//     zipCode?: string;
//   }) => void;
//   initialLocation?: { latitude: number; longitude: number };
//   title?: string;
// }

// // Default center (Lagos, Nigeria)
// const DEFAULT_CENTER = {
//   latitude: 6.5244,
//   longitude: 3.3792,
//   latitudeDelta: 0.0922,
//   longitudeDelta: 0.0421,
// };

// export default function MapAddressPicker({ 
//   visible,
//   onClose,
//   onSelectAddress,
//   initialLocation,
//   title = "Pick Location on Map"
// }: MapAddressPickerProps) {
//   const [searchText, setSearchText] = useState('');
//   const [predictions, setPredictions] = useState<any[]>([]);
//   const [selectedLocation, setSelectedLocation] = useState<Region | null>(null);
//   const [currentLocation, setCurrentLocation] = useState<Region | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [showSuggestions, setShowSuggestions] = useState(false);
//   const [selectedAddressDetails, setSelectedAddressDetails] = useState<any>(null);
//   const mapRef = useRef<MapView>(null);

//   // Get current location on mount
//   useEffect(() => {
//     if (visible) {
//       (async () => {
//         const { status } = await Location.requestForegroundPermissionsAsync();
//         if (status === 'granted') {
//           const location = await Location.getCurrentPositionAsync({});
//           const region = {
//             latitude: location.coords.latitude,
//             longitude: location.coords.longitude,
//             latitudeDelta: 0.0922,
//             longitudeDelta: 0.0421,
//           };
//           setCurrentLocation(region);
          
//           if (!initialLocation && !selectedLocation) {
//             setSelectedLocation(region);
//             reverseGeocode(location.coords.latitude, location.coords.longitude);
//           }
//         }
//       })();
//     }
//   }, [visible]);

//   // Set initial location if provided
//   useEffect(() => {
//     if (initialLocation && !selectedLocation && visible) {
//       const region = {
//         latitude: initialLocation.latitude,
//         longitude: initialLocation.longitude,
//         latitudeDelta: 0.01,
//         longitudeDelta: 0.01,
//       };
//       setSelectedLocation(region);
//       reverseGeocode(initialLocation.latitude, initialLocation.longitude);
//       mapRef.current?.animateToRegion(region, 1000);
//     }
//   }, [initialLocation, visible]);

//   // Debounced search using Google Places API
//   useEffect(() => {
//     const delayDebounceFn = setTimeout(() => {
//       if (searchText.length >= 2) {
//         searchAddress(searchText);
//       } else {
//         setPredictions([]);
//         setShowSuggestions(false);
//       }
//     }, 500);

//     return () => clearTimeout(delayDebounceFn);
//   }, [searchText]);

//   // Search using Google Places API
//   const searchAddress = async (query: string) => {
//     setLoading(true);
//     try {
//       const response = await fetch(
//         `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&components=country:ng`
//       );
//       const data = await response.json();
      
//       if (data.status === 'OK') {
//         setPredictions(data.predictions);
//         setShowSuggestions(true);
//       } else {
//         console.log('Places API error:', data.status);
//         setPredictions([]);
//       }
//     } catch (error) {
//       console.error('Search error:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Get place details for selected prediction
//   const getPlaceDetails = async (placeId: string) => {
//     try {
//       const response = await fetch(
//         `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_API_KEY}`
//       );
//       const data = await response.json();
      
//       if (data.status === 'OK') {
//         const place = data.result;
//         const location = place.geometry.location;
//         const latitude = location.lat;
//         const longitude = location.lng;
        
//         // Extract address components
//         let street = '';
//         let area = '';
//         let city = '';
//         let state = '';
//         let country = '';
//         let zipCode = '';
        
//         place.address_components?.forEach((component: any) => {
//           if (component.types.includes('route')) street = component.long_name;
//           if (component.types.includes('locality')) city = component.long_name;
//           if (component.types.includes('administrative_area_level_1')) state = component.long_name;
//           if (component.types.includes('country')) country = component.long_name;
//           if (component.types.includes('postal_code')) zipCode = component.long_name;
//         });
        
//         // If no street found, use the first address line
//         if (!street && place.formatted_address) {
//           const parts = place.formatted_address.split(',');
//           street = parts[0] || '';
//           area = parts[1]?.trim() || city;
//         }
        
//         const region = {
//           latitude,
//           longitude,
//           latitudeDelta: 0.01,
//           longitudeDelta: 0.01,
//         };
        
//         setSelectedLocation(region);
//         setSelectedAddressDetails({
//           street: street,
//           area: area || city,
//           fullAddress: place.formatted_address,
//           city,
//           state,
//           country,
//           zipCode,
//           latitude,
//           longitude,
//         });
//         setSearchText(place.formatted_address);
        
//         mapRef.current?.animateToRegion(region, 1000);
//       }
//     } catch (error) {
//       console.error('Place details error:', error);
//     }
//   };

//   // Reverse geocode using Google Maps API
//   const reverseGeocode = async (latitude: number, longitude: number) => {
//     try {
//       const response = await fetch(
//         `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`
//       );
//       const data = await response.json();
      
//       if (data.status === 'OK' && data.results.length > 0) {
//         const place = data.results[0];
        
//         // Extract address components
//         let street = '';
//         let area = '';
//         let city = '';
//         let state = '';
//         let country = '';
//         let zipCode = '';
        
//         place.address_components?.forEach((component: any) => {
//           if (component.types.includes('route')) street = component.long_name;
//           if (component.types.includes('locality')) city = component.long_name;
//           if (component.types.includes('administrative_area_level_1')) state = component.long_name;
//           if (component.types.includes('country')) country = component.long_name;
//           if (component.types.includes('postal_code')) zipCode = component.long_name;
//         });
        
//         // If no street found, use the first address line
//         if (!street && place.formatted_address) {
//           const parts = place.formatted_address.split(',');
//           street = parts[0] || '';
//           area = parts[1]?.trim() || city;
//         }
        
//         setSelectedAddressDetails({
//           street: street,
//           area: area || city,
//           fullAddress: place.formatted_address,
//           city,
//           state,
//           country,
//           zipCode,
//           latitude,
//           longitude,
//         });
        
//         setSearchText(place.formatted_address);
//       }
//     } catch (error) {
//       console.error('Reverse geocode error:', error);
//     }
//   };

//   const selectAddress = (prediction: any) => {
//     getPlaceDetails(prediction.place_id);
//     setPredictions([]);
//     setShowSuggestions(false);
//     Keyboard.dismiss();
//   };

//   const handleMapPress = async (event: any) => {
//     const { latitude, longitude } = event.nativeEvent.coordinate;
    
//     setSelectedLocation({
//       latitude,
//       longitude,
//       latitudeDelta: 0.01,
//       longitudeDelta: 0.01,
//     });
    
//     await reverseGeocode(latitude, longitude);
//   };

//   const confirmLocation = () => {
//     if (selectedAddressDetails) {
//       onSelectAddress({
//         street: selectedAddressDetails.street,
//         area: selectedAddressDetails.area,
//         landmark: '',
//         fullAddress: selectedAddressDetails.fullAddress,
//         latitude: selectedAddressDetails.latitude,
//         longitude: selectedAddressDetails.longitude,
//         city: selectedAddressDetails.city,
//         state: selectedAddressDetails.state,
//         country: selectedAddressDetails.country,
//         zipCode: selectedAddressDetails.zipCode,
//       });
//       onClose();
//     } else {
//       Alert.alert('No Location', 'Please select a location on the map or search for an address');
//     }
//   };

//   const goToCurrentLocation = async () => {
//     const { status } = await Location.requestForegroundPermissionsAsync();
//     if (status === 'granted') {
//       const location = await Location.getCurrentPositionAsync({});
//       const region = {
//         latitude: location.coords.latitude,
//         longitude: location.coords.longitude,
//         latitudeDelta: 0.01,
//         longitudeDelta: 0.01,
//       };
//       setSelectedLocation(region);
//       mapRef.current?.animateToRegion(region, 1000);
//       await reverseGeocode(location.coords.latitude, location.coords.longitude);
//     } else {
//       Alert.alert(
//         'Location Permission',
//         'Please enable location access to use this feature',
//         [{ text: 'OK' }]
//       );
//     }
//   };

//   return (
//     <Modal
//       visible={visible}
//       animationType="slide"
//       presentationStyle="fullScreen"
//       onRequestClose={onClose}
//     >
//       <View style={styles.container}>
//         {/* Header */}
//         <View style={styles.header}>
//           <TouchableOpacity onPress={onClose} style={styles.closeButton}>
//             <Feather name="x" size={24} color="#fff" />
//           </TouchableOpacity>
//           <Text style={styles.title}>{title}</Text>
//           <TouchableOpacity onPress={confirmLocation} style={styles.confirmButton}>
//             <LinearGradient
//               colors={['#f97316', '#f43f5e']}
//               start={{ x: 0, y: 0 }}
//               end={{ x: 1, y: 0 }}
//               style={styles.confirmGradient}
//             >
//               <Text style={styles.confirmText}>Confirm</Text>
//             </LinearGradient>
//           </TouchableOpacity>
//         </View>

//         {/* Search Bar */}
//         <View style={styles.searchContainer}>
//           <View style={styles.searchInputWrapper}>
//             <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
//             <TextInput
//               style={styles.searchInput}
//               placeholder="Search address, city, or place..."
//               placeholderTextColor="#666"
//               value={searchText}
//               onChangeText={(text) => {
//                 setSearchText(text);
//                 setShowSuggestions(true);
//               }}
//               onFocus={() => searchText.length >= 2 && setShowSuggestions(true)}
//             />
//             {loading && (
//               <ActivityIndicator style={styles.loader} color="#f97316" />
//             )}
//           </View>
//         </View>

//         {/* Suggestions Dropdown */}
//         {showSuggestions && predictions.length > 0 && (
//           <View style={styles.suggestionsContainer}>
//             <FlatList
//               data={predictions}
//               keyExtractor={(item) => item.place_id}
//               keyboardShouldPersistTaps="handled"
//               renderItem={({ item }) => (
//                 <TouchableOpacity
//                   style={styles.suggestionItem}
//                   onPress={() => selectAddress(item)}
//                 >
//                   <Feather name="map-pin" size={16} color="#f97316" />
//                   <Text style={styles.suggestionText}>{item.description}</Text>
//                 </TouchableOpacity>
//               )}
//             />
//           </View>
//         )}

//         {/* Map */}
//         <MapView
//           ref={mapRef}
//           style={styles.map}
//           provider={PROVIDER_GOOGLE}
//           region={selectedLocation || currentLocation || DEFAULT_CENTER}
//           onPress={handleMapPress}
//           showsUserLocation={true}
//           showsMyLocationButton={false}
//           zoomControlEnabled={true}
//         >
//           {selectedLocation && (
//             <Marker
//               coordinate={{
//                 latitude: selectedLocation.latitude,
//                 longitude: selectedLocation.longitude,
//               }}
//               draggable
//               onDragEnd={async (e) => {
//                 const { latitude, longitude } = e.nativeEvent.coordinate;
//                 setSelectedLocation({
//                   ...selectedLocation,
//                   latitude,
//                   longitude,
//                 });
//                 await reverseGeocode(latitude, longitude);
//               }}
//             />
//           )}
//         </MapView>

//         {/* Current Location Button */}
//         <TouchableOpacity
//           style={styles.currentLocationButton}
//           onPress={goToCurrentLocation}
//         >
//           <Feather name="navigation" size={24} color="#f97316" />
//         </TouchableOpacity>

//         {/* Selected Address Info */}
//         {selectedAddressDetails && (
//           <View style={styles.addressInfo}>
//             <Text style={styles.addressInfoTitle}>Selected Location</Text>
//             <Text style={styles.addressInfoText} numberOfLines={2}>
//               {selectedAddressDetails.fullAddress}
//             </Text>
//           </View>
//         )}
//       </View>
//     </Modal>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#000',
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingTop: Platform.OS === 'ios' ? 60 : 40,
//     paddingBottom: 16,
//     paddingHorizontal: 20,
//     backgroundColor: '#1a1a1a',
//     borderBottomWidth: 1,
//     borderBottomColor: 'rgba(255,255,255,0.05)',
//   },
//   title: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#fff',
//   },
//   closeButton: {
//     padding: 8,
//     marginLeft: -8,
//   },
//   confirmButton: {
//     borderRadius: 8,
//     overflow: 'hidden',
//   },
//   confirmGradient: {
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 8,
//   },
//   confirmText: {
//     color: '#fff',
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   searchContainer: {
//     position: 'absolute',
//     top: Platform.OS === 'ios' ? 120 : 100,
//     left: 16,
//     right: 16,
//     zIndex: 1,
//     backgroundColor: '#2a2a2a',
//     borderRadius: 12,
//     elevation: 5,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//   },
//   searchInputWrapper: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 16,
//   },
//   searchIcon: {
//     marginRight: 12,
//   },
//   searchInput: {
//     flex: 1,
//     height: 52,
//     fontSize: 16,
//     color: '#fff',
//   },
//   loader: {
//     marginLeft: 8,
//   },
//   suggestionsContainer: {
//     position: 'absolute',
//     top: Platform.OS === 'ios' ? 180 : 160,
//     left: 16,
//     right: 16,
//     backgroundColor: '#2a2a2a',
//     borderRadius: 12,
//     elevation: 5,
//     maxHeight: 250,
//     zIndex: 1,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//   },
//   suggestionItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 14,
//     borderBottomWidth: 1,
//     borderBottomColor: 'rgba(255,255,255,0.05)',
//     gap: 12,
//   },
//   suggestionText: {
//     flex: 1,
//     fontSize: 14,
//     color: '#fff',
//   },
//   map: {
//     flex: 1,
//   },
//   currentLocationButton: {
//     position: 'absolute',
//     bottom: 20,
//     right: 20,
//     backgroundColor: '#2a2a2a',
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 5,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//   },
//   addressInfo: {
//     position: 'absolute',
//     bottom: 90,
//     left: 16,
//     right: 16,
//     backgroundColor: 'rgba(0,0,0,0.85)',
//     borderRadius: 12,
//     padding: 12,
//   },
//   addressInfoTitle: {
//     fontSize: 12,
//     color: '#f97316',
//     marginBottom: 4,
//   },
//   addressInfoText: {
//     fontSize: 14,
//     color: '#fff',
//   },
// });












// app/components/MapAddressPicker.tsx
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput,
  ScrollView,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface MapAddressPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (location: {
    street: string;
    area: string;
    fullAddress: string;
    latitude: number;
    longitude: number;
  }) => void;
  initialLocation?: { latitude: number; longitude: number };
  title?: string;
}

export default function MapAddressPicker({ 
  visible, 
  onClose, 
  onSelectAddress,
  title = "Pick Location"
}: MapAddressPickerProps) {
  const [searchText, setSearchText] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);

  console.log('📍 MapAddressPicker visible:', visible);

  // If not visible, don't render anything
  if (!visible) return null;

  // Simple mock search function
  const handleSearch = (text: string) => {
    setSearchText(text);
    if (text.length > 2) {
      setIsLoading(true);
      setTimeout(() => {
        setSuggestions([
          { description: `${text}, Lagos, Nigeria`, place_id: '1' },
          { description: `${text}, Abuja, Nigeria`, place_id: '2' },
          { description: `${text}, Ibadan, Nigeria`, place_id: '3' },
        ]);
        setIsLoading(false);
      }, 500);
    } else {
      setSuggestions([]);
    }
  };

  const selectAddress = (suggestion: any) => {
    onSelectAddress({
      street: suggestion.description.split(',')[0],
      area: 'Lagos',
      fullAddress: suggestion.description,
      latitude: 6.5244,
      longitude: 3.3792,
    });
    onClose();
  };

  // This is a full-screen view, NOT a Modal
  return (
    <SafeAreaView style={styles.fullScreenContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 40 }} />
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
            onChangeText={handleSearch}
            autoFocus={true}
          />
          {isLoading && <ActivityIndicator size="small" color="#f97316" />}
        </View>
      </View>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <ScrollView style={styles.suggestionsList}>
          {suggestions.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => selectAddress(item)}
            >
              <Feather name="map-pin" size={16} color="#f97316" />
              <Text style={styles.suggestionText}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <Feather name="map" size={64} color="#f97316" />
        <Text style={styles.placeholderTitle}>Find Your Location</Text>
        <Text style={styles.placeholderText}>
          Search for an address above
        </Text>
        <Text style={styles.placeholderNote}>
          Tap search results to select location
        </Text>
      </View>

      {/* Confirm Button (only if text is entered) */}
      {searchText.length > 0 && (
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => {
            onSelectAddress({
              street: searchText.split(',')[0],
              area: 'Lagos',
              fullAddress: searchText,
              latitude: 6.5244,
              longitude: 3.3792,
            });
            onClose();
          }}
        >
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            style={styles.confirmGradient}
          >
            <Text style={styles.confirmText}>Use This Location</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#1a1a1a',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
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
    maxHeight: 250,
    marginHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  placeholderNote: {
    fontSize: 12,
    color: '#f97316',
    textAlign: 'center',
    marginTop: 8,
  },
  confirmButton: {
    margin: 16,
    marginBottom: 32,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});