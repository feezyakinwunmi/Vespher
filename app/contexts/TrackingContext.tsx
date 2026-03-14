// app/contexts/TrackingContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface RiderLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface TrackingContextType {
  riderLocation: RiderLocation | null;
  isTracking: boolean;
  startTracking: (orderId: string) => void;
  stopTracking: () => void;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [riderId, setRiderId] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  // Get rider ID from the order
  const fetchRiderId = async (orderId: string) => {
    try {
      // First try business_logistics
      const { data: businessData, error: businessError } = await supabase
        .from('business_logistics')
        .select('rider_id')
        .eq('id', orderId)
        .maybeSingle();

      if (businessData?.rider_id) {
        return businessData.rider_id;
      }

      // If not found, try orders table
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('rider_id')
        .eq('id', orderId)
        .maybeSingle();

      if (orderData?.rider_id) {
        return orderData.rider_id;
      }

      return null;
    } catch (error) {
      console.error('Error fetching rider ID:', error);
      return null;
    }
  };

  // Fetch initial rider location from users table
  const fetchInitialLocation = async (riderId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('current_latitude, current_longitude, last_location_update')
        .eq('id', riderId)
        .single();

      if (error) {
        console.error('Error fetching initial rider location:', error);
        return;
      }

      if (data?.current_latitude && data?.current_longitude) {
        console.log('Initial rider location from users table:', data);
        setRiderLocation({
          latitude: Number(data.current_latitude),
          longitude: Number(data.current_longitude),
          timestamp: data.last_location_update || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error in fetchInitialLocation:', error);
    }
  };

  // Start tracking a specific order
  const startTracking = async (orderId: string) => {
    console.log('Starting tracking for order:', orderId);
    setCurrentOrderId(orderId);
    setIsTracking(true);

    // Get the rider ID from the order
    const riderIdFromOrder = await fetchRiderId(orderId);
    
    if (!riderIdFromOrder) {
      console.log('No rider assigned to this order yet');
      return;
    }

    setRiderId(riderIdFromOrder);
    
    // Fetch initial location from users table
    await fetchInitialLocation(riderIdFromOrder);

    // Subscribe to rider location updates from users table
    subscriptionRef.current = supabase
      .channel(`rider-location-${riderIdFromOrder}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${riderIdFromOrder}`,
        },
        (payload) => {
          console.log('Rider location update from users table:', {
            lat: payload.new.current_latitude,
            lng: payload.new.current_longitude,
            time: payload.new.last_location_update
          });
          
          if (payload.new.current_latitude && payload.new.current_longitude) {
            setRiderLocation({
              latitude: Number(payload.new.current_latitude),
              longitude: Number(payload.new.current_longitude),
              timestamp: payload.new.last_location_update || new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();

    console.log('Subscription created for rider:', riderIdFromOrder);
  };

  // Stop tracking
  const stopTracking = () => {
    console.log('Stopping tracking for order:', currentOrderId);
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    setRiderLocation(null);
    setIsTracking(false);
    setCurrentOrderId(null);
    setRiderId(null);
  };

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  return (
    <TrackingContext.Provider value={{
      riderLocation,
      isTracking,
      startTracking,
      stopTracking,
    }}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within TrackingProvider');
  }
  return context;
}


