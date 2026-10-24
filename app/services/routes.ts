// app/services/routes.ts
// Road distance and route line via Google's Routes API (computeRoutes). The legacy
// Directions API (maps/api/directions/json) can no longer be enabled on new Google
// Cloud projects/keys, so all route lookups go through here.
import { GOOGLE_MAPS_API_KEY } from '../config/googleMaps';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceKm: number;
  // Same encoded-polyline format the legacy Directions API returned.
  encodedPolyline?: string;
}

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export async function computeRoute(origin: LatLng, destination: LatLng): Promise<RouteResult | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const response = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: 'DRIVE',
      }),
    });

    const data = await response.json();
    const route = data?.routes?.[0];
    if (!response.ok || !route?.distanceMeters) {
      console.warn('Routes API error:', data?.error?.status || response.status, data?.error?.message || '');
      return null;
    }

    return {
      distanceKm: route.distanceMeters / 1000,
      encodedPolyline: route.polyline?.encodedPolyline,
    };
  } catch (error) {
    console.warn('Routes API request failed:', error);
    return null;
  }
}
