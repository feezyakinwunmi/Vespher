// services/openFoodFacts.ts
export interface OFFProduct {
  code: string;
  product_name: string;
  ingredients_text: string;
  allergens_tags: string[];
  nutriscore_grade: 'a' | 'b' | 'c' | 'd' | 'e';
  nutriments: {
    sugars_100g?: number;
    fat_100g?: number;
    saturated_fat_100g?: number;
    salt_100g?: number;
    sodium_100g?: number;
    carbohydrates_100g?: number;
    proteins_100g?: number;
  };
  image_url: string;
  brands?: string;
  categories?: string;  // Add this line
}

// Search with timeout and better error handling
export async function searchProductByName(productName: string): Promise<OFFProduct | null> {
  try {
    console.log('🔍 Searching Open Food Facts for:', productName);
    
    // Add timeout - don't wait more than 3 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(productName)}&search_simple=1&json=1&page_size=1`;
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FoodDeliveryApp/1.0',
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('API returned status:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.products && data.products.length > 0) {
      const product = data.products[0];
      console.log('✅ Found product:', product.product_name);
      return {
        code: product.code,
        product_name: product.product_name,
        ingredients_text: product.ingredients_text || '',
        allergens_tags: product.allergens_tags || [],
        nutriscore_grade: product.nutriscore_grade || 'c',
        nutriments: {
          sugars_100g: product.nutriments?.sugars_100g,
          fat_100g: product.nutriments?.fat_100g,
          saturated_fat_100g: product.nutriments?.saturated_fat_100g,
          salt_100g: product.nutriments?.salt_100g,
        },
        image_url: product.image_url || '',
        brands: product.brands,
        categories: product.categories,  // Add this
      };
    }
    
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Open Food Facts timeout - skipping');
    } else {
      console.log('Open Food Facts error:', error.message);
    }
    return null;
  }
}