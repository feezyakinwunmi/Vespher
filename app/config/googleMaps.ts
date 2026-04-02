// app/config/googleMaps.ts

// Get API key from environment variables
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY!;

// Validate token is present
if (!googleMapsApiKey) {
  console.error('❌ Google Maps API key is missing! Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file');
}

// Export API key
export const GOOGLE_MAPS_API_KEY = googleMapsApiKey;

// Default center (Nigeria coordinates as default)
export const DEFAULT_CENTER = {
  latitude: 9.0820,
  longitude: 8.6753,
  latitudeDelta: 5,
  longitudeDelta: 5,
};

// Country restrictions for autocomplete
export const SEARCH_COUNTRIES = ['ng', 'us', 'gb']; // Nigeria, US, UK

// Helper function to check if API key is configured
export const isGoogleMapsConfigured = () => {
  return !!googleMapsApiKey && googleMapsApiKey !== '';
};

// Types for address components
export interface AddressComponents {
  streetNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  fullAddress: string;
}

// Helper function to extract address components from Google Places result
export const extractAddressComponents = (place: any): AddressComponents => {
  const components: AddressComponents = {
    fullAddress: place.formatted_address || place.place_name || ''
  };
  
  // Extract from Google's address_components
  if (place.address_components) {
    place.address_components.forEach((component: any) => {
      if (component.types.includes('street_number')) {
        components.streetNumber = component.long_name;
      }
      if (component.types.includes('route')) {
        components.street = component.long_name;
      }
      if (component.types.includes('locality')) {
        components.city = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        components.state = component.long_name;
      }
      if (component.types.includes('country')) {
        components.country = component.long_name;
      }
      if (component.types.includes('postal_code')) {
        components.zipCode = component.long_name;
      }
    });
  }
  
  // If street is not found from address_components, try to extract from formatted address
  if (!components.street && place.formatted_address) {
    const parts = place.formatted_address.split(',');
    components.street = parts[0]?.trim() || '';
    if (parts[1] && !components.city) {
      components.city = parts[1]?.trim() || '';
    }
  }
  
  return components;
};