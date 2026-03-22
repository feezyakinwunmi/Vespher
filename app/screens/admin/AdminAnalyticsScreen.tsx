// app/screens/admin/AdminAnalyticsScreen.tsx
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
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import {
  LineChart,
  BarChart,
  PieChart,
} from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

type TimeRange = 'week' | 'month' | 'year' | 'all';

interface AnalyticsData {
  // ===== ORDER TOTALS =====
  totalOrders: number;
  totalFoodOrders: number;
  totalBusinessOrders: number;
  
  // ===== REVENUE TOTALS =====
  totalRevenue: number;
  totalFoodRevenue: number;
  totalBusinessRevenue: number;
  
  // ===== VENDOR EARNINGS =====
  totalVendorEarnings: number;
  vendorEarningsBreakdown: { vendorName: string; earnings: number }[];
  
  // ===== RIDER EARNINGS =====
  totalRiderEarnings: number;
  riderEarningsBreakdown: { riderName: string; earnings: number }[];
  
  // ===== PLATFORM EARNINGS =====
  platformEarnings: {
    total: number;
    fromFoodCommission: number;
    fromDeliveryShare: number;
    fromBusinessOrders: number;
  };
  
  // ===== FEES =====
  flutterwaveFees: {
    total: number;
    fromFoodOrders: number;
    fromBusinessOrders: number;
  };
  stampDutyTotal: number;
  
  // ===== VENDOR STATS =====
  totalVendors: number;
  approvedVendors: number;
  pendingVendors: number;
  suspendedVendors: number;
  
  // ===== USER STATS =====
  totalUsers: number;
  totalCustomers: number;
  totalRiders: number;
  
  // ===== TRENDS =====
  ordersByDay: { date: string; food: number; business: number; total: number }[];
  
  // ===== TOP PERFORMERS =====
  topVendorsByOrders: any[];
  topVendorsByRevenue: any[];
  topRidersByEarnings: any[];
  
  // ===== CATEGORY DISTRIBUTION =====
  ordersByCategory: { category: string; count: number; revenue: number }[];
  
  // ===== REVENUE BREAKDOWN (for pie chart) =====
  revenueBreakdown: { name: string; amount: number; color: string }[];
}

