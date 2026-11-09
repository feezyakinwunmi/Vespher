// app/contexts/RiderContext.tsx
// Shared state for the rider screens: online status, live location sharing and
// the rider's job lists. Mounted only inside the rider navigator.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  RiderOrder,
  acceptOrder as acceptOrderRequest,
  fetchActiveOrders,
  fetchAvailableOrders,
  fetchDeliveredOrders,
  getRiderAvailability,
  setRiderAvailability,
  MissingGear,
  fetchMissingGear,
  missingGearMessage,
  touchRiderPresence,
  updateRiderLocation,
} from '../services/riderOrders';
import { CLAIMABLE_STATUSES } from '../services/riderOrders';

// How often the rider's position is written while they are online.
const LOCATION_WRITE_INTERVAL_MS = 15000;
// Presence heartbeat: location writes only happen when the rider moves.
const HEARTBEAT_INTERVAL_MS = 60000;

interface RiderContextType {
  isOnline: boolean;
  togglingOnline: boolean;
  setOnline: (online: boolean) => Promise<{ ok: boolean; message?: string }>;
  locationDenied: boolean;
  available: RiderOrder[];
  active: RiderOrder[];
  delivered: RiderOrder[];
  isLoading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  acceptOrder: (order: RiderOrder) => Promise<{ ok: boolean; message?: string }>;
  // What the rider still needs (bike and/or bag) before they can go online or accept orders.
  missingGear: MissingGear;
}

const RiderContext = createContext<RiderContextType | undefined>(undefined);

export function RiderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const riderId = user?.id;

  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [missingGear, setMissingGear] = useState<MissingGear>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [available, setAvailable] = useState<RiderOrder[]>([]);
  const [active, setActive] = useState<RiderOrder[]>([]);
  const [delivered, setDelivered] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastWriteRef = useRef(0);

  const load = useCallback(async () => {
    if (!riderId) return;
    try {
      const [a, b, c] = await Promise.all([
        fetchAvailableOrders(riderId),
        fetchActiveOrders(riderId),
        fetchDeliveredOrders(riderId),
      ]);
      setAvailable(a);
      setActive(b);
      setDelivered(c);
    } catch (error) {
      console.error('Error loading rider jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [riderId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Initial load, online status and realtime refresh on any order change.
  useEffect(() => {
    if (!riderId) return;
    load();
    getRiderAvailability(riderId).then(setIsOnline);
    fetchMissingGear(riderId).then(setMissingGear);

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 600);
    };

    const channel = supabase
      .channel(`rider-orders-${riderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        const row = payload.new as { id?: string; rider_id?: string | null; status?: string };
        const before = payload.old as { rider_id?: string | null };
        if (row.rider_id && row.rider_id !== riderId) {
          // Claimed by someone else: drop it locally instead of refetching.
          setAvailable(list => list.filter(o => o.id !== row.id));
        } else if (row.rider_id === riderId || before.rider_id === riderId || CLAIMABLE_STATUSES.includes(row.status as any)) {
          debouncedLoad();
        }
      })
      .subscribe();

    const appState = AppState.addEventListener('change', s => {
      if (s === 'active') {
        load();
        // A bike or bag may have been assigned or taken back while the app was closed.
        fetchMissingGear(riderId).then(setMissingGear);
        getRiderAvailability(riderId).then(setIsOnline);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      channel.unsubscribe();
      appState.remove();
    };
  }, [riderId, load]);

  // Share location while online, or while carrying an order.
  const shouldTrack = !!riderId && (isOnline || active.length > 0);

  useEffect(() => {
    if (!shouldTrack || !riderId) return;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setLocationDenied(true);
        return;
      }
      setLocationDenied(false);

      const write = (loc: Location.LocationObject) => {
        const now = Date.now();
        if (now - lastWriteRef.current < LOCATION_WRITE_INTERVAL_MS) return;
        lastWriteRef.current = now;
        updateRiderLocation(riderId, loc.coords.latitude, loc.coords.longitude);
      };

      try {
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          lastWriteRef.current = 0;
          write(first);
        }
      } catch {
        // GPS may be off; the watcher below picks up once it is on.
      }

      if (cancelled) return;
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 20 },
        write,
      );
    })();

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [shouldTrack, riderId]);

  // Keep "online" fresh for admins even when the rider is standing still.
  useEffect(() => {
    if (!shouldTrack || !riderId) return;
    const timer = setInterval(() => {
      if (Date.now() - lastWriteRef.current >= HEARTBEAT_INTERVAL_MS) {
        lastWriteRef.current = Date.now();
        touchRiderPresence(riderId);
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [shouldTrack, riderId]);

  const setOnline = useCallback(async (online: boolean) => {
    if (!riderId) return { ok: false };
    if (!online && active.length > 0) {
      return { ok: false, message: 'Finish your active deliveries before going offline.' };
    }
    if (online) {
      const missing = await fetchMissingGear(riderId);
      setMissingGear(missing);
      if (missing) return { ok: false, message: missingGearMessage(missing) };
    }
    setTogglingOnline(true);
    try {
      await setRiderAvailability(riderId, online);
      setIsOnline(online);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Could not update your status.' };
    } finally {
      setTogglingOnline(false);
    }
  }, [riderId, active.length]);

  const acceptOrder = useCallback(async (order: RiderOrder) => {
    if (!riderId) return { ok: false };
    if (missingGear) return { ok: false, message: missingGearMessage(missingGear) };
    if (!isOnline) return { ok: false, message: 'Go online to accept deliveries.' };
    try {
      const ok = await acceptOrderRequest(order.id, riderId, order.delivery_fee);
      await load();
      return ok ? { ok } : { ok, message: 'Another rider already took this order.' };
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Could not accept this order.' };
    }
  }, [riderId, isOnline, missingGear, load]);

  return (
    <RiderContext.Provider
      value={{
        isOnline,
        togglingOnline,
        setOnline,
        missingGear,
        locationDenied,
        available,
        active,
        delivered,
        isLoading,
        refreshing,
        refresh,
        acceptOrder,
      }}
    >
      {children}
    </RiderContext.Provider>
  );
}

export function useRider() {
  const ctx = useContext(RiderContext);
  if (!ctx) throw new Error('useRider must be used inside RiderProvider');
  return ctx;
}
