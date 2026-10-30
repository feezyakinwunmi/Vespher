// app/hooks/rider/useRiderWallet.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useRider } from '../../contexts/RiderContext';
import { RiderWithdrawal, fetchLifetimeEarnings, fetchWithdrawals } from '../../services/riderOrders';

// Balance = delivered earnings − paid-out − in-flight withdrawals.
export function useRiderWallet() {
  const { user } = useAuth();
  const { delivered, refresh: refreshJobs } = useRider();
  const [withdrawals, setWithdrawals] = useState<RiderWithdrawal[]>([]);
  const [earned, setEarned] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadWithdrawals = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [w, e] = await Promise.all([fetchWithdrawals(user.id), fetchLifetimeEarnings(user.id)]);
      setWithdrawals(w);
      setEarned(e);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Recalculate whenever a delivery completes.
  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals, delivered.length]);

  useFocusEffect(
    useCallback(() => {
      loadWithdrawals();
    }, [loadWithdrawals]),
  );

  const totals = useMemo(() => {
    const withdrawn = withdrawals.filter(w => w.status === 'completed').reduce((s, w) => s + w.amount, 0);
    const pending = withdrawals
      .filter(w => w.status === 'pending' || w.status === 'processing')
      .reduce((s, w) => s + w.amount, 0);
    return {
      earned,
      withdrawn,
      pending,
      available: Math.max(0, earned - withdrawn - pending),
      hasPending: pending > 0,
    };
  }, [earned, withdrawals]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshJobs(), loadWithdrawals()]);
  }, [refreshJobs, loadWithdrawals]);

  return { ...totals, withdrawals, delivered, isLoading, refresh };
}
