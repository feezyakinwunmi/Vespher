// contexts/HealthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type HealthCondition =
  // Age-based
  | 'child_under_5' | 'child_5_12' | 'teen_13_17' | 'adult_18_40' | 'adult_41_60' | 'senior_60_plus'
  | 'pregnant' | 'breastfeeding' | 'menopause'

  // Medical Conditions
  | 'diabetic_type1' | 'diabetic_type2' | 'pre_diabetic'
  | 'hypertensive' | 'hypotensive'
  | 'heart_disease' | 'heart_condition' | 'high_cholesterol' | 'stroke_history'
  | 'kidney_disease' | 'liver_disease' | 'gout' | 'arthritis' | 'osteoporosis' | 'anemia'
  | 'thyroid_hyper' | 'thyroid_hypo'
  | 'asthma' | 'copd'
  | 'acid_reflux' | 'ibs' | 'crohns' | 'ulcerative_colitis' | 'celiac' | 'gallbladder'
  | 'migraine' | 'epilepsy' | 'cancer_history' | 'hiv_aids' | 'tuberculosis'
  | 'malaria_history' | 'typhoid_history'

  // Additional Common Conditions
  | 'obesity' | 'metabolic_syndrome' | 'pcod_pcos' | 'endometriosis'
  | 'psoriasis' | 'eczema' | 'acne' | 'dermatitis'
  | 'parkinsons' | 'multiple_sclerosis' | 'dementia' | 'alzheimers'
  | 'constipation_chronic' | 'diverticulitis' | 'pancreatitis' | 'hepatitis'
  | 'high_uric_acid'

  // Allergies & Intolerances
  | 'nut_allergy' | 'peanut_allergy' | 'tree_nut_allergy' | 'dairy_allergy' | 'lactose_intolerant'
  | 'egg_allergy' | 'shellfish_allergy' | 'fish_allergy' | 'soy_allergy' | 'wheat_allergy'
  | 'gluten_intolerance' | 'celiac_disease' | 'sesame_allergy' | 'corn_allergy'
  | 'sulfite_sensitivity' | 'msg_sensitivity' | 'histamine_intolerance' | 'fructose_intolerance'

  // Dietary & Lifestyle
  | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'low_carb' | 'low_fat'
  | 'low_sugar' | 'low_sodium' | 'low_fodmap' | 'halal' | 'kosher' | 'intermittent_fasting'

  // Fitness & Wellness Goals
  | 'workout_mode' | 'muscle_gain' | 'weight_loss' | 'weight_gain'
  | 'endurance_training' | 'bodybuilding' | 'athlete' | 'post_workout_recovery'

  // Mental Health
  | 'anxiety' | 'depression' | 'adhd' | 'autism' | 'bipolar' | 'insomnia'

  // Nigerian & African Specific
  | 'sickle_cell' | 'kwashiorkor' | 'malnutrition_history'
  | 'hypertension_african' | 'diabetes_african' | 'lactose_intolerant_african'

  // Post-Surgery & Recovery
  | 'post_surgery' | 'dental_surgery' | 'chemo_patient' | 'organ_transplant' | 'wound_healing'

  // General Health
  | 'weak_immune' | 'frequent_sickness' | 'low_energy' | 'underweight' | 'overweight' | 'obese';

export interface HealthConditionMeta {
  id: HealthCondition;
  label: string;
  icon: string;
  description: string;
  color: string;
  avoidTags: string[];
  goodTags?: string[];
  ageGroup?: string;
  category: string;
}

