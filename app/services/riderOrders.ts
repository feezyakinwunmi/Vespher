// app/services/riderOrders.ts
// Data access for the rider side. Riders only handle food orders from the
// `orders` table; business logistics deliveries live in a separate app.
import { supabase } from '../lib/supabase';

export type RiderOrderStatus = 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

// Orders a rider can claim: the vendor has accepted them and nobody has them yet.
export const CLAIMABLE_STATUSES: RiderOrderStatus[] = ['preparing', 'ready'];
export const ACTIVE_STATUSES: RiderOrderStatus[] = ['confirmed', 'preparing', 'ready', 'picked_up', 'in_transit'];

// Rider's share of the delivery fee, set in Admin → Settings. Defaults match the
// admin screen when a setting is missing.
const DEFAULT_COMPANY_VEHICLE_SHARE = 50;
const DEFAULT_OWN_VEHICLE_SHARE = 80;

// Signature of the server-side code check that marks an order as delivered.
const VERIFY_CODE_RPC = 'verify_delivery_code';

export interface RiderOrderItem {
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string | null;
}

export interface RiderOrder {
  id: string;
  order_number: string;
  status: RiderOrderStatus;
  rider_id: string | null;
  items: RiderOrderItem[];
  item_count: number;
  delivery_fee: number;
  rider_earnings: number;
  total: number;
  payment_method: string | null;
  notes: string | null;
  vendor: {
    id: string | null;
    name: string;
    phone: string | null;
    address: string;
    latitude: number | null;
    longitude: number | null;
    image_url: string | null;
  };
  customer: {
    id: string | null;
    name: string;
    phone: string | null;
    avatar_url: string | null;
  };
  dropoff: {
    address: string;
    landmark: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  created_at: string;
  updated_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}

const ORDER_SELECT = `
  *,
  vendor:vendor_id (id, name, phone, address, latitude, longitude, image_url),
  customer:users!orders_customer_id_fkey (id, name, phone, avatar_url)
`;

const parseJson = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};

export interface RiderShares {
  company: number; // rider rides a Vesphe bike
  own: number; // rider brings their own (or rented) vehicle
}

const SETTINGS_TTL_MS = 5 * 60 * 1000;
let sharesCache: { value: RiderShares; at: number } | null = null;
const ownershipCache = new Map<string, string | null>();

export async function getRiderShares(): Promise<RiderShares> {
  if (sharesCache && Date.now() - sharesCache.at < SETTINGS_TTL_MS) return sharesCache.value;
  const { data } = await supabase.from('platform_settings').select('*').order('id', { ascending: true }).limit(1).maybeSingle();
  const value = {
    company: num(data?.company_vehicle_rider_percentage) ?? DEFAULT_COMPANY_VEHICLE_SHARE,
    own: num(data?.personal_vehicle_rider_percentage) ?? DEFAULT_OWN_VEHICLE_SHARE,
  };
  sharesCache = { value, at: Date.now() };
  return value;
}

// "Own vehicle" pay applies to riders who bring a bike (owned or rented);
// everyone else rides a company bike.
export const usesOwnVehicle = (ownership?: string | null) => ownership === 'personal' || ownership === 'rented';

async function riderOwnership(riderId: string): Promise<string | null> {
  if (ownershipCache.has(riderId)) return ownershipCache.get(riderId) ?? null;
  const { data } = await supabase.from('users').select('vehicle_ownership').eq('id', riderId).maybeSingle();
  const ownership = data?.vehicle_ownership ?? null;
  ownershipCache.set(riderId, ownership);
  return ownership;
}

// The share (%) of the delivery fee this rider earns, based on their vehicle.
export async function getRiderPercentage(riderId?: string): Promise<number> {
  const shares = await getRiderShares();
  if (!riderId) return shares.company;
  return usesOwnVehicle(await riderOwnership(riderId)) ? shares.own : shares.company;
}

// What the rider takes home: the stored figure once accepted, otherwise an estimate.
export function riderShare(deliveryFee: number, storedEarnings: number | null, percentage: number): number {
  if (storedEarnings && storedEarnings > 0) return storedEarnings;
  return Math.round(deliveryFee * (percentage / 100));
}

