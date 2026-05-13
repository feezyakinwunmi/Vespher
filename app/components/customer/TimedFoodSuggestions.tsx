// components/customer/TimedFoodSuggestions.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MealTime, SuggestedProduct, getMealTimeLabel } from '../../hooks/customer/useAIFoodSuggestions';

interface Props {
  suggestions: SuggestedProduct[];
  isLoading: boolean;
  mealTime: MealTime;
  onProductPress: (product: SuggestedProduct) => void;
  onViewAll: () => void;
}

const MEAL_TIME_ICONS: Record<MealTime, string> = {
  breakfast: '☀️',
  lunch: '🍽️',
  dinner: '🌙',
  snack: '🌆',
};

export function TimedFoodSuggestions({ suggestions, isLoading, mealTime, onProductPress, onViewAll }: Props) {
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.mealIcon}>{MEAL_TIME_ICONS[mealTime]}</Text>
          <View>
            <Text style={styles.sectionTitle}>
              {getMealTimeLabel(mealTime)} Picks
            </Text>
            <Text style={styles.sectionSubtitle}>AI-selected for this time of day</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
          <Feather name="arrow-right" size={14} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Suggestions List */}
      {isLoading ? (
        <View style={styles.loadingRow}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={styles.skeletonItem}>
              <View style={styles.skeletonCircle} />
              <View style={styles.skeletonText} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={suggestions}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => onProductPress(item)}
              activeOpacity={0.8}
            >
              {/* Circular Image */}
              <View style={styles.imageWrapper}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.foodImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imageFallback}>
                    <Feather name="image" size={24} color="#333" />
                  </View>
                )}
                {/* Price badge */}
                <View style={styles.priceBadge}>
                  <Text style={styles.priceText} numberOfLines={1}>
                    ₦{item.price >= 1000
                      ? `${(item.price / 1000).toFixed(item.price % 1000 === 0 ? 0 : 1)}k`
                      : item.price.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Name */}
              <Text style={styles.foodName} numberOfLines={2}>
                {item.name}
              </Text>

              {/* Vendor */}
              <Text style={styles.vendorName} numberOfLines={1}>
                {item.vendorName}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealIcon: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#555',
    marginTop: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewAllText: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  suggestionItem: {
    width: 90,
    alignItems: 'center',
    gap: 6,
  },
  imageWrapper: {
    position: 'relative',
    width: 82,
    height: 82,
  },
  foodImage: {
    width: 82,
    height: 82,
    borderRadius: 41, // perfect circle
    borderWidth: 2.5,
    borderColor: '#f97316',
  },
  imageFallback: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#2a2a2a',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 44,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  foodName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 16,
  },
  vendorName: {
    fontSize: 10,
    color: '#555',
    textAlign: 'center',
  },
  // Skeleton loader
  loadingRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 16,
  },
  skeletonItem: {
    alignItems: 'center',
    gap: 8,
  },
  skeletonCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#1e1e1e',
  },
  skeletonText: {
    width: 60,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1e1e1e',
  },
});