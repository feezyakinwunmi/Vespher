// services/locationService.ts
import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get user's current location
export async function getUserLocation(): Promise<UserLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Location permission denied');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({});
    
    // Get address from coordinates
    let address = '';
    let city = '';
    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (geocode[0]) {
        address = `${geocode[0].street || ''} ${geocode[0].district || ''}`.trim();
        city = geocode[0].city || geocode[0].region || '';
      }
    } catch (e) {
      console.log('Geocoding error:', e);
    }
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      address: address || 'Your location',
      city: city,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
}