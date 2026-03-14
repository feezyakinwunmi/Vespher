// app/contexts/LocationContext.tsx

import React, { createContext, useContext, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Address } from '../types';
import { usePlatformSettings } from '../hooks/usePlatformSettings';

interface LocationContextType {
  userLocation: { latitude: number; longitude: number } | null;
  currentLocationAddress: Address | null;
  isLoading: boolean;
  error: string | null;
  deliveryFee: number;
  deliveryDistance: number | null;
  requestLocation: () => Promise<Address | null>;
  saveCurrentLocationAsAddress: () => Promise<Address | null>;
  calculateDeliveryToVendor: (vendorLat: number, vendorLng: number, deliveryLat: number, deliveryLng: number) => Promise<number>;
  getDistanceFromUser: (destLat: number, destLng: number) => Promise<number>; // Renamed to avoid confusion
  calculateDeliveryFeeFromDistance: (distanceKm: number) => number; // Renamed
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const DELIVERY_FEE_PER_KM = 500; // ₦500 per kilometer

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryDistance, setDeliveryDistance] = useState<number | null>(null);
const { settings } = usePlatformSettings();

  // Internal helper function for Haversine calculation
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const requestLocation = async (): Promise<Address | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      const [addressResult] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      let formattedAddress = 'Current Location';
      if (addressResult) {
        const parts = [];
        if (addressResult.street) parts.push(addressResult.street);
        if (addressResult.city) parts.push(addressResult.city);
        if (addressResult.region) parts.push(addressResult.region);
        formattedAddress = parts.join(', ') || 'Current Location';
      }

      const locationAddress: Address = {
        id: 'temp-current-location',
        label: 'Current Location',
        street: formattedAddress,
        area: '',
        phone: user?.phone || '',
        latitude,
        longitude,
        is_default: false,
        isCurrentLocation: true,
      };

      setCurrentLocationAddress(locationAddress);
      return locationAddress;
    } catch (err) {
      console.error('Error getting location:', err);
      setError('Failed to get location');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

// app/contexts/LocationContext.tsx
// Update the saveCurrentLocationAsAddress function:

const saveCurrentLocationAsAddress = async (): Promise<Address | null> => {
  if (!user) {
    setError('You must be logged in to save an address');
    return null;
  }

  let location = currentLocationAddress;
  if (!location) {
    location = await requestLocation();
    if (!location) return null;
  }

  try {
    setIsLoading(true);
    
    // Check if this location already exists
    const { data: existingAddresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .eq('latitude', location.latitude)
      .eq('longitude', location.longitude);

    if (existingAddresses && existingAddresses.length > 0) {
      // Address already exists, return it
      return existingAddresses[0] as Address;
    }

    // Check if this is the first address
    const { count } = await supabase
      .from('addresses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Save to database
    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id: user.id,
        label: 'Business Location', // Changed from 'Current Location' to be more specific for vendors
        street: location.street,
        area: location.area || '',
        phone: user.phone || '',
        latitude: location.latitude,
        longitude: location.longitude,
        is_default: count === 0, // Make default if first address
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log('Saved address to DB:', data);
    return data as Address;
  } catch (err) {
    console.error('Error saving location:', err);
    setError('Failed to save location');
    return null;
  } finally {
    setIsLoading(false);
  }
};

const calculateDeliveryToVendor = async (
  vendorLat: number, 
  vendorLng: number,
  deliveryLat: number,
  deliveryLng: number
): Promise<number> => {
  const distance = calculateHaversineDistance(deliveryLat, deliveryLng, vendorLat, vendorLng);
  setDeliveryDistance(distance);
  
  const roundedDistance = Math.round(distance * 10) / 10; // Round to 1 decimal
  let fee = roundedDistance * (settings?.delivery_fee_per_km ?? 500);
  
  // Apply min/max bounds
  fee = Math.max(settings?.min_delivery_fee ?? 500, Math.min(settings?.max_delivery_fee ?? 5000, fee));
  
  setDeliveryFee(fee);
  return fee;
};

  const getDistanceFromUser = async (destLat: number, destLng: number): Promise<number> => {
    if (!userLocation) {
      await requestLocation();
      if (!userLocation) return 0;
    }

    return calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      destLat,
      destLng
    );
  };

const calculateDeliveryFeeFromDistance = (distanceKm: number): number => {
  const roundedDistance = Math.round(distanceKm * 10) / 10;
  
  const feePerKm = settings?.delivery_fee_per_km ?? 500; // Use 500 as fallback if settings is null
  const minFee = settings?.min_delivery_fee ?? 500;
  const maxFee = settings?.max_delivery_fee ?? 5000;
  
  let fee = roundedDistance * feePerKm;
  fee = Math.max(minFee, Math.min(maxFee, fee));
  
  return fee;
};

  return (
    <LocationContext.Provider value={{
      userLocation,
      currentLocationAddress,
      isLoading,
      error,
      deliveryFee,
      deliveryDistance,
      requestLocation,
      saveCurrentLocationAsAddress,
      calculateDeliveryToVendor,
      getDistanceFromUser, // Renamed
      calculateDeliveryFeeFromDistance, // Renamed
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
}