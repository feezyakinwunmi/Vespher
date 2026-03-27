// app/screens/vendor/PromotionDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Toast from 'react-native-toast-message';

interface Promotion {
  id: string;
  vendor_id: string;
  title: string;
  description: string;
  image_url: string;
  promotion_type: 'flyer' | 'product_offer' | 'combo';
  status: 'pending_payment' | 'pending_approval' | 'active' | 'rejected' | 'expired';
  start_date: string;
  end_date: string;
  days_count: number;
  cost_per_day: number;
  total_cost: number;
  views: number;
  clicks: number;
  conversions: number;
  rejection_reason?: string;
  product_id?: string;
  product_name?: string;
  discounted_price?: number;
  // Combo fields
  main_product_id?: string;
  main_product_name?: string;
  free_product_id?: string;
  free_product_name?: string;
  buy_quantity?: number;
  get_quantity?: number;
  main_product_original_price?: number;
  free_product_original_price?: number;
  max_per_customer?: number;
}

export function PromotionDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { promotionId } = route.params as { promotionId: string };
  const { user } = useAuth();
  
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorName, setVendorName] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type: type,
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  useEffect(() => {
    fetchPromotionDetails();
  }, [promotionId]);

  const fetchPromotionDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch promotion with product details
      const { data: promo, error: promoError } = await supabase
        .from('promotions')
        .select(`
          *,
          products:product_id (name, price),
          main_product:main_product_id (name, price),
          free_product:free_product_id (name, price)
        `)
        .eq('id', promotionId)
        .single();

      if (promoError) throw promoError;

      // Process product names
      const processedPromo = {
        ...promo,
        product_name: promo.products?.name,
        main_product_name: promo.main_product?.name,
        free_product_name: promo.free_product?.name,
        main_product_original_price: promo.main_product?.price,
        free_product_original_price: promo.free_product?.price,
      };
      
      setPromotion(processedPromo);

      // Fetch vendor name
      const { data: vendor } = await supabase
        .from('vendors')
        .select('name')
        .eq('id', promo.vendor_id)
        .single();
      
      if (vendor) {
        setVendorName(vendor.name);
      }

    } catch (error) {
      console.error('Error fetching promotion:', error);
      showToast('Failed to load promotion details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'pending_approval':
        return '#f59e0b';
      case 'pending_payment':
        return '#3b82f6';
      case 'rejected':
        return '#ef4444';
      case 'expired':
        return '#6b7280';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'pending_approval':
        return 'Pending Approval';
      case 'pending_payment':
        return 'Payment Pending';
      case 'rejected':
        return 'Rejected';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flyer':
        return 'image';
      case 'product_offer':
        return 'tag';
      case 'combo':
        return 'gift';
      default:
        return 'speaker';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'flyer':
        return 'Flyer Banner';
      case 'product_offer':
        return 'Product Offer';
      case 'combo':
        return 'Combo Deal';
      default:
        return type;
    }
  };

  const handleShare = async () => {
    if (!promotion) return;
    
    try {
      await Share.share({
        message: `Check out our promotion: ${promotion.title}!\n\n${promotion.description || 'Limited time offer!'}\n\nAvailable on Vespher App`,
        url: promotion.image_url,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const calculateConversionRate = () => {
    if (!promotion) return 0;
    if (promotion.clicks === 0) return 0;
    return ((promotion.conversions / promotion.clicks) * 100).toFixed(1);
  };

  const calculateCTR = () => {
    if (!promotion) return 0;
    if (promotion.views === 0) return 0;
    return ((promotion.clicks / promotion.views) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading promotion details...</Text>
      </View>
    );
  }

  if (!promotion) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Promotion Not Found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promotion Details</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Feather name="share-2" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: promotion.image_url }} style={styles.bannerImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.imageOverlay}
          />
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(promotion.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(promotion.status) }]}>
              {getStatusText(promotion.status)}
            </Text>
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <View style={styles.typeBadge}>
              <Feather name={getTypeIcon(promotion.promotion_type)} size={14} color="#f97316" />
              <Text style={styles.typeText}>{getTypeText(promotion.promotion_type)}</Text>
            </View>
            <Text style={styles.title}>{promotion.title}</Text>
            {promotion.description && (
              <Text style={styles.description}>{promotion.description}</Text>
            )}
          </View>
        </View>

        {/* Vendor Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vendor</Text>
          <View style={styles.vendorCard}>
            <Feather name="home" size={20} color="#f97316" />
            <Text style={styles.vendorName}>{vendorName || 'Your Store'}</Text>
          </View>
        </View>

        {/* Product Details (for product offers) */}
        {promotion.promotion_type === 'product_offer' && promotion.product_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            <View style={styles.productCard}>
              <Text style={styles.productName}>{promotion.product_name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₦{promotion.main_product_original_price?.toLocaleString()}</Text>
                <Text style={styles.discountedPrice}>₦{promotion.discounted_price?.toLocaleString()}</Text>
              </View>
              {promotion.max_per_customer ? (
                <Text style={styles.limitText}>Max {promotion.max_per_customer} per customer</Text>
              ) : (
                <Text style={styles.limitText}>No purchase limit</Text>
              )}
            </View>
          </View>
        )}

        {/* Combo Details */}
        {promotion.promotion_type === 'combo' && promotion.main_product_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Combo Details</Text>
            <View style={styles.comboCard}>
              <View style={styles.comboItem}>
                <Feather name="shopping-bag" size={16} color="#f97316" />
                <Text style={styles.comboText}>
                  Buy {promotion.buy_quantity} × {promotion.main_product_name}
                </Text>
                <Text style={styles.comboPrice}>₦{promotion.main_product_original_price?.toLocaleString()}</Text>
              </View>
              <View style={styles.comboArrow}>
                <Feather name="arrow-down" size={20} color="#f97316" />
                <Text style={styles.comboFree}>FREE</Text>
              </View>
              <View style={styles.comboItem}>
                <Feather name="gift" size={16} color="#10b981" />
                <Text style={styles.comboText}>
                  Get {promotion.get_quantity} × {promotion.free_product_name}
                </Text>
                <Text style={styles.comboPrice}>FREE</Text>
              </View>
              {promotion.max_per_customer ? (
                <Text style={styles.limitText}>Max {promotion.max_per_customer} combo per customer</Text>
              ) : (
                <Text style={styles.limitText}>No purchase limit</Text>
              )}
            </View>
          </View>
        )}

        {/* Performance Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Feather name="eye" size={20} color="#10b981" />
              <Text style={styles.statNumber}>{promotion.views?.toLocaleString() || 0}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.statCard}>
              <Feather name="mouse-pointer" size={20} color="#f59e0b" />
              <Text style={styles.statNumber}>{promotion.clicks?.toLocaleString() || 0}</Text>
              <Text style={styles.statLabel}>Clicks</Text>
            </View>
            <View style={styles.statCard}>
              <Feather name="shopping-bag" size={20} color="#f97316" />
              <Text style={styles.statNumber}>{promotion.conversions?.toLocaleString() || 0}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
          </View>

          <View style={styles.rateCard}>
            <View style={styles.rateItem}>
              <Text style={styles.rateLabel}>Click-Through Rate (CTR)</Text>
              <Text style={styles.rateValue}>{calculateCTR()}%</Text>
            </View>
            <View style={styles.rateDivider} />
            <View style={styles.rateItem}>
              <Text style={styles.rateLabel}>Conversion Rate</Text>
              <Text style={styles.rateValue}>{calculateConversionRate()}%</Text>
            </View>
          </View>
        </View>

        {/* Duration & Cost */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration & Cost</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={16} color="#666" />
              <Text style={styles.infoLabel}>Start Date</Text>
              <Text style={styles.infoValue}>
                {new Date(promotion.start_date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={16} color="#666" />
              <Text style={styles.infoLabel}>End Date</Text>
              <Text style={styles.infoValue}>
                {new Date(promotion.end_date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="clock" size={16} color="#666" />
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{promotion.days_count} days</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Feather name="trending-up" size={16} color="#f97316" />
              <Text style={styles.infoLabel}>Cost per Day</Text>
              <Text style={styles.infoValue}>₦{promotion.cost_per_day?.toLocaleString()}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Cost</Text>
              <Text style={styles.totalValue}>₦{promotion.total_cost?.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Rejection Reason (if rejected) */}
        {promotion.status === 'rejected' && promotion.rejection_reason && (
          <View style={styles.rejectionSection}>
            <Feather name="alert-triangle" size={20} color="#ef4444" />
            <View style={styles.rejectionContent}>
              <Text style={styles.rejectionTitle}>Rejection Reason</Text>
              <Text style={styles.rejectionText}>{promotion.rejection_reason}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    height: 200,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  titleRow: {
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 12,
    color: '#f97316',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 8,
  },
  vendorName: {
    fontSize: 14,
    color: '#fff',
  },
  productCard: {
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  originalPrice: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f97316',
  },
  comboCard: {
    backgroundColor: '#0a0a0a',
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  comboItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  comboText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  comboPrice: {
    fontSize: 14,
    color: '#f97316',
    fontWeight: '500',
  },
  comboArrow: {
    alignItems: 'center',
    gap: 4,
  },
  comboFree: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: 'bold',
  },
  limitText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
  },
  rateCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  rateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 13,
    color: '#666',
  },
  rateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
  rateDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 8,
  },
  infoCard: {
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f97316',
  },
  rejectionSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239,68,68,0.1)',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  rejectionContent: {
    flex: 1,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
    color: '#ef4444',
    lineHeight: 18,
  },
});