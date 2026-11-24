// app/components/customer/CategoryPills.tsx
import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Category } from '../../types';
import { TC } from '../../theme/palette';

interface CategoryPillsProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryPills({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}: CategoryPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map(category => (
        <TouchableOpacity
          key={category.id}
          onPress={() => onSelectCategory(category.name)}
          style={[
            styles.pill,
            selectedCategory === category.name && styles.pillSelected,
          ]}
        >
          <Feather 
            name={category.icon as any} 
            size={16} 
            color={selectedCategory === category.name ? '#f97316' : TC.muted} 
          />
          <Text style={[
            styles.pillText,
            selectedCategory === category.name && styles.pillTextSelected,
          ]}>
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TC.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillSelected: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  pillText: {
    fontSize: 13,
    color: TC.muted,
  },
  pillTextSelected: {
    color: '#f97316',
  },
});