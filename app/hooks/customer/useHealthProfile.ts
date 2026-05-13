// hooks/useHealthProfile.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export interface HealthProfile {
  conditions: string[];
  isLocked: boolean;
  enableWarnings: boolean;
  lockInGoal: string | null;
  lockInEndDate: string | null;
}

export function useHealthProfile() {
  const { user } = useAuth();
  const [healthProfile, setHealthProfile] = useState<HealthProfile>({
    conditions: [],
    isLocked: false,
    enableWarnings: true,
    lockInGoal: null,
    lockInEndDate: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      console.log('No user, setting default');
      setHealthProfile({
        conditions: [],
        isLocked: false,
        enableWarnings: true,
        lockInGoal: null,
        lockInEndDate: null,
      });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔄 Direct fetch for user:', user.id);
      
      const { data, error } = await supabase
        .from('customer_health_profiles')
        .select('conditions, is_locked, enable_warnings, lock_in_goal, lock_in_end_date')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Fetch error:', error);
        // If no profile found, use default
        if (error.code === 'PGRST116') {
          setHealthProfile({
            conditions: [],
            isLocked: false,
            enableWarnings: true,
            lockInGoal: null,
            lockInEndDate: null,
          });
        }
      } else if (data) {
        console.log('✅ Profile loaded:', data);
        setHealthProfile({
          conditions: data.conditions || [],
          isLocked: data.is_locked || false,
          enableWarnings: data.enable_warnings ?? true,
          lockInGoal: data.lock_in_goal || null,
          lockInEndDate: data.lock_in_end_date || null,
        });
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { healthProfile, isLoading, refreshProfile: fetchProfile };
}