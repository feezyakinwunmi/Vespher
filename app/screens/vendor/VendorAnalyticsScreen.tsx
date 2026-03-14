// app/screens/vendor/VendorAnalyticsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useVendorStats } from '../../hooks/vendor/useVendorStats';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SimpleLineChart, SimpleBarChart } from '../../components/SimpleChart';

export function VendorAnalyticsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { stats, isLoading: statsLoading, refreshStats } = useVendorStats();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchAnalyticsData();
  }, [user, period]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Get vendor ID
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (!vendorData) return;

      // Get date range
      const endDate = new Date();
      const startDate = new Date();
      if (period === 'week') startDate.setDate(startDate.getDate() - 7);
      else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
      else startDate.setFullYear(startDate.getFullYear() - 1);

      // Fetch orders for the period
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', vendorData.id)
        .eq('status', 'delivered')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      // Fetch reviews
      const { data: reviews } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          user_id,
          users!user_id (
            name
          )
        `)
        .eq('vendor_id', vendorData.id)
        .order('created_at', { ascending: false });

      // Calculate sales over time
      const salesMap = new Map();
      orders?.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString();
        const existing = salesMap.get(date) || { earnings: 0, orders: 0 };
        
        // Use the same calculation as vendorStats
        const subtotal = (order.total || 0) - (order.delivery_fee || 0);
        const platformFee = Math.round(subtotal * 0.1);
        const earnings = subtotal - platformFee;
        
        salesMap.set(date, {
          earnings: existing.earnings + earnings,
          orders: existing.orders + 1,
        });
      });

      const salesOverTime = Array.from(salesMap.entries()).map(([date, values]) => ({
        date,
        ...values,
      }));

      // Calculate top products
      const productMap = new Map();
      orders?.forEach(order => {
        order.items?.forEach((item: any) => {
          const existing = productMap.get(item.name) || { count: 0 };
          productMap.set(item.name, {
            count: existing.count + item.quantity,
          });
        });
      });

      const topProducts = Array.from(productMap.entries())
        .map(([name, values]) => ({ name, ...values }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate top locations
      const locationMap = new Map();
      orders?.forEach(order => {
        const area = order.delivery_address?.area || 'Unknown';
        locationMap.set(area, (locationMap.get(area) || 0) + 1);
      });

      const topLocations = Array.from(locationMap.entries())
        .map(([area, orders]) => ({ area, orders }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);

      // Calculate peak hours
      const hourMap = new Map();
      for (let i = 0; i < 24; i++) hourMap.set(i, 0);
      
      orders?.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      });

      const peakHours = Array.from(hourMap.entries())
        .map(([hour, orders]) => ({ hour, orders }))
        .filter(h => h.orders > 0);

      // Format reviews
     const formattedReviews = (reviews || []).map(review => ({
  id: review.id,
  rating: review.rating,
  comment: review.comment || '',
  created_at: review.created_at,
  customer_name: (review.users as any)?.name || 'Anonymous Customer',
}));

      setAnalyticsData({
        salesOverTime,
        topProducts,
        topLocations,
        peakHours,
        recentReviews: formattedReviews.slice(0, 5),
        periodStats: {
          totalOrders: orders?.length || 0,
          totalEarnings: orders?.reduce((sum, o) => {
            const subtotal = (o.total || 0) - (o.delivery_fee || 0);
            const platformFee = Math.round(subtotal * 0.1);
            return sum + (subtotal - platformFee);
          }, 0) || 0,
        },
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (statsLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!analyticsData || !stats) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load analytics</Text>
        <TouchableOpacity onPress={refreshStats} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
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
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity onPress={() => {
          refreshStats();
          fetchAnalyticsData();
        }} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => setPeriod(option.value as typeof period)}
              style={[
                styles.periodButton,
                period === option.value && styles.periodButtonActive,
              ]}
            >
              <Text style={[
                styles.periodButtonText,
                period === option.value && styles.periodButtonTextActive,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards - Using stats for total, analyticsData for period */}
        <View style={styles.summaryGrid}>
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={styles.summaryValue}>{stats.totalOrders}</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#10b981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <Text style={styles.summaryLabel}>Total Earnings</Text>
            <Text style={styles.summaryValue}>₦{stats.totalVendorEarnings.toLocaleString()}</Text>
          </LinearGradient>

          <View style={styles.summaryCardSecondary}>
            <Text style={styles.summaryLabelSecondary}>Period Orders</Text>
            <Text style={styles.summaryValueSecondary}>{analyticsData.periodStats.totalOrders}</Text>
          </View>

          <View style={styles.summaryCardSecondary}>
            <Text style={styles.summaryLabelSecondary}>Period Earnings</Text>
            <Text style={styles.summaryValueSecondary}>₦{analyticsData.periodStats.totalEarnings.toLocaleString()}</Text>
          </View>
        </View>

        {/* Earnings Chart */}
        {analyticsData.salesOverTime.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Earnings Trend ({period})</Text>
            <SimpleLineChart
              data={analyticsData.salesOverTime.map((item: any) => ({
                date: item.date,
                sales: item.earnings,
                earnings: item.earnings,
              }))}
              height={220}
            />
          </View>
        )}

        {/* Top Products */}
        <View style={styles.row}>
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.cardTitle}>Top Products</Text>
            {analyticsData.topProducts.map((product: any, idx: number) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Text style={styles.listItemRank}>#{idx + 1}</Text>
                  <View style={styles.listItemInfo}>
                    <Text style={styles.listItemName} numberOfLines={1}>{product.name}</Text>
                    <Text style={styles.listItemSubtext}>{product.count} orders</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Top Locations */}
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.cardTitle}>Top Areas</Text>
            {analyticsData.topLocations.map((location: any, idx: number) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Feather name="map-pin" size={14} color="#f97316" />
                  <Text style={styles.listItemName} numberOfLines={1}>{location.area}</Text>
                </View>
                <Text style={styles.listItemCount}>{location.orders} orders</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Peak Hours */}
        {analyticsData.peakHours.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Peak Hours</Text>
            <SimpleBarChart
              data={analyticsData.peakHours.map((h: any) => ({ 
                label: `${h.hour}:00`, 
                value: h.orders 
              }))}
              height={200}
            />
          </View>
        )}

        {/* Recent Reviews */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Reviews</Text>
          {analyticsData.recentReviews.length > 0 ? (
            analyticsData.recentReviews.map((review: any) => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>
                      {review.customer_name}
                    </Text>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Feather
                          key={star}
                          name="star"
                          size={12}
                          color={star <= review.rating ? '#fbbf24' : '#666'}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {review.comment ? (
                  <Text style={styles.reviewComment}>"{review.comment}"</Text>
                ) : (
                  <Text style={styles.reviewComment}>No comment provided</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No reviews yet</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Add all the styles from your existing file
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f97316',
    borderRadius: 8,
  },
  retryText: {
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#f97316',
  },
  periodButtonText: {
    fontSize: 13,
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
  },
  summaryCardSecondary: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  summaryLabelSecondary: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValueSecondary: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  summarySubtext: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  listItemRank: {
    width: 30,
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 2,
  },
  listItemSubtext: {
    fontSize: 10,
    color: '#666',
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listItemCount: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500',
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 10,
    color: '#666',
  },
  reviewComment: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
});