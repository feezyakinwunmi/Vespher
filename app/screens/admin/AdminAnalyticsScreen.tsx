import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import {
  LineChart,
  BarChart,
  PieChart,
  ProgressChart,
} from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

type TimeRange = 'week' | 'month' | 'year' | 'all';

interface AnalyticsData {
  // Order stats
  totalOrders: number;
  totalFoodOrders: number;
  totalBusinessOrders: number;
  totalRevenue: number;
  totalFoodRevenue: number;
  totalBusinessRevenue: number;
  platformFees: number;
totalBusinessPlatformShare:number;
totalRiderEarnings:number;
    // Additional fields for debugging/info
    totalFoodDeliveryFees:number;
    totalBusinessRiderShare:number;
  
  // Vendor stats
  totalVendors: number;
  approvedVendors: number;
  pendingVendors: number;
  suspendedVendors: number;
  
  // User stats
  totalUsers: number;
  totalCustomers: number;
  totalRiders: number;
  totalBusinesses: number;
  
  // Order trends
  ordersByDay: { date: string; food: number; business: number }[];
  
  // Top performers
  topVendorsByOrders: any[];
  topVendorsByRevenue: any[];
  topVendorsByRating: any[];
  
  // Category distribution
  ordersByCategory: { category: string; count: number }[];
  
  // Revenue breakdown
  revenueByType: { name: string; revenue: number; color: string }[];
}

export function AdminAnalyticsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalOrders: 0,
    totalFoodOrders: 0,
    totalBusinessOrders: 0,
    totalRevenue: 0,
    totalFoodRevenue: 0,
    totalBusinessRevenue: 0,
    platformFees: 0,
    totalVendors: 0,
    approvedVendors: 0,
    pendingVendors: 0,
    suspendedVendors: 0,
    totalUsers: 0,
    totalCustomers: 0,
    totalBusinessPlatformShare:0,
    totalRiderEarnings:0,
    // Additional fields for debugging/info
    totalFoodDeliveryFees:0,
    totalBusinessRiderShare:0,

    totalRiders: 0,
    totalBusinesses: 0,
    ordersByDay: [],
    topVendorsByOrders: [],
    topVendorsByRevenue: [],
    topVendorsByRating: [],
    ordersByCategory: [],
    revenueByType: [],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Get date range filter
      const dateFilter = getDateFilter(timeRange);

      // Fetch all required data in parallel
      const [
        foodOrdersData,
        businessOrdersData,
        vendorsData,
        usersData,
        reviewsData,
        platformSettings,
      ] = await Promise.all([
        // Food orders
        supabase
          .from('orders')
          .select(`
            *,
            vendor:vendors(name, rating),
            items:order_items(quantity, price)
          `)
          .gte('created_at', dateFilter.startDate),
        
        // Business logistics
        supabase
          .from('business_logistics')
          .select('*')
          .gte('created_at', dateFilter.startDate),
        
        // Vendors
        supabase
          .from('vendors')
          .select('*'),
        
        // Users
        supabase
          .from('users')
          .select('role, created_at'),
        
        // Reviews
        supabase
          .from('reviews')
          .select('vendor_id, rating, created_at'),
        
        // Platform settings for fee percentage
        supabase
          .from('platform_settings')
          .select('platform_fee_percentage')
          .order('id', { ascending: true })
          .limit(1)
          .single(),
      ]);

      // Process the data
      const processedData = processAnalyticsData(
        foodOrdersData.data || [],
        businessOrdersData.data || [],
        vendorsData.data || [],
        usersData.data || [],
        reviewsData.data || [],
        platformSettings.data?.platform_fee_percentage || 10
      );

      setAnalytics(processedData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load analytics',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDateFilter = (range: TimeRange) => {
    const now = new Date();
    const startDate = new Date();

    switch (range) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2000); // Far in the past
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    };
  };

