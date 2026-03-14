// app/hooks/vendor/useVendorMenu.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from 'react-native';

export interface MenuItem {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url?: string;
  category: string;
  is_available: boolean;
  is_popular: boolean;
  preparation_time?: string;
  options?: any[];
  quantity_available?: number; // Track available quantity
  approval_status: 'pending' | 'approved' | 'rejected'; // New approval status
  created_at: string;
}

export function useVendorMenu() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);

  // Get vendor ID on mount
  useEffect(() => {
    if (!user) return;

    const getVendorId = async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setVendorId(data.id);
      }
    };

    getVendorId();
  }, [user]);

  const fetchMenuItems = useCallback(async () => {
    if (!vendorId) return;
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setItems(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [vendorId]);

  const addMenuItem = async (item: Omit<MenuItem, 'id' | 'created_at' | 'vendor_id' | 'approval_status'>) => {
    if (!vendorId) {
      Alert.alert('Error', 'Vendor ID not found');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...item,
          vendor_id: vendorId,
          approval_status: 'pending', // New items start as pending
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      setItems(prev => [data, ...prev]);
      Alert.alert('Success', 'Menu item added and pending admin approval');
      return data;
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', 'Failed to add menu item');
      throw err;
    }
  };

  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    try {
      // If updating after approval, reset approval status if content changed
      const item = items.find(i => i.id === id);
      if (item?.approval_status === 'approved' && 
          (updates.name || updates.description || updates.price || updates.category)) {
        updates.approval_status = 'pending';
      }

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setItems(prev => prev.map(item => item.id === id ? data : item));
      
      if (updates.approval_status === 'pending') {
        Alert.alert('Info', 'Item updated and pending re-approval');
      } else {
        Alert.alert('Success', 'Menu item updated');
      }
      
      return data;
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', 'Failed to update menu item');
      throw err;
    }
  };

  const deleteMenuItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== id));
      Alert.alert('Success', 'Menu item deleted');
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', 'Failed to delete menu item');
      throw err;
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    return updateMenuItem(id, { is_available: !currentStatus });
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 0) {
      Alert.alert('Error', 'Quantity cannot be negative');
      return;
    }
    return updateMenuItem(id, { quantity_available: quantity });
  };

  // Get counts for vendor dashboard
  const pendingCount = items.filter(i => i.approval_status === 'pending').length;
  const approvedCount = items.filter(i => i.approval_status === 'approved').length;
  const outOfStockCount = items.filter(i => i.quantity_available === 0).length;

  useEffect(() => {
    if (vendorId) {
      fetchMenuItems();
    }
  }, [vendorId, fetchMenuItems]);

  return {
    items,
    isLoading,
    error,
    pendingCount,
    approvedCount,
    outOfStockCount,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
    updateQuantity,
    refreshMenu: fetchMenuItems,
  };
}