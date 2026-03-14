// app/components/VendorMap.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, Linking } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useLocation } from '../contexts/LocationContext';

const { width } = Dimensions.get('window');

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
const { userLocation, getDistanceFromUser, calculateDeliveryFeeFromDistance, requestLocation } = useLocation();  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  
  const [mapRegion, setMapRegion] = useState({
    latitude: vendorLocation.latitude,
    longitude: vendorLocation.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  useEffect(() => {
    calculateVendorDistance();
  }, [userLocation]);

  const calculateVendorDistance = async () => {
   const dist = await getDistanceFromUser(vendorLocation.latitude, vendorLocation.longitude);
const fee = calculateDeliveryFeeFromDistance(dist);
    setDeliveryFee(fee);
    
    if (onDistanceCalculated) {
      onDistanceCalculated(dist, fee);
    }
  };

  const openMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${vendorLocation.latitude},${vendorLocation.longitude}`;
    Linking.openURL(url);
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
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
      >
        {/* Vendor Marker */}
        <Marker
          coordinate={{
            latitude: vendorLocation.latitude,
            longitude: vendorLocation.longitude,
          }}
          title={vendorLocation.name}
          description={vendorLocation.address}
          pinColor="#f97316"
        />

        {/* User Location Marker */}
        <Marker
          coordinate={userLocation}
          title="Your Location"
          pinColor="#f97316"
        />
      </MapView>

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
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
  distanceCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: '#1a1a1a',
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
    fontSize: 14,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeText: {
    color: '#f97316',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  getDirectionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  getDirectionsText: {
    color: '#f97316',
    fontSize: 12,
    marginRight: 4,
  },
});