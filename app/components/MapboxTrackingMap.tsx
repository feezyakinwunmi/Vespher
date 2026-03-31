// app/components/MapboxTrackingMap.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Feather } from '@expo/vector-icons';
import { MAPBOX_TOKEN } from '../config/mapbox';

const { width, height } = Dimensions.get('window');

interface MapboxTrackingMapProps {
  vendorLat: number;
  vendorLng: number;
  deliveryLat?: number;
  deliveryLng?: number;
  riderLat?: number;
  riderLng?: number;
  orderStatus: string;
}

export default function MapboxTrackingMap({
  vendorLat,
  vendorLng,
  deliveryLat,
  deliveryLng,
  riderLat,
  riderLng,
  orderStatus,
}: MapboxTrackingMapProps) {
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Calculate center point for the map
  const getMapCenter = () => {
    if (riderLat && riderLng) {
      return [riderLng, riderLat];
    }
    if (deliveryLat && deliveryLng) {
      return [deliveryLng, deliveryLat];
    }
    return [vendorLng, vendorLat];
  };

  // Get bounds to fit all markers
  const getBounds = () => {
    const points: [number, number][] = [[vendorLng, vendorLat]];
    if (deliveryLat && deliveryLng) points.push([deliveryLng, deliveryLat]);
    if (riderLat && riderLng) points.push([riderLng, riderLat]);
    return points;
  };

  // Fit map to show all points
  const fitToBounds = () => {
    const points = getBounds();
    if (points.length > 1 && mapRef.current) {
      // Calculate bounds
      let minLng = points[0][0];
      let maxLng = points[0][0];
      let minLat = points[0][1];
      let maxLat = points[0][1];

      points.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });

      // Add padding
      const padding = 0.02;
      const bounds = {
        ne: [maxLng + padding, maxLat + padding],
        sw: [minLng - padding, minLat - padding],
      };

      cameraRef.current?.fitBounds(bounds.ne, bounds.sw, 50, 1000);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      setTimeout(fitToBounds, 500);
    }
  }, [isLoading, riderLat, riderLng]);

  // Update camera when rider moves
  useEffect(() => {
    if (riderLat && riderLng && cameraRef.current) {
      cameraRef.current?.setCamera({
        centerCoordinate: [riderLng, riderLat],
        zoomLevel: 14,
        animationDuration: 1000,
      });
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

      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/streets-v12"
        onDidFinishLoadingMap={() => setIsLoading(false)}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={getMapCenter()}
          zoomLevel={13}
          animationDuration={1000}
        />

        {/* Vendor Marker */}
        <Mapbox.PointAnnotation
          id="vendor"
          coordinate={[vendorLng, vendorLat]}
          title="Restaurant"
        >
          <View style={styles.vendorMarker}>
            <Feather name="coffee" size={20} color="#fff" />
            <View style={styles.vendorPulse} />
          </View>
        </Mapbox.PointAnnotation>

        {/* Delivery Marker */}
        {deliveryLat && deliveryLng && (
          <Mapbox.PointAnnotation
            id="delivery"
            coordinate={[deliveryLng, deliveryLat]}
            title="Delivery Location"
          >
            <View style={styles.deliveryMarker}>
              <Feather name="home" size={18} color="#fff" />
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* Rider Marker */}
        {riderLat && riderLng && (
          <Mapbox.PointAnnotation
            id="rider"
            coordinate={[riderLng, riderLat]}
            title="Rider"
          >
            <View style={styles.riderMarker}>
              <Feather name="truck" size={18} color="#fff" />
              <View style={styles.riderPulse} />
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* Route Line between points */}
        {riderLat && riderLng && deliveryLat && deliveryLng && (
          <Mapbox.ShapeSource
            id="routeLine"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [riderLng, riderLat],
                  [deliveryLng, deliveryLat],
                ],
              },
              properties: {},
            }}
          >
            <Mapbox.LineLayer
              id="routeLineLayer"
              style={{
                lineColor: '#f97316',
                lineWidth: 3,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.8,
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

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
  vendorPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(249,115,22,0.3)',
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
  riderPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59,130,246,0.3)',
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

// Add animation definition
// You may need to add this to your global styles or use a library
// For now, the pulse effect will work without animation definition