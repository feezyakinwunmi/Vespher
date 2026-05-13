// services/healthAnalyzer.ts
import { OFFProduct } from './openFoodFacts';
import { HEALTH_CONDITIONS, HealthCondition } from '../contexts/HealthContext';

export interface HealthAnalysis {
  productName: string;
  hasData: boolean;
  warnings: string[];
  safeToEat: boolean;
  matchedConditions: HealthCondition[];
  nutritionScore: 'A' | 'B' | 'C' | 'D' | 'E' | 'unknown';
  ingredients: string;
}

export function analyzeWithOpenFoodFacts(
  product: OFFProduct,
  userConditions: HealthCondition[]
): HealthAnalysis {
  const warnings: string[] = [];
  const matchedConditions: HealthCondition[] = [];
  
  // Combine all text for searching
  const searchText = `${product.product_name} ${product.ingredients_text || ''} ${product.categories || ''}`.toLowerCase();
  
  // Check each user condition against the product data
  for (const conditionId of userConditions) {
    const conditionMeta = HEALTH_CONDITIONS.find(c => c.id === conditionId);
    if (!conditionMeta) continue;
    
    // Check if any avoid tags match the product data
    for (const tag of conditionMeta.avoidTags) {
      if (searchText.includes(tag.toLowerCase())) {
        warnings.push(`⚠️ ${conditionMeta.label}: Contains "${tag}"`);
        matchedConditions.push(conditionId);
        break;
      }
    }
  }
  
  // Check Nutri-Score
  const nutriscore = product.nutriscore_grade;
  if (nutriscore === 'e' || nutriscore === 'd') {
    warnings.push(`📊 Poor Nutri-Score (${nutriscore.toUpperCase()}) - Low nutritional quality`);
  } else if (nutriscore === 'a' || nutriscore === 'b') {
    warnings.push(`✅ Good Nutri-Score (${nutriscore.toUpperCase()}) - Generally healthy choice`);
  }
  
  // Check sugar content
  const sugarPer100g = product.nutriments?.sugars_100g || 0;
  if (sugarPer100g > 22.5) {
    warnings.push(`🍬 Very high sugar (${sugarPer100g}g per 100g)`);
    if (userConditions.includes('low_sugar') || userConditions.includes('diabetic_type2')) {
      matchedConditions.push('low_sugar');
    }
  } else if (sugarPer100g > 15) {
    warnings.push(`🍬 High sugar (${sugarPer100g}g per 100g) - Consume moderately`);
  }
  
  // Check salt content
  const saltPer100g = product.nutriments?.salt_100g || 0;
  if (saltPer100g > 1.5) {
    warnings.push(`🧂 Very high salt (${saltPer100g}g per 100g)`);
    if (userConditions.includes('low_sodium') || userConditions.includes('hypertensive')) {
      matchedConditions.push('low_sodium');
    }
  }
  
  // Check saturated fat
  const satFatPer100g = product.nutriments?.saturated_fat_100g || 0;
  if (satFatPer100g > 5) {
    warnings.push(`🍔 High saturated fat (${satFatPer100g}g per 100g)`);
    if (userConditions.includes('high_cholesterol') || userConditions.includes('heart_disease')) {
      matchedConditions.push('high_cholesterol');
    }
  }
  
  // Check allergens
  if (product.allergens_tags && product.allergens_tags.length > 0) {
    for (const allergen of product.allergens_tags) {
      const allergenLower = allergen.toLowerCase();
      if (allergenLower.includes('peanut') && userConditions.includes('peanut_allergy')) {
        warnings.push(`🥜 Contains peanuts - Severe allergy risk!`);
        matchedConditions.push('peanut_allergy');
      }
      if (allergenLower.includes('nut') && userConditions.includes('nut_allergy')) {
        warnings.push(`🥜 Contains nuts - Allergy risk!`);
        matchedConditions.push('nut_allergy');
      }
      if (allergenLower.includes('milk') && userConditions.includes('dairy_allergy')) {
        warnings.push(`🥛 Contains dairy - Allergy risk!`);
        matchedConditions.push('dairy_allergy');
      }
      if (allergenLower.includes('gluten') && (userConditions.includes('celiac_disease') || userConditions.includes('gluten_intolerance'))) {
        warnings.push(`🌾 Contains gluten - Not safe for celiac/gluten intolerance!`);
        matchedConditions.push('celiac_disease');
      }
      if (allergenLower.includes('shellfish') && userConditions.includes('shellfish_allergy')) {
        warnings.push(`🦐 Contains shellfish - Severe allergy risk!`);
        matchedConditions.push('shellfish_allergy');
      }
      if (allergenLower.includes('egg') && userConditions.includes('egg_allergy')) {
        warnings.push(`🥚 Contains eggs - Allergy risk!`);
        matchedConditions.push('egg_allergy');
      }
      if (allergenLower.includes('soy') && userConditions.includes('soy_allergy')) {
        warnings.push(`🌱 Contains soy - Allergy risk!`);
        matchedConditions.push('soy_allergy');
      }
      if (allergenLower.includes('fish') && userConditions.includes('fish_allergy')) {
        warnings.push(`🐟 Contains fish - Allergy risk!`);
        matchedConditions.push('fish_allergy');
      }
    }
  }
  
  return {
    productName: product.product_name,
    hasData: true,
    warnings: [...new Set(warnings)], // Remove duplicates
    safeToEat: matchedConditions.length === 0,
    matchedConditions: [...new Set(matchedConditions)],
    nutritionScore: nutriscore ? nutriscore.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E' : 'unknown',
    ingredients: product.ingredients_text || 'No ingredient data available',
  };
}