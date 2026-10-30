// hooks/customer/useAIFoodSuggestions.ts - meal-time classification helpers (used by services/recommendations)

import { containsTerm } from '../../services/foodSafety';

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface SuggestedProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  vendorId: string;
  vendorName: string;
  category: string;
}

interface RawProduct {
  id: string;
  name: string;
  image?: string;
  image_url?: string;
  price: number;
  vendorId: string;
  vendorName?: string;
  category?: string;
  description?: string;
}

// ============================================
// HARD OVERRIDE RULES (These ALWAYS win)
// ============================================

// NEVER classify these as snack (main meals only)
const NEVER_SNACK: string[] = [
  // Nigerian staples
  'eba', 'garri', 'fufu', 'akpu', 'semo', 'amala', 'elubo', 'lafun',
  'pounded yam', 'iyan', 'tuwo', 'shinkafa', 'dawa', 'masa',
  // Soups (main meal)
  'egusi', 'ogbono', 'okro', 'okra', 'vegetable soup', 'efo riro', 'efo',
  'bitter leaf soup', 'onugbu', 'oha soup', 'ofe oha', 'nsala', 'white soup', 'ofe nsala',
  'pepper soup', 'catfish pepper soup', 'goat meat pepper soup', 'assorted pepper soup',
  'ugwu', 'green soup', 'edikang ikong', 'afang', 'atama', 'banga', 'ofe akwu',
  // Rice dishes
  'jollof rice', 'fried rice', 'coconut rice', 'ofada rice', 'native rice',
  'concoction rice', 'curry rice', 'thai rice', 'basmati rice',
  'beans', 'ewa', 'ewa agoyin', 'brown beans', 'honey beans', 'ewa oloyin',
  // Yam/carb dishes
  'yam porridge', 'asaro', 'boiled yam', 'fried yam', 'roasted yam', 'yamarita',
  'potato porridge', 'irish potato', 'boiled potato',
  'plantain', 'dodo', 'fried plantain', 'baked plantain', 'plantain porridge',
  // Stews and proteins
  'stew', 'tomato stew', 'chicken stew', 'beef stew', 'meat stew', 'fish stew',
  'goat meat', 'ram meat', 'ponmo', 'assorted meat', 'offal'
];

// NEVER classify these as breakfast
const NEVER_BREAKFAST: string[] = [
  'eba', 'fufu', 'egusi', 'ogbono', 'jollof rice', 'fried rice',
  'amala', 'pounded yam', 'vegetable soup', 'bitter leaf soup',
  'stew', 'pepper soup', 'goat meat', 'assorted'
];

// FORCE classify as specific meal (highest priority - overrides everything)
const FORCE_CLASSIFICATION: Record<string, MealTime> = {
  // Breakfast items
  'akara': 'breakfast',
  'moi moi': 'breakfast',
  'moimoi': 'breakfast',
  'pap': 'breakfast',
  'akamu': 'breakfast',
  'koko': 'breakfast',
  'ogi': 'breakfast',
  'oatmeal': 'breakfast',
  'cereal': 'breakfast',
  'cornflakes': 'breakfast',
  'pancake': 'breakfast',
  'waffle': 'breakfast',
  'french toast': 'breakfast',
  'toast': 'breakfast',
  'scrambled egg': 'breakfast',
  'boiled egg': 'breakfast',
  'fried egg': 'breakfast',
  'omelette': 'breakfast',
  'smoothie': 'breakfast',
  'yogurt': 'breakfast',
  'coffee': 'breakfast',
  'tea': 'breakfast',
  
  // Lunch/Dinner items (main meals)
  'eba': 'lunch',
  'garri': 'lunch',
  'fufu': 'lunch',
  'akpu': 'lunch',
  'semo': 'lunch',
  'amala': 'lunch',
  'elubo': 'lunch',
  'pounded yam': 'lunch',
  'iyan': 'lunch',
  'egusi': 'lunch',
  'ogbono': 'lunch',
  'okro': 'lunch',
  'jollof rice': 'lunch',
  'fried rice': 'lunch',
  'coconut rice': 'lunch',
  'ofada rice': 'lunch',
  'beans': 'lunch',
  'ewa agoyin': 'lunch',
  'yam porridge': 'lunch',
  'asaro': 'lunch',
  'pepper soup': 'dinner',
  'catfish pepper soup': 'dinner',
  'assorted': 'dinner',
  'steak': 'dinner',
  'grill': 'dinner',
  'seafood': 'dinner',
  'pizza': 'dinner',
  
  // Snack items
  'puff puff': 'snack',
  'buns': 'snack',
  'samosa': 'snack',
  'spring roll': 'snack',
  'chin chin': 'snack',
  'kuli kuli': 'snack',
  'robo': 'snack',
  'suya': 'snack',
  'kilishi': 'snack',
  'fries': 'snack',
  'chips': 'snack',
  'meat pie': 'snack',
  'sausage roll': 'snack',
  'scotch egg': 'snack',
  'cake': 'snack',
  'cupcake': 'snack',
  'doughnut': 'snack',
  'donut': 'snack',
  'ice cream': 'snack',
  'popcorn': 'snack'
};