export function mapOrder(row: any, percentage: number): RiderOrder {
  const items = parseJson<any[]>(row.items, []);
  const address = parseJson<any>(row.delivery_address, {});
  const addressObj = typeof address === 'string' ? { street: address } : address || {};
  const deliveryFee = num(row.delivery_fee) ?? 0;

  return {
    id: row.id,
    order_number: row.order_number || String(row.id).slice(0, 8).toUpperCase(),
    status: row.status,
    rider_id: row.rider_id ?? null,
    items: items.map((i: any) => ({
      product_id: i.product_id,
      name: i.name,
      quantity: i.quantity || 1,
      price: num(i.price) ?? 0,
      image_url: i.image_url || i.image || null,
    })),
    item_count: items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0),
    delivery_fee: deliveryFee,
    rider_earnings: riderShare(deliveryFee, num(row.rider_earnings), percentage),
    total: num(row.total) ?? 0,
    payment_method: row.payment_method ?? null,
    notes: row.notes || row.special_instructions || null,
    vendor: {
      id: row.vendor?.id ?? row.vendor_id ?? null,
      name: row.vendor?.name || 'Restaurant',
      phone: row.vendor?.phone || null,
      address: row.vendor?.address || 'Restaurant address',
      latitude: num(row.vendor?.latitude),
      longitude: num(row.vendor?.longitude),
      image_url: row.vendor?.image_url || null,
    },
    customer: {
      id: row.customer?.id ?? row.customer_id ?? null,
      name: row.customer?.name || 'Customer',
      phone: addressObj.phone || row.customer?.phone || null,
      avatar_url: row.customer?.avatar_url || null,
    },
    dropoff: {
      address: addressObj.street || addressObj.address || addressObj.label || 'Customer address',
      landmark: addressObj.landmark || addressObj.instructions || null,
      latitude: num(addressObj.latitude ?? addressObj.lat),
      longitude: num(addressObj.longitude ?? addressObj.lng),
    },
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    picked_up_at: row.picked_up_at ?? null,
    delivered_at: row.delivered_at ?? null,
  };
}

export async function fetchAvailableOrders(riderId?: string): Promise<RiderOrder[]> {
  const [pct, { data, error }] = await Promise.all([
    getRiderPercentage(riderId),
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .in('status', CLAIMABLE_STATUSES)
      .is('rider_id', null)
      .order('created_at', { ascending: true })
      .limit(50),
  ]);
  if (error) throw error;
  return (data || []).map(r => mapOrder(r, pct));
}

export async function fetchActiveOrders(riderId: string): Promise<RiderOrder[]> {
  const [pct, { data, error }] = await Promise.all([
    getRiderPercentage(riderId),
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('rider_id', riderId)
      .in('status', ACTIVE_STATUSES)
      .order('updated_at', { ascending: false }),
  ]);
  if (error) throw error;
  return (data || []).map(r => mapOrder(r, pct));
}

export async function fetchDeliveredOrders(riderId: string, limit = 200): Promise<RiderOrder[]> {
  const [pct, { data, error }] = await Promise.all([
    getRiderPercentage(riderId),
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('rider_id', riderId)
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false, nullsFirst: false })
      .limit(limit),
  ]);
  if (error) throw error;
  return (data || []).map(r => mapOrder(r, pct));
}

// Lifetime total across every delivered order (light query, used for the balance).
export async function fetchLifetimeEarnings(riderId: string): Promise<number> {
  const [pct, { data, error }] = await Promise.all([
    getRiderPercentage(riderId),
    supabase.from('orders').select('delivery_fee, rider_earnings').eq('rider_id', riderId).eq('status', 'delivered'),
  ]);
  if (error) throw error;
  return (data || []).reduce((sum, r) => sum + riderShare(num(r.delivery_fee) ?? 0, num(r.rider_earnings), pct), 0);
}

