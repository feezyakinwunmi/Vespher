// app/hooks/customer/useVendors.ts
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  image_url?: string;
  category: string;
  isAvailable: boolean;
  is_available?: boolean;
  isPopular: boolean;
  is_popular?: boolean;
  preparationTime?: number;
  preparation_time?: number;
  created_at?: string;
  // Add stock fields
  stock_quantity?: number;
  track_stock?: boolean;
}

export interface Vendor {
  
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  image: string;
  coverImage: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  isOpen: boolean;
  address: string;
  phone: string;
  email: string;
  is_approved: boolean;
  owner_id: string;
  created_at?: string;
  latitude?: number;
  longitude?: number;
  products: Product[];
  image_url?: string;
  cover_image_url?: string;
  businessCover?: string;
  businessLogo?: any;
}

// One vendor list per device: the many screens using this hook share a single
// download and realtime connection, and open/close changes are patched in place
// so one vendor's update doesn't make every customer re-download the catalogue.
const VENDOR_CACHE_MS = 60000;
let vendorCache: { vendors: Vendor[]; at: number } | null = null;
let vendorsInFlight: Promise<Vendor[]> | null = null;
let vendorChannel: ReturnType<typeof supabase.channel> | null = null;
const vendorSubscribers = new Set<(vendors: Vendor[]) => void>();

function publishVendors(vendors: Vendor[]) {
  vendorCache = { vendors, at: Date.now() };
  vendorSubscribers.forEach(notify => notify(vendors));
}

function applyVendorChange(row: any) {
  if (!vendorCache) return;
  const vendors = row.is_approved === false || row.is_suspended === true
    ? vendorCache.vendors.filter(v => v.id !== row.id)
    : vendorCache.vendors.map(v => (v.id === row.id ? { ...v, isOpen: row.is_open ?? true } : v));
  publishVendors(vendors);
}

function subscribeToVendors(notify: (vendors: Vendor[]) => void) {
  vendorSubscribers.add(notify);
  if (!vendorChannel) {
    vendorChannel = supabase
      .channel('customer-vendors')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vendors' }, payload => applyVendorChange(payload.new))
      .subscribe();
  }
  return () => {
    vendorSubscribers.delete(notify);
    if (vendorSubscribers.size === 0 && vendorChannel) {
      vendorChannel.unsubscribe();
      vendorChannel = null;
    }
  };
}

async function queryVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select(`
      *,
      products (*),
      users!owner_id (
        avatar_url
      )
    `)
    .eq('is_approved', true)
    .eq('is_suspended', false)
    .order('rating', { ascending: false, nullsFirst: false });

  if (error) throw error;

  if (!data || data.length === 0) return [];

  // Transform data + filter only approved products and products in stock
  const transformedVendors: Vendor[] = data.map(v => ({
    id: v.id,
    name: v.name || 'Unnamed Vendor',
    description: v.description || '',
    category: v.category || 'Restaurant',
    logo: v.logo_url || v.users?.avatar_url || '',
    image: v.avatars_url || v.users?.avatar_url || '',
    coverImage: v.cover_image_url || v.image_url || v.users?.avatar_url || '',
    rating: v.rating || 0,
    reviewCount: v.review_count || 0,
    deliveryTime: v.delivery_time || '30-45 min',
    deliveryFee: v.delivery_fee || 500,
    minOrder: v.min_order || 1000,
    isOpen: v.is_open ?? true,
    address: v.address || '',
    phone: v.phone || '',
    email: v.email,
    latitude: v.latitude,
    longitude: v.longitude,
    is_approved: v.is_approved,
    owner_id: v.owner_id,
    created_at: v.created_at,
    // Only include approved products that are in stock
    products: (v.products || [])
      .filter((p: any) => {
        // First, only approved products
        if (p.approval_status !== 'approved') return false;
        
        // Then, check stock if tracking is enabled
        if (p.track_stock === true) {
          // Only show if stock_quantity > 0
          return (p.stock_quantity || 0) > 0;
        }
        
        // If stock tracking is disabled, always show
        return true;
      })
      .map((p: any) => ({
        id: p.id,
        vendorId: p.vendor_id,
        name: p.name || 'Unnamed Product',
        description: p.description || '',
        price: p.price || 0,
        originalPrice: p.original_price,
        image: p.image_url || '',
        image_url: p.image_url,
        category: p.category || 'Other',
        isAvailable: p.is_available ?? true,
        is_available: p.is_available,
        isPopular: p.is_popular || false,
        is_popular: p.is_popular,
        preparationTime: p.preparation_time,
        preparation_time: p.preparation_time,
        ingredients: p.ingredients || [],
        allergens: p.allergens || [],
        health_tags: p.health_tags || [],
        meal_times: p.meal_times || [],
        created_at: p.created_at,
        // Include stock fields for UI display
        stock_quantity: p.stock_quantity,
        track_stock: p.track_stock,
      })),
  }));

      return transformedVendors;
}

function loadVendors(force: boolean): Promise<Vendor[]> {
  if (!force && vendorCache && Date.now() - vendorCache.at < VENDOR_CACHE_MS) return Promise.resolve(vendorCache.vendors);
  if (!vendorsInFlight) {
    vendorsInFlight = queryVendors()
      .then(vendors => {
        publishVendors(vendors);
        return vendors;
      })
      .finally(() => {
        vendorsInFlight = null;
      });
  }
  return vendorsInFlight;
}

export function useVendors() {
  const { isReady } = useAuth();
  // Every approved vendor, including closed ones (shop pages show a "closed" state).
  const [allVendors, setAllVendors] = useState<Vendor[]>(vendorCache?.vendors ?? []);
  // Closed shops (vendor switched off "Open for orders") are unlisted for customers.
  // Memoised: screens run effects on `vendors`, so a new array every render loops.
  const vendors = useMemo(() => allVendors.filter(v => v.isOpen), [allVendors]);
  const [isLoading, setIsLoading] = useState(!vendorCache);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = async (force = false) => {
    try {
      setIsLoading(!vendorCache);
      setError(null);

      const transformedVendors = await loadVendors(force);
      setAllVendors(transformedVendors);
    } catch (err: any) {
      console.error('Error fetching vendors:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch only when auth is ready
  useEffect(() => {
    if (!isReady) return;
    fetchVendors();
  }, [isReady]);

  // Every screen on the device shares one list and one live connection.
  useEffect(() => {
    if (!isReady) return;
    return subscribeToVendors(setAllVendors);
  }, [isReady]);

  const getVendorById = (id: string) => {
    return allVendors.find(v => v.id === id) || null;
  };

  const getVendorsByCategory = (category: string) => {
    if (category === 'All') return vendors;
    return vendors.filter(v => 
      v.products.some(p => p.category === category)
    );
  };

  const searchVendors = (query: string) => {
    const searchTerm = query.toLowerCase();
    return vendors.filter(v => 
      v.name.toLowerCase().includes(searchTerm) ||
      v.description.toLowerCase().includes(searchTerm) ||
      v.products.some(p => p.name.toLowerCase().includes(searchTerm))
    );
  };

  return {
    vendors,
    allVendors,
    isLoading,
    error,
    refresh: () => fetchVendors(true),
    getVendorById,
    getVendorsByCategory,
    searchVendors,
  };
}