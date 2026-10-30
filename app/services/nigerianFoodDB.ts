// services/nigerianFoodDB.ts
export interface NigerianFood {
  id: string;
  name: string;
  variants: string[];
  category: 'swallow' | 'soup' | 'rice' | 'protein' | 'snack' | 'drink' | 'breakfast';
  nutrition: {
    isHighCarb: boolean;
    isHighSugar: boolean;
    isHighFat: boolean;
    isHighSodium: boolean;
    isFried: boolean;
    hasGluten: boolean;
    hasNuts: boolean;
    hasDairy: boolean;
    hasEggs: boolean;
    hasShellfish: boolean;
  };
  warnings: {
    // General health
    diabetic?: string;
    hypertensive?: string;
    high_cholesterol?: string;
    weight_loss?: string;
    workout_mode?: string;
    low_sodium?: string;
    low_sugar?: string;
    heart_disease?: string;
    // Allergies
    nut_allergy?: string;
    peanut_allergy?: string;
    tree_nut_allergy?: string;
    dairy_allergy?: string;
    lactose_intolerant?: string;
    egg_allergy?: string;
    shellfish_allergy?: string;
    fish_allergy?: string;
    soy_allergy?: string;
    gluten_free?: string;
    celiac_disease?: string;
    // Respiratory
    asthmatic?: string;
    // Other
    acid_reflux?: string;
    pregnant?: string;
    sickle_cell?: string;
  };
}

