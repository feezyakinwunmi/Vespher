// app/hooks/customer/useRecommendations.ts
// Personalised picks for the current meal time. Free customers see the first few
// (admin-configurable); Vesphe Pro unlocks the full list.
import { useEffect, useMemo, useState } from 'react';
import { useHealth } from '../../contexts/HealthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { recommend, RecommendableProduct } from '../../services/recommendations';
import { getCurrentMealTime, MealTime, SuggestedProduct } from './useAIFoodSuggestions';

const MAX_SUGGESTIONS = 12;

export interface RecommendedProduct extends SuggestedProduct {
  reasons: string[];
  hasWarning: boolean;
}

export function useRecommendations(allProducts: RecommendableProduct[]) {
  const { healthProfile } = useHealth();
  const { isPro, pricing } = useSubscription();
  const [mealTime, setMealTime] = useState<MealTime>(getCurrentMealTime);

  // Follow the clock so breakfast picks turn into lunch picks automatically.
  useEffect(() => {
    const interval = setInterval(() => setMealTime(getCurrentMealTime()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toDateString();
  const conditionsKey = healthProfile.conditions.join(',');

  const ranked = useMemo(
    () => recommend(allProducts, { mealTime, conditions: healthProfile.conditions }).slice(0, MAX_SUGGESTIONS),
    // allProducts identity changes on every render upstream; length + ids are enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allProducts.map(p => p.id).join(','), mealTime, conditionsKey, today]
  );

  const visibleCount = isPro ? ranked.length : Math.min(ranked.length, pricing.freeRecommendationLimit);

  const suggestions: RecommendedProduct[] = ranked.slice(0, visibleCount).map(({ product, reasons, warning }) => ({
    id: product.id,
    name: product.name,
    image: product.image || product.image_url || '',
    price: product.price,
    vendorId: product.vendorId,
    vendorName: product.vendorName || '',
    category: product.category || '',
    reasons,
    hasWarning: !!warning,
  }));

  return {
    suggestions,
    lockedCount: ranked.length - visibleCount,
    mealTime,
    isPro,
    isPersonalised: healthProfile.conditions.length > 0,
    isLoading: false,
  };
}