// ============================================
// COMPREHENSIVE FOOD DATABASE
// ============================================

const FOOD_KEYWORDS = {
  breakfast: {
    strong: [
      'akara', 'moi moi', 'moimoi', 'pap', 'akamu', 'koko', 'ogi',
      'cereal', 'cornflakes', 'golden morn', 'rice krispies',
      'oatmeal', 'porridge', 'quaker oats',
      'pancake', 'waffle', 'french toast', 'crepe',
      'english breakfast', 'continental breakfast'
    ],
    medium: [
      'toast', 'bread', 'butter bread', 'agege bread',
      'egg', 'scrambled egg', 'boiled egg', 'fried egg', 'omelette',
      'yogurt', 'yoghurt', 'greek yogurt', 'fruit salad',
      'coffee', 'tea', 'chai', 'green tea', 'cocoa', 'milo',
      'smoothie', 'fruit juice', 'fresh juice', 'milk'
    ],
    weak: [
      'morning', 'breakfast', 'early', 'sunrise', 'dawn',
      'honey', 'jam', 'marmalade', 'butter'
    ]
  },

  lunch: {
    strong: [
      'eba', 'garri', 'fufu', 'akpu', 'semo', 'amala', 'elubo', 'lafun',
      'pounded yam', 'iyan', 'tuwo', 'shinkafa', 'dawa',
      'egusi', 'egusi soup', 'ogbono', 'ogbono soup',
      'okro', 'okra soup', 'ilasa',
      'vegetable soup', 'efo riro', 'efo', 'ugwu', 'green soup',
      'bitter leaf soup', 'onugbu', 'nsala', 'white soup', 'ofe nsala',
      'oha soup', 'ofe oha', 'edikang ikong', 'afang', 'atama', 'banga',
      'jollof rice', 'fried rice', 'coconut rice', 'native rice', 'ofada rice',
      'beans', 'ewa', 'ewa agoyin', 'ewa oloyin',
      'plantain', 'dodo', 'fried plantain', 'baked plantain',
      'yam porridge', 'asaro', 'yamarita',
      'potato porridge', 'irish potato',
      'noodles', 'indomie', 'ramen', 'udon', 'soba',
      'pasta', 'spaghetti', 'macaroni', 'penne', 'fettuccine',
      'lasagna', 'cannelloni', 'ravioli',
      'sandwich', 'burger', 'shawarma', 'tacos', 'burrito',
      'curry', 'stew', 'tomato stew', 'chicken stew', 'beef stew'
    ],
    medium: [
      'rice', 'wheat', 'spaghetti', 'macaroni',
      'meat', 'chicken', 'beef', 'goat meat', 'ram meat', 'ponmo', 'offal',
      'fish', 'tilapia', 'croaker', 'catfish', 'mackerel', 'salmon', 'tuna',
      'turkey', 'duck', 'lamb', 'pork',
      'salad', 'caesar salad', 'garden salad', 'pasta salad',
      'wrap', 'roll', 'pita', 'bun'
    ],
    weak: [
      'lunch', 'midday', 'afternoon', 'brunch', 'combo', 'meal deal',
      'full meal', 'set meal', 'executive meal', 'regular meal'
    ]
  },

  dinner: {
    strong: [
      'steak', 'ribeye', 'sirloin', 't-bone', 'fillet mignon',
      'grill', 'barbecue', 'bbq', 'smoked', 'roast',
      'seafood', 'lobster', 'crab', 'shrimp', 'prawn', 'crayfish', 'lobster',
      'grilled fish', 'baked fish', 'whole fish', 'grilled chicken',
      'pepper soup', 'catfish pepper soup', 'goat meat pepper soup',
      'assorted meat', 'mixed grill', 'platter', 'spread',
      'pizza', 'margherita', 'pepperoni', 'meat feast',
      'signature dish', 'chef special', 'house special',
      'deluxe', 'premium', 'luxury', 'feast'
    ],
    medium: [
      'roasted', 'baked', 'oven baked', 'slow cooked',
      'gourmet', 'artisan', 'premium', 'special',
      'family meal', 'family size', 'sharing platter',
      'banquet', 'celebratory', 'festive'
    ],
    weak: [
      'dinner', 'evening', 'night', 'special', 'signature',
      'ala carte', 'main course', 'entree'
    ]
  },

  snack: {
    strong: [
      'puff puff', 'buns', 'doughnut', 'donut',
      'samosa', 'spring roll', 'egg roll',
      'small chops', 'finger food', 'canape',
      'fries', 'chips', 'french fries', 'wedges',
      'popcorn', 'corn', 'roasted corn',
      'cake', 'cupcake', 'pastry', 'croissant', 'danish',
      'ice cream', 'gelato', 'sorbet', 'frozen yogurt',
      'cookies', 'biscuit', 'cracker', 'wafer',
      'chocolate', 'candy', 'sweets',
      'chin chin', 'kokoro', 'kuli kuli', 'robo',
      'suya', 'kilishi', 'dried meat',
      'meat pie', 'chicken pie', 'sausage roll', 'scotch egg'
    ],
    medium: [
      'shake', 'milkshake', 'smoothie', 'frappe',
      'juice', 'soda', 'coke', 'pepsi', 'fanta', 'sprite',
      'yogurt cup', 'parfait', 'pudding', 'custard',
      'wrap', 'roll', 'pocket', 'slice'
    ],
    weak: [
      'snack', 'appetizer', 'starter', 'side',
      'quick bite', 'on the go', 'light meal', 'small',
      'nibble', 'munchies', 'treat', 'bite'
    ]
  }
};

