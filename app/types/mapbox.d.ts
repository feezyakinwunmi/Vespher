// app/types/mapbox.d.ts
declare module '@mapbox/mapbox-sdk' {
  export interface MapboxClient {
    accessToken: string;
  }
  
  export default function MapboxClient(options: { accessToken: string }): any;
}

declare module '@mapbox/mapbox-sdk/services/geocoding' {
  export interface GeocodingService {
    forwardGeocode(options: {
      query: string;
      limit?: number;
      countries?: string[];
      types?: string[];
    }): any;
    
    reverseGeocode(options: {
      query: [number, number];
      limit?: number;
    }): any;
  }
  
  export default function Geocoding(options: { accessToken: string }): GeocodingService;
}

declare module '@mapbox/mapbox-sdk/services/directions' {
  export interface DirectionsService {
    getDirections(options: {
      profile: string;
      waypoints: Array<{ coordinates: [number, number] }>;
    }): any;
  }
  
  export default function Directions(options: { accessToken: string }): DirectionsService;
}

declare module '@mapbox/mapbox-sdk/services/static' {
  export interface StaticMapService {
    getStaticImage(options: any): any;
  }
  
  export default function StaticMap(options: { accessToken: string }): StaticMapService;
}