// app/components/customer/VendorCard.tsx
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
import { useFavorites } from '../../hooks/customer/useFavorites';
import { useAuth } from '../../contexts/AuthContext';
import type { Vendor } from '../../types';

interface VendorCardProps {
  vendor: Vendor;
  variant?: 'default' | 'horizontal';
  onPress?: () => void;
}

const { width } = Dimensions.get('window');
const HORIZONTAL_CARD_WIDTH = width - 40;

export function VendorCard({ vendor, variant = 'default', onPress }: VendorCardProps) {
  const [imageError, setImageError] = useState(false);
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  
  const isFav = isFavorite(vendor.id);

  const handleFavoriteClick = async (e: any) => {
    e.stopPropagation();
    
    if (!user) {
      // Navigate to login
      return;
    }
    
    await toggleFavorite(vendor.id);
  };

  const vendorImage = vendor.image || vendor.logo || 'https://via.placeholder.com/200';

  if (variant === 'horizontal') {
    return (
      <TouchableOpacity onPress={onPress} style={styles.horizontalCard}>
        {/* Vendor Image */}
        <View style={styles.horizontalImageContainer}>
          {vendorImage && !imageError ? (
            <Image
              source={{ uri: vendorImage }}
              style={styles.horizontalImage}
              onError={() => setImageError(true)}
            />
          ) : (
            <LinearGradient
              colors={['rgba(59,130,246,0.2)', 'rgba(16,185,129,0.2)']}
              style={styles.horizontalImagePlaceholder}
            >
              <Text style={styles.horizontalPlaceholderText}>
                {vendor.name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </View>

        {/* Content */}
        <View style={styles.horizontalContent}>
          <View style={styles.horizontalHeader}>
            <Text style={styles.horizontalName} numberOfLines={1}>{vendor.name}</Text>
            <TouchableOpacity onPress={handleFavoriteClick} style={styles.favoriteButton}>
              <Feather 
                name="heart" 
                size={16} 
                color={isFav ? '#ef4444' : '#666'} 
                style={isFav && styles.favoriteFilled}
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.horizontalRating}>
            <Feather name="star" size={12} color="#fbbf24" />
            <Text style={styles.horizontalRatingText}>{vendor.rating.toFixed(1)}</Text>
            <Text style={styles.horizontalDot}>•</Text>
            {/* <Text style={styles.horizontalDeliveryTime}>{vendor.deliveryTime}</Text> */}
          </View>

          <View style={styles.horizontalAddress}>
            <Feather name="map-pin" size={12} color="#666" />
            <Text style={styles.horizontalAddressText} numberOfLines={1}>
              {vendor.address}
            </Text>
          </View>

          <View style={styles.horizontalFooter}>
            <View style={styles.horizontalBadge}>
              {/* <Text style={styles.horizontalBadgeText}>
                ₦{vendor.deliveryFee} delivery
              </Text> */}
            </View>
            <View style={[styles.horizontalBadge, styles.horizontalBadgeSecondary]}>
              <Text style={styles.horizontalBadgeTextSecondary}>
                Min ₦{vendor.minOrder}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Default vertical card
  return (
    <TouchableOpacity onPress={onPress} style={styles.defaultCard}>
      {/* Cover Image */}
      <View style={styles.defaultImageContainer}>
        {vendorImage && !imageError ? (
          <Image
            source={{ uri: vendorImage }}
            style={styles.defaultImage}
            onError={() => setImageError(true)}
          />
        ) : (
          <LinearGradient
            colors={['rgba(59,130,246,0.2)', 'rgba(16,185,129,0.2)']}
            style={styles.defaultImagePlaceholder}
          >
            <Text style={styles.defaultPlaceholderText}>
              {vendor.name.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        )}
        
        <TouchableOpacity onPress={handleFavoriteClick} style={styles.defaultFavoriteButton}>
          <Feather 
            name="heart" 
            size={16} 
            color="#fff" 
            style={isFav && styles.favoriteFilledWhite}
          />
        </TouchableOpacity>
      </View>

      {/* Vendor Info */}
      <View style={styles.defaultInfo}>
        <View style={styles.defaultHeader}>
          <Text style={styles.defaultName} numberOfLines={1}>{vendor.name}</Text>
          <View style={styles.defaultRating}>
            <Feather name="star" size={12} color="#fbbf24" />
            <Text style={styles.defaultRatingText}>{vendor.rating.toFixed(1)}</Text>
          </View>
        </View>

        <Text style={styles.defaultDescription} numberOfLines={2}>
          {vendor.description}
        </Text>

        <View style={styles.defaultMeta}>
          <View style={styles.defaultMetaItem}>
            <Feather name="clock" size={12} color="#666" />
            <Text style={styles.defaultMetaText}>{vendor.deliveryTime}</Text>
          </View>
          {/* <Text style={styles.defaultMetaText}>•</Text> */}
          {/* <Text style={styles.defaultMetaText}>₦{vendor.deliveryFee} delivery</Text> */}
        </View>

        <View style={styles.defaultAddress}>
          <Feather name="map-pin" size={10} color="#666" />
          <Text style={styles.defaultAddressText} numberOfLines={1}>
            {vendor.address}
          </Text>
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
    width: HORIZONTAL_CARD_WIDTH,
  },
  horizontalImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  horizontalImage: {
    width: '100%',
    height: '100%',
  },
  horizontalImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalPlaceholderText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  horizontalContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  horizontalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  horizontalName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  favoriteButton: {
    padding: 4,
  },
  favoriteFilled: {
    color: '#ef4444',
  },
  favoriteFilledWhite: {
    color: '#ef4444',
  },
  horizontalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  horizontalRatingText: {
    fontSize: 12,
    color: '#fff',
  },
  horizontalDot: {
    fontSize: 12,
    color: '#666',
  },
  horizontalDeliveryTime: {
    fontSize: 12,
    color: '#666',
  },
  horizontalAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  horizontalAddressText: {
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
  horizontalFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  horizontalBadge: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  horizontalBadgeText: {
    fontSize: 10,
    color: '#3b82f6',
  },
  horizontalBadgeSecondary: {
    backgroundColor: '#2a2a2a',
  },
  horizontalBadgeTextSecondary: {
    fontSize: 10,
    color: '#666',
  },

  // Default vertical variant
  defaultCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
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
  defaultImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'rgba(59,130,246,0.3)',
  },
  defaultFavoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultInfo: {
    padding: 12,
  },
  defaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  defaultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  defaultRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  defaultRatingText: {
    fontSize: 12,
    color: '#fff',
  },
  defaultDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  defaultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  defaultMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  defaultMetaText: {
    fontSize: 11,
    color: '#666',
  },
  defaultAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  defaultAddressText: {
    fontSize: 10,
    color: '#666',
    flex: 1,
  },
});