// app/config/mapbox.ts
import MapboxClient from '@mapbox/mapbox-sdk';
import Geocoding from '@mapbox/mapbox-sdk/services/geocoding';
import Directions from '@mapbox/mapbox-sdk/services/directions';
import StaticMap from '@mapbox/mapbox-sdk/services/static';

// Get token from environment variables
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN!;

// Validate token is present
if (!mapboxToken) {
  console.error('❌ Mapbox token is missing! Add EXPO_PUBLIC_MAPBOX_TOKEN to your .env file');
}

// Create Mapbox client
export const mapboxClient = MapboxClient({ accessToken: mapboxToken });

// Initialize services
export const geocodingService = Geocoding({ accessToken: mapboxToken });
export const directionsService = Directions({ accessToken: mapboxToken });
export const staticMapService = StaticMap({ accessToken: mapboxToken });

// Export token for direct use if needed
export const MAPBOX_TOKEN = mapboxToken;

// Default map style (you can change this)
export const MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v12';

// Default center (Nigeria coordinates as default)
export const DEFAULT_CENTER = {
  latitude: 9.0820,
  longitude: 8.6753,
  latitudeDelta: 5,
  longitudeDelta: 5,
};

// Country restrictions for autocomplete
export const SEARCH_COUNTRIES = ['ng', 'us', 'gb']; // Nigeria, US, UK

// Helper function to check if token is configured
export const isMapboxConfigured = () => {
  return !!mapboxToken && mapboxToken !== '';
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

// Helper function to extract address components
export const extractAddressComponents = (place: any): AddressComponents => {
  const components: AddressComponents = {
    fullAddress: place.place_name
  };
  
  // Extract from context
  if (place.context) {
    place.context.forEach((ctx: any) => {
      if (ctx.id.includes('street')) components.street = ctx.text;
      if (ctx.id.includes('place')) components.city = ctx.text;
      if (ctx.id.includes('region')) components.state = ctx.text;
      if (ctx.id.includes('country')) components.country = ctx.text;
      if (ctx.id.includes('postcode')) components.zipCode = ctx.text;
    });
  }
  
  // Extract from address components if available
  if (place.address) {
    components.streetNumber = place.address;
  }
  
  return components;
};