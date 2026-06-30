// hooks/customer/useHealthCheck.ts (UPDATED - with product health_tags support)
import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HEALTH_CONDITIONS, HealthCondition } from '../../contexts/HealthContext';

export type SafetyVerdict = 'safe' | 'caution' | 'avoid';

export interface HealthCheckResult {
  verdict: SafetyVerdict;
  reason: string;
  effects: string[];
  conditions: HealthCondition[];
}

// Map product health tags to health conditions
const TAG_TO_CONDITION_MAP: Record<string, { conditions: HealthCondition[], effect: string }> = {
  'high_sugar': {
    conditions: ['low_sugar', 'diabetic_type2', 'pre_diabetic'],
    effect: '🍬 High in sugar - May spike blood sugar levels'
  },
  'high_sodium': {
    conditions: ['hypertensive', 'low_sodium', 'heart_disease'],
    effect: '🧂 High in sodium - May increase blood pressure'
  },
  'high_fat': {
    conditions: ['high_cholesterol', 'heart_disease', 'weight_loss'],
    effect: '🍔 High in saturated fat - May raise cholesterol'
  },
  'high_carb': {
    conditions: ['diabetic_type2', 'weight_loss', 'low_carb'],
    effect: '🍚 High in carbohydrates - May spike blood sugar'
  },
  'fried': {
    conditions: ['workout_mode', 'weight_loss', 'high_cholesterol', 'heart_disease'],
    effect: '🍟 Fried food - High in unhealthy fats'
  },
  'spicy': {
    conditions: ['asthma', 'acid_reflux'],
    effect: '🌶️ Spicy - May trigger respiratory issues or heartburn'
  },
  'grilled': {
    conditions: [],
    effect: '✅ Grilled - Generally a healthier option'
  },
  'steamed': {
    conditions: [],
    effect: '✅ Steamed - Healthy cooking method'
  },
  'high_protein': {
    conditions: ['workout_mode', 'muscle_gain'],
    effect: '💪 High in protein - Good for muscle building'
  },
  'vegetarian': {
    conditions: ['vegetarian'],
    effect: '🥦 Vegetarian - No meat products'
  },
  'contains_nuts': {
    conditions: ['nut_allergy', 'peanut_allergy', 'tree_nut_allergy'],
    effect: '🥜 Contains nuts - Severe allergic reaction possible'
  },
  'contains_dairy': {
    conditions: ['dairy_allergy', 'lactose_intolerant'],
    effect: '🥛 Contains dairy - May cause allergic reaction'
  },
  'contains_gluten': {
    conditions: ['celiac_disease', 'gluten_intolerance'],
    effect: '🌾 Contains gluten - Not safe for celiac'
  },
  'contains_eggs': {
    conditions: ['egg_allergy'],
    effect: '🥚 Contains eggs - May trigger allergic reaction'
  },
  'contains_shellfish': {
    conditions: ['shellfish_allergy'],
    effect: '🦐 Contains shellfish - Severe allergic reaction possible'
  },
  'contains_fish': {
    conditions: ['fish_allergy'],
    effect: '🐟 Contains fish - May trigger allergic reaction'
  },
  'contains_soy': {
    conditions: ['soy_allergy'],
    effect: '🌱 Contains soy - May trigger allergic reaction'
  },
};

// Local keyword-based checking (fallback)
function localHealthCheck(
  productName: string,
  productDescription: string,
  conditions: HealthCondition[]
): HealthCheckResult | null {
  if (conditions.length === 0) return null;
  
  const searchText = `${productName} ${productDescription}`.toLowerCase();
  const triggeredConditions: HealthCondition[] = [];
  const effects: string[] = [];
  
  for (const conditionId of conditions) {
    const conditionMeta = HEALTH_CONDITIONS.find(c => c.id === conditionId);
    if (!conditionMeta) continue;
    
    let matched = false;
    for (const tag of conditionMeta.avoidTags) {
      if (searchText.includes(tag.toLowerCase())) {
        matched = true;
        console.log(`⚠️ Keyword match: "${productName}" contains "${tag}" -> triggers ${conditionMeta.label}`);
        break;
      }
    }
    
    if (matched) {
      triggeredConditions.push(conditionId);
      const effect = getEffectForCondition(conditionId, conditionMeta.label);
      if (effect) effects.push(effect);
    }
  }
  
  if (triggeredConditions.length === 0) return null;
  
  const severeConditions = [
    'nut_allergy', 'peanut_allergy', 'tree_nut_allergy', 'shellfish_allergy',
    'asthma', 'pregnant', 'sickle_cell', 'celiac_disease', 'kidney_disease'
  ];
  const hasSevere = triggeredConditions.some(c => severeConditions.includes(c));
  
  const conditionNames = triggeredConditions
    .map(c => HEALTH_CONDITIONS.find(h => h.id === c)?.label || c)
    .join(', ');
  
  return {
    verdict: hasSevere ? 'avoid' : 'caution',
    reason: `This item may not be suitable for your ${conditionNames} condition(s).`,
    effects: [...new Set(effects)],
    conditions: triggeredConditions,
  };
}