// ============================================
// MAIN CLASSIFICATION FUNCTION
// ============================================

export function classifyProductForMealTime(
  productName: string,
  category: string = '',
  description: string = ''
): MealTime {
  const searchText = `${productName} ${category} ${description}`.toLowerCase();
  
  // STEP 1: Check FORCE CLASSIFICATION (highest priority)
  for (const [key, forcedMeal] of Object.entries(FORCE_CLASSIFICATION)) {
    if (containsTerm(searchText, key)) {
      return forcedMeal;
    }
  }
  
  // STEP 2: Check NEVER SNACK rules
  for (const forbidden of NEVER_SNACK) {
    if (containsTerm(searchText, forbidden)) {
      // Determine correct meal based on time of day
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11) return 'breakfast';
      if (hour >= 11 && hour < 16) return 'lunch';
      if (hour >= 16 && hour < 21) return 'dinner';
      return 'lunch';
    }
  }
  
  // STEP 3: Check NEVER BREAKFAST rules
  for (const forbidden of NEVER_BREAKFAST) {
    if (containsTerm(searchText, forbidden)) {
      const hour = new Date().getHours();
      if (hour >= 11 && hour < 16) return 'lunch';
      if (hour >= 16 && hour < 21) return 'dinner';
      return 'lunch';
    }
  }
  
  // STEP 4: Calculate weighted scores
  const scores = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  
  for (const [mealType, keywords] of Object.entries(FOOD_KEYWORDS)) {
    const meal = mealType as MealTime;
    
    // Strong keywords (+5)
    for (const keyword of keywords.strong) {
      if (containsTerm(searchText, keyword)) {
        scores[meal] += 5;
      }
    }
    
    // Medium keywords (+3)
    for (const keyword of keywords.medium) {
      if (containsTerm(searchText, keyword)) {
        scores[meal] += 3;
      }
    }
    
    // Weak keywords (+1)
    for (const keyword of keywords.weak) {
      if (containsTerm(searchText, keyword)) {
        scores[meal] += 1;
      }
    }
  }
  
  // STEP 5: Special combo detection (soup + solid food = main meal)
  const hasSoup = containsTerm(searchText, 'soup') || containsTerm(searchText, 'stew');
  const hasSolid = containsTerm(searchText, 'eba') || containsTerm(searchText, 'fufu') || 
                   containsTerm(searchText, 'amala') || containsTerm(searchText, 'semo') ||
                   containsTerm(searchText, 'rice') || containsTerm(searchText, 'pounded yam') ||
                   containsTerm(searchText, 'yam') || containsTerm(searchText, 'plantain');
  
  if (hasSoup && hasSolid) {
    scores.lunch += 10;
    scores.dinner += 8;
    scores.snack = 0;
  }
  
  // STEP 6: Penalty for main meals classified as snack
  const mainMealIndicators = [
    'eba', 'fufu', 'amala', 'semo', 'pounded yam', 'akpu',
    'jollof', 'fried rice', 'egusi', 'ogbono', 'vegetable soup',
    'beans', 'ewa', 'stew', 'curry', 'rice'
  ];
  
  for (const indicator of mainMealIndicators) {
    if (containsTerm(searchText, indicator)) {
      scores.snack -= 15;
    }
  }
  
  // STEP 7: Find best match
  let bestMeal: MealTime = 'lunch';
  let highestScore = -100;
  
  for (const [meal, score] of Object.entries(scores)) {
    if (score > highestScore) {
      highestScore = score;
      bestMeal = meal as MealTime;
    }
  }
  
  // STEP 8: Final safety check - if result is snack but has main meal content
  if (bestMeal === 'snack') {
    for (const indicator of mainMealIndicators) {
      if (containsTerm(searchText, indicator)) {
        return 'lunch';
      }
    }
  }
  
  // STEP 9: Default to time of day if no clear match
  if (highestScore < 2) {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 16) return 'lunch';
    if (hour >= 16 && hour < 21) return 'dinner';
    return 'snack';
  }
  
  return bestMeal;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getCurrentMealTime(): MealTime {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 21) return 'dinner';
  return 'snack';
}

export function getMealTimeLabel(mealTime: MealTime): string {
  const labels = {
    breakfast: 'Breakfast Picks',
    lunch: 'Lunch Favorites',
    dinner: 'Dinner Specials',
    snack: 'Snacks & Small Chops',
  };
  return labels[mealTime];
}

export function getMealTimeGreeting(mealTime: MealTime, firstName: string): { greeting: string; subtitle: string } {
  const greetings = {
    breakfast: {
      greeting: `Good morning, ${firstName}!`,
      subtitle: 'Start your day right — here are light breakfast picks for you',
    },
    lunch: {
      greeting: `Hey ${firstName}, lunchtime!`,
      subtitle: 'Hungry? Check out these hearty Nigerian lunch meals',
    },
    dinner: {
      greeting: `Good evening, ${firstName}!`,
      subtitle: 'Wind down with a satisfying dinner',
    },
    snack: {
      greeting: `Hey ${firstName}!`,
      subtitle: 'Feeling peckish? Here are some snacks for you',
    },
  };
  return greetings[mealTime];
}

