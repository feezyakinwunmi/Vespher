// app/services/foodSafety.ts
// Single food-safety engine used by vendors (allergen detection while adding a dish),
// admins (review before approval) and customers (warnings before adding to cart).
//
// It reads everything the vendor provides — ingredients, declared allergens and health
// tags — plus the dish name/description, and matches whole words only, so "coconut"
// no longer counts as a nut and "eggplant" no longer counts as egg.
import { HEALTH_CONDITIONS, HealthCondition } from '../contexts/HealthContext';
import { findNigerianFood } from './nigerianFoodDB';

export type SafetyVerdict = 'safe' | 'caution' | 'avoid';

export interface HealthCheckResult {
  verdict: SafetyVerdict;
  reason: string;
  effects: string[];
  conditions: HealthCondition[];
}

export interface FoodInfo {
  name: string;
  description?: string | null;
  category?: string | null;
  ingredients?: string[] | null;
  health_tags?: string[] | null;
  allergens?: string[] | null;
}

// ---------------------------------------------------------------------------
// Allergens: id is what gets stored in products.allergens.
// ---------------------------------------------------------------------------
export interface AllergenDef {
  id: string;
  label: string;
  icon: string;
  keywords: string[];
}

export const ALLERGENS: AllergenDef[] = [
  {
    id: 'contains_peanuts',
    label: 'Peanuts',
    icon: '🥜',
    keywords: ['peanut', 'groundnut', 'groundnut oil', 'kuli kuli', 'kulikuli', 'arachis', 'suya spice', 'yaji'],
  },
  {
    id: 'contains_nuts',
    label: 'Tree nuts',
    icon: '🌰',
    keywords: ['almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'brazil nut', 'tiger nut', 'nut butter', 'praline', 'marzipan', 'nuts'],
  },
  {
    id: 'contains_dairy',
    label: 'Dairy',
    icon: '🥛',
    keywords: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'whey', 'casein', 'lactose', 'wara', 'custard', 'ice cream', 'evaporated milk', 'condensed milk', 'milk powder', 'ghee', 'mozzarella', 'cheddar'],
  },
  {
    id: 'contains_eggs',
    label: 'Eggs',
    icon: '🥚',
    keywords: ['egg', 'egg white', 'egg yolk', 'mayonnaise', 'mayo', 'meringue', 'albumin'],
  },
  {
    id: 'contains_gluten',
    label: 'Gluten',
    icon: '🌾',
    keywords: ['wheat', 'flour', 'bread', 'pasta', 'spaghetti', 'macaroni', 'noodle', 'indomie', 'semolina', 'semovita', 'couscous', 'barley', 'rye', 'oats', 'puff puff', 'chin chin', 'meat pie', 'doughnut', 'cake', 'biscuit', 'breadcrumb', 'wheat meal'],
  },
  {
    id: 'contains_shellfish',
    label: 'Shellfish',
    icon: '🦐',
    keywords: ['crayfish', 'shrimp', 'prawn', 'crab', 'lobster', 'periwinkle', 'isam', 'oyster', 'clam', 'mussel', 'scallop', 'snail', 'shellfish', 'seafood'],
  },
  {
    id: 'contains_fish',
    label: 'Fish',
    icon: '🐟',
    keywords: ['fish', 'stockfish', 'okporoko', 'panla', 'titus', 'mackerel', 'croaker', 'catfish', 'tilapia', 'sardine', 'tuna', 'salmon', 'cod', 'eja', 'smoked fish', 'dry fish', 'fish sauce', 'seafood'],
  },
  {
    id: 'contains_soy',
    label: 'Soy',
    icon: '🌱',
    keywords: ['soy', 'soya', 'soybean', 'soy sauce', 'tofu', 'awara', 'soy milk', 'miso', 'edamame'],
  },
  {
    id: 'contains_sesame',
    label: 'Sesame',
    icon: '⚪',
    keywords: ['sesame', 'beniseed', 'benne seed', 'tahini', 'sesame oil'],
  },
];