function getEffectForCondition(conditionId: HealthCondition, label: string): string | null {
  const effectsMap: Record<string, string> = {
    'low_sugar': 'High in sugar',
    'diabetic_type1': 'May spike blood sugar levels',
    'diabetic_type2': 'May spike blood sugar levels',
    'hypertensive': 'May increase blood pressure',
    'workout_mode': 'May slow fitness progress',
    'weight_loss': 'High in calories - may hinder weight loss',
    'nut_allergy': 'Severe allergic reaction possible',
    'lactose_intolerant': 'May cause digestive discomfort',
  };
  return effectsMap[conditionId] || `May be unsuitable for ${label}`;
}

export function useHealthCheck() {
  const { user } = useAuth();

  const checkProduct = useCallback(async (
    productId: string,
    productName: string,
    productDescription: string = '',
    productCategory: string = '',
  ): Promise<HealthCheckResult | null> => {
    if (!user?.id) {
      console.log('❌ No user logged in');
      return null;
    }

    console.log('🔥 Checking product:', productName);

    // STEP 1: Fetch user's health profile
    const { data: profile, error } = await supabase
      .from('customer_health_profiles')
      .select('conditions, is_locked, enable_warnings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !profile || !profile.is_locked || !profile.enable_warnings || !profile.conditions?.length) {
      console.log('🔒 Health check skipped - lock-in disabled or no conditions');
      return null;
    }

    console.log('📊 User conditions:', profile.conditions);

    // STEP 2: Fetch product's health tags from database (NEW!)
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('health_tags, ingredients, allergens, nutritional_flags')
      .eq('id', productId)
      .single();

    const userConditionsSet = new Set(profile.conditions);
    const triggeredConditions: HealthCondition[] = [];
    const effects: string[] = [];

    // STEP 3: Check product's health_tags against user's conditions
    if (productData && productData.health_tags && productData.health_tags.length > 0) {
      console.log('🏷️ Product health tags:', productData.health_tags);
      
      for (const tag of productData.health_tags) {
        const tagMapping = TAG_TO_CONDITION_MAP[tag];
        if (tagMapping) {
          for (const condition of tagMapping.conditions) {
            if (userConditionsSet.has(condition) && !triggeredConditions.includes(condition)) {
              triggeredConditions.push(condition);
              effects.push(tagMapping.effect);
              console.log(`⚠️ Tag match: "${tag}" -> triggers ${condition}`);
            }
          }
        }
      }
    }

    // STEP 4: Also check allergens from product
   if (
  productData &&
  Array.isArray(productData.allergens) &&
  productData.allergens.length > 0
) {
      for (const allergen of productData.allergens) {
        const tagMapping = TAG_TO_CONDITION_MAP[allergen];
        if (tagMapping) {
          for (const condition of tagMapping.conditions) {
            if (userConditionsSet.has(condition) && !triggeredConditions.includes(condition)) {
              triggeredConditions.push(condition);
              effects.push(tagMapping.effect);
              console.log(`⚠️ Allergen match: "${allergen}" -> triggers ${condition}`);
            }
          }
        }
      }
    }

    // STEP 5: If no tags triggered, fall back to keyword matching
    if (triggeredConditions.length === 0) {
      console.log('📝 No tag matches, falling back to keyword check');
      const keywordResult = localHealthCheck(
        productName,
        `${productDescription} ${productCategory}`,
        profile.conditions
      );
      
      if (keywordResult) {
        return keywordResult;
      }
    }

    // STEP 6: Return result if any conditions triggered
    if (triggeredConditions.length > 0) {
      const conditionNames = triggeredConditions
        .map(c => HEALTH_CONDITIONS.find(h => h.id === c)?.label || c)
        .join(', ');
      
      const severeConditions = [
        'nut_allergy', 'peanut_allergy', 'shellfish_allergy', 'asthma', 'pregnant', 'sickle_cell'
      ];
      const hasSevere = triggeredConditions.some(c => severeConditions.includes(c));
      
      console.log(`⚠️ Health warning for "${productName}": ${hasSevere ? 'avoid' : 'caution'}`);
      
      return {
        verdict: hasSevere ? 'avoid' : 'caution',
        reason: `This item may not be suitable for your ${conditionNames} condition(s).`,
        effects: [...new Set(effects)],
        conditions: triggeredConditions,
      };
    }

    console.log(`✅ "${productName}" passed all health checks`);
    return null;
  }, [user?.id]);

  return { checkProduct };
}