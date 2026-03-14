// app/components/customer/ProductCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart } from '../../contexts/CartContext';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'compact' | 'horizontal';
  showAddButton?: boolean;
  onPress?: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

export function ProductCard({ 
  product, 
  variant = 'default', 
  showAddButton = true,
  onPress 
}: ProductCardProps) {
  const { addItem, removeItem, items, updateQuantity } = useCart();
  const [imageError, setImageError] = useState(false);

  const cartItem = items.find(item => item.product.id === product.id);
  const quantity = cartItem?.quantity || 0;

  const handleAdd = (e: any) => {
    e.stopPropagation();
    addItem(product, 1);
  };

  const handleIncrement = (e: any) => {
    e.stopPropagation();
    addItem(product, 1);
  };

  const handleDecrement = (e: any) => {
    e.stopPropagation();
    if (quantity > 1) {
      updateQuantity(product.id, quantity - 1);
    } else {
      removeItem(product.id);
    }
  };

  const productImage = product.image || product.image_url || 'https://via.placeholder.com/200';

  if (variant === 'horizontal') {
    return (
      <TouchableOpacity onPress={onPress} style={styles.horizontalCard}>
        {/* Image */}
        <View style={styles.horizontalImageContainer}>
          <Image 
            source={{ uri: productImage }} 
            style={styles.horizontalImage}
            onError={() => setImageError(true)}
          />
          {product.isPopular && (
            <View style={styles.popularBadgeSmall}>
              <Feather name="zap" size={10} color="#fff" />
              <Text style={styles.popularTextSmall}>Hot</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.horizontalContent}>
          <View>
            <Text style={styles.horizontalName} numberOfLines={1}>{product.name}</Text>
            <Text style={styles.horizontalDescription} numberOfLines={2}>
              {product.description}
            </Text>
          </View>

          <View style={styles.horizontalFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₦{product.price.toLocaleString()}</Text>
              {product.originalPrice && (
                <Text style={styles.originalPrice}>
                  ₦{product.originalPrice.toLocaleString()}
                </Text>
              )}
            </View>

            {showAddButton && (
              quantity > 0 ? (
                <View style={styles.quantityControl}>
                  <TouchableOpacity onPress={handleDecrement} style={styles.quantityButton}>
                    <Feather name="minus" size={14} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <TouchableOpacity onPress={handleIncrement} style={[styles.quantityButton, styles.primaryButton]}>
                    <Feather name="plus" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={handleAdd} style={styles.addButtonSmall}>
                  <Feather name="plus" size={16} color="#fff" />
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity onPress={onPress} style={styles.compactCard}>
        <View style={styles.compactImageContainer}>
          <Image 
            source={{ uri: productImage }} 
            style={styles.compactImage}
            onError={() => setImageError(true)}
          />
          {product.isPopular && (
            <View style={styles.popularBadgeCompact}>
              <Feather name="zap" size={10} color="#fff" />
              <Text style={styles.popularTextCompact}>Hot</Text>
            </View>
          )}
          {!product.isAvailable && (
            <View style={styles.unavailableOverlay}>
              <Text style={styles.unavailableText}>Unavailable</Text>
            </View>
          )}
        </View>
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>{product.name}</Text>
          <View style={styles.compactFooter}>
            <Text style={styles.compactPrice}>₦{product.price.toLocaleString()}</Text>
            {showAddButton && product.isAvailable && (
              <TouchableOpacity onPress={handleAdd} style={styles.compactAddButton}>
                <Feather name="plus" size={14} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Default variant
  return (
    <TouchableOpacity onPress={onPress} style={styles.defaultCard}>
      {/* Image */}
      <View style={styles.defaultImageContainer}>
        <Image 
          source={{ uri: productImage }} 
          style={styles.defaultImage}
          onError={() => setImageError(true)}
        />
        {product.isPopular && (
          <View style={styles.popularBadge}>
            <Feather name="zap" size={12} color="#fff" />
            <Text style={styles.popularText}>Popular</Text>
          </View>
        )}
        {product.originalPrice && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>
              Save ₦{product.originalPrice - product.price}
            </Text>
          </View>
        )}
        {!product.isAvailable && (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableText}>Unavailable</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.defaultContent}>
        <Text style={styles.defaultName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.defaultDescription} numberOfLines={2}>
          {product.description}
        </Text>

        {product.preparationTime && (
          <View style={styles.prepTimeContainer}>
            <Feather name="clock" size={12} color="#666" />
            <Text style={styles.prepTimeText}>{product.preparationTime}</Text>
          </View>
        )}

        <View style={styles.defaultFooter}>
          <View>
            <Text style={styles.defaultPrice}>₦{product.price.toLocaleString()}</Text>
            {product.originalPrice && (
              <Text style={styles.defaultOriginalPrice}>
                ₦{product.originalPrice.toLocaleString()}
              </Text>
            )}
          </View>

          {showAddButton && product.isAvailable && (
            quantity > 0 ? (
              <View style={styles.defaultQuantityControl}>
                <TouchableOpacity onPress={handleDecrement} style={styles.defaultQtyButton}>
                  <Feather name="minus" size={14} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.defaultQtyText}>{quantity}</Text>
                <TouchableOpacity onPress={handleIncrement} style={[styles.defaultQtyButton, styles.defaultPrimaryButton]}>
                  <Feather name="plus" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handleAdd} style={styles.defaultAddButton}>
                <Text style={styles.defaultAddText}>Add</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Horizontal variant
  horizontalCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  horizontalImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  horizontalImage: {
    width: '100%',
    height: '100%',
  },
  horizontalContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  horizontalName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  horizontalDescription: {
    fontSize: 12,
    color: '#666',
  },
  horizontalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  originalPrice: {
    fontSize: 11,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  addButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#f97316',
  },
  quantityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'center',
  },

  // Compact variant
  compactCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  compactImageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactInfo: {
    padding: 10,
  },
  compactName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  compactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  compactAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Default variant
  defaultCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  defaultImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  defaultImage: {
    width: '100%',
    height: '100%',
  },
  defaultContent: {
    padding: 12,
  },
  defaultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  defaultDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  prepTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  prepTimeText: {
    fontSize: 11,
    color: '#666',
  },
  defaultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  defaultPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f97316',
  },
  defaultOriginalPrice: {
    fontSize: 11,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  defaultAddButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#f97316',
    borderRadius: 16,
  },
  defaultAddText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  defaultQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defaultQtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultPrimaryButton: {
    backgroundColor: '#f97316',
  },
  defaultQtyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'center',
  },

  // Badges
  popularBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  popularBadgeSmall: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  popularTextSmall: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  popularBadgeCompact: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  popularTextCompact: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#f43f5e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailableText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});