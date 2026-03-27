// app/screens/vendor/PromotionsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Toast from 'react-native-toast-message';
import { RootStackParamList } from '../../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type VendorAddressesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Promotion {
  id: string;
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
  clicks: number;
  conversions: number; // This now counts actual completed orders
  rejection_reason?: string;
  product_id?: string;
  product_name?: string;
  discounted_price?: number;
}

interface Vendor {
  id: string;
  name: string;
}

export function PromotionsScreen() {
  const navigation = useNavigation<VendorAddressesScreenNavigationProp>();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [stats, setStats] = useState({
    total_spent: 0,
    active_count: 0,
    pending_count: 0,
    total_clicks: 0,
    total_conversions: 0,
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type: type,
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  // Fetch vendor ID from user
  const fetchVendor = async () => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setVendor(data);
        return data.id;
      }
      return null;
    } catch (error) {
      console.error('Error fetching vendor:', error);
      return null;
    }
  };



// Calculate conversions from actual completed orders
const calculateActualConversions = async (promotionId: string) => {
  try {
    console.log('Calculating conversions for promotion:', promotionId);
    
    // Use a simpler query without .in() which might be causing issues
    const { data, error } = await supabase
      .from('orders')
      .select('id, status')
      .eq('promotion_id', promotionId);

    if (error) {
      console.error('Error counting orders:', error);
      return 0;
    }
    
    // Count only delivered orders manually
    const deliveredCount = data?.filter(order => 
      order.status === 'delivered' || order.status === 'completed'
    ).length || 0;
    
    console.log(`Promotion ${promotionId} has ${deliveredCount} completed orders`);
    return deliveredCount;
  } catch (error) {
    console.error('Error calculating conversions:', error);
    return 0;
  }
};

  const fetchPromotions = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // First get vendor ID
      const vendorId = await fetchVendor();
      if (!vendorId) {
        setLoading(false);
        return;
      }
      
      let query = supabase
        .from('promotions')
        .select(`
          *,
          products:product_id (name)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Process data to include product name and calculate actual conversions
      const processedData = await Promise.all((data || []).map(async (promo) => {
        // Calculate actual conversions from completed orders
        const actualConversions = await calculateActualConversions(promo.id);
        
        return {
          ...promo,
          product_name: promo.products?.name,
          conversions: actualConversions, // Override with actual completed orders count
        };
      }));

      setPromotions(processedData);

      // Calculate stats (excluding views)
      const totalSpent = processedData
        .filter(p => p.status === 'active' || p.status === 'expired')
        .reduce((sum, p) => sum + (p.total_cost || 0), 0);
      
      const activeCount = processedData.filter(p => p.status === 'active').length;
      const pendingCount = processedData.filter(p => p.status === 'pending_approval').length;
      const totalClicks = processedData.reduce((sum, p) => sum + (p.clicks || 0), 0);
      const totalConversions = processedData.reduce((sum, p) => sum + (p.conversions || 0), 0);

      setStats({
        total_spent: totalSpent,
        active_count: activeCount,
        pending_count: pendingCount,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
      });

    } catch (error) {
      console.error('Error fetching promotions:', error);
      showToast('Failed to load promotions', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPromotions();
    }, [user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPromotions();
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

  const filteredPromotions = selectedStatus === 'all' 
    ? promotions 
    : promotions.filter(p => p.status === selectedStatus);

  const handleCreatePromotion = () => {
    navigation.navigate('CreatePromotion');
  };

  const handlePromotionPress = (promotion: Promotion) => {
    navigation.navigate('PromotionDetails', { promotionId: promotion.id });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading promotions...</Text>
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
        <Text style={styles.headerTitle}>My Promotions</Text>
        <TouchableOpacity onPress={handleCreatePromotion} style={styles.createButton}>
          <Feather name="plus" size={24} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Vendor Name */}
      {vendor && (
        <View style={styles.vendorInfo}>
          <Feather name="home" size={14} color="#f97316" />
          <Text style={styles.vendorName}>{vendor.name}</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {/* Stats Cards - Removed Views */}
        <View style={styles.statsContainer}>
          <LinearGradient
            colors={['#1a1a1a', '#0a0a0a']}
            style={styles.statCard}
          >
            <Feather name="trending-up" size={20} color="#f97316" />
            <Text style={styles.statValue}>₦{stats.total_spent.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#1a1a1a', '#0a0a0a']}
            style={styles.statCard}
          >
            <Feather name="mouse-pointer" size={20} color="#f59e0b" />
            <Text style={styles.statValue}>{stats.total_clicks.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Clicks</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#1a1a1a', '#0a0a0a']}
            style={styles.statCard}
          >
            <Feather name="shopping-bag" size={20} color="#f97316" />
            <Text style={styles.statValue}>{stats.total_conversions.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Orders Completed</Text>
          </LinearGradient>
        </View>

        {/* Status Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          <TouchableOpacity
            onPress={() => setSelectedStatus('all')}
            style={[styles.filterChip, selectedStatus === 'all' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selectedStatus === 'all' && styles.filterTextActive]}>
              All ({promotions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedStatus('active')}
            style={[styles.filterChip, selectedStatus === 'active' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selectedStatus === 'active' && styles.filterTextActive]}>
              Active ({stats.active_count})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedStatus('pending_approval')}
            style={[styles.filterChip, selectedStatus === 'pending_approval' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selectedStatus === 'pending_approval' && styles.filterTextActive]}>
              Pending ({stats.pending_count})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedStatus('expired')}
            style={[styles.filterChip, selectedStatus === 'expired' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selectedStatus === 'expired' && styles.filterTextActive]}>
              Expired
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedStatus('rejected')}
            style={[styles.filterChip, selectedStatus === 'rejected' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selectedStatus === 'rejected' && styles.filterTextActive]}>
              Rejected
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Promotions List */}
        {filteredPromotions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="speaker" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No Promotions Yet</Text>
            <Text style={styles.emptyText}>
              Create your first promotion to attract more customers
            </Text>
            <TouchableOpacity onPress={handleCreatePromotion} style={styles.emptyButton}>
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyButtonGradient}
              >
                <Text style={styles.emptyButtonText}>Create Promotion</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredPromotions.map((promotion) => (
              <TouchableOpacity
                key={promotion.id}
                style={styles.promotionCard}
                onPress={() => handlePromotionPress(promotion)}
              >
                <Image
                  source={{ uri: promotion.image_url }}
                  style={styles.promotionImage}
                  onError={() => console.log('Image failed to load:', promotion.image_url)}
                />
                <View style={styles.promotionContent}>
                  <View style={styles.promotionHeader}>
                    <View style={styles.promotionType}>
                      <Feather name={getTypeIcon(promotion.promotion_type)} size={12} color="#f97316" />
                      <Text style={styles.promotionTypeText}>
                        {promotion.promotion_type === 'flyer' ? 'Flyer' : 
                         promotion.promotion_type === 'product_offer' ? 'Product Offer' : 'Combo'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(promotion.status)}20` }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(promotion.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(promotion.status) }]}>
                        {getStatusText(promotion.status)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.promotionTitle}>{promotion.title}</Text>
                  {promotion.product_name && (
                    <Text style={styles.promotionProduct}>{promotion.product_name}</Text>
                  )}
                  
                  <View style={styles.promotionStats}>
                    <View style={styles.statItem}>
                      <Feather name="calendar" size={12} color="#666" />
                      <Text style={styles.statItemText}>
                        {new Date(promotion.start_date).toLocaleDateString()} - {new Date(promotion.end_date).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Feather name="mouse-pointer" size={12} color="#666" />
                      <Text style={styles.statItemText}>{promotion.clicks || 0} clicks</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Feather name="shopping-bag" size={12} color="#f97316" />
                      <Text style={styles.statItemText}>{promotion.conversions || 0} orders</Text>
                    </View>
                  </View>

                  <View style={styles.promotionFooter}>
                    <Text style={styles.promotionCost}>₦{promotion.total_cost?.toLocaleString()}</Text>
                    <Text style={styles.promotionDays}>{promotion.days_count} days</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
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
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  vendorName: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  promotionCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  promotionImage: {
    width: 100,
    height: 100,
    backgroundColor: '#2a2a2a',
  },
  promotionContent: {
    flex: 1,
    padding: 12,
  },
  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  promotionType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  promotionTypeText: {
    fontSize: 10,
    color: '#f97316',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  promotionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  promotionProduct: {
    fontSize: 11,
    color: '#f97316',
    marginBottom: 6,
  },
  promotionStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statItemText: {
    fontSize: 10,
    color: '#666',
  },
  promotionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  promotionCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  promotionDays: {
    fontSize: 10,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});