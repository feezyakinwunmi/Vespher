// app/components/GoogleTrackingMap.tsx
import { computeRoute } from '../services/routes';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface GoogleTrackingMapProps {
  vendorLat: number;
  vendorLng: number;
  deliveryLat?: number;
  deliveryLng?: number;
  riderLat?: number;
  riderLng?: number;
  orderStatus: string;
}

export default function GoogleTrackingMap({
  vendorLat,
  vendorLng,
  deliveryLat,
  deliveryLng,
  riderLat,
  riderLng,
  orderStatus,
}: GoogleTrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [region, setRegion] = useState<Region>({
    latitude: vendorLat,
    longitude: vendorLng,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Fit map to show all markers
  const fitToBounds = () => {
    const points: { latitude: number; longitude: number }[] = [];
    
    points.push({ latitude: vendorLat, longitude: vendorLng });
    if (deliveryLat && deliveryLng) points.push({ latitude: deliveryLat, longitude: deliveryLng });
    if (riderLat && riderLng) points.push({ latitude: riderLat, longitude: riderLng });
    
    if (points.length === 0) return;
    
    if (points.length === 1) {
      mapRef.current?.animateToRegion({
        latitude: points[0].latitude,
        longitude: points[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
      return;
    }
    
    // Calculate bounds
    let minLat = points[0].latitude;
    let maxLat = points[0].latitude;
    let minLng = points[0].longitude;
    let maxLng = points[0].longitude;
    
    points.forEach(point => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });
    
    const padding = 0.02;
    const newRegion = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) + padding,
      longitudeDelta: (maxLng - minLng) + padding,
    };
    
    mapRef.current?.animateToRegion(newRegion, 1000);
  };

  // Decode polyline helper function
  function decodePolyline(encoded: string) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    
    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      
      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return points;
  }

  // Fetch the road route (Google Routes API)
  const fetchRoute = async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
    setRouteLoading(true);
    try {
      const route = await computeRoute(
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: destination.lat, longitude: destination.lng }
      );
      if (route?.encodedPolyline) {
        setRouteCoordinates(decodePolyline(route.encodedPolyline));
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    } finally {
      setRouteLoading(false);
    }
  };

  // Fetch route when rider and delivery locations are available
  useEffect(() => {
    if (riderLat && riderLng && deliveryLat && deliveryLng) {
      fetchRoute(
        { lat: riderLat, lng: riderLng },
        { lat: deliveryLat, lng: deliveryLng }
      );
    }
  }, [riderLat, riderLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    setTimeout(() => {
      fitToBounds();
      setIsLoading(false);
    }, 500);
  }, [riderLat, riderLng, deliveryLat, deliveryLng]);

  // Update camera when rider moves
  useEffect(() => {
    if (riderLat && riderLng) {
      mapRef.current?.animateToRegion({
        latitude: riderLat,
        longitude: riderLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [riderLat, riderLng]);

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onMapReady={() => setIsLoading(false)}
      >
        {/* Vendor Marker */}
        <Marker
          coordinate={{ latitude: vendorLat, longitude: vendorLng }}
          title="Restaurant"
        >
          <View style={styles.vendorMarker}>
            <Feather name="coffee" size={20} color="#fff" />
          </View>
        </Marker>

        {/* Delivery Marker */}
        {deliveryLat && deliveryLng && (
          <Marker
            coordinate={{ latitude: deliveryLat, longitude: deliveryLng }}
            title="Delivery Location"
          >
            <View style={styles.deliveryMarker}>
              <Feather name="home" size={18} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Rider Marker */}
        {riderLat && riderLng && (
          <Marker
            coordinate={{ latitude: riderLat, longitude: riderLng }}
            title="Rider"
          >
            <View style={styles.riderMarker}>
              <Feather name="truck" size={18} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Route Line - Actual Road Route (if available) */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#f97316"
            strokeWidth={4}
          />
        )}

        {/* Fallback: Straight line if no route fetched yet */}
        {routeCoordinates.length === 0 && riderLat && riderLng && deliveryLat && deliveryLng && (
          <Polyline
            coordinates={[
              { latitude: riderLat, longitude: riderLng },
              { latitude: deliveryLat, longitude: deliveryLng },
            ]}
            strokeColor="#f97316"
            strokeWidth={4}
            lineDashPattern={[0]}
          />
        )}

        {/* Route Line between vendor and rider (optional) */}
        {vendorLat && vendorLng && riderLat && riderLng && (
          <Polyline
            coordinates={[
              { latitude: vendorLat, longitude: vendorLng },
              { latitude: riderLat, longitude: riderLng },
            ]}
            strokeColor="#f97316"
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* Route Loading Indicator */}
      {routeLoading && (
        <View style={styles.routeLoadingOverlay}>
          <ActivityIndicator size="small" color="#f97316" />
        </View>
      )}

      {/* Legend Toggle Button */}
      <TouchableOpacity
        style={styles.legendToggle}
        onPress={() => setShowLegend(!showLegend)}
      >
        <Feather name="info" size={18} color="#fff" />
      </TouchableOpacity>

      {/* Legend */}
      {showLegend && (
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
            <Text style={styles.legendText}>Restaurant</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.legendText}>Delivery</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>Rider</Text>
          </View>
        </View>
      )}

      {/* Status Badge */}
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {orderStatus === 'in_transit'
            ? '🚚 Rider is on the way'
            : orderStatus === 'picked_up'
            ? '📦 Order picked up'
            : orderStatus === 'ready'
            ? '✅ Ready for pickup'
            : '🍳 Preparing your order'}
        </Text>
      </View>

      {/* Fit to Bounds Button */}
      <TouchableOpacity style={styles.fitButton} onPress={fitToBounds}>
        <Feather name="maximize-2" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
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
  deliveryMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
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
  riderMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
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
  routeLoadingOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  legendToggle: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  legendContainer: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 8,
    borderRadius: 8,
    gap: 4,
    zIndex: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#fff',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  fitButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
});