export const NIGERIAN_FOODS: NigerianFood[] = [
  // ========== SWALLOWS ==========
  {
    id: 'eba',
    name: 'Eba',
    variants: ['eba', 'garri', 'eba garri', 'cassava flakes'],
    category: 'swallow',
    nutrition: {
      isHighCarb: true,
      isHighSugar: false,
      isHighFat: false,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in carbohydrates - may spike blood sugar levels',
      weight_loss: 'High calorie density - eat in moderation',
      workout_mode: 'Good for energy but high carb - best for pre-workout',
    }
  },
  {
    id: 'fufu',
    name: 'Fufu',
    variants: ['fufu', 'akpu', 'cassava fufu'],
    category: 'swallow',
    nutrition: {
      isHighCarb: true,
      isHighSugar: false,
      isHighFat: false,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in carbohydrates - may spike blood sugar',
      weight_loss: 'High calorie - moderate portions',
    }
  },
  {
    id: 'amala',
    name: 'Amala',
    variants: ['amala', 'yam flour', 'elubo'],
    category: 'swallow',
    nutrition: {
      isHighCarb: true,
      isHighSugar: false,
      isHighFat: false,
      isHighSodium: false,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in carbohydrates',
      weight_loss: 'Calorie dense',
    }
  },
  {
    id: 'pounded_yam',
    name: 'Pounded Yam',
    variants: ['pounded yam', 'iyan'],
    category: 'swallow',
    nutrition: {
      isHighCarb: true,
      isHighSugar: false,
      isHighFat: false,
      isHighSodium: false,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in carbohydrates - may spike blood sugar',
    }
  },
  {
    id: 'semo',
    name: 'Semovita',
    variants: ['semo', 'semolina'],
    category: 'swallow',
    nutrition: {
      isHighCarb: true,
      isHighSugar: false,
      isHighFat: false,
      isHighSodium: false,
      isFried: false,
      hasGluten: true,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in carbohydrates',
      gluten_free: 'Contains gluten - not safe for celiac',
      celiac_disease: 'Contains gluten - strictly avoid',
    }
  },

  // ========== SOUPS ==========
  {
    id: 'egusi_soup',
    name: 'Egusi Soup',
    variants: ['egusi', 'egusi soup', 'melon soup'],
    category: 'soup',
    nutrition: {
      isHighCarb: false,
      isHighSugar: false,
      isHighFat: true,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: true,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'May contain palm oil and thickeners that affect blood sugar',
      hypertensive: 'Often high in salt and palm oil',
      high_cholesterol: 'High in palm oil (saturated fat)',
      nut_allergy: 'Contains egusi (melon seeds) - may trigger allergies',
      weight_loss: 'High calorie - limit portion size',
      workout_mode: 'High fat - not ideal for lean eating',
    }
  },
  {
    id: 'ogbono_soup',
    name: 'Ogbono Soup',
    variants: ['ogbono', 'ogbono soup', 'wild mango soup'],
    category: 'soup',
    nutrition: {
      isHighCarb: false,
      isHighSugar: false,
      isHighFat: true,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: true,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'May affect blood sugar due to thickeners',
      hypertensive: 'High in salt and oil',
      high_cholesterol: 'Contains palm oil',
      nut_allergy: 'Contains ogbono seeds',
    }
  },
  {
    id: 'vegetable_soup',
    name: 'Vegetable Soup',
    variants: ['vegetable soup', 'efo riro', 'efo', 'green soup'],
    category: 'soup',
    nutrition: {
      isHighCarb: false,
      isHighSugar: false,
      isHighFat: true,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      hypertensive: 'Often high in salt and palm oil',
      high_cholesterol: 'Contains palm oil',
      weight_loss: 'High calorie from oil',
    }
  },
  {
    id: 'okro_soup',
    name: 'Okro Soup',
    variants: ['okro', 'okra soup', 'ilasa'],
    category: 'soup',
    nutrition: {
      isHighCarb: false,
      isHighSugar: false,
      isHighFat: true,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: true,
    },
    warnings: {
      hypertensive: 'High in salt',
      shellfish_allergy: 'Often contains dried crayfish (shellfish)',
    }
  },
  {
    id: 'pepper_soup',
    name: 'Pepper Soup',
    variants: ['pepper soup', 'catfish pepper soup', 'goat meat pepper soup'],
    category: 'soup',
    nutrition: {
      isHighCarb: false,
      isHighSugar: false,
      isHighFat: false,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: true,
    },
    warnings: {
      hypertensive: 'High in salt',
      asthmatic: 'Very spicy - may trigger respiratory issues',
      acid_reflux: 'Very spicy - may trigger heartburn',
      shellfish_allergy: 'Often contains dried fish/crayfish',
    }
  },

  // ========== RICE DISHES ==========
  {
    id: 'jollof_rice',
    name: 'Jollof Rice',
    variants: ['jollof rice', 'jollof', 'party jollof'],
    category: 'rice',
    nutrition: {
      isHighCarb: true,
      isHighSugar: false,
      isHighFat: true,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in carbs - may spike blood sugar',
      hypertensive: 'High in salt and oil',
      high_cholesterol: 'Contains cooking oil',
      weight_loss: 'High calorie density',
      low_sodium: 'Contains salt and seasoning',
      workout_mode: 'Good for energy but high calorie',
    }
  },
  {
    id: 'fried_rice',
    name: 'Fried Rice',
    variants: ['fried rice', 'chinese fried rice'],
    category: 'rice',
    nutrition: {
      isHighCarb: true,
      isHighSugar: false,
      isHighFat: true,
      isHighSodium: true,
      isFried: true,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: true,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in carbs',
      hypertensive: 'High in salt and oil',
      high_cholesterol: 'Fried and contains oil',
      weight_loss: 'High calorie',
      workout_mode: 'Fried food - not ideal',
      egg_allergy: 'May contain eggs',
    }
  },

  // ========== SNACKS ==========
  {
    id: 'puff_puff',
    name: 'Puff Puff',
    variants: ['puff puff', 'buns'],
    category: 'snack',
    nutrition: {
      isHighCarb: true,
      isHighSugar: true,
      isHighFat: true,
      isHighSodium: false,
      isFried: true,
      hasGluten: true,
      hasNuts: false,
      hasDairy: true,
      hasEggs: true,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in sugar and carbs - blood sugar spike',
      weight_loss: 'High calorie, high sugar - limit intake',
      workout_mode: 'Fried, sugary - not fitness friendly',
      low_sugar: 'High in sugar',
      gluten_free: 'Contains gluten',
      celiac_disease: 'Contains gluten',
      dairy_allergy: 'May contain milk',
      egg_allergy: 'May contain eggs',
    }
  },
  {
    id: 'samosa',
    name: 'Samosa',
    variants: ['samosa', 'samosas', 'meat pie'],
    category: 'snack',
    nutrition: {
      isHighCarb: true,
      isHighSugar: false,
      isHighFat: true,
      isHighSodium: true,
      isFried: true,
      hasGluten: true,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      diabetic: 'High in carbs from pastry',
      weight_loss: 'High calorie - deep fried',
      workout_mode: 'Fried - not ideal',
      gluten_free: 'Contains gluten',
      celiac_disease: 'Contains gluten',
      hypertensive: 'High in salt',
    }
  },

  // ========== BREAKFAST ==========
  {
    id: 'akara',
    name: 'Akara',
    variants: ['akara', 'bean cake', 'fried bean cake'],
    category: 'breakfast',
    nutrition: {
      isHighCarb: false,
      isHighSugar: false,
      isHighFat: true,
      isHighSodium: true,
      isFried: true,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: false,
      hasShellfish: false,
    },
    warnings: {
      workout_mode: 'Fried - not ideal for workout days',
      weight_loss: 'High in calories from frying',
      hypertensive: 'Contains salt',
    }
  },
  {
    id: 'moi_moi',
    name: 'Moi Moi',
    variants: ['moi moi', 'moimoi', 'steamed bean pudding'],
    category: 'breakfast',
    nutrition: {
      isHighCarb: false,
      isHighSugar: false,
      isHighFat: false,
      isHighSodium: true,
      isFried: false,
      hasGluten: false,
      hasNuts: false,
      hasDairy: false,
      hasEggs: true,
      hasShellfish: false,
    },
    warnings: {
      workout_mode: 'Good protein from beans',
      egg_allergy: 'May contain eggs',
    }
  },
];

// Helper function to find a food by name
export function findNigerianFood(productName: string): NigerianFood | null {
  const searchTerm = productName.toLowerCase().trim();
  
  // First try exact match
  let exact = NIGERIAN_FOODS.find(food => 
    food.name.toLowerCase() === searchTerm
  );
  if (exact) return exact;
  
  // Then check variants
  let byVariant = NIGERIAN_FOODS.find(food =>
    food.variants.some(v => searchTerm.includes(v))
  );
  if (byVariant) return byVariant;
  
  // Finally check partial match
  let partial = NIGERIAN_FOODS.find(food =>
    searchTerm.includes(food.name.toLowerCase())
  );
  
  return partial || null;
}