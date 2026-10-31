// app/utils/riderPresence.ts
// One definition of "online" for every admin screen. A rider is online when
// their switch is on AND the rider app has checked in recently: the app sends a
// heartbeat every minute while online (see RiderContext), so a rider who closed
// the app without switching off drops to offline after a few minutes.
export const PRESENCE_TIMEOUT_MS = 5 * 60 * 1000;

interface PresenceFields {
  is_available?: boolean | null;
  is_suspended?: boolean | null;
  last_location_update?: string | null;
}

export function isRiderOnline(r: PresenceFields, now = Date.now()): boolean {
  if (r.is_suspended || !r.is_available || !r.last_location_update) return false;
  return now - new Date(r.last_location_update).getTime() < PRESENCE_TIMEOUT_MS;
}

export type RiderStatus = 'suspended' | 'busy' | 'available' | 'offline';

export function riderStatus(r: PresenceFields & { active_order_count?: number | null }, now = Date.now()): RiderStatus {
  if (r.is_suspended) return 'suspended';
  if ((r.active_order_count || 0) > 0) return 'busy';
  return isRiderOnline(r, now) ? 'available' : 'offline';
}

export const RIDER_STATUS_COLOR: Record<RiderStatus, string> = {
  suspended: '#ef4444',
  busy: '#f59e0b',
  available: '#10b981',
  offline: '#6b7280',
};
