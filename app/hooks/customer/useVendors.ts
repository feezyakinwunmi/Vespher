// app/hooks/customer/useVendors.ts
import { useState, useEffect } from 'react';
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
}

export function useVendors() {
  const { isReady } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('vendors')
        .select(`
          *,
          products (*),
          users!owner_id (
            avatar_url
          )
        `)
        .eq('is_approved', true)              // Still require approval
        .eq('is_suspended', false)            // ← NEW: Exclude suspended vendors
        .order('rating', { ascending: false, nullsFirst: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setVendors([]);
        return;
      }

      // Transform data + filter only approved products
      const transformedVendors: Vendor[] = data.map(v => ({
        id: v.id,
        name: v.name || 'Unnamed Vendor',
        description: v.description || '',
        category: v.category || 'Restaurant',
        logo: v.logo_url || v.users?.avatar_url || '',
        image: v.image_url || v.users?.avatar_url || '',
        coverImage: v.cover_image || v.image_url || v.users?.avatar_url || '',
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
        // Only include approved products
        products: (v.products || [])
          .filter((p: any) => p.approval_status === 'approved')
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
            created_at: p.created_at,
          })),
      }));

      setVendors(transformedVendors);
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

  const getVendorById = (id: string) => {
    return vendors.find(v => v.id === id) || null;
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
    isLoading,
    error,
    refresh: fetchVendors,
    getVendorById,
    getVendorsByCategory,
    searchVendors,
  };
}