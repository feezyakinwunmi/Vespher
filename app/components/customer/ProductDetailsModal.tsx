// app/components/customer/ProductDetailsModal.tsx
// Full food details for customers: photo, price, prep time, description,
// ingredients, allergens and dietary tags, with the same health-checked add-to-cart.
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import type { Product } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { useHealthCheck, HealthCheckResult } from '../../hooks/customer/useHealthCheck';
import { reviewFood } from '../../services/foodSafety';
import { imageSource } from '../../utils/images';

interface ProductDetailsModalProps {
  product: Product | null;
  onClose: () => void;
  onHealthWarning?: (product: Product, result: HealthCheckResult) => void;
  // Shown when the modal is opened outside the vendor's own page (e.g. Explore).
  vendorName?: string;
}

export function ProductDetailsModal({ product, onClose, onHealthWarning, vendorName }: ProductDetailsModalProps) {
  const { addItem } = useCart();
  const { checkProduct } = useHealthCheck();
  const [isAdding, setIsAdding] = useState(false);

  if (!product) return null;

  const ingredients = product.ingredients || [];
  const { allAllergens } = reviewFood(product);
  const dietaryTags = (product.health_tags || []).filter(t => !t.startsWith('contains_'));
  const prepTime = product.preparation_time ?? product.preparationTime;
  const originalPrice = product.originalPrice ?? product.original_price;

  const handleAdd = async () => {
    setIsAdding(true);
    try {
      const result = await checkProduct(product.id, product.name, product.description || '', product.category || '');
      if (result) {
        onClose();
        onHealthWarning?.(product, result);
        return;
      }
      await addItem(product, 1);
      Toast.show({ type: 'success', text1: `${product.name} added to cart`, position: 'bottom', visibilityTime: 2000 });
      onClose();
    } catch (error) {
      console.error('Add to cart error:', error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View>
              <Image source={imageSource(product.image || product.image_url)} style={styles.image} />
              <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              <Text style={styles.name}>{product.name}</Text>
              {!!vendorName && (
                <View style={styles.vendorRow}>
                  <Feather name="shopping-bag" size={12} color="#aaa" />
                  <Text style={styles.metaText}>{vendorName}</Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.price}>₦{product.price.toLocaleString()}</Text>
                {!!originalPrice && originalPrice > product.price && (
                  <Text style={styles.originalPrice}>₦{originalPrice.toLocaleString()}</Text>
                )}
                {!!prepTime && (
                  <View style={styles.metaPill}>
                    <Feather name="clock" size={12} color="#aaa" />
                    <Text style={styles.metaText}>{String(prepTime)}</Text>
                  </View>
                )}
                {!!product.category && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaText}>{product.category}</Text>
                  </View>
                )}
              </View>

              {!!product.description && <Text style={styles.description}>{product.description}</Text>}

              <Text style={styles.sectionTitle}>Ingredients</Text>
              {ingredients.length ? (
                <View style={styles.chipRow}>
                  {ingredients.map((ing, i) => (
                    <View key={ing + i} style={styles.chip}>
                      <Text style={styles.chipText}>{ing}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedText}>The vendor hasn't listed ingredients for this item.</Text>
              )}

              {allAllergens.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Contains</Text>
                  <View style={styles.chipRow}>
                    {allAllergens.map(a => (
                      <View key={a.id} style={[styles.chip, styles.allergenChip]}>
                        <Text style={styles.chipText}>{a.icon} {a.label}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {dietaryTags.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Dietary info</Text>
                  <View style={styles.chipRow}>
                    {dietaryTags.map(tag => (
                      <View key={tag} style={styles.chip}>
                        <Text style={[styles.chipText, styles.capitalize]}>{tag.replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.disclaimer}>
                Allergen information is provided by the vendor and checked automatically. If you have a severe allergy, confirm with the vendor before ordering.
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity onPress={handleAdd} disabled={isAdding} style={styles.addButton}>
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addGradient}
            >
              {isAdding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="shopping-bag" size={18} color="#fff" />
                  <Text style={styles.addText}>Add to cart · ₦{product.price.toLocaleString()}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
    paddingBottom: 24,
  },
  image: {
    width: '100%',
    height: 220,
    backgroundColor: '#1a1a1a',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: 16,
  },
  name: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  price: {
    color: '#f97316',
    fontSize: 18,
    fontWeight: '700',
  },
  originalPrice: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
  },
  metaText: {
    color: '#aaa',
    fontSize: 12,
  },
  description: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  allergenChip: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  mutedText: {
    color: '#888',
    fontSize: 13,
  },
  disclaimer: {
    color: '#777',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 20,
  },
  addButton: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addGradient: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
