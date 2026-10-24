// hooks/customer/useHealthCheck.ts
// Customer-side health check before adding to cart. The rules live in
// services/foodSafety so customers, vendors and admins all see the same result.
import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { assessFood } from '../../services/foodSafety';

export type { SafetyVerdict, HealthCheckResult } from '../../services/foodSafety';
import type { HealthCheckResult } from '../../services/foodSafety';

export function useHealthCheck() {
  const { user } = useAuth();

  const checkProduct = useCallback(async (
    productId: string,
    productName: string,
    productDescription: string = '',
    productCategory: string = '',
  ): Promise<HealthCheckResult | null> => {
    if (!user?.id) return null;

    const { data: profile, error } = await supabase
      .from('customer_health_profiles')
      .select('conditions, is_locked, enable_warnings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !profile || !profile.is_locked || !profile.enable_warnings || !profile.conditions?.length) {
      return null;
    }

    // Use what the vendor declared for this dish (ingredients, allergens, tags).
    const { data: productData } = await supabase
      .from('products')
      .select('name, description, category, ingredients, allergens, health_tags')
      .eq('id', productId)
      .maybeSingle();

    return assessFood(
      {
        name: productData?.name || productName,
        description: productData?.description ?? productDescription,
        category: productData?.category ?? productCategory,
        ingredients: productData?.ingredients,
        allergens: productData?.allergens,
        health_tags: productData?.health_tags,
      },
      profile.conditions
    );
  }, [user?.id]);

  return { checkProduct };
}