// Health tags (from health_tags_reference) and allergen ids → affected conditions.
const TAG_TO_CONDITIONS: Record<string, { conditions: HealthCondition[]; effect: string }> = {
  high_sugar: { conditions: ['low_sugar', 'diabetic_type1', 'diabetic_type2', 'pre_diabetic'], effect: '🍬 High in sugar - may spike blood sugar levels' },
  high_sodium: { conditions: ['hypertensive', 'low_sodium', 'heart_disease', 'kidney_disease'], effect: '🧂 High in sodium - may raise blood pressure' },
  high_fat: { conditions: ['high_cholesterol', 'heart_disease', 'weight_loss', 'low_fat'], effect: '🍔 High in fat - may raise cholesterol' },
  high_carb: { conditions: ['diabetic_type2', 'weight_loss', 'low_carb', 'keto'], effect: '🍚 High in carbohydrates - may spike blood sugar' },
  fried: { conditions: ['workout_mode', 'weight_loss', 'high_cholesterol', 'heart_disease', 'low_fat'], effect: '🍟 Fried - high in unhealthy fats' },
  spicy: { conditions: ['asthma', 'acid_reflux', 'ibs'], effect: '🌶️ Spicy - may trigger heartburn or irritation' },
  contains_peanuts: { conditions: ['peanut_allergy', 'nut_allergy'], effect: '🥜 Contains peanuts - severe allergic reaction possible' },
  contains_nuts: { conditions: ['nut_allergy', 'tree_nut_allergy'], effect: '🌰 Contains tree nuts - severe allergic reaction possible' },
  contains_dairy: { conditions: ['dairy_allergy', 'lactose_intolerant', 'lactose_intolerant_african', 'vegan'], effect: '🥛 Contains dairy' },
  contains_eggs: { conditions: ['egg_allergy', 'vegan'], effect: '🥚 Contains eggs' },
  contains_gluten: { conditions: ['celiac_disease', 'celiac'], effect: '🌾 Contains gluten - not safe for celiac' },
  contains_shellfish: { conditions: ['shellfish_allergy', 'gout', 'vegetarian', 'vegan'], effect: '🦐 Contains shellfish - severe allergic reaction possible' },
  contains_fish: { conditions: ['fish_allergy', 'vegetarian', 'vegan'], effect: '🐟 Contains fish' },
  contains_soy: { conditions: ['soy_allergy'], effect: '🌱 Contains soy' },
  contains_sesame: { conditions: ['sesame_allergy'], effect: '⚪ Contains sesame' },
};

// Conditions where eating the wrong thing is dangerous, not just unwise.
const SEVERE_CONDITIONS = new Set<string>([
  'nut_allergy', 'peanut_allergy', 'tree_nut_allergy', 'shellfish_allergy', 'fish_allergy',
  'egg_allergy', 'dairy_allergy', 'soy_allergy', 'sesame_allergy', 'celiac_disease', 'celiac',
  'pregnant', 'sickle_cell', 'kidney_disease', 'chemo_patient',
]);

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word (or whole-phrase) match, allowing simple plurals.
export function containsTerm(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return new RegExp(`(^|[^a-z])${escapeRegExp(t)}(s|es)?(?=[^a-z]|$)`, 'i').test(text);
}

function foodText(info: FoodInfo, includeDescription = true): string {
  return [
    info.name,
    includeDescription ? info.description : '',
    info.category,
    ...(info.ingredients || []),
  ]
    .filter(Boolean)
    .join(' , ')
    .toLowerCase();
}

export interface DetectedAllergen {
  allergen: AllergenDef;
  matches: string[];
}

// Allergens found in the dish's name/ingredients/description.
export function detectAllergens(info: FoodInfo): DetectedAllergen[] {
  const text = foodText(info);
  const found: DetectedAllergen[] = [];
  for (const allergen of ALLERGENS) {
    const matches = allergen.keywords.filter(k => containsTerm(text, k));
    if (matches.length > 0) found.push({ allergen, matches });
  }
  return found;
}

export const allergenById = (id: string) => ALLERGENS.find(a => a.id === id);

