// app/services/recommendations.ts
// Personalised food recommendations. Every dish is scored for *this* customer at
// *this* meal time, and each pick carries short, human reasons ("Good for Workout
// mode", "Grilled, lighter option") so recommendations feel considered rather than random.
//
// Signals, strongest first:
//   1. Meal time   – vendor-confirmed meal_times, else the dish template, else the
//                    name-based classifier. Dishes for other meal times are not shown.
//   2. Safety      – the same check used at add-to-cart (foodSafety.assessFood):
//                    "avoid" dishes are never recommended; "caution" ones rank lower.
//   3. Fit         – the customer's conditions' goodTags and helpful health tags.
//   4. Quality     – popularity and complete listings (ingredients provided).
//   5. Variety     – a per-day seed so picks change daily but stay stable within a day.
import { HEALTH_CONDITIONS } from '../contexts/HealthContext';
import { assessFood, containsTerm, HealthCheckResult } from './foodSafety';
import { findDishTemplate, MealTime } from './dishTemplates';
import { classifyProductForMealTime } from '../hooks/customer/useAIFoodSuggestions';

export interface RecommendableProduct {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  image?: string;
  image_url?: string;
  vendorId: string;
  vendorName?: string;
  isPopular?: boolean;
  ingredients?: string[] | null;
  allergens?: string[] | null;
  health_tags?: string[] | null;
  meal_times?: string[] | null;
}

export interface Recommendation<T extends RecommendableProduct = RecommendableProduct> {
  product: T;
  score: number;
  reasons: string[];
  warning: HealthCheckResult | null;
}

export interface RecommendationContext {
  mealTime: MealTime;
  conditions: string[];
  date?: Date;
}

const MEAL_TIMES: MealTime[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// Which meal times a dish suits. Main meals in Nigeria are eaten at lunch or dinner.
export function mealTimesForProduct(product: RecommendableProduct): MealTime[] {
  const declared = (product.meal_times || []).filter((m): m is MealTime => MEAL_TIMES.includes(m as MealTime));
  if (declared.length) return declared;

  const template = findDishTemplate(product.name);
  if (template) return template.mealTimes;

  const meal = classifyProductForMealTime(product.name, product.category || '', product.description || '');
  if (meal === 'lunch' || meal === 'dinner') return ['lunch', 'dinner'];
  return [meal];
}

// Stable 0..1 pseudo-random value per (dish, day, meal) for daily variety.
function dailySeed(productId: string, date: Date, mealTime: MealTime): number {
  const key = `${productId}|${date.getFullYear()}-${date.getMonth()}-${date.getDate()}|${mealTime}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const PERFORMANCE_CONDITIONS = ['workout_mode', 'muscle_gain', 'endurance_training', 'post_workout_recovery', 'weight_loss'];
const LIGHTER_CONDITIONS = ['weight_loss', 'high_cholesterol', 'heart_disease', 'hypertensive', 'low_fat', 'obesity', 'overweight'];

export function scoreProduct<T extends RecommendableProduct>(
  product: T,
  ctx: RecommendationContext
): Recommendation<T> | null {
  const date = ctx.date || new Date();
  const fitsMeal = mealTimesForProduct(product).includes(ctx.mealTime);
  if (!fitsMeal) return null;

  const warning = assessFood(product, ctx.conditions);
  if (warning?.verdict === 'avoid') return null;

  let score = 50;
  const reasons: string[] = [];
  const text = [product.name, product.description, ...(product.ingredients || [])].filter(Boolean).join(' , ').toLowerCase();
  const tags = new Set(product.health_tags || []);

  // Fit with the customer's goals and conditions.
  let goodMatches = 0;
  for (const conditionId of ctx.conditions) {
    const meta = HEALTH_CONDITIONS.find(c => c.id === conditionId);
    const hit = meta?.goodTags?.find(tag => containsTerm(text, tag));
    if (meta && hit && goodMatches < 3) {
      goodMatches++;
      score += 12;
      reasons.push(`Good for ${meta.label}`);
    }
  }
  if (tags.has('high_protein') && ctx.conditions.some(c => PERFORMANCE_CONDITIONS.includes(c))) {
    score += 10;
    reasons.push('High in protein');
  }
  if ((tags.has('grilled') || tags.has('steamed')) && ctx.conditions.some(c => LIGHTER_CONDITIONS.includes(c))) {
    score += 8;
    reasons.push(tags.has('grilled') ? 'Grilled, lighter option' : 'Steamed, lighter option');
  }

  if (warning) {
    score -= 25;
  } else if (ctx.conditions.length) {
    score += 6;
    if (reasons.length === 0) reasons.push('Fits your health profile');
  }

  if (product.isPopular) {
    score += 5;
    reasons.push('Popular');
  }
  if (product.ingredients?.length) score += 3;

  score += dailySeed(product.id, date, ctx.mealTime) * 10;

  return { product, score, reasons: reasons.slice(0, 2), warning };
}

export function recommend<T extends RecommendableProduct>(
  products: T[],
  ctx: RecommendationContext
): Recommendation<T>[] {
  const scored: Recommendation<T>[] = [];
  const seenNames = new Set<string>();
  for (const product of products) {
    const rec = scoreProduct(product, ctx);
    if (rec) scored.push(rec);
  }
  scored.sort((a, b) => b.score - a.score);

  // Don't show the same dish from five vendors in a row.
  return scored.filter(rec => {
    const key = rec.product.name.trim().toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
}

// Weekly plan: best safe dish per day and meal, avoiding repeats within the week
// and spreading picks across vendors.
export function planWeek<T extends RecommendableProduct>(
  products: T[],
  days: string[],
  conditions: string[],
  startDate: Date = new Date()
): Record<string, Record<MealTime, Recommendation<T> | null>> {
  const plan: Record<string, Record<MealTime, Recommendation<T> | null>> = {};
  const used = new Set<string>();

  days.forEach((day, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const vendorsToday = new Set<string>();
    plan[day] = { breakfast: null, lunch: null, dinner: null, snack: null };

    for (const mealTime of MEAL_TIMES) {
      const ranked = recommend(products, { mealTime, conditions, date });
      const pick =
        ranked.find(r => !used.has(r.product.id) && !vendorsToday.has(r.product.vendorId) && !r.warning) ||
        ranked.find(r => !used.has(r.product.id) && !r.warning) ||
        ranked.find(r => !used.has(r.product.id)) ||
        ranked[0] ||
        null;
      plan[day][mealTime] = pick;
      if (pick) {
        used.add(pick.product.id);
        vendorsToday.add(pick.product.vendorId);
      }
    }
  });

  return plan;
}
