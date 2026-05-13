// services/healthChecker.ts
import { HealthCondition, HEALTH_CONDITIONS } from '../contexts/HealthContext';

export interface HealthCheckResult {
  hasWarning: boolean;
  triggeredConditions: HealthCondition[];
  effects: string[];
  reason: string;
  verdict: 'safe' | 'caution' | 'avoid';
}

// Check if a food is healthy/suitable for user's conditions
export function checkFoodHealth(
  productName: string,
  productDescription: string,
  userConditions: HealthCondition[]
): HealthCheckResult | null {
  if (!userConditions || userConditions.length === 0) {
    return null;
  }

  const searchText = `${productName} ${productDescription}`.toLowerCase();
  const triggeredConditions: HealthCondition[] = [];
  const effects: string[] = [];

  for (const conditionId of userConditions) {
    const conditionMeta = HEALTH_CONDITIONS.find(c => c.id === conditionId);
    if (!conditionMeta) continue;

    // Check if any avoid tags match
    for (const tag of conditionMeta.avoidTags) {
      if (searchText.includes(tag.toLowerCase())) {
        triggeredConditions.push(conditionId);
        
        // Add specific effect message based on condition
        let effectMessage = '';
        switch (conditionId) {
          case 'low_sugar':
            effectMessage = 'High in sugar - May affect your low sugar diet';
            break;
          case 'diabetic_type2':
            effectMessage = 'May spike blood sugar levels';
            break;
          case 'hypertensive':
            effectMessage = 'High in sodium - May increase blood pressure';
            break;
          case 'workout_mode':
            effectMessage = 'Not workout-friendly - May slow fitness progress';
            break;
          case 'weight_loss':
            effectMessage = 'High in calories - May hinder weight loss';
            break;
          case 'high_cholesterol':
            effectMessage = 'High in saturated fat - May affect cholesterol';
            break;
          case 'nut_allergy':
            effectMessage = 'Contains nuts - Severe allergic reaction possible';
            break;
          case 'peanut_allergy':
            effectMessage = 'Contains peanuts - Severe allergic reaction possible';
            break;
          case 'shellfish_allergy':
            effectMessage = 'Contains shellfish - Severe allergic reaction possible';
            break;
          case 'asthma':
            effectMessage = 'May trigger asthma symptoms';
            break;
          case 'pregnant':
            effectMessage = 'May be unsafe during pregnancy';
            break;
          case 'celiac_disease':
            effectMessage = 'Contains gluten - Not safe for celiac';
            break;
          default:
            effectMessage = `May be unsuitable for ${conditionMeta.label}`;
        }
        effects.push(effectMessage);
        break;
      }
    }
  }

  if (triggeredConditions.length === 0) {
    return {
      hasWarning: false,
      triggeredConditions: [],
      effects: [],
      reason: '',
      verdict: 'safe',
    };
  }

  const conditionNames = triggeredConditions
    .map(c => HEALTH_CONDITIONS.find(h => h.id === c)?.label || c)
    .join(', ');

  const hasSevere = triggeredConditions.some(c =>
    ['nut_allergy', 'peanut_allergy', 'shellfish_allergy', 'asthma', 'pregnant', 'sickle_cell'].includes(c)
  );

  return {
    hasWarning: true,
    triggeredConditions,
    effects,
    reason: `This item may not be suitable for your ${conditionNames} condition(s).`,
    verdict: hasSevere ? 'avoid' : 'caution',
  };
}

// Check if a food is appropriate for a specific meal time
export function isFoodAppropriateForMealTime(
  productName: string,
  mealTime: 'breakfast' | 'lunch' | 'dinner' | 'snack'
): boolean {
  const name = productName.toLowerCase();
  
  const mealRules = {
    breakfast: {
      allowed: ['toast', 'bread', 'egg', 'cereal', 'oatmeal', 'pancake', 'waffle', 'yogurt', 'fruit', 'smoothie', 'akara', 'moi moi', 'pap', 'coffee', 'tea', 'milk'],
      notAllowed: ['rice', 'pasta', 'noodles', 'burger', 'pizza', 'fries', 'steak', 'fried chicken', 'eba', 'fufu', 'pounded yam', 'jollof', 'egusi']
    },
    lunch: {
      allowed: ['rice', 'jollof', 'fried rice', 'beans', 'pasta', 'noodles', 'burger', 'shawarma', 'salad', 'soup', 'stew', 'chicken', 'beef', 'fish', 'protein'],
      notAllowed: ['cereal', 'pancake', 'oatmeal', 'donut', 'pastry', 'akara', 'pap']
    },
    dinner: {
      allowed: ['steak', 'grill', 'seafood', 'fish', 'pepper soup', 'pizza', 'pasta', 'soup', 'swallow', 'rice', 'chicken', 'beef'],
      notAllowed: ['cereal', 'pancake', 'donut', 'pastry', 'heavy cream']
    },
    snack: {
      allowed: ['fries', 'chips', 'samosa', 'spring roll', 'puff puff', 'cake', 'ice cream', 'fruit', 'smoothie', 'drink', 'cookie', 'biscuit'],
      notAllowed: []
    }
  };

  const rules = mealRules[mealTime];
  
  // Check if not allowed
  for (const forbidden of rules.notAllowed) {
    if (name.includes(forbidden)) {
      return false;
    }
  }
  
  // Check if allowed (if allowed list is not empty)
  if (rules.allowed.length > 0) {
    for (const allowed of rules.allowed) {
      if (name.includes(allowed)) {
        return true;
      }
    }
    return false;
  }
  
  return true;
}

// Get suggested foods for a meal time based on user's health conditions
export function getSuggestedFoodsForMeal(
  allProducts: any[],
  mealTime: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  userConditions: HealthCondition[]
): any[] {
  let suitable = allProducts.filter(product => {
    // First check if appropriate for meal time
    if (!isFoodAppropriateForMealTime(product.name, mealTime)) {
      return false;
    }
    
    // Then check health conditions
    if (userConditions.length > 0) {
      const healthCheck = checkFoodHealth(product.name, product.description || '', userConditions);
      if (healthCheck?.hasWarning) {
        return false;
      }
    }
    
    return true;
  });
  
  // Score and sort by healthiness
  suitable = suitable.map(product => {
    let score = 0;
    
    // Popularity score
    if (product.isPopular) score += 50;
    
    // Price score (cheaper is better for suggestions)
    score += Math.max(0, 100 - product.price / 100);
    
    return { ...product, score };
  }).sort((a, b) => b.score - a.score);
  
  return suitable.slice(0, 10);
}