// ---------------------------------------------------------------------------
// Vendor / admin review
// ---------------------------------------------------------------------------
export interface FoodReview {
  // Allergens found in the ingredients/name that the vendor did not declare.
  undeclaredAllergens: DetectedAllergen[];
  // Allergens declared (allergens + allergen-type health tags) or detected.
  allAllergens: AllergenDef[];
  issues: string[];
  notes: string[];
}

export function reviewFood(info: FoodInfo): FoodReview {
  const declared = new Set([...(info.allergens || []), ...(info.health_tags || [])]);
  const detected = detectAllergens(info);
  const undeclaredAllergens = detected.filter(d => !declared.has(d.allergen.id));
  const allIds = new Set([...detected.map(d => d.allergen.id), ...declared]);
  const allAllergens = ALLERGENS.filter(a => allIds.has(a.id));

  const issues: string[] = [];
  const ingredients = (info.ingredients || []).filter(i => i.trim());
  if (ingredients.length === 0) issues.push('No ingredients listed');
  if (!info.description?.trim()) issues.push('No description');
  for (const d of undeclaredAllergens) {
    issues.push(`${d.allergen.icon} ${d.allergen.label} not declared (found: ${d.matches.join(', ')})`);
  }

  const notes: string[] = [];
  const known = findNigerianFood(info.name);
  if (known) {
    const n = known.nutrition;
    const flags = [
      n.isHighCarb && 'high carb',
      n.isHighSugar && 'high sugar',
      n.isHighFat && 'high fat',
      n.isHighSodium && 'high sodium',
      n.isFried && 'fried',
    ].filter(Boolean);
    if (flags.length) notes.push(`Typical ${known.name}: ${flags.join(', ')}`);
  }

  return { undeclaredAllergens, allAllergens, issues, notes };
}

// ---------------------------------------------------------------------------
// Customer check
// ---------------------------------------------------------------------------
export function assessFood(info: FoodInfo, userConditions: string[]): HealthCheckResult | null {
  if (!userConditions?.length) return null;

  const conditions = new Set(userConditions);
  const triggered: HealthCondition[] = [];
  const effects: string[] = [];
  const trigger = (condition: HealthCondition, effect: string) => {
    if (!triggered.includes(condition)) triggered.push(condition);
    if (!effects.includes(effect)) effects.push(effect);
  };

  // 1. Vendor-declared tags/allergens and allergens detected from the ingredients.
  const tagIds = new Set([
    ...(info.health_tags || []),
    ...(info.allergens || []),
    ...detectAllergens(info).map(d => d.allergen.id),
  ]);
  for (const tag of tagIds) {
    const mapping = TAG_TO_CONDITIONS[tag];
    if (!mapping) continue;
    for (const c of mapping.conditions) {
      if (conditions.has(c)) trigger(c, mapping.effect);
    }
  }

  // 2. Each condition's avoid-list against name, description and ingredients.
  const text = foodText(info);
  for (const conditionId of userConditions) {
    const meta = HEALTH_CONDITIONS.find(c => c.id === conditionId);
    if (!meta) continue;
    const hit = meta.avoidTags.find(tag => containsTerm(text, tag));
    if (hit) trigger(meta.id, `${meta.icon} ${meta.label}: contains "${hit}"`);
  }

  // 3. General nutrition knowledge for common Nigerian dishes.
  const known = findNigerianFood(info.name);
  if (known) {
    for (const conditionId of userConditions) {
      const warning = (known.warnings as Record<string, string | undefined>)[conditionId];
      if (warning) trigger(conditionId as HealthCondition, warning);
    }
  }

  if (triggered.length === 0) return null;

  const names = triggered
    .map(c => HEALTH_CONDITIONS.find(h => h.id === c)?.label || c)
    .join(', ');

  return {
    verdict: triggered.some(c => SEVERE_CONDITIONS.has(c)) ? 'avoid' : 'caution',
    reason: `This item may not be suitable for your ${names} condition(s).`,
    effects,
    conditions: triggered,
  };
}
