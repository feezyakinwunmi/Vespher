// app/components/VendorMap.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  Linking,
  ActivityIndicator 
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Feather } from '@expo/vector-icons';
import { useLocation } from '../contexts/LocationContext';

interface VendorMapProps {
  vendorLocation: {
    latitude: number;
    longitude: number;
    address: string;
    name: string;
  };
  onDistanceCalculated?: (distance: number, fee: number) => void;
}

export function VendorMap({ vendorLocation, onDistanceCalculated }: VendorMapProps) {
  const { 
    userLocation, 
    getDistanceFromUser, 
    calculateDeliveryFeeFromDistance, 
    requestLocation 
  } = useLocation();
  
  const cameraRef = useRef<Mapbox.Camera>(null);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (userLocation) {
      calculateVendorDistance();
    }
  }, [userLocation]);

  const calculateVendorDistance = async () => {
    const dist = await getDistanceFromUser(
      vendorLocation.latitude,
      vendorLocation.longitude
    );
    const fee = calculateDeliveryFeeFromDistance(dist);
    setDistance(dist);
    setDeliveryFee(fee);
    if (onDistanceCalculated) {
      onDistanceCalculated(dist, fee);
    }
  };

  const fitToBounds = () => {
    if (!userLocation || !vendorLocation || !mapReady) return;
    
    const points = [
      [vendorLocation.longitude, vendorLocation.latitude],
      [userLocation.longitude, userLocation.latitude],
    ];
    
    let minLng = points[0][0], maxLng = points[0][0];
    let minLat = points[0][1], maxLat = points[0][1];
    
    points.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
    
    const padding = 0.02;
    cameraRef.current?.fitBounds(
      [maxLng + padding, maxLat + padding],
      [minLng - padding, minLat - padding],
      [50, 50, 50, 50],
      500
    );
  };

  const centerOnVendor = () => {
    if (vendorLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [vendorLocation.longitude, vendorLocation.latitude],
        zoomLevel: 16,
        animationDuration: 500,
      });
    }
  };

  const centerOnUser = () => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 16,
        animationDuration: 500,
      });
    } else {
      requestLocation();
    }
  };

  const openMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${vendorLocation.latitude},${vendorLocation.longitude}`;
    Linking.openURL(url);
  };

  const getInitialCenter = () => {
    if (userLocation) {
      return [userLocation.longitude, userLocation.latitude];
    }
    return [vendorLocation.longitude, vendorLocation.latitude];
  };

  if (!userLocation) {
    return (
      <TouchableOpacity style={styles.locationPrompt} onPress={requestLocation}>
        <Feather name="map-pin" size={24} color="#f97316" />
        <Text style={styles.locationPromptText}>Enable location to see distance</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      )}

      <Mapbox.MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/streets-v12"
        onDidFinishLoadingMap={() => {
          setIsLoading(false);
          setMapReady(true);
          setTimeout(fitToBounds, 500);
        }}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={getInitialCenter()}
          zoomLevel={13}
          animationDuration={1000}
        />

        {/* Vendor Marker */}
        <Mapbox.PointAnnotation
          id="vendor"
          coordinate={[vendorLocation.longitude, vendorLocation.latitude]}
          title={vendorLocation.name}
        >
          <View style={styles.vendorMarker}>
            <Feather name="coffee" size={20} color="#fff" />
          </View>
        </Mapbox.PointAnnotation>

        {/* User Location Marker */}
        <Mapbox.PointAnnotation
          id="user"
          coordinate={[userLocation.longitude, userLocation.latitude]}
          title="Your Location"
        >
          <View style={styles.userMarker}>
            <Feather name="navigation" size={16} color="#fff" />
          </View>
        </Mapbox.PointAnnotation>

        {/* Route Line */}
        {userLocation && vendorLocation && (
          <Mapbox.ShapeSource
            id="routeLine"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [userLocation.longitude, userLocation.latitude],
                  [vendorLocation.longitude, vendorLocation.latitude],
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
                lineDasharray: [2, 2],
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* Control Buttons */}
      <View style={styles.controlButtons}>
        <TouchableOpacity style={styles.controlButton} onPress={fitToBounds}>
          <Feather name="maximize-2" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={centerOnVendor}>
          <Feather name="coffee" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={centerOnUser}>
          <Feather name="navigation" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Distance Info Card */}
      {distance !== null && (
        <TouchableOpacity style={styles.distanceCard} onPress={openMaps}>
          <View style={styles.distanceRow}>
            <Feather name="navigation" size={16} color="#f97316" />
            <Text style={styles.distanceText}>
              {distance < 1 
                ? `${Math.round(distance * 1000)}m away` 
                : `${distance.toFixed(1)}km away`}
            </Text>
          </View>
          
          {deliveryFee !== null && (
            <View style={styles.feeRow}>
              <Feather name="truck" size={16} color="#f97316" />
              <Text style={styles.feeText}>
                Delivery fee: ₦{deliveryFee.toLocaleString()}
              </Text>
            </View>
          )}

          <View style={styles.getDirectionsRow}>
            <Text style={styles.getDirectionsText}>Get Directions</Text>
            <Feather name="external-link" size={12} color="#f97316" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    width: '100%',
    marginVertical: 16,
    borderRadius: 12,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  locationPrompt: {
    height: 200,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  locationPromptText: {
    color: '#666',
    marginTop: 8,
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
  },
  userMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  controlButtons: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    gap: 8,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 50,
    backgroundColor: 'rgba(26,26,26,0.95)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  distanceText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 13,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeText: {
    color: '#f97316',
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  getDirectionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  getDirectionsText: {
    color: '#f97316',
    fontSize: 11,
    marginRight: 4,
  },
});