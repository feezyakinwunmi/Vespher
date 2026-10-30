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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useLocation } from '../contexts/LocationContext';
import { useVendors } from '../hooks/customer/useVendors';

interface VendorMapProps {
  vendorId: string; // Change: pass vendorId instead of full location
  onDistanceCalculated?: (distance: number, fee: number) => void;
}

export function VendorMap({ vendorId, onDistanceCalculated }: VendorMapProps) {
  const { 
    userLocation, 
    getDistanceFromUser, 
    calculateDeliveryFeeFromDistance, 
    requestLocation 
  } = useLocation();
  
  // ✅ Get vendor data from the vendors hook
  const { allVendors: vendors } = useVendors();
  const vendor = vendors.find(v => v.id === vendorId);
  
  const mapRef = useRef<MapView>(null);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState<Region>({
    latitude: vendor?.latitude || 6.5244,
    longitude: vendor?.longitude || 3.3792,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Update region when vendor loads
  useEffect(() => {
    if (vendor?.latitude && vendor?.longitude) {
      setRegion({
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  }, [vendor]);

  useEffect(() => {
    if (userLocation && vendor) {
      calculateVendorDistance();
      fitToBounds();
    }
  }, [userLocation, vendor]);

  const calculateVendorDistance = async () => {
    if (!vendor?.latitude || !vendor?.longitude) return;
    
    const dist = await getDistanceFromUser(
      vendor.latitude,
      vendor.longitude
    );
    const fee = calculateDeliveryFeeFromDistance(dist);
    setDistance(dist);
    setDeliveryFee(fee);
    if (onDistanceCalculated) {
      onDistanceCalculated(dist, fee);
    }
  };

  const fitToBounds = () => {
    if (!userLocation || !vendor?.latitude || !vendor?.longitude || !mapReady) return;
    
    const points = [
      { latitude: vendor.latitude, longitude: vendor.longitude },
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
    ];
    
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
    
    mapRef.current?.animateToRegion(newRegion, 500);
    setRegion(newRegion);
  };

  const centerOnVendor = () => {
    if (vendor?.latitude && vendor?.longitude) {
      mapRef.current?.animateToRegion({
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const centerOnUser = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    } else {
      requestLocation();
    }
  };

  const openMaps = () => {
    if (vendor?.latitude && vendor?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${vendor.latitude},${vendor.longitude}`;
      Linking.openURL(url);
    }
  };

  const getInitialRegion = () => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }
    return {
      latitude: vendor?.latitude || 6.5244,
      longitude: vendor?.longitude || 3.3792,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };
  };

  if (!vendor) {
    return (
      <View style={styles.locationPrompt}>
        <ActivityIndicator size="small" color="#f97316" />
        <Text style={styles.locationPromptText}>Loading vendor...</Text>
      </View>
    );
  }

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

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={getInitialRegion()}
        region={region}
        onMapReady={() => {
          setIsLoading(false);
          setMapReady(true);
          setTimeout(fitToBounds, 500);
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        zoomControlEnabled={true}
      >
        {/* Vendor Marker */}
        {vendor.latitude && vendor.longitude && (
          <Marker
            coordinate={{
              latitude: vendor.latitude,
              longitude: vendor.longitude,
            }}
            title={vendor.name}
            description={vendor.address}
          >
            <View style={styles.vendorMarker}>
              <Feather name="coffee" size={20} color="#fff" />
            </View>
          </Marker>
        )}

        {/* User Location Marker */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Your Location"
          >
            <View style={styles.userMarker}>
              <Feather name="navigation" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Route Line between user and vendor */}
        {userLocation && vendor.latitude && vendor.longitude && (
          <Polyline
            coordinates={[
              { latitude: userLocation.latitude, longitude: userLocation.longitude },
              { latitude: vendor.latitude, longitude: vendor.longitude },
            ]}
            strokeColor="#f97316"
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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