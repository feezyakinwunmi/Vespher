// app/hooks/useCategories.ts (React Native version)
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export interface Category {
  id: string;
  name: string;
  icon: string; // This will be the Feather icon name
  image: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Get unique categories from products
        const { data: products, error } = await supabase
          .from('products')
          .select('category')
          .eq('is_available', true);

        if (error) throw error;

        // Get unique categories
        const uniqueCategories = Array.from(new Set(products.map(p => p.category)));
        
        // Map to Category type with Feather icons
        const categoryList: Category[] = [
          { id: 'all', name: 'All', icon: 'grid', image: '' },
          ...uniqueCategories.map((cat, index) => ({
            id: `cat-${index}`,
            name: cat,
            icon: getCategoryIcon(cat),
            image: '',
          })),
        ];

        setCategories(categoryList);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      'Rice Dishes': 'package',
      'Swallow': 'circle',
      'Soups & Stews': 'coffee',
      'Grilled & Fried': 'flame',
      'Small Chops': 'grid',
      'Beverages': 'cup',
    'Desserts': 'gift', // Changed from 'cake' to 'gift'
      'Specials': 'star',
    };
    return icons[category] || 'box';
  };

  return { categories, isLoading };
}