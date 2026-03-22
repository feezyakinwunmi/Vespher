// app/hooks/vendor/useVendorProfile.ts
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from 'react-native';

export type BusinessHours = {
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
};

export interface VendorProfile {
  id: string;
  // User table fields
  name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  
  // Vendors table fields
  businessName: string;
  businessDescription?: string;
  businessAddress: string;
  businessCategory: string;
  businessLogo?: string;
  businessCover?: string;
  
  // Settings
  businessHours: BusinessHours;
  deliveryRadius: number;
  minOrder: number;
  deliveryFee: number;
  
  // Bank details
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountName: string;

  
  // Notification settings - ADD THIS
  notifications: {
    newOrders: boolean;
    orderUpdates: boolean;
    payments: boolean;
  };
}

export function useVendorProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select(`
          id,
          name,
          description,
          address,
          category,
          image_url,
          cover_image_url,
          opening_hours,
          delivery_radius,
          min_order,
          delivery_fee,
          bank_name,
          account_number,
          account_name,
          notification_settings,
          users!owner_id (
            name,
            email,
            phone,
            avatar_url
          )
        `)
        .eq('owner_id', user.id)
        .single();

      if (vendorError) throw vendorError;

      const userData = vendorData.users && Array.isArray(vendorData.users) 
        ? vendorData.users[0] 
        : vendorData.users || {};

      if (mounted.current) {
        setProfile({
          id: vendorData.id,
          name: userData?.name || '',
          email: userData?.email || '',
          phone: userData?.phone || '',
          avatar_url: userData?.avatar_url,
          businessName: vendorData.name,
          businessDescription: vendorData.description,
          businessAddress: vendorData.address,
          businessCategory: vendorData.category,
          businessLogo: vendorData.image_url,
          businessCover: vendorData.cover_image_url,
          businessHours: vendorData.opening_hours || {
            mon: '8:00-22:00',
            tue: '8:00-22:00',
            wed: '8:00-22:00',
            thu: '8:00-22:00',
            fri: '8:00-22:00',
            sat: '9:00-23:00',
            sun: '9:00-23:00'
          },
          deliveryRadius: vendorData.delivery_radius || 5,
          minOrder: vendorData.min_order || 1000,
          deliveryFee: vendorData.delivery_fee || 500,
          bankName: vendorData.bank_name || '',
          accountNumber: vendorData.account_number || '',
          accountName: vendorData.account_name || '',
          notifications: vendorData.notification_settings || {
            newOrders: true,
            orderUpdates: true,
            payments: true,
          },
        });
      }
    } catch (err: any) {
      if (mounted.current) {
        console.error('Error fetching vendor profile:', err);
        setError(err.message);
        Alert.alert('Error', 'Failed to load profile');
      }
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<VendorProfile>) => {
    if (!user || !profile) return;

    try {
      setIsLoading(true);

      const { data: vendorData, error: vendorSelectError } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (vendorSelectError) throw vendorSelectError;
      if (!vendorData) throw new Error('Vendor not found');

      const userUpdates: any = {};
      if (updates.name !== undefined) userUpdates.name = updates.name;
      if (updates.phone !== undefined) userUpdates.phone = updates.phone;
      if (updates.avatar_url !== undefined) userUpdates.avatar_url = updates.avatar_url;

      if (Object.keys(userUpdates).length > 0) {
        const { error: userError } = await supabase
          .from('users')
          .update(userUpdates)
          .eq('id', user.id);

        if (userError) throw userError;
      }

      const vendorUpdates: any = {};
      if (updates.businessName) vendorUpdates.name = updates.businessName;
      if (updates.businessDescription !== undefined) vendorUpdates.description = updates.businessDescription;
      if (updates.businessAddress) vendorUpdates.address = updates.businessAddress;
      if (updates.businessCategory) vendorUpdates.category = updates.businessCategory;
      if (updates.businessLogo) vendorUpdates.image_url = updates.businessLogo;
      if (updates.businessCover) vendorUpdates.cover_image_url = updates.businessCover;
      if (updates.businessHours) vendorUpdates.opening_hours = updates.businessHours;
      if (updates.deliveryRadius) vendorUpdates.delivery_radius = updates.deliveryRadius;
      if (updates.minOrder) vendorUpdates.min_order = updates.minOrder;
      if (updates.deliveryFee) vendorUpdates.delivery_fee = updates.deliveryFee;
      if (updates.bankName) vendorUpdates.bank_name = updates.bankName;
      if (updates.accountNumber) vendorUpdates.account_number = updates.accountNumber;
      if (updates.accountName) vendorUpdates.account_name = updates.accountName;
      if (updates.notifications) vendorUpdates.notification_settings = updates.notifications;

      if (Object.keys(vendorUpdates).length > 0) {
        const { error: vendorError } = await supabase
          .from('vendors')
          .update(vendorUpdates)
          .eq('id', vendorData.id);

        if (vendorError) throw vendorError;
      }

      await fetchProfile();
      Alert.alert('Success', 'Profile updated successfully');

    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message);
      Alert.alert('Error', err.message || 'Failed to update profile');
      throw err;
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    fetchProfile();

    return () => {
      mounted.current = false;
    };
  }, [user]);

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    refreshProfile: fetchProfile,
  };
}