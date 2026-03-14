// app/hooks/usePlatformSettings.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface PlatformSettings {
  platform_fee_percentage: number;
  delivery_fee_per_km: number;
  min_delivery_fee: number;
  max_delivery_fee: number;
}

// app/hooks/usePlatformSettings.ts
// Make sure it's not returning default values when data is null

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null); // Start with null, not defaults
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching platform settings:', error);
      setSettings(null); // Set to null on error, not defaults
    } finally {
      setIsLoading(false);
    }
  };

  return {
    settings, // This should be null if not found
    isLoading,
    refreshSettings: fetchSettings,
  };
}