export const HEALTH_CONDITIONS: HealthConditionMeta[] = [
  // ========== AGE-BASED CONDITIONS ==========
  {
    id: 'child_under_5',
    label: 'Child (Under 5 years)',
    icon: '👶',
    description: 'Young child with developing digestive system',
    color: '#f59e0b',
    category: 'age',
    avoidTags: ['honey', 'raw', 'undercooked', 'whole nuts', 'choking hazard', 'sugary', 'caffeine', 'spicy'],
    goodTags: ['soft', 'mashed', 'nutritious', 'vitamin rich', 'calcium rich', 'iron rich']
  },
  {
    id: 'child_5_12',
    label: 'Child (5-12 years)',
    icon: '🧒',
    description: 'Growing child needing balanced nutrition',
    color: '#f59e0b',
    category: 'age',
    avoidTags: ['excessive sugar', 'caffeine', 'junk food', 'processed', 'soda', 'candy'],
    goodTags: ['protein', 'calcium', 'vegetables', 'fruits', 'whole grains']
  },
  {
    id: 'teen_13_17',
    label: 'Teenager (13-17 years)',
    icon: '🧑',
    description: 'Adolescent with high nutritional needs',
    color: '#f59e0b',
    category: 'age',
    avoidTags: ['empty calories', 'excessive sugar', 'processed snacks', 'soda', 'energy drinks'],
    goodTags: ['protein', 'calcium', 'iron', 'zinc', 'vitamins', 'healthy fats']
  },
  {
    id: 'adult_18_40',
    label: 'Adult (18-40 years)',
    icon: '👨',
    description: 'Peak adult with active lifestyle',
    color: '#f59e0b',
    category: 'age',
    avoidTags: ['excessive processed food', 'high sodium', 'trans fat'],
    goodTags: ['balanced', 'protein rich', 'fibre', 'antioxidants']
  },
  {
    id: 'adult_41_60',
    label: 'Middle Age (41-60 years)',
    icon: '👴',
    description: 'Age-related health management',
    color: '#f59e0b',
    category: 'age',
    avoidTags: ['high cholesterol', 'high sodium', 'saturated fat', 'sugary', 'processed meat'],
    goodTags: ['heart healthy', 'low sodium', 'fibre', 'calcium', 'omega-3']
  },
  {
    id: 'senior_60_plus',
    label: 'Senior (60+ years)',
    icon: '👵',
    description: 'Elderly with age-related dietary needs',
    color: '#f59e0b',
    category: 'age',
    avoidTags: ['hard to chew', 'tough meat', 'raw vegetables', 'spicy', 'excessive salt', 'sugary'],
    goodTags: ['soft', 'easy to digest', 'calcium rich', 'protein rich', 'vitamin b12', 'fibre']
  },

  // ========== PREGNANCY & MATERNAL ==========
  {
    id: 'pregnant',
    label: 'Pregnancy',
    icon: '🤰',
    description: 'Nutritional needs during pregnancy',
    color: '#ec4899',
    category: 'maternal',
    avoidTags: ['raw fish', 'sushi', 'unpasteurized', 'alcohol', 'high mercury', 'raw eggs', 'liver', 'pate', 'undercooked meat', 'soft cheese', 'caffeine'],
    goodTags: ['folate rich', 'iron rich', 'calcium rich', 'protein', 'folic acid', 'prenatal vitamins']
  },
  {
    id: 'breastfeeding',
    label: 'Breastfeeding',
    icon: '🍼',
    description: 'Nutritional needs during breastfeeding',
    color: '#ec4899',
    category: 'maternal',
    avoidTags: ['alcohol', 'caffeine', 'spicy', 'gas causing beans', 'cabbage', 'broccoli', 'gassy vegetables', 'allergenic foods'],
    goodTags: ['hydrating', 'calcium rich', 'protein', 'oats', 'barley', 'fenugreek']
  },
  {
    id: 'menopause',
    label: 'Menopause',
    icon: '🌸',
    description: 'Managing menopausal symptoms',
    color: '#ec4899',
    category: 'maternal',
    avoidTags: ['spicy', 'caffeine', 'alcohol', 'sugary', 'processed', 'hot foods', 'triggers'],
    goodTags: ['calcium', 'vitamin d', 'phytoestrogens', 'soy', 'flaxseed', 'whole grains']
  },

  // ========== CHRONIC CONDITIONS ==========
  {
    id: 'diabetic_type1',
    label: 'Type 1 Diabetes',
    icon: '🩸',
    description: 'Insulin-dependent diabetes management',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['sugary', 'sweet', 'cake', 'ice cream', 'soda', 'juice', 'candy', 'chocolate', 'syrup', 'honey', 'white rice', 'white bread', 'pasta', 'carb heavy'],
    goodTags: ['low glycemic', 'high fibre', 'protein', 'non-starchy vegetables', 'whole grains']
  },
  {
    id: 'diabetic_type2',
    label: 'Type 2 Diabetes',
    icon: '🩸',
    description: 'Non-insulin dependent diabetes management',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['sugary', 'sweet', 'soda', 'juice', 'white rice', 'white bread', 'refined carbs', 'processed', 'junk food'],
    goodTags: ['low carb', 'high fibre', 'leafy greens', 'lean protein', 'whole grains', 'low glycemic']
  },
  {
    id: 'pre_diabetic',
    label: 'Pre-diabetic',
    icon: '⚠️',
    description: 'Preventing progression to diabetes',
    color: '#f97316',
    category: 'chronic',
    avoidTags: ['sugary', 'sweet', 'soda', 'refined carbs', 'processed', 'white bread', 'white rice', 'pasta'],
    goodTags: ['whole grains', 'fibre rich', 'lean protein', 'vegetables', 'low sugar']
  },
  {
    id: 'hypertensive',
    label: 'High Blood Pressure',
    icon: '❤️',
    description: 'Managing hypertension',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['salty', 'salted', 'smoked', 'cured', 'processed', 'fast food', 'canned', 'pickled', 'soy sauce', 'maggi', 'stock cube', 'bouillon'],
    goodTags: ['low sodium', 'potassium rich', 'banana', 'plantain', 'leafy greens', 'beans', 'unsalted']
  },
  {
    id: 'hypotensive',
    label: 'Low Blood Pressure',
    icon: '💙',
    description: 'Managing low blood pressure',
    color: '#3b82f6',
    category: 'chronic',
    avoidTags: [],
    goodTags: ['salty foods', 'caffeine', 'hydrating', 'small frequent meals', 'vitamin b12', 'folate']
  },
  {
    id: 'high_cholesterol',
    label: 'High Cholesterol',
    icon: '🫀',
    description: 'Managing cholesterol levels',
    color: '#f43f5e',
    category: 'chronic',
    avoidTags: ['saturated fat', 'trans fat', 'fried', 'processed meat', 'butter', 'full cream', 'coconut oil', 'palm oil', 'red meat', 'organ meat'],
    goodTags: ['omega-3', 'fibre rich', 'oats', 'beans', 'nuts', 'olive oil', 'fish', 'avocado']
  },
  {
    id: 'heart_disease',
    label: 'Heart Disease',
    icon: '🫀',
    description: 'Heart-healthy diet required',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['saturated fat', 'trans fat', 'fried', 'salty', 'processed', 'red meat', 'butter', 'coconut', 'palm oil', 'sugary'],
    goodTags: ['heart healthy', 'low sodium', 'low fat', 'fibre rich', 'omega-3', 'vegetables', 'whole grains']
  },
  {
    id: 'stroke_history',
    label: 'Stroke History',
    icon: '🧠',
    description: 'Diet for stroke prevention',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['high sodium', 'saturated fat', 'processed food', 'fried', 'red meat', 'sugary drinks'],
    goodTags: ['low sodium', 'mediterranean', 'fish', 'olive oil', 'nuts', 'vegetables', 'fruits']
  },
  {
    id: 'kidney_disease',
    label: 'Kidney Disease',
    icon: '🩸',
    description: 'Kidney-friendly diet required',
    color: '#8b5cf6',
    category: 'chronic',
    avoidTags: ['high potassium', 'high phosphorus', 'high sodium', 'processed', 'dairy', 'nuts', 'banana', 'orange', 'cola', 'dark soda'],
    goodTags: ['low potassium', 'low phosphorus', 'low sodium', 'renal friendly', 'white rice', 'apples', 'berries']
  },
  {
    id: 'liver_disease',
    label: 'Liver Disease',
    icon: '🧬',
    description: 'Liver-supporting diet',
    color: '#8b5cf6',
    category: 'chronic',
    avoidTags: ['alcohol', 'fatty', 'fried', 'processed', 'red meat', 'sugary', 'high sodium', 'raw shellfish'],
    goodTags: ['lean protein', 'vegetables', 'fruits', 'whole grains', 'low fat', 'coffee', 'green tea']
  },
  {
    id: 'gout',
    label: 'Gout',
    icon: '🦶',
    description: 'Managing uric acid levels',
    color: '#8b5cf6',
    category: 'chronic',
    avoidTags: ['high purine', 'organ meat', 'red meat', 'shellfish', 'sardines', 'mackerel', 'anchovies', 'beer', 'sugary drinks'],
    goodTags: ['low purine', 'cherries', 'berries', 'vegetables', 'water', 'low fat dairy', 'coffee']
  },
  {
    id: 'arthritis',
    label: 'Arthritis',
    icon: '🦴',
    description: 'Anti-inflammatory diet',
    color: '#8b5cf6',
    category: 'chronic',
    avoidTags: ['inflammatory', 'processed', 'fried', 'sugary', 'red meat', 'dairy', 'refined carbs', 'alcohol'],
    goodTags: ['anti inflammatory', 'omega-3', 'fish', 'turmeric', 'ginger', 'berries', 'leafy greens', 'olive oil']
  },
  {
    id: 'osteoporosis',
    label: 'Osteoporosis',
    icon: '🦴',
    description: 'Bone health support',
    color: '#8b5cf6',
    category: 'chronic',
    avoidTags: ['excessive salt', 'caffeine', 'alcohol', 'soda'],
    goodTags: ['calcium rich', 'vitamin d', 'leafy greens', 'dairy', 'fish', 'fortified foods']
  },
  {
    id: 'anemia',
    label: 'Anemia',
    icon: '🩸',
    description: 'Iron deficiency management',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['calcium blockers', 'tea with meals', 'coffee with meals'],
    goodTags: ['iron rich', 'red meat', 'liver', 'leafy greens', 'beans', 'vitamin c rich', 'fortified cereals']
  },
  {
    id: 'thyroid_hyper',
    label: 'Hyperthyroidism',
    icon: '🏥',
    description: 'Overactive thyroid management',
    color: '#8b5cf6',
    category: 'chronic',
    avoidTags: ['iodine rich', 'seaweed', 'kelp', 'iodized salt', 'soy', 'caffeine'],
    goodTags: ['calcium rich', 'lean protein', 'vegetables', 'low iodine']
  },
  {
    id: 'thyroid_hypo',
    label: 'Hypothyroidism',
    icon: '🏥',
    description: 'Underactive thyroid management',
    color: '#8b5cf6',
    category: 'chronic',
    avoidTags: ['raw goitrogenic', 'raw cabbage', 'raw broccoli', 'raw kale', 'soy', 'millet'],
    goodTags: ['iodine rich', 'seaweed', 'fish', 'eggs', 'dairy', 'selenium rich', 'brazil nuts']
  },
  {
    id: 'obesity',
    label: 'Obesity',
    icon: '⚖️',
    description: 'Weight management for obesity',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['high calorie', 'fried', 'sugary', 'processed', 'fast food'],
    goodTags: ['high fibre', 'vegetables', 'lean protein', 'whole grains', 'water rich']
  },
  {
    id: 'metabolic_syndrome',
    label: 'Metabolic Syndrome',
    icon: '🩸',
    description: 'Cluster of conditions increasing heart risk',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['sugary', 'refined carbs', 'fried', 'processed'],
    goodTags: ['mediterranean', 'high fibre', 'healthy fats', 'leafy greens']
  },
  {
    id: 'pcod_pcos',
    label: 'PCOS / PCOD',
    icon: '🌸',
    description: 'Polycystic Ovary Syndrome',
    color: '#ec4899',
    category: 'chronic',
    avoidTags: ['high sugar', 'refined carbs', 'dairy', 'fried'],
    goodTags: ['low glycemic', 'anti-inflammatory', 'cinnamon', 'spearmint', 'fiber rich']
  },
  {
    id: 'endometriosis',
    label: 'Endometriosis',
    icon: '🌸',
    description: 'Endometriosis management',
    color: '#ec4899',
    category: 'chronic',
    avoidTags: ['red meat', 'dairy', 'gluten', 'processed'],
    goodTags: ['anti-inflammatory', 'omega-3', 'leafy greens', 'berries', 'turmeric']
  },

  // ========== RESPIRATORY ==========
  {
    id: 'asthma',
    label: 'Asthma',
    icon: '🫁',
    description: 'Managing asthma triggers',
    color: '#8b5cf6',
    category: 'respiratory',
    avoidTags: ['sulfite', 'wine', 'beer', 'dried fruit', 'shrimp', 'pickled', 'fermented', 'cold drinks', 'ice cream', 'processed meat'],
    goodTags: ['anti inflammatory', 'magnesium rich', 'leafy greens', 'nuts', 'seeds', 'fruits', 'vegetables', 'omega-3']
  },
  {
    id: 'copd',
    label: 'COPD',
    icon: '🫁',
    description: 'Chronic lung disease management',
    color: '#8b5cf6',
    category: 'respiratory',
    avoidTags: ['gas causing', 'beans', 'cabbage', 'broccoli', 'carbonated drinks', 'fried', 'processed'],
    goodTags: ['easy to breathe', 'anti inflammatory', 'protein rich', 'healthy fats', 'complex carbs']
  },

  // ========== DIGESTIVE ==========
  {
    id: 'acid_reflux',
    label: 'Acid Reflux / GERD',
    icon: '🔥',
    description: 'Managing heartburn and reflux',
    color: '#f59e0b',
    category: 'digestive',
    avoidTags: ['spicy', 'fatty', 'fried', 'citrus', 'tomato', 'onion', 'garlic', 'mint', 'chocolate', 'caffeine', 'alcohol', 'carbonated'],
    goodTags: ['low acid', 'bland', 'lean protein', 'oatmeal', 'ginger', 'alkaline', 'banana', 'melon']
  },
  {
    id: 'ibs',
    label: 'IBS (Irritable Bowel)',
    icon: '💩',
    description: 'Managing irritable bowel syndrome',
    color: '#f59e0b',
    category: 'digestive',
    avoidTags: ['fodmap', 'onion', 'garlic', 'beans', 'lentils', 'wheat', 'dairy', 'apple', 'watermelon', 'cauliflower', 'mushroom'],
    goodTags: ['low fodmap', 'rice', 'potato', 'carrot', 'zucchini', 'spinach', 'fodmap friendly']
  },
  {
    id: 'crohns',
    label: 'Crohn\'s Disease',
    icon: '💩',
    description: 'Inflammatory bowel disease management',
    color: '#f59e0b',
    category: 'digestive',
    avoidTags: ['high fibre', 'nuts', 'seeds', 'popcorn', 'raw vegetables', 'spicy', 'fatty', 'fried', 'dairy'],
    goodTags: ['low residue', 'smooth', 'cooked vegetables', 'lean protein', 'white rice', 'white bread']
  },
  {
    id: 'ulcerative_colitis',
    label: 'Ulcerative Colitis',
    icon: '💩',
    description: 'Inflammatory bowel disease',
    color: '#f59e0b',
    category: 'digestive',
    avoidTags: ['high fibre', 'spicy', 'fatty', 'fried', 'dairy', 'alcohol', 'caffeine', 'raw vegetables', 'nuts', 'seeds'],
    goodTags: ['low residue', 'cooked', 'soft', 'lean protein', 'white rice', 'banana', 'applesauce']
  },
  {
    id: 'celiac',
    label: 'Celiac Disease',
    icon: '🌾',
    description: 'Severe gluten intolerance',
    color: '#f59e0b',
    category: 'digestive',
    avoidTags: ['gluten', 'wheat', 'barley', 'rye', 'oats', 'bread', 'pasta', 'flour', 'beer', 'soy sauce', 'couscous', 'semolina'],
    goodTags: ['gluten free', 'rice', 'corn', 'quinoa', 'buckwheat', 'gluten free flour', 'tapioca']
  },
  {
    id: 'gallbladder',
    label: 'Gallbladder Issues',
    icon: '🟢',
    description: 'Low fat diet for gallbladder',
    color: '#f59e0b',
    category: 'digestive',
    avoidTags: ['fatty', 'fried', 'creamy', 'butter', 'oil rich', 'egg yolk', 'red meat', 'processed', 'dairy'],
    goodTags: ['low fat', 'lean protein', 'vegetables', 'fruits', 'whole grains', 'low oil']
  },
  {
    id: 'constipation_chronic',
    label: 'Chronic Constipation',
    icon: '🚽',
    description: 'Improving bowel movement',
    color: '#f59e0b',
    category: 'digestive',
    avoidTags: ['low fibre', 'processed', 'low water'],
    goodTags: ['high fibre', 'prunes', 'kiwi', 'water rich', 'probiotics']
  },
  {
    id: 'diverticulitis',
    label: 'Diverticulitis',
    icon: '💩',
    description: 'Diverticular disease',
    color: '#f59e0b',
    category: 'digestive',
    avoidTags: ['nuts', 'seeds', 'popcorn', 'corn', 'raw vegetables'],
    goodTags: ['low residue during flare', 'high fibre when stable']
  },

  // ========== ALLERGIES & INTOLERANCES ==========
  {
    id: 'nut_allergy',
    label: 'Nut Allergy (All nuts)',
    icon: '🥜',
    description: 'Allergic to all nuts',
    color: '#d97706',
    category: 'allergy',
    avoidTags: ['nut', 'peanut', 'almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'chestnut', 'nut butter', 'nut oil'],
    goodTags: ['nut free', 'seed butter', 'sunflower butter']
  },
  {
    id: 'peanut_allergy',
    label: 'Peanut Allergy',
    icon: '🥜',
    description: 'Allergic to peanuts',
    color: '#d97706',
    category: 'allergy',
    avoidTags: ['peanut', 'groundnut', 'arachis', 'peanut butter', 'peanut oil', 'peanut flour', 'kuli kuli'],
    goodTags: ['peanut free', 'other nuts', 'seeds']
  },
  {
    id: 'tree_nut_allergy',
    label: 'Tree Nut Allergy',
    icon: '🌰',
    description: 'Allergic to tree nuts',
    color: '#d97706',
    category: 'allergy',
    avoidTags: ['almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'chestnut', 'brazil nut'],
    goodTags: ['peanuts', 'seeds', 'nut free']
  },
  {
    id: 'dairy_allergy',
    label: 'Dairy Allergy',
    icon: '🥛',
    description: 'Allergic to milk proteins',
    color: '#06b6d4',
    category: 'allergy',
    avoidTags: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'lactose', 'ice cream', 'milky'],
    goodTags: ['dairy free', 'plant milk', 'soy milk', 'almond milk', 'coconut milk']
  },
  {
    id: 'lactose_intolerant',
    label: 'Lactose Intolerant',
    icon: '🥛',
    description: 'Difficulty digesting lactose',
    color: '#06b6d4',
    category: 'intolerance',
    avoidTags: ['milk', 'milk powder', 'cream', 'ice cream', 'soft cheese', 'yogurt', 'whey'],
    goodTags: ['lactose free', 'hard cheese', 'aged cheese', 'plant milk', 'lactaid']
  },
  {
    id: 'egg_allergy',
    label: 'Egg Allergy',
    icon: '🥚',
    description: 'Allergic to eggs',
    color: '#d97706',
    category: 'allergy',
    avoidTags: ['egg', 'egg white', 'egg yolk', 'mayonnaise', 'meringue', 'albumin', 'ovoglobulin'],
    goodTags: ['egg free', 'flax egg', 'chia egg', 'tofu']
  },
  {
    id: 'shellfish_allergy',
    label: 'Shellfish Allergy',
    icon: '🦐',
    description: 'Allergic to shellfish',
    color: '#d97706',
    category: 'allergy',
    avoidTags: ['shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'langoustine', 'oyster', 'clam', 'mussel', 'scallop', 'shellfish'],
    goodTags: ['fish', 'other seafood']
  },
  {
    id: 'fish_allergy',
    label: 'Fish Allergy',
    icon: '🐟',
    description: 'Allergic to fish',
    color: '#d97706',
    category: 'allergy',
    avoidTags: ['fish', 'tilapia', 'croaker', 'catfish', 'mackerel', 'salmon', 'tuna', 'sardine', 'cod', 'haddock', 'fish sauce'],
    goodTags: ['shellfish', 'chicken', 'beef', 'vegetarian']
  },
  {
    id: 'soy_allergy',
    label: 'Soy Allergy',
    icon: '🌱',
    description: 'Allergic to soy',
    color: '#d97706',
    category: 'allergy',
    avoidTags: ['soy', 'soybean', 'tofu', 'tempeh', 'edamame', 'soy sauce', 'soya', 'bean curd', 'soy milk', 'miso'],
    goodTags: ['soy free', 'coconut aminos', 'liquid aminos']
  },
  {
    id: 'celiac_disease',
    label: 'Celiac Disease',
    icon: '🌾',
    description: 'Autoimmune gluten disorder',
    color: '#10b981',
    category: 'allergy',
    avoidTags: ['gluten', 'wheat', 'barley', 'rye', 'oats', 'bread', 'pasta', 'flour', 'beer', 'soup', 'soy sauce', 'couscous'],
    goodTags: ['gluten free', 'corn', 'rice', 'quinoa', 'millet', 'sorghum', 'teff', 'buckwheat']
  },
  {
    id: 'sesame_allergy',
    label: 'Sesame Allergy',
    icon: '🌻',
    description: 'Allergic to sesame seeds',
    color: '#d97706',
    category: 'allergy',
    avoidTags: ['sesame', 'benne seed', 'tahini', 'sesame oil', 'sesame seed', 'beniseed'],
    goodTags: ['sesame free', 'other seeds']
  },
  {
    id: 'histamine_intolerance',
    label: 'Histamine Intolerance',
    icon: '⚠️',
    description: 'Difficulty breaking down histamine',
    color: '#d97706',
    category: 'intolerance',
    avoidTags: ['fermented', 'aged cheese', 'wine', 'beer', 'sauerkraut', 'processed meat', 'tomato', 'spinach'],
    goodTags: ['fresh foods', 'low histamine', 'quercetin', 'vitamin c']
  },
  {
    id: 'fructose_intolerance',
    label: 'Fructose Malabsorption',
    icon: '🍎',
    description: 'Fructose intolerance',
    color: '#d97706',
    category: 'intolerance',
    avoidTags: ['apple', 'pear', 'mango', 'honey', 'high fructose corn syrup'],
    goodTags: ['glucose balanced', 'low fructose fruits']
  },

  // ========== DIETARY & LIFESTYLE ==========
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    icon: '🥦',
    description: 'No meat or seafood',
    color: '#22c55e',
    category: 'diet',
    avoidTags: ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood', 'bacon', 'sausage', 'shrimp', 'prawn', 'lamb', 'goat meat', 'ram meat'],
    goodTags: ['vegetarian', 'plant based', 'tofu', 'beans', 'lentils', 'eggs', 'dairy']
  },
  {
    id: 'vegan',
    label: 'Vegan',
    icon: '🌱',
    description: 'No animal products whatsoever',
    color: '#22c55e',
    category: 'diet',
    avoidTags: ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood', 'egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey', 'gelatin', 'whey', 'casein'],
    goodTags: ['vegan', 'plant based', 'tofu', 'tempeh', 'seitan', 'nutritional yeast', 'plant milk']
  },
  {
    id: 'pescatarian',
    label: 'Pescatarian',
    icon: '🐟',
    description: 'Fish and seafood allowed, no meat',
    color: '#22c55e',
    category: 'diet',
    avoidTags: ['meat', 'chicken', 'beef', 'pork', 'bacon', 'sausage', 'lamb', 'goat meat'],
    goodTags: ['fish', 'seafood', 'vegetarian', 'vegetables', 'tofu', 'beans']
  },
  {
    id: 'keto',
    label: 'Keto Diet',
    icon: '🥑',
    description: 'Low carb, high fat diet',
    color: '#22c55e',
    category: 'diet',
    avoidTags: ['high carb', 'sugar', 'rice', 'bread', 'pasta', 'potato', 'yam', 'beans', 'cereal', 'fruit', 'soda', 'juice', 'starchy vegetables'],
    goodTags: ['low carb', 'high fat', 'meat', 'fish', 'eggs', 'cheese', 'butter', 'oil', 'nuts', 'avocado', 'leafy greens']
  },
  {
    id: 'paleo',
    label: 'Paleo Diet',
    icon: '🍖',
    description: 'Whole foods, no processed',
    color: '#22c55e',
    category: 'diet',
    avoidTags: ['processed', 'grains', 'dairy', 'refined sugar', 'legumes', 'beans', 'lentils', 'soy', 'vegetable oil'],
    goodTags: ['meat', 'fish', 'eggs', 'vegetables', 'fruits', 'nuts', 'seeds', 'coconut oil', 'olive oil']
  },
  {
    id: 'low_carb',
    label: 'Low Carb',
    icon: '🍞',
    description: 'Reduced carbohydrate intake',
    color: '#22c55e',
    category: 'diet',
    avoidTags: ['high carb', 'sugar', 'rice', 'bread', 'pasta', 'potato', 'yam', 'cereal', 'soda', 'juice'],
    goodTags: ['protein rich', 'vegetables', 'healthy fats', 'low carb vegetables']
  },
  {
    id: 'low_fat',
    label: 'Low Fat',
    icon: '🥗',
    description: 'Reduced fat intake',
    color: '#22c55e',
    category: 'diet',
    avoidTags: ['fatty', 'oily', 'fried', 'butter', 'oil', 'cream', 'coconut', 'avocado', 'nuts', 'seeds', 'red meat', 'fatty fish'],
    goodTags: ['lean protein', 'vegetables', 'fruits', 'whole grains', 'low fat dairy']
  },
  {
    id: 'low_sugar',
    label: 'Low Sugar',
    icon: '🍬',
    description: 'Reduced sugar intake',
    color: '#22c55e',
    category: 'diet',
  avoidTags: [
    'sugar', 'sweet', 'cake', 'candy', 'chocolate', 'soda', 'juice', 
    'honey', 'syrup', 'ice cream', 'pastry', 'donut', 'coke', 'coca-cola',
    'coca cola', 'sprite', 'fanta', 'pepsi', 'soft drink', 'carbonated drink',
    'chips', 'pringles', 'lays', 'doritos', 'snack', 'biscuit', 'cookie',
    'glucose', 'fructose', 'sucrose', 'maltose', 'corn syrup', 'cane sugar',
    'milk chocolate', 'white chocolate', 'caramel', 'toffee', 'marshmallow',
    'jam', 'marmalade', 'sweetener', 'sweetened'
  ],
  goodTags: ['no added sugar', 'naturally sweet', 'fruit', 'stevia', 'sugar free']
},
  {
    id: 'low_sodium',
    label: 'Low Sodium',
    icon: '🧂',
    description: 'Reduced salt intake',
    color: '#22c55e',
    category: 'diet',
    avoidTags: ['salty', 'salted', 'smoked', 'cured', 'pickled', 'processed', 'fast food', 'canned', 'maggi', 'stock cube', 'bouillon', 'soy sauce'],
    goodTags: ['low sodium', 'unsalted', 'herbs', 'spices', 'fresh', 'potassium rich']
  },
  {
    id: 'halal',
    label: 'Halal',
    icon: '☪️',
    description: 'Islamic dietary guidelines',
    color: '#10b981',
    category: 'diet',
    avoidTags: ['pork', 'ham', 'bacon', 'sausage', 'gelatin', 'alcohol', 'non halal meat', 'blood', 'carnivorous animals'],
    goodTags: ['halal certified', 'zabihah', 'chicken', 'beef', 'lamb', 'goat', 'fish', 'vegetarian']
  },
  {
    id: 'kosher',
    label: 'Kosher',
    icon: '✡️',
    description: 'Jewish dietary guidelines',
    color: '#10b981',
    category: 'diet',
    avoidTags: ['pork', 'shellfish', 'shrimp', 'crab', 'lobster', 'non kosher meat', 'meat and dairy together', 'blood'],
    goodTags: ['kosher certified', 'kosher meat', 'pareve', 'dairy', 'fish with scales']
  },

  // ========== FITNESS & WELLNESS ==========
  {
    id: 'workout_mode',
    label: 'Workout Mode',
    icon: '💪',
    description: 'Fitness-focused eating',
    color: '#f97316',
    category: 'fitness',
    avoidTags: ['fried', 'sugary', 'junk food', 'soda', 'candy', 'chips', 'fast food', 'processed', 'high fat', 'salty'],
    goodTags: ['protein rich', 'lean', 'healthy carbs', 'vegetables', 'chicken', 'fish', 'eggs', 'rice', 'sweet potato', 'clean eating']
  },
  {
    id: 'muscle_gain',
    label: 'Muscle Gain',
    icon: '💪',
    description: 'Building muscle mass',
    color: '#f97316',
    category: 'fitness',
    avoidTags: ['empty calories', 'junk food', 'sugary', 'fried', 'low protein', 'processed'],
    goodTags: ['high protein', 'chicken', 'beef', 'fish', 'eggs', 'dairy', 'rice', 'potato', 'oats', 'healthy fats', 'calorie dense']
  },
  {
    id: 'weight_loss',
    label: 'Weight Loss',
    icon: '⚖️',
    description: 'Losing weight',
    color: '#f97316',
    category: 'fitness',
    avoidTags: ['high calorie', 'fatty', 'fried', 'sugary', 'processed', 'junk food', 'fast food', 'soda', 'juice', 'high carb'],
    goodTags: ['low calorie', 'high protein', 'fibre rich', 'vegetables', 'lean protein', 'low fat', 'portion controlled', 'water rich']
  },
  {
    id: 'weight_gain',
    label: 'Weight Gain',
    icon: '📈',
    description: 'Gaining weight healthily',
    color: '#f97316',
    category: 'fitness',
    avoidTags: ['empty calories', 'junk food', 'sugary processed'],
    goodTags: ['calorie dense', 'protein rich', 'healthy fats', 'nuts', 'nut butter', 'avocado', 'whole grains', 'dairy', 'meat', 'rice']
  },
  {
    id: 'endurance_training',
    label: 'Endurance Training',
    icon: '🏃',
    description: 'Fueling for long workouts',
    color: '#f97316',
    category: 'fitness',
    avoidTags: ['heavy', 'fatty', 'fried', 'too much fibre before workout'],
    goodTags: ['carb loading', 'quick energy', 'complex carbs', 'rice', 'pasta', 'potato', 'banana', 'oats', 'hydration']
  },
  {
    id: 'post_workout_recovery',
    label: 'Post-Workout Recovery',
    icon: '🔄',
    description: 'Optimal recovery nutrition',
    color: '#f97316',
    category: 'fitness',
    avoidTags: ['alcohol', 'inflammatory', 'processed'],
    goodTags: ['protein rich', 'recovery', 'repair', 'anti inflammatory', 'chicken', 'fish', 'eggs', 'soy', 'leafy greens', 'berries', 'omega-3']
  },

  // ========== MENTAL HEALTH ==========
  {
    id: 'anxiety',
    label: 'Anxiety',
    icon: '😰',
    description: 'Supporting mental wellness',
    color: '#8b5cf6',
    category: 'mental',
    avoidTags: ['caffeine', 'alcohol', 'sugary', 'energy drinks', 'stimulants', 'processed'],
    goodTags: ['magnesium rich', 'omega-3', 'leafy greens', 'nuts', 'seeds', 'whole grains', 'banana', 'turmeric', 'chamomile']
  },
  {
    id: 'depression',
    label: 'Depression',
    icon: '😞',
    description: 'Mood-supporting nutrition',
    color: '#8b5cf6',
    category: 'mental',
    avoidTags: ['sugary', 'processed', 'junk food', 'alcohol', 'inflammatory'],
    goodTags: ['omega-3', 'vitamin d', 'b vitamins', 'fish', 'leafy greens', 'berries', 'nuts', 'seeds', 'turmeric', 'whole grains']
  },
  {
    id: 'bipolar',
    label: 'Bipolar Disorder',
    icon: '🧠',
    description: 'Mood stabilization support',
    color: '#8b5cf6',
    category: 'mental',
    avoidTags: ['caffeine', 'alcohol', 'sugar crashes'],
    goodTags: ['omega-3', 'balanced meals', 'regular eating schedule']
  },

  // ========== NIGERIAN/AFRICAN SPECIFIC ==========
  {
    id: 'sickle_cell',
    label: 'Sickle Cell',
    icon: '🩸',
    description: 'Sickle cell disease management',
    color: '#ef4444',
    category: 'genetic',
    avoidTags: ['dehydrating', 'caffeine', 'alcohol', 'high altitude foods'],
    goodTags: ['hydrating', 'folic acid rich', 'leafy greens', 'beans', 'lentils', 'fortified grains', 'vitamin c rich', 'water rich']
  },
  {
    id: 'kwashiorkor',
    label: 'Kwashiorkor History',
    icon: '🥣',
    description: 'Protein-energy malnutrition recovery',
    color: '#ef4444',
    category: 'genetic',
    avoidTags: ['low protein'],
    goodTags: ['high quality protein', 'legumes', 'animal protein', 'nutrient dense']
  },
  {
    id: 'hypertension_african',
    label: 'Hypertension (African context)',
    icon: '❤️',
    description: 'High blood pressure with African diet considerations',
    color: '#ef4444',
    category: 'chronic',
    avoidTags: ['maggi', 'stock cube', 'bouillon', 'salty', 'salted fish', 'salted meat', 'processed', 'canned', 'pickled', 'high sodium'],
    goodTags: ['local herbs', 'uda', 'ehuru', 'negro pepper', 'low sodium', 'potassium rich', 'fresh vegetables', 'unprocessed']
  },
  {
    id: 'lactose_intolerant_african',
    label: 'Lactose Intolerant (African)',
    icon: '🥛',
    description: 'High prevalence lactose intolerance',
    color: '#06b6d4',
    category: 'intolerance',
    avoidTags: ['milk', 'powdered milk', 'ice cream', 'cream', 'soft cheese', 'milk tea', 'milo with milk'],
    goodTags: ['lactose free', 'plant milk', 'fermented dairy', 'yogurt', 'hard cheese', 'soy milk', 'coconut milk']
  },

  // ========== POST-SURGERY & RECOVERY ==========
  {
    id: 'post_surgery',
    label: 'Post-Surgery Recovery',
    icon: '🏥',
    description: 'Healing and recovery nutrition',
    color: '#ec4899',
    category: 'recovery',
    avoidTags: ['hard to digest', 'spicy', 'fibrous', 'processed', 'alcohol'],
    goodTags: ['easy to digest', 'protein rich', 'zinc rich', 'vitamin c rich', 'bone broth', 'eggs', 'soft foods', 'smoothies']
  },
  {
    id: 'chemo_patient',
    label: 'Chemotherapy Patient',
    icon: '⚕️',
    description: 'Supporting during cancer treatment',
    color: '#ec4899',
    category: 'recovery',
    avoidTags: ['raw', 'unpasteurized', 'undercooked', 'spicy', 'acidic', 'hard to digest'],
    goodTags: ['easy to digest', 'immune supporting', 'protein rich', 'calorie dense', 'bone broth', 'smoothies', 'soft foods']
  },
  {
    id: 'wound_healing',
    label: 'Wound Healing',
    icon: '🩹',
    description: 'Supporting wound recovery',
    color: '#ec4899',
    category: 'recovery',
    avoidTags: ['inflammatory', 'sugar'],
    goodTags: ['protein rich', 'vitamin c', 'zinc', 'vitamin a', 'hydration']
  },

  // ========== GENERAL HEALTH ==========
  {
    id: 'weak_immune',
    label: 'Weak Immune System',
    icon: '🛡️',
    description: 'Supporting immune function',
    color: '#10b981',
    category: 'general',
    avoidTags: ['raw', 'unpasteurized', 'undercooked', 'sugary', 'processed', 'alcohol'],
    goodTags: ['immune boosting', 'vitamin c', 'zinc', 'garlic', 'ginger', 'turmeric', 'citrus', 'leafy greens', 'bone broth']
  },
  {
    id: 'low_energy',
    label: 'Low Energy / Fatigue',
    icon: '🔋',
    description: 'Boosting energy levels',
    color: '#10b981',
    category: 'general',
    avoidTags: ['sugary', 'caffeine dependent', 'processed', 'empty calories'],
    goodTags: ['slow release energy', 'complex carbs', 'b vitamins', 'iron rich', 'oats', 'brown rice', 'beans', 'leafy greens', 'nuts', 'seeds']
  },
  {
    id: 'overweight',
    label: 'Overweight',
    icon: '⚖️',
    description: 'Weight management',
    color: '#f97316',
    category: 'general',
    avoidTags: ['high calorie', 'processed', 'sugary'],
    goodTags: ['balanced', 'high fibre', 'portion control']
  }
];

export const HEALTH_CATEGORIES = [
  { id: 'age', label: '👶 Age Groups', icon: '👶' },
  { id: 'maternal', label: '🤰 Pregnancy & Maternal', icon: '🤰' },
  { id: 'chronic', label: '🩺 Chronic Conditions', icon: '🩺' },
  { id: 'respiratory', label: '🫁 Respiratory', icon: '🫁' },
  { id: 'digestive', label: '💩 Digestive Health', icon: '💩' },
  { id: 'allergy', label: '🚫 Allergies', icon: '🚫' },
  { id: 'intolerance', label: '⚠️ Intolerances', icon: '⚠️' },
  { id: 'diet', label: '🥗 Special Diets', icon: '🥗' },
  { id: 'fitness', label: '💪 Fitness Goals', icon: '💪' },
  { id: 'mental', label: '🧠 Mental Health', icon: '🧠' },
  { id: 'genetic', label: '🧬 Genetic Conditions', icon: '🧬' },
  { id: 'recovery', label: '🏥 Recovery', icon: '🏥' },
  { id: 'general', label: '⭐ General Health', icon: '⭐' }
];

export interface HealthProfile {
  conditions: HealthCondition[];
  isLocked: boolean;
  enableWarnings: boolean;
  lockInGoal: string | null;
  lockInEndDate: string | null;
}

interface HealthContextValue {
  healthProfile: HealthProfile;
  setConditions: (conditions: HealthCondition[]) => void;
  setLockInGoal: (goal: string | null) => void;
  setLockInEndDate: (date: string | null) => void;
  toggleLockIn: () => void;
  toggleWarnings: () => void;
  isLoading: boolean;
  saveProfile: (overrides?: Partial<HealthProfile>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  hasAnyCondition: boolean;
}

const defaultProfile: HealthProfile = {
  conditions: [],
  isLocked: false,
  enableWarnings: true,
  lockInGoal: null,
  lockInEndDate: null,
};

const HealthContext = createContext<HealthContextValue>({
  healthProfile: defaultProfile,
  setConditions: () => {},
  setLockInGoal: () => {},
  setLockInEndDate: () => {},
  toggleLockIn: () => {},
  toggleWarnings: () => {},
  isLoading: false,
  saveProfile: async () => false,
  refreshProfile: async () => {},
  hasAnyCondition: false,
});

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [healthProfile, setHealthProfile] = useState<HealthProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setHealthProfile(defaultProfile);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('customer_health_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching health profile:', error);
        return;
      }

      if (data) {
        setHealthProfile({
          conditions: data.conditions || [],
          isLocked: data.is_locked || false,
          enableWarnings: data.enable_warnings ?? true,
          lockInGoal: data.lock_in_goal || null,
          lockInEndDate: data.lock_in_end_date || null,
        });
      } else {
        setHealthProfile(defaultProfile);
      }
    } catch (err) {
      console.error('Health profile load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const saveProfile = useCallback(async (overrides?: Partial<HealthProfile>): Promise<boolean> => {
    if (!user?.id) return false;

    const profileToSave = overrides ? { ...healthProfile, ...overrides } : healthProfile;

    try {
      const { data: existing } = await supabase
        .from('customer_health_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let result;

      if (existing) {
        result = await supabase
          .from('customer_health_profiles')
          .update({
            conditions: profileToSave.conditions,
            is_locked: profileToSave.isLocked,
            enable_warnings: profileToSave.enableWarnings,
            lock_in_goal: profileToSave.lockInGoal,
            lock_in_end_date: profileToSave.lockInEndDate,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      } else {
        result = await supabase
          .from('customer_health_profiles')
          .insert({
            user_id: user.id,
            conditions: profileToSave.conditions,
            is_locked: profileToSave.isLocked,
            enable_warnings: profileToSave.enableWarnings,
            lock_in_goal: profileToSave.lockInGoal,
            lock_in_end_date: profileToSave.lockInEndDate,
          });
      }

      return !result.error;
    } catch (err) {
      console.error('Health profile save error:', err);
      return false;
    }
  }, [user?.id, healthProfile]);

  useEffect(() => {
    refreshProfile();
  }, [user?.id, refreshProfile]);

  useEffect(() => {
    if (refreshKey > 0) refreshProfile();
  }, [refreshKey]);

  const setConditions = useCallback((conditions: HealthCondition[]) => {
    setHealthProfile(prev => ({ ...prev, conditions }));
    setTimeout(() => saveProfile({ conditions }), 100);
  }, [saveProfile]);

  const setLockInGoal = useCallback((lockInGoal: string | null) => {
    setHealthProfile(prev => ({ ...prev, lockInGoal }));
    setTimeout(() => saveProfile({ lockInGoal }), 100);
  }, [saveProfile]);

  const setLockInEndDate = useCallback((lockInEndDate: string | null) => {
    setHealthProfile(prev => ({ ...prev, lockInEndDate }));
    setTimeout(() => saveProfile({ lockInEndDate }), 100);
  }, [saveProfile]);

  const toggleLockIn = useCallback(() => {
    setHealthProfile(prev => ({ ...prev, isLocked: !prev.isLocked }));
    setTimeout(() => saveProfile({ isLocked: !healthProfile.isLocked }), 100);
  }, [healthProfile.isLocked, saveProfile]);

  const toggleWarnings = useCallback(() => {
    setHealthProfile(prev => ({ ...prev, enableWarnings: !prev.enableWarnings }));
    setTimeout(() => saveProfile({ enableWarnings: !healthProfile.enableWarnings }), 100);
  }, [healthProfile.enableWarnings, saveProfile]);

  const manualRefresh = useCallback(async () => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <HealthContext.Provider value={{
      healthProfile,
      setConditions,
      setLockInGoal,
      setLockInEndDate,
      toggleLockIn,
      toggleWarnings,
      isLoading,
      saveProfile,
      refreshProfile: manualRefresh,
      hasAnyCondition: healthProfile.conditions.length > 0,
    }}>
      {children}
    </HealthContext.Provider>
  );
}

export const useHealth = () => {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within HealthProvider');
  }
  return context;
};