export async function fetchOrder(orderId: string, riderId?: string): Promise<RiderOrder | null> {
  const [pct, { data, error }] = await Promise.all([
    getRiderPercentage(riderId),
    supabase.from('orders').select(ORDER_SELECT).eq('id', orderId).maybeSingle(),
  ]);
  if (error) throw error;
  if (!data) return null;

  const order = mapOrder(data, pct);
  // Older orders didn't store item images; fill them from the menu.
  const missing = order.items.filter(i => !i.image_url && i.product_id).map(i => i.product_id!);
  if (missing.length) {
    const { data: products } = await supabase.from('products').select('id, image_url').in('id', missing);
    const images = new Map((products || []).map(p => [p.id, p.image_url]));
    order.items = order.items.map(i => ({ ...i, image_url: i.image_url || images.get(i.product_id!) || null }));
  }
  return order;
}

// Claims an order. Fails (returns false) when another rider got it first.
export async function acceptOrder(orderId: string, riderId: string, deliveryFee: number): Promise<boolean> {
  const pct = await getRiderPercentage(riderId);
  const riderCut = riderShare(deliveryFee, null, pct);
  const { data, error } = await supabase
    .from('orders')
    .update({
      rider_id: riderId,
      rider_earnings: riderCut,
      // Vesphe keeps the rest of the delivery fee (counted in admin revenue reports).
      platform_delivery_earnings: Math.max(0, deliveryFee - riderCut),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .is('rider_id', null)
    .in('status', CLAIMABLE_STATUSES)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markPickedUp(orderId: string, riderId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('orders')
    .update({ status: 'picked_up', picked_up_at: now, updated_at: now })
    .eq('id', orderId)
    .eq('rider_id', riderId)
    .eq('status', 'ready');
  if (error) throw error;
}

// Moving to in_transit makes the server generate the customer's delivery code.
export async function startTrip(orderId: string, riderId: string) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'in_transit', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('rider_id', riderId)
    .eq('status', 'picked_up');
  if (error) throw error;
}

const VERIFY_ERRORS = {
  invalid: 'That code is not correct. Ask the customer to check the code in their app.',
  expired: 'This code has expired. Contact Vesphe support to complete this delivery.',
  missing: 'No code has been created for this order yet. Make sure you tapped "Start trip".',
  status: 'This order is not on the way yet. Start the trip first.',
};

const verifyErrorMessage = (raw: string) => {
  const msg = raw.toLowerCase();
  if (msg.includes('invalid verification code')) return VERIFY_ERRORS.invalid;
  if (msg.includes('expired')) return VERIFY_ERRORS.expired;
  if (msg.includes('no verification code')) return VERIFY_ERRORS.missing;
  if (msg.includes('not in transit')) return VERIFY_ERRORS.status;
  return raw;
};

// Checks the customer's code on the server, then closes the order.
export async function completeDelivery(orderId: string, riderId: string, code: string): Promise<{ ok: boolean; message?: string }> {
  // verify_delivery_code(p_order_id text, p_code varchar, p_rider_id uuid) returns true
  // or raises; it marks the code verified but leaves the order status to us.
  const { data, error } = await supabase.rpc(VERIFY_CODE_RPC, {
    p_order_id: orderId,
    p_code: code.trim(),
    p_rider_id: riderId,
  });
  if (error) return { ok: false, message: verifyErrorMessage(error.message) };
  if (data === false) return { ok: false, message: VERIFY_ERRORS.invalid };

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'delivered', delivered_at: now, updated_at: now })
    .eq('id', orderId)
    .eq('rider_id', riderId)
    .neq('status', 'delivered');
  if (updateError) return { ok: false, message: updateError.message };
  return { ok: true };
}

// last_location_update doubles as the presence heartbeat (see utils/riderPresence).
export async function setRiderAvailability(riderId: string, available: boolean) {
  const { error } = await supabase
    .from('users')
    .update({ is_available: available, last_location_update: new Date().toISOString() })
    .eq('id', riderId);
  if (error) throw error;
}

// Heartbeat while online, so admins can tell a live rider from a closed app.
export async function touchRiderPresence(riderId: string) {
  await supabase.from('users').update({ last_location_update: new Date().toISOString() }).eq('id', riderId);
}

export async function getRiderAvailability(riderId: string): Promise<boolean> {
  const { data } = await supabase.from('users').select('is_available').eq('id', riderId).maybeSingle();
  return !!data?.is_available;
}

export async function updateRiderLocation(riderId: string, latitude: number, longitude: number) {
  await supabase
    .from('users')
    .update({
      current_latitude: latitude,
      current_longitude: longitude,
      last_location_update: new Date().toISOString(),
    })
    .eq('id', riderId);
}

