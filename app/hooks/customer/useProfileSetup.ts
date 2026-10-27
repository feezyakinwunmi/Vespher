// app/hooks/customer/useProfileSetup.ts
// Getting-started checklist for customers (especially after Google sign-up, where we
// only know name and email): phone number, delivery address and health preferences.
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useHealth } from '../../contexts/HealthContext';

export type SetupStepId = 'phone' | 'address' | 'health';

export interface SetupStep {
  id: SetupStepId;
  title: string;
  description: string;
  done: boolean;
}

export function useProfileSetup() {
  const { user } = useAuth();
  const { healthProfile } = useHealth();
  const [hasAddress, setHasAddress] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let active = true;
      supabase
        .from('addresses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => {
          if (active) setHasAddress((count || 0) > 0);
        });
      return () => {
        active = false;
      };
    }, [user?.id])
  );

  const steps: SetupStep[] = [
    { id: 'phone', title: 'Add your phone number', description: 'So riders can reach you on delivery', done: !!user?.phone?.trim() },
    { id: 'address', title: 'Add a delivery address', description: 'Get accurate delivery fees and nearby vendors', done: !!hasAddress },
    { id: 'health', title: 'Set your health preferences', description: 'Personalised picks and allergy warnings', done: healthProfile.conditions.length > 0 },
  ];

  const completed = steps.filter(s => s.done).length;

  return {
    steps,
    completed,
    total: steps.length,
    // Unknown until the address check returns, so the tooltip doesn't flash.
    isComplete: hasAddress === null ? true : completed === steps.length,
  };
}
