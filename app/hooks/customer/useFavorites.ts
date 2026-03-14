// app/hooks/useFavorites.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from 'react-native';

export function useFavorites() {
  const { user, isReady } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds([]);
      setIsLoading(false);
      return;
    }

    try {
      console.log('Fetching favorites for user:', user.id);
      
      const { data, error } = await supabase
        .from('favorites')
        .select('vendor_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Fetch error:', error);
        throw error;
      }

      console.log('Fetched favorites:', data);
      setFavoriteIds(data?.map(f => f.vendor_id) || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isReady) return;
    fetchFavorites();
  }, [isReady, fetchFavorites]);

  const addFavorite = async (vendorId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to save favorites');
      return false;
    }

    try {
      console.log('Adding favorite:', { user_id: user.id, vendor_id: vendorId });
      
      const { data, error } = await supabase
        .from('favorites')
        .insert({ 
          user_id: user.id, 
          vendor_id: vendorId 
        })
        .select();

      if (error) {
        console.error('Add favorite error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        throw error;
      }

      console.log('Add favorite success:', data);
      setFavoriteIds(prev => [...prev, vendorId]);
      Alert.alert('Success', 'Added to favorites');
      return true;
    } catch (error) {
      console.error('Error adding favorite:', error);
      Alert.alert('Error', 'Failed to add to favorites');
      return false;
    }
  };

  const removeFavorite = async (vendorId: string) => {
    if (!user) return false;

    try {
      console.log('Removing favorite:', { user_id: user.id, vendor_id: vendorId });
      
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('vendor_id', vendorId);

      if (error) {
        console.error('Remove favorite error:', error);
        throw error;
      }

      console.log('Remove favorite success');
      setFavoriteIds(prev => prev.filter(id => id !== vendorId));
      Alert.alert('Success', 'Removed from favorites');
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
      Alert.alert('Error', 'Failed to remove from favorites');
      return false;
    }
  };

  const toggleFavorite = async (vendorId: string) => {
    if (favoriteIds.includes(vendorId)) {
      return removeFavorite(vendorId);
    } else {
      return addFavorite(vendorId);
    }
  };

  const isFavorite = (vendorId: string) => favoriteIds.includes(vendorId);

  return {
    favoriteIds,
    isLoading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    refreshFavorites: fetchFavorites,
  };
}