const processAnalyticsData = (
  foodOrders: any[],
  businessOrders: any[],
  vendors: any[],
  users: any[],
  reviews: any[],
  platformFeePercentage: number
): AnalyticsData => {
  // For food orders: filter by delivered/completed status
  const completedFoodOrders = foodOrders.filter(order => 
    order.status === 'delivered' || order.status === 'completed'
  );
  
  // For business orders: filter by paid status
  const completedBusinessOrders = businessOrders.filter(order => 
    order.payment_status === 'paid'
  );

  // ===== FOOD ORDERS METRICS =====
  const totalFoodOrders = completedFoodOrders.length;
  
  // Total food revenue (order total)
  const totalFoodRevenue = completedFoodOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  
  // Total food delivery fees
  const totalFoodDeliveryFees = completedFoodOrders.reduce((sum, order) => {
    return sum + (order.delivery_fee || 0);
  }, 0);
  
  // Total food service fees (for future)
  const totalFoodServiceFees = completedFoodOrders.reduce((sum, order) => {
    return sum + (order.service_fee || 0);
  }, 0);
  
  // Food platform income = 50% of delivery fees + service fees
  const foodPlatformIncome = (totalFoodDeliveryFees * 0.5) + totalFoodServiceFees;
  
  // Food rider earnings = 50% of delivery fees
  const foodRiderEarnings = totalFoodDeliveryFees * 0.5;

  // ===== BUSINESS ORDERS METRICS =====
  const totalBusinessOrders = completedBusinessOrders.length;
  
  // Total business revenue (calculated_fee)
  const totalBusinessRevenue = completedBusinessOrders.reduce((sum, order) => {
    const fee = typeof order.calculated_fee === 'string' 
      ? parseFloat(order.calculated_fee) 
      : (order.calculated_fee || 0);
    return sum + fee;
  }, 0);
  
  // Total business platform share (from column)
  const totalBusinessPlatformShare = completedBusinessOrders.reduce((sum, order) => {
    if (order.platform_share) {
      const share = typeof order.platform_share === 'string' 
        ? parseFloat(order.platform_share) 
        : order.platform_share;
      return sum + share;
    }
    return sum;
  }, 0);
  
  // Total business rider share (from column)
  const totalBusinessRiderShare = completedBusinessOrders.reduce((sum, order) => {
    if (order.rider_share) {
      const share = typeof order.rider_share === 'string' 
        ? parseFloat(order.rider_share) 
        : order.rider_share;
      return sum + share;
    }
    return sum;
  }, 0);

  // ===== TOTAL PLATFORM INCOME =====
  // Platform income = Food platform income + Business platform share
  const totalPlatformIncome = foodPlatformIncome + totalBusinessPlatformShare;
  
  // ===== TOTAL RIDER EARNINGS =====
  // Rider earnings = Food rider earnings + Business rider share
  const totalRiderEarnings = foodRiderEarnings + totalBusinessRiderShare;
  
  // ===== TOTAL REVENUE =====
  const totalRevenue = totalFoodRevenue + totalBusinessRevenue;

  // Debug log to see all components
  console.log('📊 ANALYTICS BREAKDOWN:');
  console.log('===== FOOD ORDERS =====');
  console.log('Total Food Orders:', totalFoodOrders);
  console.log('Total Food Revenue:', totalFoodRevenue);
  console.log('Total Food Delivery Fees:', totalFoodDeliveryFees);
  console.log('Total Food Service Fees:', totalFoodServiceFees);
  console.log('Food Platform Income (50% delivery):', foodPlatformIncome);
  console.log('Food Rider Earnings:', foodRiderEarnings);
  
  console.log('===== BUSINESS ORDERS =====');
  console.log('Total Business Orders:', totalBusinessOrders);
  console.log('Total Business Revenue:', totalBusinessRevenue);
  console.log('Total Business Platform Share:', totalBusinessPlatformShare);
  console.log('Total Business Rider Share:', totalBusinessRiderShare);
  
  console.log('===== TOTALS =====');
  console.log('Total Revenue (Food + Business):', totalRevenue);
  console.log('TOTAL PLATFORM INCOME:', totalPlatformIncome);
  console.log('TOTAL RIDER EARNINGS:', totalRiderEarnings);
  console.log('Check: Platform + Rider should = Revenue:', totalPlatformIncome + totalRiderEarnings);

  // Vendor stats
  const totalVendors = vendors.length;
  const approvedVendors = vendors.filter(v => v.is_approved).length;
  const pendingVendors = vendors.filter(v => !v.is_approved).length;
  const suspendedVendors = vendors.filter(v => v.is_suspended).length;

  // User stats
  const totalUsers = users.length;
  const totalCustomers = users.filter(u => u.role === 'customer').length;
  const totalRiders = users.filter(u => u.role === 'rider').length;
  const totalBusinesses = users.filter(u => u.role === 'business').length;

  // Orders by day
  const ordersByDay = generateOrdersByDay(completedFoodOrders, completedBusinessOrders);

  // Top vendors by orders
  const vendorOrderCount = new Map();
  completedFoodOrders.forEach(order => {
    if (order.vendor_id) {
      vendorOrderCount.set(
        order.vendor_id,
        (vendorOrderCount.get(order.vendor_id) || 0) + 1
      );
    }
  });

  const topVendorsByOrders = vendors
    .map(vendor => ({
      id: vendor.id,
      name: vendor.name,
      orderCount: vendorOrderCount.get(vendor.id) || 0,
      revenue: completedFoodOrders
        .filter(o => o.vendor_id === vendor.id)
        .reduce((sum, o) => sum + (o.total || 0), 0),
      rating: parseFloat(vendor.rating) || 0,
      reviewCount: vendor.review_count || 0,
    }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5);

  // Top vendors by revenue
  const topVendorsByRevenue = [...topVendorsByOrders]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top vendors by rating
  const topVendorsByRating = vendors
    .map(vendor => ({
      id: vendor.id,
      name: vendor.name,
      orderCount: vendorOrderCount.get(vendor.id) || 0,
      revenue: completedFoodOrders
        .filter(o => o.vendor_id === vendor.id)
        .reduce((sum, o) => sum + (o.total || 0), 0),
      rating: parseFloat(vendor.rating) || 0,
      reviewCount: vendor.review_count || 0,
    }))
    .filter(v => v.reviewCount > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  // Orders by category
  const categoryCount = new Map();
  vendors.forEach(vendor => {
    if (vendor.category) {
      const count = completedFoodOrders.filter(o => o.vendor_id === vendor.id).length;
      categoryCount.set(vendor.category, (categoryCount.get(vendor.category) || 0) + count);
    }
  });

  const ordersByCategory = Array.from(categoryCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Revenue by type for pie chart
  const revenueByType = [
    {
      name: 'Food Orders',
      population: totalFoodRevenue,
      revenue: totalFoodRevenue,
      color: '#f97316',
      legendFontColor: '#fff',
      legendFontSize: 10,
    },
    {
      name: 'Business Orders',
      population: totalBusinessRevenue,
      revenue: totalBusinessRevenue,
      color: '#f43f5e',
      legendFontColor: '#fff',
      legendFontSize: 10,
    },
    {
      name: 'Platform Fees',
      population: totalPlatformIncome,
      revenue: totalPlatformIncome,
      color: '#8b5cf6',
      legendFontColor: '#fff',
      legendFontSize: 10,
    },
  ];

  return {
    totalOrders: totalFoodOrders + totalBusinessOrders,
    totalFoodOrders,
    totalBusinessOrders,
    totalRevenue,
    totalFoodRevenue,
    totalBusinessRevenue,
    platformFees: totalPlatformIncome,
    totalVendors,
    approvedVendors,
    pendingVendors,
    suspendedVendors,
    totalUsers,
    totalCustomers,
    totalRiders,
    totalBusinesses,
    ordersByDay,
    topVendorsByOrders,
    topVendorsByRevenue,
    topVendorsByRating,
    ordersByCategory,
    revenueByType,
    totalRiderEarnings,
    // Additional fields for debugging/info
    totalFoodDeliveryFees,
    totalBusinessPlatformShare,
    totalBusinessRiderShare,
  };
};




console.log('Analytics data:', {
  totalRevenue: analytics.totalRevenue,
  totalFoodRevenue: analytics.totalFoodRevenue,
  totalBusinessRevenue: analytics.totalBusinessRevenue,
  platformFees: analytics.platformFees
});
  const generateOrdersByDay = (foodOrders: any[], businessOrders: any[]) => {
    const days = 7; // Show last 7 days
    const result = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const foodCount = foodOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.toDateString() === date.toDateString();
      }).length;
      
      const businessCount = businessOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.toDateString() === date.toDateString();
      }).length;
      
      result.push({
        date: dateStr,
        food: foodCount,
        business: businessCount,
      });
    }
    
    return result;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const chartConfig = {
    backgroundColor: '#1a1a1a',
    backgroundGradientFrom: '#1a1a1a',
    backgroundGradientTo: '#1a1a1a',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#f97316',
    },
  };

  const timeRanges: Array<{ label: string; value: TimeRange }> = [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
    { label: 'All Time', value: 'all' },
  ];

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#f97316', '#f43f5e']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <TouchableOpacity onPress={fetchAnalytics} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Time Range Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRangeContainer}>
        <View style={styles.timeRangeFilters}>
          {timeRanges.map((range) => (
            <TouchableOpacity
              key={range.value}
              style={[
                styles.timeRangeChip,
                timeRange === range.value && styles.timeRangeChipActive,
              ]}
              onPress={() => setTimeRange(range.value)}
            >
              <Text style={[
                styles.timeRangeChipText,
                timeRange === range.value && styles.timeRangeChipTextActive,
              ]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {/* Key Metrics Cards */}
{/* Key Metrics Cards */}
{/* Key Metrics Cards */}
<View style={styles.metricsGrid}>
  {/* Total Orders Card */}
  <LinearGradient
    colors={['#f97316', '#f43f5e']}
    style={styles.metricCard}
  >
    <Text style={styles.metricValue}>{formatNumber(analytics.totalOrders)}</Text>
    <Text style={styles.metricLabel}>Total Orders</Text>
    <View style={styles.metricBreakdown}>
      <Text style={styles.metricBreakdownText}>🍔 {analytics.totalFoodOrders}</Text>
      <Text style={styles.metricBreakdownText}>📦 {analytics.totalBusinessOrders}</Text>
    </View>
  </LinearGradient>

  {/* Total Revenue Card */}
  <LinearGradient
    colors={['#3b82f6', '#8b5cf6']}
    style={styles.metricCard}
  >
    <Text style={styles.metricValue}>{formatCurrency(analytics.totalRevenue)}</Text>
    <Text style={styles.metricLabel}>Total Revenue</Text>
    
    <View style={styles.metricDivider} />
    
    {/* Food Revenue */}
    <View style={styles.revenueRow}>
      <View style={styles.revenueLeft}>
        <View style={[styles.revenueDot, { backgroundColor: '#f97316' }]} />
        <Text style={styles.revenueLabel}>Total Food Order Revenue</Text>
      </View>
      <Text style={styles.revenueValue}>{formatCurrency(analytics.totalFoodRevenue)}</Text>
    </View>
    
    {/* Business Revenue */}
    <View style={styles.revenueRow}>
      <View style={styles.revenueLeft}>
        <View style={[styles.revenueDot, { backgroundColor: '#f43f5e' }]} />
        <Text style={styles.revenueLabel}>Total Business Order Revenue</Text>
      </View>
      <Text style={styles.revenueValue}>{formatCurrency(analytics.totalBusinessRevenue)}</Text>
    </View>
  </LinearGradient>

  {/* Platform & Rider Earnings Card */}
  <LinearGradient
    colors={['#8b5cf6', '#ec4899']}
    style={styles.metricCard}
  >
    <Text style={styles.metricValue}>{formatCurrency(analytics.platformFees)}</Text>
    <Text style={styles.metricLabel}>Platform Income</Text>
    
    <View style={styles.metricDivider} />
    
    {/* Food Delivery Fees */}
    <View style={styles.revenueRow}>
      <View style={styles.revenueLeft}>
        <Feather name="truck" size={12} color="#f97316" />
        <Text style={styles.revenueLabel}>Total Food Delivery Fees</Text>
      </View>
      <Text style={styles.revenueValue}>{formatCurrency(analytics.totalFoodDeliveryFees || 0)}</Text>
    </View>
    
    {/* Food Platform Share (50%) */}
    <View style={styles.revenueRow}>
      <View style={styles.revenueLeft}>
        <View style={[styles.revenueDot, { backgroundColor: '#f97316' }]} />
        <Text style={styles.revenueLabel}>Total Platform earning from Food Orders</Text>
      </View>
      <Text style={styles.revenueValue}>
        {formatCurrency((analytics.totalFoodDeliveryFees || 0) * 0.5)}
      </Text>
    </View>
    
    {/* Business Platform Share */}
    <View style={styles.revenueRow}>
      <View style={styles.revenueLeft}>
        <View style={[styles.revenueDot, { backgroundColor: '#f43f5e' }]} />
        <Text style={styles.revenueLabel}>Total Platform earning from Business Orders</Text>
      </View>
      <Text style={styles.revenueValue}>
        {formatCurrency(analytics.totalBusinessPlatformShare || 0)}
      </Text>
    </View>
    
    <View style={styles.revenueDivider} />
    
    {/* Total Rider Earnings */}
    <View style={styles.revenueRow}>
      <View style={styles.revenueLeft}>
        <Feather name="users" size={12} color="#10b981" />
        <Text style={[styles.revenueLabel, { fontWeight: '600' }]}>Total Logistics fee</Text>
      </View>
      <Text style={[styles.revenueValue, { color: '#10b981', fontWeight: '700' }]}>
        {formatCurrency(analytics.totalRiderEarnings || 0)}
      </Text>
    </View>
    
    {/* Rider Breakdown */}
    <View style={styles.revenueRow}>
      <View style={styles.revenueLeft}>
        <View style={[styles.revenueDot, { backgroundColor: '#f97316' }]} />
        <Text style={styles.revenueSmallLabel}>All logistics fee from Food </Text>
      </View>
      <Text style={styles.revenueSmallValue}>
        {formatCurrency((analytics.totalFoodDeliveryFees || 0) * 0.5)}
      </Text>
    </View>
    
    <View style={styles.revenueRow}>
      <View style={styles.revenueLeft}>
        <View style={[styles.revenueDot, { backgroundColor: '#f43f5e' }]} />
        <Text style={styles.revenueSmallLabel}>All logistics fee from Business </Text>
      </View>
      <Text style={styles.revenueSmallValue}>
        {formatCurrency(analytics.totalBusinessRiderShare || 0)}
      </Text>
    </View>
  </LinearGradient>

  {/* Users & Vendors Card */}
  <View style={styles.metricCardSecondary}>
<View>
    <Text style={styles.metricValueSecondary}>{analytics.totalUsers}</Text>
    <Text style={styles.metricLabelSecondary}>Total Users</Text>
    <View style={styles.metricBreakdown}>
      <Text style={styles.metricBreakdownText}>👤 {analytics.totalCustomers}</Text>
      <Text style={styles.metricBreakdownText}>🛵 {analytics.totalRiders}</Text>
      <Text style={styles.metricBreakdownText}>🏢 {analytics.totalBusinesses}</Text>
    </View>
    </View>
    <View style={styles.metricSmallDivider} />
    <View>
    <Text style={styles.metricValueSecondary}>{analytics.totalVendors}</Text>
    <Text style={styles.metricLabelSecondary}>Total Vendors</Text>
    <View style={styles.metricBreakdown}>
      <Text style={[styles.metricBreakdownText, { color: '#10b981' }]}>✅ {analytics.approvedVendors}</Text>
      <Text style={[styles.metricBreakdownText, { color: '#f59e0b' }]}>⏳ {analytics.pendingVendors}</Text>
      <Text style={[styles.metricBreakdownText, { color: '#ef4444' }]}>🚫 {analytics.suspendedVendors}</Text>
    </View>
</View>
  </View>
</View>

        {/* Orders Trend Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Orders Trend</Text>
          <Text style={styles.chartSubtitle}>Last 7 days</Text>
          
          {analytics.ordersByDay.length > 0 && (
            <LineChart
              data={{
                labels: analytics.ordersByDay.map(d => d.date),
                datasets: [
                  {
                    data: analytics.ordersByDay.map(d => d.food),
                    color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
                    strokeWidth: 2,
                  },
                  {
                    data: analytics.ordersByDay.map(d => d.business),
                    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                    strokeWidth: 2,
                  },
                ],
                legend: ['Food Orders', 'Business Logistics'],
              }}
              width={width - 32}
              height={220}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
              }}
              bezier
              style={styles.chart}
            />
          )}
        </View>

        {/* Revenue Distribution */}
        <View style={styles.row}>
          <View style={[styles.chartCard, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.chartTitle}>Revenue Distribution</Text>
            
            {analytics.revenueByType.length > 0 && (
             <PieChart
  data={analytics.revenueByType}
  width={width/1.5}
  height={150}
  chartConfig={chartConfig}
  accessor="population"  // This should match the field name
  backgroundColor="transparent"
  paddingLeft=""
  absolute
/>
            )}
          </View>
{/* <View style={[styles.chartCard, { flex: 1, marginLeft: 8 }]}>
  <Text style={styles.chartTitle}>Order Types</Text>
  
  {analytics.totalOrders > 0 && (
    <ProgressChart
      data={{
        labels: ['Food', 'Business'],
        data: [
          analytics.totalFoodOrders / analytics.totalOrders,
          analytics.totalBusinessOrders / analytics.totalOrders,
        ],
      }}
      width={width / 2 - 20}
      height={150}
      chartConfig={{
        backgroundColor: '#1a1a1a',
        backgroundGradientFrom: '#1a1a1a',
        backgroundGradientTo: '#1a1a1a',
        decimalPlaces: 2,
        color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        style: {
          borderRadius: 16,
        },
      }}
      hideLegend={false}
      style={styles.chart}
    />
  )}
</View> */}
        </View>

        {/* Vendor Categories */}
        {/* Vendor Categories - Fixed BarChart */}
<View style={styles.chartCard}>
  <Text style={styles.chartTitle}>Orders by Category</Text>
  
  {analytics.ordersByCategory.length > 0 && (
    <BarChart
      data={{
        labels: analytics.ordersByCategory.map(c => c.category.substring(0, 5) + '...'),
        datasets: [
          {
            data: analytics.ordersByCategory.map(c => c.count),
          },
        ],
      }}
      width={width - 32}
      height={220}
      yAxisLabel=""
      yAxisSuffix=""
      chartConfig={{
        backgroundColor: '#1a1a1a',
        backgroundGradientFrom: '#1a1a1a',
        backgroundGradientTo: '#1a1a1a',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        style: {
          borderRadius: 16,
        },
        propsForDots: {
          r: '6',
          strokeWidth: '2',
          stroke: '#f97316',
        },
      }}
      style={{
        marginVertical: 8,
        borderRadius: 16,
      }}
      showValuesOnTopOfBars={true}
      fromZero={true}
    />
  )}
</View>

        {/* Top Vendors Section */}
        <Text style={styles.sectionTitle}>Top Performers</Text>

        {/* Top Vendors by Orders */}
        <View style={styles.topVendorsCard}>
          <Text style={styles.topVendorsTitle}>🏆 Most Orders</Text>
          {analytics.topVendorsByOrders.map((vendor, index) => (
            <View key={vendor.id} style={styles.vendorRankItem}>
              <View style={styles.vendorRankLeft}>
                <Text style={styles.vendorRank}>#{index + 1}</Text>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName}>{vendor.name}</Text>
                  <Text style={styles.vendorStats}>{vendor.orderCount} orders • ₦{vendor.revenue.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.vendorRating}>
                <Feather name="star" size={12} color="#fbbf24" />
                <Text style={styles.vendorRatingText}>{vendor.rating.toFixed(1)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Top Vendors by Revenue */}
        <View style={styles.topVendorsCard}>
          <Text style={styles.topVendorsTitle}>💰 Highest Revenue</Text>
          {analytics.topVendorsByRevenue.map((vendor, index) => (
            <View key={vendor.id} style={styles.vendorRankItem}>
              <View style={styles.vendorRankLeft}>
                <Text style={styles.vendorRank}>#{index + 1}</Text>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName}>{vendor.name}</Text>
                  <Text style={styles.vendorStats}>{vendor.orderCount} orders • ₦{vendor.revenue.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.vendorRating}>
                <Feather name="star" size={12} color="#fbbf24" />
                <Text style={styles.vendorRatingText}>{vendor.rating.toFixed(1)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Top Rated Vendors */}
        <View style={styles.topVendorsCard}>
          <Text style={styles.topVendorsTitle}>⭐ Top Rated</Text>
          {analytics.topVendorsByRating.map((vendor, index) => (
            <View key={vendor.id} style={styles.vendorRankItem}>
              <View style={styles.vendorRankLeft}>
                <Text style={styles.vendorRank}>#{index + 1}</Text>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName}>{vendor.name}</Text>
                  <Text style={styles.vendorStats}>{vendor.reviewCount} reviews • {vendor.rating.toFixed(1)} ⭐</Text>
                </View>
              </View>
              <View style={styles.vendorRating}>
                <Text style={styles.vendorRatingText}>₦{vendor.revenue.toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Vendor Stats Summary */}
        <View style={styles.statsSummary}>
          <View style={styles.statSummaryItem}>
            <Text style={styles.statSummaryLabel}>Total Vendors</Text>
            <Text style={styles.statSummaryValue}>{analytics.totalVendors}</Text>
          </View>
          <View style={styles.statSummaryItem}>
            <Text style={styles.statSummaryLabel}>Approved</Text>
            <Text style={[styles.statSummaryValue, { color: '#10b981' }]}>{analytics.approvedVendors}</Text>
          </View>
          <View style={styles.statSummaryItem}>
            <Text style={styles.statSummaryLabel}>Pending</Text>
            <Text style={[styles.statSummaryValue, { color: '#f59e0b' }]}>{analytics.pendingVendors}</Text>
          </View>
          <View style={styles.statSummaryItem}>
            <Text style={styles.statSummaryLabel}>Suspended</Text>
            <Text style={[styles.statSummaryValue, { color: '#ef4444' }]}>{analytics.suspendedVendors}</Text>
          </View>
        </View>
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
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeRangeContainer: {
    maxHeight: 60,
    marginVertical: 12,
  },
  timeRangeFilters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  timeRangeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  metricDivider: {
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.2)',
  marginVertical: 12,
},
metricSmallDivider: {
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.1)',
  marginVertical: 8,
},
revenueRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 6,
},
revenueLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
revenueDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
},
revenueLabel: {
  fontSize: 11,
  color: 'rgba(255,255,255,0.9)',
},
revenueSmallLabel: {
  fontSize: 10,
  color: 'rgba(255,255,255,0.7)',
  marginLeft: 14,
},
revenueValue: {
  fontSize: 12,
  fontWeight: '600',
  color: '#fff',
},
revenueSmallValue: {
  fontSize: 11,
  color: 'rgba(255,255,255,0.8)',
},
revenueDivider: {
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.1)',
  marginVertical: 8,
},
  timeRangeChipActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  timeRangeChipText: {
    fontSize: 13,
    color: '#666',
  },
  timeRangeChipTextActive: {
    color: '#f97316',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
  },
  metricCardSecondary: {
    flexDirection:'row',
    width: '100%',
    justifyContent:'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  metricValueSecondary: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  metricLabelSecondary: {
    fontSize: 12,
    color: '#666',
  },
  metricBreakdown: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  metricBreakdownText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  chartCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 5,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  topVendorsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  topVendorsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 12,
  },
  vendorRankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  vendorRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vendorRank: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 30,
  },
  vendorInfo: {
    gap: 2,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  vendorStats: {
    fontSize: 11,
    color: '#666',
  },
  vendorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vendorRatingText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
  },
  statsSummary: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'space-around',
  },
  statSummaryItem: {
    alignItems: 'center',
  },
  statSummaryLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  statSummaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
 
});