// The company bike assigned to this rider, if any (see the Fleet page on the web).
export interface AssignedBike {
  plate_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  assigned_at: string;
}

// Riders need a bike (unless they bring their own) and a Vesphe delivery bag
// before they can go online or accept orders. Enforced in the database too.
export type MissingGear = 'bike' | 'bag' | 'bike_and_bag' | null;

export async function fetchMissingGear(riderId: string): Promise<MissingGear> {
  const { data, error } = await supabase.rpc('rider_missing_gear', { p_rider_id: riderId });
  // If the check itself isn't available yet, don't lock riders out.
  if (error) return null;
  return (data as MissingGear) || null;
}

export function missingGearMessage(missing: MissingGear): string {
  const what = missing === 'bike_and_bag' ? 'a Vesphe bike and delivery bag' : missing === 'bike' ? 'a Vesphe bike' : 'a Vesphe delivery bag';
  return `You don't have ${what} assigned yet. You can go online once ${missing === 'bike_and_bag' ? 'they are' : 'it is'} assigned to you.`;
}

export interface AssignedBag {
  bag_code: string;
  size: string | null;
  color: string | null;
  assigned_at: string;
}

export async function fetchMyBag(riderId: string): Promise<AssignedBag | null> {
  const { data, error } = await supabase
    .from('bag_assignments')
    .select('assigned_at, bag:bag_id (bag_code, size, color)')
    .eq('rider_id', riderId)
    .is('returned_at', null)
    .maybeSingle();
  if (error || !data) return null;
  const bag: any = Array.isArray((data as any).bag) ? (data as any).bag[0] : (data as any).bag;
  return bag ? { ...bag, assigned_at: (data as any).assigned_at } : null;
}

export async function fetchMyBike(riderId: string): Promise<AssignedBike | null> {
  const { data, error } = await supabase
    .from('bike_assignments')
    .select('assigned_at, bike:bike_id (plate_number, make, model, color)')
    .eq('rider_id', riderId)
    .is('returned_at', null)
    .maybeSingle();
  if (error || !data) return null;
  const bike: any = Array.isArray((data as any).bike) ? (data as any).bike[0] : (data as any).bike;
  return bike ? { ...bike, assigned_at: (data as any).assigned_at } : null;
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export interface RiderWithdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bank_name: string | null;
  account_number: string | null;
  reference: string | null;
  created_at: string;
}

export interface RiderBankDetails {
  id?: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

export const MIN_WITHDRAWAL = 1000;

export async function fetchWithdrawals(riderId: string): Promise<RiderWithdrawal[]> {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('id, amount, status, bank_name, account_number, reference, created_at')
    .eq('user_id', riderId)
    .eq('user_type', 'rider')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(w => ({ ...w, amount: num(w.amount) ?? 0 }));
}

export async function fetchBankDetails(riderId: string): Promise<RiderBankDetails | null> {
  const { data } = await supabase
    .from('bank_details')
    .select('id, bank_name, account_number, account_name')
    .eq('user_id', riderId)
    .eq('user_type', 'rider')
    .eq('is_default', true)
    .maybeSingle();
  return data || null;
}

export async function saveBankDetails(riderId: string, details: RiderBankDetails): Promise<RiderBankDetails> {
  const payload = {
    user_id: riderId,
    user_type: 'rider',
    bank_name: details.bank_name,
    account_number: details.account_number,
    account_name: details.account_name,
    is_default: true,
    updated_at: new Date().toISOString(),
  };
  const query = details.id
    ? supabase.from('bank_details').update(payload).eq('id', details.id)
    : supabase.from('bank_details').insert(payload);
  const { data, error } = await query.select('id, bank_name, account_number, account_name').single();
  if (error) throw error;
  return data;
}

export async function requestWithdrawal(riderId: string, amount: number, bank: RiderBankDetails) {
  const reference = `WD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const { error } = await supabase.from('withdrawals').insert({
    user_id: riderId,
    user_type: 'rider',
    amount,
    bank_name: bank.bank_name,
    account_number: bank.account_number,
    account_name: bank.account_name,
    status: 'pending',
    reference,
  });
  if (error) throw error;
  return reference;
}