// Professional color palette
const colors = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#8b5cf6',
  orange: '#f97316',
  pink: '#ec489a',
  background: '#0a0a0a',
  card: '#1a1a1a',
  border: '#2a2a2a',
  text: '#ffffff',
  textSecondary: '#9ca3af',
};

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
    totalVendorEarnings: 0,
    vendorEarningsBreakdown: [],
    totalRiderEarnings: 0,
    riderEarningsBreakdown: [],
    platformEarnings: { total: 0, fromFoodCommission: 0, fromDeliveryShare: 0, fromBusinessOrders: 0 },
    flutterwaveFees: { total: 0, fromFoodOrders: 0, fromBusinessOrders: 0 },
    stampDutyTotal: 0,
    totalVendors: 0,
    approvedVendors: 0,
    pendingVendors: 0,
    suspendedVendors: 0,
    totalUsers: 0,
    totalCustomers: 0,
    totalRiders: 0,
    ordersByDay: [],
    topVendorsByOrders: [],
    topVendorsByRevenue: [],
    topRidersByEarnings: [],
    ordersByCategory: [],
    revenueBreakdown: [],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

 const fetchAnalytics = async () => {
  try {
    setLoading(true);

    const dateFilter = getDateFilter(timeRange);

    // Fetch all delivered food orders
    const { data: foodOrders } = await supabase
      .from('orders')
      .select(`
        *,
        vendor:vendors(id, name, category)
      `)
      .eq('status', 'delivered')
      .gte('created_at', dateFilter.startDate);

    // Fetch all business logistics orders (from business_logistics table)
    const { data: businessOrders } = await supabase
      .from('business_logistics')
      .select('*')
      .gte('created_at', dateFilter.startDate);

    // Fetch all vendors
    const { data: vendors } = await supabase
      .from('vendors')
      .select('*');

    // Fetch all riders (users with role 'rider')
    const { data: riders } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('role', 'rider');

    // Fetch all users for stats
    const { data: users } = await supabase
      .from('users')
      .select('role');

    // Process all data (this is now async because it fetches rider_earnings)
    const processedData = await processAnalyticsData(
      foodOrders || [],
      businessOrders || [],
      vendors || [],
      riders || [],
      users || [],
      10 // platform fee percentage
    );

    setAnalytics(processedData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    Toast.show({ type: 'error', text1: 'Failed to load analytics' });
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
        startDate.setFullYear(2000);
        break;
    }

    return { startDate: startDate.toISOString(), endDate: now.toISOString() };
  };

const processAnalyticsData = (
  foodOrders: any[],
  businessOrders: any[],
  vendors: any[],
  riders: any[],
  users: any[],
  platformFeePercentage: number
): AnalyticsData => {
  
  // ===== BUSINESS ORDERS: Filter by delivered/completed =====
  const completedBusinessOrders = businessOrders.filter(order => 
    order.status === 'delivered' || order.status === 'completed'
  );

  // ===== FOOD ORDERS CALCULATIONS =====
  const totalFoodOrders = foodOrders.length;
  const totalFoodRevenue = foodOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  
  // Vendor earnings from food orders
  const vendorEarningsFromFood = foodOrders.reduce((sum, order) => {
    const payout = typeof order.vendor_payout === 'string' 
      ? parseFloat(order.vendor_payout) 
      : (order.vendor_payout || 0);
    return sum + payout;
  }, 0);
  
  // Platform commission from food orders
  const platformCommissionFromFood = foodOrders.reduce((sum, order) => {
    const commission = typeof order.platform_commission === 'string' 
      ? parseFloat(order.platform_commission) 
      : (order.platform_commission || 0);
    return sum + commission;
  }, 0);
  
  // ===== RIDER EARNINGS FROM FOOD ORDERS =====
  // Directly from the rider_earnings column in orders table
  const riderEarningsFromFoodOrders = foodOrders.reduce((sum, order) => {
    const earnings = typeof order.rider_earnings === 'string' 
      ? parseFloat(order.rider_earnings) 
      : (order.rider_earnings || 0);
    return sum + earnings;
  }, 0);
  
  // ===== RIDER EARNINGS FROM BUSINESS ORDERS =====
  const riderEarningsFromBusinessOrders = completedBusinessOrders.reduce((sum, order) => {
    const share = typeof order.rider_share === 'string' 
      ? parseFloat(order.rider_share) 
      : (order.rider_share || 0);
    return sum + share;
  }, 0);
  
  // ===== TOTAL RIDER EARNINGS =====
  const totalRiderEarnings = riderEarningsFromFoodOrders + riderEarningsFromBusinessOrders;
  
  // ===== BUILD RIDER EARNINGS BREAKDOWN =====
  const riderEarningsMap = new Map();
  
  // 1. Process food orders - get earnings by rider_id
  foodOrders.forEach(order => {
    const riderId = order.rider_id;
    if (riderId) {
      const earnings = typeof order.rider_earnings === 'string' 
        ? parseFloat(order.rider_earnings) 
        : (order.rider_earnings || 0);
      
      if (earnings > 0) {
        if (!riderEarningsMap.has(riderId)) {
          const rider = riders.find(r => r.id === riderId);
          riderEarningsMap.set(riderId, { 
            name: rider?.name || 'Unknown Rider', 
            earnings: 0,
            fromFood: 0,
            fromBusiness: 0,
            orders: 0
          });
        }
        const riderData = riderEarningsMap.get(riderId);
        riderData.earnings += earnings;
        riderData.fromFood += earnings;
        riderData.orders += 1;
      }
    }
  });
  
  // 2. Process business orders - get earnings by rider_id
  completedBusinessOrders.forEach(order => {
    const riderId = order.rider_id;
    if (riderId && order.rider_share) {
      const share = typeof order.rider_share === 'string' 
        ? parseFloat(order.rider_share) 
        : (order.rider_share || 0);
      
      if (share > 0) {
        if (!riderEarningsMap.has(riderId)) {
          const rider = riders.find(r => r.id === riderId);
          riderEarningsMap.set(riderId, { 
            name: rider?.name || 'Unknown Rider', 
            earnings: 0,
            fromFood: 0,
            fromBusiness: 0,
            orders: 0
          });
        }
        const riderData = riderEarningsMap.get(riderId);
        riderData.earnings += share;
        riderData.fromBusiness += share;
      }
    }
  });
  
  const riderEarningsBreakdown = Array.from(riderEarningsMap.values())
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 10);
  
  // Log for debugging
  console.log('Rider earnings breakdown:', riderEarningsBreakdown);
  console.log('Total rider earnings:', totalRiderEarnings);
  
  // Delivery share for platform (50% of delivery fee)
  const totalDeliveryFees = foodOrders.reduce((sum, order) => sum + (order.delivery_fee || 0), 0);
  const deliveryShare = totalDeliveryFees * 0.5;
  
  // Flutterwave fees from food orders
  const flutterwaveFeesFood = foodOrders.reduce((sum, order) => {
    const fee = typeof order.flutterwave_fee === 'string' 
      ? parseFloat(order.flutterwave_fee) 
      : (order.flutterwave_fee || 0);
    return sum + fee;
  }, 0);
  
  // Stamp duty from food orders
  const stampDutyTotal = foodOrders.reduce((sum, order) => {
    const duty = typeof order.stamp_duty === 'string' 
      ? parseFloat(order.stamp_duty) 
      : (order.stamp_duty || 0);
    return sum + duty;
  }, 0);
  
  // ===== BUSINESS ORDERS CALCULATIONS =====
  const totalBusinessOrders = completedBusinessOrders.length;
  const totalBusinessRevenue = completedBusinessOrders.reduce((sum, order) => {
    const fee = typeof order.calculated_fee === 'string' 
      ? parseFloat(order.calculated_fee) 
      : (order.calculated_fee || 0);
    return sum + fee;
  }, 0);
  
  // Platform earnings from business orders (platform_share column)
  const platformEarningsFromBusiness = completedBusinessOrders.reduce((sum, order) => {
    const share = typeof order.platform_share === 'string' 
      ? parseFloat(order.platform_share) 
      : (order.platform_share || 0);
    return sum + share;
  }, 0);
  
  // Flutterwave fees from business orders (estimate 2% of total)
  const flutterwaveFeesBusiness = totalBusinessRevenue * 0.02;
  
  // ===== TOTAL CALCULATIONS =====
  const totalOrders = totalFoodOrders + totalBusinessOrders;
  const totalRevenue = totalFoodRevenue + totalBusinessRevenue;
  const totalVendorEarnings = vendorEarningsFromFood;
  
  // Platform earnings breakdown
  const platformEarnings = {
    total: platformCommissionFromFood + deliveryShare + platformEarningsFromBusiness - flutterwaveFeesFood - flutterwaveFeesBusiness - stampDutyTotal,
    fromFoodCommission: platformCommissionFromFood,
    fromDeliveryShare: deliveryShare,
    fromBusinessOrders: platformEarningsFromBusiness,
  };
  
  // Flutterwave fees breakdown
  const flutterwaveFees = {
    total: flutterwaveFeesFood + flutterwaveFeesBusiness,
    fromFoodOrders: flutterwaveFeesFood,
    fromBusinessOrders: flutterwaveFeesBusiness,
  };
  
  // ===== VENDOR EARNINGS BREAKDOWN =====
  const vendorEarningsMap = new Map();
  foodOrders.forEach(order => {
    const vendorId = order.vendor_id;
    const vendorName = order.vendor?.name || 'Unknown';
    const payout = typeof order.vendor_payout === 'string' 
      ? parseFloat(order.vendor_payout) 
      : (order.vendor_payout || 0);
    
    if (!vendorEarningsMap.has(vendorId)) {
      vendorEarningsMap.set(vendorId, { name: vendorName, earnings: 0, orders: 0 });
    }
    const vendor = vendorEarningsMap.get(vendorId);
    vendor.earnings += payout;
    vendor.orders += 1;
  });
  
  const vendorEarningsBreakdown = Array.from(vendorEarningsMap.values())
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 10);
  
  // ===== VENDOR STATS =====
  const totalVendors = vendors.length;
  const approvedVendors = vendors.filter(v => v.is_approved).length;
  const pendingVendors = vendors.filter(v => !v.is_approved && !v.is_suspended).length;
  const suspendedVendors = vendors.filter(v => v.is_suspended).length;
  
  // ===== USER STATS =====
  const totalUsers = users.length;
  const totalCustomers = users.filter(u => u.role === 'customer').length;
  const totalRiders = users.filter(u => u.role === 'rider').length;
  
  // ===== ORDERS BY DAY (last 7 days) =====
  const ordersByDay = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
    
    const foodCount = foodOrders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate.toDateString() === date.toDateString();
    }).length;
    
    const businessCount = completedBusinessOrders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate.toDateString() === date.toDateString();
    }).length;
    
    ordersByDay.push({
      date: dateStr,
      food: foodCount,
      business: businessCount,
      total: foodCount + businessCount,
    });
  }
  
  // ===== TOP VENDORS =====
  const vendorOrderMap = new Map();
  const vendorRevenueMap = new Map();
  foodOrders.forEach(order => {
    const vendorId = order.vendor_id;
    vendorOrderMap.set(vendorId, (vendorOrderMap.get(vendorId) || 0) + 1);
    vendorRevenueMap.set(vendorId, (vendorRevenueMap.get(vendorId) || 0) + (order.total || 0));
  });
  
  const topVendorsByOrders = vendors
    .map(vendor => ({
      id: vendor.id,
      name: vendor.name,
      orderCount: vendorOrderMap.get(vendor.id) || 0,
      revenue: vendorRevenueMap.get(vendor.id) || 0,
      rating: parseFloat(vendor.rating) || 0,
    }))
    .filter(v => v.orderCount > 0)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5);
  
  const topVendorsByRevenue = [...topVendorsByOrders]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  
  // ===== TOP RIDERS BY EARNINGS =====
  const topRidersByEarnings = riderEarningsBreakdown.slice(0, 5);
  
  // ===== ORDERS BY CATEGORY =====
  const categoryMap = new Map();
  foodOrders.forEach(order => {
    const category = order.vendor?.category || 'Other';
    const existing = categoryMap.get(category) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += (order.total || 0);
    categoryMap.set(category, existing);
  });
  
  const ordersByCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, count: data.count, revenue: data.revenue }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // ===== REVENUE BREAKDOWN FOR PIE CHART =====
  const revenueBreakdown = [
    { name: 'Vendor Payouts', amount: totalVendorEarnings, color: colors.success },
    { name: 'Rider Earnings', amount: totalRiderEarnings, color: colors.warning },
    { name: 'Platform Earnings', amount: platformEarnings.total, color: colors.primary },
    { name: 'Flutterwave Fees', amount: flutterwaveFees.total, color: colors.danger },
  ].filter(r => r.amount > 0);
  
  return {
    totalOrders,
    totalFoodOrders,
    totalBusinessOrders,
    totalRevenue,
    totalFoodRevenue,
    totalBusinessRevenue,
    totalVendorEarnings,
    vendorEarningsBreakdown,
    totalRiderEarnings,
    riderEarningsBreakdown,
    platformEarnings,
    flutterwaveFees,
    stampDutyTotal,
    totalVendors,
    approvedVendors,
    pendingVendors,
    suspendedVendors,
    totalUsers,
    totalCustomers,
    totalRiders,
    ordersByDay,
    topVendorsByOrders,
    topVendorsByRevenue,
    topRidersByEarnings,
    ordersByCategory,
    revenueBreakdown,
  };
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
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const chartConfig = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
    style: { borderRadius: 16 },
  };

  const timeRanges: Array<{ label: string; value: TimeRange }> = [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
    { label: 'All', value: 'all' },
  ];

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity onPress={fetchAnalytics} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ===== KEY METRICS CARDS ===== */}
        <View style={styles.metricsGrid}>
          {/* Total Orders */}
          <View style={styles.metricCard}>
            <Feather name="shopping-bag" size={20} color={colors.primary} />
            <Text style={styles.metricValue}>{formatNumber(analytics.totalOrders)}</Text>
            <Text style={styles.metricLabel}>Total Orders</Text>
            <View style={styles.metricSubtext}>
              <Text style={styles.metricSubtextText}>🍔 {analytics.totalFoodOrders}</Text>
              <Text style={styles.metricSubtextText}>📦 {analytics.totalBusinessOrders}</Text>
            </View>
          </View>

          {/* Total Revenue */}
          <View style={styles.metricCard}>
            <Feather name="dollar-sign" size={20} color={colors.success} />
            <Text style={styles.metricValue}>{formatCurrency(analytics.totalRevenue)}</Text>
            <Text style={styles.metricLabel}>Total Revenue</Text>
            <View style={styles.metricSubtext}>
              <Text style={styles.metricSubtextText}>🍔 {formatCurrency(analytics.totalFoodRevenue)}</Text>
              <Text style={styles.metricSubtextText}>📦 {formatCurrency(analytics.totalBusinessRevenue)}</Text>
            </View>
          </View>

          {/* Vendor Earnings */}
          <View style={styles.metricCard}>
            <Feather name="home" size={20} color={colors.success} />
            <Text style={styles.metricValue}>{formatCurrency(analytics.totalVendorEarnings)}</Text>
            <Text style={styles.metricLabel}>Vendor Earnings</Text>
          </View>

          {/* Rider Earnings */}
          <View style={styles.metricCard}>
            <Feather name="truck" size={20} color={colors.warning} />
            <Text style={styles.metricValue}>{formatCurrency(analytics.totalRiderEarnings)}</Text>
            <Text style={styles.metricLabel}>Rider Earnings</Text>
          </View>

          {/* Platform Earnings */}
          <View style={[styles.metricCard, styles.metricCardHighlight]}>
            <Feather name="trending-up" size={20} color={colors.primary} />
            <Text style={[styles.metricValue, { color: colors.primary }]}>{formatCurrency(analytics.platformEarnings.total)}</Text>
            <Text style={styles.metricLabel}>Platform Earnings</Text>
            <View style={styles.metricSubtext}>
              <Text style={styles.metricSubtextText}>Commission: {formatCurrency(analytics.platformEarnings.fromFoodCommission)}</Text>
              <Text style={styles.metricSubtextText}>Delivery: {formatCurrency(analytics.platformEarnings.fromDeliveryShare)}</Text>
              <Text style={styles.metricSubtextText}>Business: {formatCurrency(analytics.platformEarnings.fromBusinessOrders)}</Text>
            </View>
          </View>

          {/* Flutterwave Fees */}
          <View style={styles.metricCard}>
            <Feather name="credit-card" size={20} color={colors.danger} />
            <Text style={[styles.metricValue, { color: colors.danger }]}>{formatCurrency(analytics.flutterwaveFees.total)}</Text>
            <Text style={styles.metricLabel}>Flutterwave Fees</Text>
            <View style={styles.metricSubtext}>
              <Text style={styles.metricSubtextText}>Food: {formatCurrency(analytics.flutterwaveFees.fromFoodOrders)}</Text>
              <Text style={styles.metricSubtextText}>Business: {formatCurrency(analytics.flutterwaveFees.fromBusinessOrders)}</Text>
            </View>
          </View>

          {/* Stamp Duty */}
          <View style={styles.metricCard}>
            <Feather name="file-text" size={20} color={colors.warning} />
            <Text style={styles.metricValue}>{formatCurrency(analytics.stampDutyTotal)}</Text>
            <Text style={styles.metricLabel}>Stamp Duty</Text>
          </View>
        </View>

        {/* ===== ORDERS TREND CHART ===== */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Orders Trend</Text>
          <Text style={styles.chartSubtitle}>Last 7 days</Text>
          {analytics.ordersByDay.length > 0 && (
            <LineChart
              data={{
                labels: analytics.ordersByDay.map(d => d.date),
                datasets: [
                  { data: analytics.ordersByDay.map(d => d.food), color: () => `rgba(249, 115, 22, 1)`, strokeWidth: 2 },
                  { data: analytics.ordersByDay.map(d => d.business), color: () => `rgba(59, 130, 246, 1)`, strokeWidth: 2 },
                  { data: analytics.ordersByDay.map(d => d.total), color: () => `rgba(16, 185, 129, 1)`, strokeWidth: 2 },
                ],
                legend: ['Food', 'Business', 'Total'],
              }}
              width={width - 32}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          )}
        </View>

        {/* ===== REVENUE BREAKDOWN PIE CHART ===== */}
        {analytics.revenueBreakdown.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Revenue Distribution</Text>
            <PieChart
              data={analytics.revenueBreakdown.map(r => ({
                name: r.name,
                population: r.amount,
                color: r.color,
                legendFontColor: colors.textSecondary,
                legendFontSize: 10,
              }))}
              width={width - 32}
              height={180}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        )}

        {/* ===== ORDERS BY CATEGORY ===== */}
       {/* Orders by Category */}
{analytics.ordersByCategory.length > 0 && (
  <View style={styles.chartCard}>
    <Text style={styles.chartTitle}>Orders by Category</Text>
    <BarChart
      data={{
        labels: analytics.ordersByCategory.map(c => c.category.length > 10 ? c.category.substring(0, 8) + '...' : c.category),
        datasets: [{ data: analytics.ordersByCategory.map(c => c.count) }],
      }}
      width={width - 32}
      height={200}
      yAxisLabel=""
      yAxisSuffix=""  // ✅ ADD THIS LINE
      chartConfig={chartConfig}
      showValuesOnTopOfBars
      fromZero
    />
  </View>
)}

        {/* ===== TOP VENDORS SECTION ===== */}
        <Text style={styles.sectionTitle}>Top Vendors</Text>

        {/* By Orders */}
        <View style={styles.topVendorsCard}>
          <Text style={styles.topVendorsTitle}>🏆 Most Orders</Text>
          {analytics.topVendorsByOrders.map((vendor, index) => (
            <View key={vendor.id} style={styles.vendorRankItem}>
              <View style={styles.vendorRankLeft}>
                <Text style={styles.vendorRank}>#{index + 1}</Text>
                <View>
                  <Text style={styles.vendorName}>{vendor.name}</Text>
                  <Text style={styles.vendorStats}>
                    {vendor.orderCount} orders • {formatCurrency(vendor.revenue)}
                  </Text>
                </View>
              </View>
              <View style={styles.vendorRating}>
                <Feather name="star" size={12} color={colors.warning} />
                <Text style={styles.vendorRatingText}>{vendor.rating.toFixed(1)}</Text>
              </View>
            </View>
          ))}
          {analytics.topVendorsByOrders.length === 0 && (
            <Text style={styles.emptyText}>No orders yet</Text>
          )}
        </View>

        {/* By Revenue */}
        <View style={styles.topVendorsCard}>
          <Text style={styles.topVendorsTitle}>💰 Highest Revenue</Text>
          {analytics.topVendorsByRevenue.map((vendor, index) => (
            <View key={vendor.id} style={styles.vendorRankItem}>
              <View style={styles.vendorRankLeft}>
                <Text style={styles.vendorRank}>#{index + 1}</Text>
                <View>
                  <Text style={styles.vendorName}>{vendor.name}</Text>
                  <Text style={styles.vendorStats}>
                    {vendor.orderCount} orders • {formatCurrency(vendor.revenue)}
                  </Text>
                </View>
              </View>
              <View style={styles.vendorRating}>
                <Feather name="star" size={12} color={colors.warning} />
                <Text style={styles.vendorRatingText}>{vendor.rating.toFixed(1)}</Text>
              </View>
            </View>
          ))}
          {analytics.topVendorsByRevenue.length === 0 && (
            <Text style={styles.emptyText}>No orders yet</Text>
          )}
        </View>

        {/* ===== TOP RIDERS SECTION ===== */}
        <Text style={styles.sectionTitle}>Top Riders</Text>
        <View style={styles.topVendorsCard}>
          <Text style={styles.topVendorsTitle}>🛵 Highest Earnings</Text>
          {analytics.topRidersByEarnings.map((rider, index) => (
            <View key={index} style={styles.vendorRankItem}>
              <View style={styles.vendorRankLeft}>
                <Text style={styles.vendorRank}>#{index + 1}</Text>
                <Text style={styles.vendorName}>{rider.name}</Text>
              </View>
              <Text style={styles.vendorRatingText}>{formatCurrency(rider.earnings)}</Text>
            </View>
          ))}
          {analytics.topRidersByEarnings.length === 0 && (
            <Text style={styles.emptyText}>No rider earnings yet</Text>
          )}
        </View>

        {/* ===== STATS SUMMARY ===== */}
        <View style={styles.statsSummary}>
          <View style={styles.statSummaryItem}>
            <Text style={styles.statSummaryLabel}>Vendors</Text>
            <Text style={styles.statSummaryValue}>{analytics.totalVendors}</Text>
            <View style={styles.statSummaryBadges}>
              <Text style={[styles.statBadge, styles.approvedBadge]}>✓ {analytics.approvedVendors}</Text>
              <Text style={[styles.statBadge, styles.pendingBadge]}>⏳ {analytics.pendingVendors}</Text>
              <Text style={[styles.statBadge, styles.suspendedBadge]}>⚠️ {analytics.suspendedVendors}</Text>
            </View>
          </View>
          <View style={styles.statSummaryItem}>
            <Text style={styles.statSummaryLabel}>Users</Text>
            <Text style={styles.statSummaryValue}>{analytics.totalUsers}</Text>
            <View style={styles.statSummaryBadges}>
              <Text style={[styles.statBadge, styles.customerBadge]}>👤 {analytics.totalCustomers}</Text>
              <Text style={[styles.statBadge, styles.riderBadge]}>🛵 {analytics.totalRiders}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeRangeChipActive: {
    backgroundColor: `${colors.primary}20`,
    borderColor: colors.primary,
  },
  timeRangeChipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  timeRangeChipTextActive: {
    color: colors.primary,
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
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricCardHighlight: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  metricSubtext: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metricSubtextText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  topVendorsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topVendorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
  },
  vendorRankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  vendorRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  vendorRank: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 30,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  vendorStats: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  vendorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vendorRatingText: {
    fontSize: 12,
    color: colors.warning,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  statsSummary: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  statSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  statSummaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  statSummaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  statBadge: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  approvedBadge: {
    backgroundColor: `${colors.success}20`,
    color: colors.success,
  },
  pendingBadge: {
    backgroundColor: `${colors.warning}20`,
    color: colors.warning,
  },
  suspendedBadge: {
    backgroundColor: `${colors.danger}20`,
    color: colors.danger,
  },
  customerBadge: {
    backgroundColor: `${colors.primary}20`,
    color: colors.primary,
  },
  riderBadge: {
    backgroundColor: `${colors.info}20`,
    color: colors.info,
  },
});