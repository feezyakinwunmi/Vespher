// app/screens/vendor/VendorEarningsScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useVendorEarnings } from '../../hooks/vendor/useVendorEarnings';
import { PayoutModal } from '../../components/vendor/PayoutModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { supabase } from '../../lib/supabase';

type FilterType = 'all' | 'order' | 'payout';
type DateRangeType = 'all' | 'today' | 'week' | 'month' | 'custom';

// ✅ Interface for order details (for receipt)
interface OrderDetails {
  id: string;
  order_number?: string;
  subtotal: number;
  total: number;
  delivery_fee: number;
  discount: number;
  platform_commission?: number;
  flutterwave_fee?: number;
  vat_on_fee?: number;
  stamp_duty?: number;
  vendor_payout?: number;
  customer_name?: string;
  created_at: string;
  payment_method?: string;
  payment_status?: string;
  // Discount details - all optional
  first_order_discount?: number;
  promo_code?: string | null;
  promo_discount?: number;
  discount_type?: string | null;
}

// ✅ Receipt Modal Component
// ✅ Receipt Modal Component
function ReceiptModal({ 
  visible, 
  onClose, 
  transaction,
  orderDetails 
}: { 
  visible: boolean; 
  onClose: () => void; 
  transaction: any;
  orderDetails?: OrderDetails | null;
}) {
  if (!transaction) return null;

  // For order transactions, use orderDetails if available
  const isOrder = transaction.type === 'order';
  
  // Calculate breakdown with proper null checks
  const subtotal = orderDetails?.subtotal || 0;
  const discount = orderDetails?.discount || 0;
  const deliveryFee = orderDetails?.delivery_fee || 0;
  const platformCommission = orderDetails?.platform_commission || Math.round(subtotal * 0.1);
  const flutterwaveFee = orderDetails?.flutterwave_fee || Math.round(subtotal * 0.02);
  const vatOnFee = orderDetails?.vat_on_fee || Math.round(flutterwaveFee * 0.075);
  const stampDuty = orderDetails?.stamp_duty || (subtotal >= 10000 ? 50 : 0);
  const netPayout = orderDetails?.vendor_payout || transaction.amount;
  
  // ✅ Discount details with safe access
  const firstOrderDiscount = orderDetails?.first_order_discount || 0;
  const promoDiscount = orderDetails?.promo_discount || 0;
  const promoCode = orderDetails?.promo_code;
  const discountType = orderDetails?.discount_type;
  const totalDiscount = discount || firstOrderDiscount + promoDiscount;

  const getStatusColor = (status?: string) => {
    switch(status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
      case 'paid':
        return '#10b981';
      case 'pending':
      case 'processing':
        return '#f59e0b';
      case 'failed':
      case 'cancelled':
        return '#ef4444';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch(status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
      case 'paid':
        return 'check-circle';
      case 'pending':
      case 'processing':
        return 'clock';
      case 'failed':
      case 'cancelled':
        return 'x-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const paymentStatus = transaction.status || 
                       (isOrder ? 'delivered' : transaction.status) || 
                       'completed';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.receiptModal}>
          {/* Header */}
          <View style={styles.receiptHeader}>
            <TouchableOpacity onPress={onClose} style={styles.receiptCloseButton}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.receiptTitle}>Payment Receipt</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.receiptBody}>
            {/* Logo/Brand */}
            <View style={styles.receiptBrand}>
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                style={styles.receiptLogo}
              >
                <Text style={styles.receiptLogoText}>V</Text>
              </LinearGradient>
              <Text style={styles.receiptBrandName}>Vespher</Text>
            </View>

            {/* Status Badge */}
            <View style={[styles.receiptStatusBadge, { backgroundColor: `${getStatusColor(paymentStatus)}20` }]}>
              <Feather 
                name={getStatusIcon(paymentStatus)} 
                size={16} 
                color={getStatusColor(paymentStatus)} 
              />
              <Text style={[styles.receiptStatusText, { color: getStatusColor(paymentStatus) }]}>
                {paymentStatus.toUpperCase()}
              </Text>
            </View>

            {/* Amount */}
            <View style={styles.receiptAmountSection}>
              <Text style={styles.receiptAmountLabel}>Amount</Text>
              <Text style={styles.receiptAmount}>
                ₦{Math.abs(transaction.amount).toLocaleString()}
              </Text>
              {transaction.amount < 0 && (
                <Text style={styles.receiptAmountNote}>(Withdrawal)</Text>
              )}
            </View>

            {/* Transaction Details */}
            <View style={styles.receiptDetailsSection}>
              <Text style={styles.receiptDetailsTitle}>Transaction Details</Text>
              
              <View style={styles.receiptDetailRow}>
                <Text style={styles.receiptDetailLabel}>Reference</Text>
                <Text style={styles.receiptDetailValue}>
                  {transaction.reference || transaction.id || 'N/A'}
                </Text>
              </View>

              <View style={styles.receiptDetailRow}>
                <Text style={styles.receiptDetailLabel}>Date</Text>
                <Text style={styles.receiptDetailValue}>
                  {formatDate(transaction.date)}
                </Text>
              </View>

              <View style={styles.receiptDetailRow}>
                <Text style={styles.receiptDetailLabel}>Type</Text>
                <Text style={styles.receiptDetailValue}>
                  {transaction.type === 'order' ? 'Order Payment' : 
                   transaction.type === 'payout' ? 'Withdrawal' : 
                   transaction.type || 'Transaction'}
                </Text>
              </View>

              {isOrder && (
                <>
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Order #</Text>
                    <Text style={styles.receiptDetailValue}>
                      {orderDetails?.order_number || transaction.order_id?.slice(0, 8) || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Customer</Text>
                    <Text style={styles.receiptDetailValue}>
                      {orderDetails?.customer_name || 'Customer'}
                    </Text>
                  </View>

                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Payment Method</Text>
                    <Text style={styles.receiptDetailValue}>
                      {orderDetails?.payment_method || 'Card'}
                    </Text>
                  </View>
                </>
              )}

              {transaction.type === 'payout' && (
                <>
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Bank</Text>
                    <Text style={styles.receiptDetailValue}>
                      {transaction.bank_name || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Account</Text>
                    <Text style={styles.receiptDetailValue}>
                      ••••{transaction.account_number?.slice(-4) || 'N/A'}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Earnings Breakdown (for orders) */}
            {isOrder && (
              <View style={styles.receiptBreakdownSection}>
                <Text style={styles.receiptBreakdownTitle}>Earnings Breakdown</Text>
                
                {/* Subtotal */}
                <View style={styles.receiptBreakdownRow}>
                  <Text style={styles.receiptBreakdownLabel}>Subtotal</Text>
                  <Text style={styles.receiptBreakdownValue}>
                    ₦{subtotal.toLocaleString()}
                  </Text>
                </View>

                {/* ✅ Discount Section - Show if discount exists */}
                {(firstOrderDiscount > 0 || promoDiscount > 0 || totalDiscount > 0) && (
                  <>
                    {/* First Order Discount */}
                    {firstOrderDiscount > 0 && (
                      <View style={styles.receiptBreakdownRow}>
                        <Text style={[styles.receiptBreakdownLabel, styles.discountLabel]}>
                          🎉 First Order Discount (20%)
                        </Text>
                        <Text style={[styles.receiptBreakdownValue, styles.receiptDeduction]}>
                          -₦{firstOrderDiscount.toLocaleString()}
                        </Text>
                      </View>
                    )}

                    {/* Promo Code Discount */}
                    {promoDiscount > 0 && promoCode && (
                      <View style={styles.receiptBreakdownRow}>
                        <Text style={[styles.receiptBreakdownLabel, styles.discountLabel]}>
                          🏷️ Promo: {promoCode}
                          {discountType === 'percentage' && ` (${Math.round((promoDiscount / subtotal) * 100)}%)`}
                        </Text>
                        <Text style={[styles.receiptBreakdownValue, styles.receiptDeduction]}>
                          -₦{promoDiscount.toLocaleString()}
                        </Text>
                      </View>
                    )}

                    {/* Total Discount Separator (if multiple discounts) */}
                    {(firstOrderDiscount > 0 && promoDiscount > 0) && (
                      <View style={styles.discountSeparator}>
                        <View style={styles.receiptBreakdownRow}>
                          <Text style={styles.receiptBreakdownLabel}>Total Discount</Text>
                          <Text style={[styles.receiptBreakdownValue, styles.receiptDeduction]}>
                            -₦{totalDiscount.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* Food Total after discount */}
                <View style={styles.receiptBreakdownRow}>
                  <Text style={styles.receiptBreakdownLabel}>Food Total (after discount)</Text>
                  <Text style={styles.receiptBreakdownValue}>
                    ₦{(subtotal - totalDiscount).toLocaleString()}
                  </Text>
                </View>

                {/* Platform Commission */}
                <View style={styles.receiptBreakdownRow}>
                  <Text style={styles.receiptBreakdownLabel}>Platform Commission (10%)</Text>
                  <Text style={[styles.receiptBreakdownValue, styles.receiptDeduction]}>
                    -₦{platformCommission.toLocaleString()}
                  </Text>
                </View>

                {/* Delivery Fee */}
                {deliveryFee > 0 && (
                  <View style={styles.receiptBreakdownRow}>
                    <Text style={styles.receiptBreakdownLabel}>Delivery Fee</Text>
                    <Text style={styles.receiptBreakdownValue}>
                      +₦{deliveryFee.toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Flutterwave Fee */}
                <View style={styles.receiptBreakdownRow}>
                  <Text style={styles.receiptBreakdownLabel}>Flutterwave Fee (2%)</Text>
                  <Text style={[styles.receiptBreakdownValue, styles.receiptDeduction]}>
                    -₦{flutterwaveFee.toLocaleString()}
                  </Text>
                </View>

                {/* VAT on Fee */}
                <View style={styles.receiptBreakdownRow}>
                  <Text style={styles.receiptBreakdownLabel}>VAT on Fee (7.5%)</Text>
                  <Text style={[styles.receiptBreakdownValue, styles.receiptDeduction]}>
                    -₦{vatOnFee.toLocaleString()}
                  </Text>
                </View>

                {/* Stamp Duty */}
                {stampDuty > 0 && (
                  <View style={styles.receiptBreakdownRow}>
                    <Text style={styles.receiptBreakdownLabel}>Stamp Duty</Text>
                    <Text style={[styles.receiptBreakdownValue, styles.receiptDeduction]}>
                      -₦{stampDuty.toLocaleString()}
                    </Text>
                  </View>
                )}

                <View style={styles.receiptDivider} />

                <View style={[styles.receiptBreakdownRow, styles.receiptNetRow]}>
                  <Text style={styles.receiptNetLabel}>Net Payout</Text>
                  <Text style={styles.receiptNetValue}>
                    ₦{netPayout.toLocaleString()}
                  </Text>
                </View>

                {/* Discount Summary Note */}
                {(firstOrderDiscount > 0 || promoDiscount > 0) && (
                  <View style={styles.discountNote}>
                    <Feather name="info" size={12} color="#f97316" />
                    <Text style={styles.discountNoteText}>
                      {firstOrderDiscount > 0 && '🎉 First order discount applied • '}
                      {promoDiscount > 0 && `🏷️ Promo code "${promoCode}" applied`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Footer Note */}
            <View style={styles.receiptFooter}>
              <Feather name="info" size={14} color="#f97316" />
              <Text style={styles.receiptFooterText}>
                {isOrder 
                  ? 'Funds will be available for withdrawal within 1-2 business days'
                  : transaction.status === 'pending'
                  ? 'Withdrawal is being processed'
                  : transaction.status === 'completed'
                  ? 'Funds have been sent to your bank account'
                  : 'Thank you for using Vespher'}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.receiptActions}>
              <TouchableOpacity style={styles.receiptAction}>
                <Feather name="share-2" size={18} color="#f97316" />
                <Text style={styles.receiptActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function VendorEarningsScreen() {
  const navigation = useNavigation();
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [dateRange, setDateRange] = useState<DateRangeType>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // ✅ Receipt modal states
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  const { 
    earnings, 
    transactions, 
    isLoading, 
    refreshData,
    requestPayout 
  } = useVendorEarnings();

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // ✅ Fetch order details for receipt
 // ✅ Fetch order details for receipt
// ✅ Fetch order details for receipt
const fetchOrderDetails = async (orderId: string) => {
  setLoadingOrderDetails(true);
  try {
    // First get the order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        subtotal,
        total,
        delivery_fee,
        discount,
        platform_commission,
        flutterwave_fee,
        vat_on_fee,
        stamp_duty,
        vendor_payout,
        customer_name,
        created_at,
        payment_method,
        payment_status
      `)
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    // ✅ Fetch first order discount if applied (single object)
    const { data: firstOrderDiscount } = await supabase
      .from('first_order_discounts')
      .select('discount_amount, applied_at')
      .eq('order_id', orderId)
      .maybeSingle(); // Use maybeSingle() instead of single()

    // ✅ Fetch promo code usage if applied (array)
    const { data: promoUsage } = await supabase
      .from('promo_code_usage')
      .select(`
        discount_amount,
        promo_code:promo_code_id (
          code,
          discount_type,
          discount_value
        )
      `)
      .eq('order_id', orderId)
      .maybeSingle(); // Use maybeSingle() since there should be at most one promo per order

    // ✅ Safe access to promo data
    let promoCode = null;
    let promoDiscount = 0;
    let discountType = null;
    
    if (promoUsage && promoUsage.promo_code) {
      // If promo_code is an array, take the first element
      const promoData = Array.isArray(promoUsage.promo_code) 
        ? promoUsage.promo_code[0] 
        : promoUsage.promo_code;
      
      promoCode = promoData?.code;
      discountType = promoData?.discount_type;
      promoDiscount = promoUsage.discount_amount || 0;
    }

    setOrderDetails({
      ...order,
      first_order_discount: firstOrderDiscount?.discount_amount || 0,
      promo_code: promoCode,
      promo_discount: promoDiscount,
      discount_type: discountType,
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
  } finally {
    setLoadingOrderDetails(false);
  }
};

  // ✅ Handle transaction press
  const handleTransactionPress = async (txn: any) => {
    setSelectedTransaction(txn);
    
    if (txn.type === 'order' && txn.order_id) {
      await fetchOrderDetails(txn.order_id);
    } else {
      setOrderDetails(null);
    }
    
    setShowReceipt(true);
  };

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.setHours(0, 0, 0, 0));
      
      if (dateRange === 'today') {
        filtered = filtered.filter(t => {
          const txDate = new Date(t.date);
          return txDate >= today;
        });
      } else if (dateRange === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(t => new Date(t.date) >= weekAgo);
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter(t => new Date(t.date) >= monthAgo);
      } else if (dateRange === 'custom' && customStartDate && customEndDate) {
        filtered = filtered.filter(t => {
          const txDate = new Date(t.date);
          return txDate >= customStartDate && txDate <= customEndDate;
        });
      }
    }

    // Search by ID
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [transactions, filterType, dateRange, searchQuery, customStartDate, customEndDate]);

  const getDateRangeText = () => {
    switch (dateRange) {
      case 'today': return 'Today';
      case 'week': return 'Last 7 days';
      case 'month': return 'Last 30 days';
      case 'custom': 
        if (customStartDate && customEndDate) {
          return `${customStartDate.toLocaleDateString()} - ${customEndDate.toLocaleDateString()}`;
        }
        return 'Custom Range';
      default: return 'All Time';
    }
  };

  const getStatusColor = (status?: string) => {
    switch(status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return '#10b981';
      case 'pending':
      case 'processing':
        return '#f59e0b';
      case 'failed':
      case 'cancelled':
        return '#ef4444';
      default:
        return '#666';
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!earnings) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load earnings data</Text>
        <TouchableOpacity onPress={refreshData} style={styles.retryButton}>
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
        <Text style={styles.headerTitle}>Earnings</Text>
        <TouchableOpacity onPress={refreshData} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {/* Total Earnings Card */}
        <LinearGradient
          colors={['#f97316', '#f43f5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.totalCard}
        >
          <Text style={styles.totalLabel}>Total Earnings (All Time)</Text>
          <Text style={styles.totalValue}>₦{earnings.totalEarnings.toLocaleString()}</Text>
          <View style={styles.weeklyRow}>
            {/* <Text style={styles.weeklyText}>
              This week: ₦{earnings.weeklyEarnings.toLocaleString()}
            </Text> */}
            <View style={styles.growthBadge}>
              <Feather 
                name="trending-up" 
                size={12} 
                color={earnings.weeklyGrowth >= 0 ? '#10b981' : '#ef4444'} 
              />
              <Text style={[
                styles.growthText,
                { color: earnings.weeklyGrowth >= 0 ? '#10b981' : '#ef4444' }
              ]}>
                {earnings.weeklyGrowth > 0 ? '+' : ''}{earnings.weeklyGrowth}%
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Orders</Text>
            <Text style={styles.statValue}>{earnings.orderCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg. Order</Text>
            <Text style={styles.statValue}>₦{earnings.averageOrderValue.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Rating</Text>
            <Text style={styles.statValue}>{earnings.rating.toFixed(1)}</Text>
            <Text style={styles.statSubtext}>{earnings.reviewCount} reviews</Text>
          </View>
           <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>
              ₦{earnings.pendingPayout.toLocaleString()}
            </Text>
          </View> 
        </View>

         <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Available for Payout</Text>
              <Text style={styles.balanceValue}>₦{earnings.availableBalance.toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowPayoutModal(true)}
              disabled={earnings.availableBalance < 1000}
              style={[
                styles.withdrawButton,
                earnings.availableBalance < 1000 && styles.withdrawButtonDisabled
              ]}
            >
              <Text style={styles.withdrawButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.payoutInfo}>
            <Feather name="clock" size={12} color="#666" />
            <Text style={styles.payoutInfoText}>
              Payouts are processed within 1-2 business days
            </Text>
          </View>
        </View> 

        {/* Transactions Section with Search and Filters */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Transactions</Text>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by ID or type..."
              placeholderTextColor="#666"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={16} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Row */}
          <View style={styles.filterRow}>
            {/* Type Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeFilters}>
              <View style={styles.filterChips}>
                <TouchableOpacity
                  onPress={() => setFilterType('all')}
                  style={[styles.filterChip, filterType === 'all' && styles.activeFilterChip]}
                >
                  <Text style={[styles.filterChipText, filterType === 'all' && styles.activeFilterChipText]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilterType('order')}
                  style={[styles.filterChip, filterType === 'order' && styles.activeFilterChip]}
                >
                  <Feather name="shopping-bag" size={12} color={filterType === 'order' ? '#fff' : '#666'} />
                  <Text style={[styles.filterChipText, filterType === 'order' && styles.activeFilterChipText]}>
                    Orders
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilterType('payout')}
                  style={[styles.filterChip, filterType === 'payout' && styles.activeFilterChip]}
                >
                  <Feather name="credit-card" size={12} color={filterType === 'payout' ? '#fff' : '#666'} />
                  <Text style={[styles.filterChipText, filterType === 'payout' && styles.activeFilterChipText]}>
                    Payouts
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Date Filter Button */}
            <TouchableOpacity 
              style={styles.dateFilterButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Feather name="calendar" size={16} color="#f97316" />
              <Text style={styles.dateFilterText} numberOfLines={1}>
                {getDateRangeText()}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Results Count */}
          <View style={styles.resultsCount}>
            <Text style={styles.resultsText}>
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </Text>
            {(filterType !== 'all' || dateRange !== 'all' || searchQuery) && (
              <TouchableOpacity 
                onPress={() => {
                  setFilterType('all');
                  setDateRange('all');
                  setSearchQuery('');
                  setCustomStartDate(null);
                  setCustomEndDate(null);
                }}
              >
                <Text style={styles.clearFilters}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Transactions List */}
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <Feather name="list" size={32} color="#666" />
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          ) : (
            filteredTransactions.map((txn) => (
              <TouchableOpacity
                key={txn.id}
                style={styles.transactionCard}
                onPress={() => handleTransactionPress(txn)}
              >
                <View style={styles.transactionLeft}>
                  <View style={styles.transactionIcon}>
                    <Feather 
                      name={txn.type === 'order' ? 'shopping-bag' : 'credit-card'} 
                      size={16} 
                      color={txn.type === 'order' ? '#f97316' : '#8b5cf6'} 
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionType}>
                      {txn.type === 'order' ? 'Order Payment' : 
                       txn.type === 'payout' ? 'Withdrawal' : 'Transaction'}
                    </Text>
                    <Text style={styles.transactionId}>{txn.id.slice(0, 8)}...</Text>
                    <Text style={styles.transactionDate}>{txn.date}</Text>
                    
                    {/* Status Badge */}
                    {txn.status && (
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: `${getStatusColor(txn.status)}20` }
                      ]}>
                        <Feather 
                          name={txn.status === 'completed' || txn.status === 'delivered' ? 'check-circle' : 'clock'} 
                          size={10} 
                          color={getStatusColor(txn.status)} 
                        />
                        <Text style={[styles.statusText, { color: getStatusColor(txn.status) }]}>
                          {txn.status}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  txn.amount > 0 ? styles.positiveAmount : styles.negativeAmount
                ]}>
                  {txn.amount > 0 ? '+' : ''}{txn.amount.toLocaleString()} ₦
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Date Range Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {['all', 'today', 'week', 'month', 'custom'].map((range) => (
                <TouchableOpacity
                  key={range}
                  onPress={() => {
                    setDateRange(range as DateRangeType);
                    if (range !== 'custom') {
                      setShowDatePicker(false);
                    } else {
                      setShowStartPicker(true);
                    }
                  }}
                  style={[
                    styles.dateRangeOption,
                    dateRange === range && styles.dateRangeOptionSelected
                  ]}
                >
                  <Text style={[
                    styles.dateRangeText,
                    dateRange === range && styles.dateRangeTextSelected
                  ]}>
                    {range === 'all' ? 'All Time' :
                     range === 'today' ? 'Today' :
                     range === 'week' ? 'Last 7 Days' :
                     range === 'month' ? 'Last 30 Days' : 'Custom Range'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={customStartDate || new Date()}
          mode="date"
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) {
              setCustomStartDate(date);
              setShowEndPicker(true);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={customEndDate || new Date()}
          mode="date"
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date && customStartDate && date >= customStartDate) {
              setCustomEndDate(date);
              setDateRange('custom');
            } else {
              showToast('End date must be after start date');
            }
            setShowDatePicker(false);
          }}
        />
      )}

      {/* Payout Modal - YOUR EXISTING COMPONENT */}
      <PayoutModal
        visible={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        onSubmit={requestPayout}
        maxAmount={earnings.availableBalance}
        bankDetails={{
          bankName: earnings.bankName || '',
          accountNumber: earnings.accountNumber || '',
          accountName: earnings.accountName || '',
        }}
      />

      {/* ✅ Receipt Modal - NEW */}
      <ReceiptModal
        visible={showReceipt}
        onClose={() => {
          setShowReceipt(false);
          setSelectedTransaction(null);
          setOrderDetails(null);
        }}
        transaction={selectedTransaction}
        orderDetails={orderDetails}
      />

      {/* Loading overlay for order details */}
      {loadingOrderDetails && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingOverlayText}>Loading receipt...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({

  
  receiptModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxHeight: '90%',
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  receiptCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  receiptBody: {
    padding: 20,
  },
  receiptBrand: {
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptLogoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  receiptBrandName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  receiptStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    marginBottom: 20,
  },
  receiptStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  receiptAmountSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptAmountLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  receiptAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f97316',
  },
  receiptAmountNote: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  receiptDetailsSection: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  discountLabel: {
  color: '#10b981',
},
discountSeparator: {
  marginTop: 4,
  marginBottom: 4,
  paddingTop: 4,
  borderTopWidth: 1,
  borderTopColor: 'rgba(16,185,129,0.2)',
},
discountNote: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginTop: 12,
  padding: 10,
  backgroundColor: 'rgba(249,115,22,0.1)',
  borderRadius: 8,
},
discountNoteText: {
  fontSize: 11,
  color: '#f97316',
  flex: 1,
},
  receiptDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptDetailLabel: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  receiptDetailValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  receiptBreakdownSection: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  receiptBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  receiptBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptBreakdownLabel: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  receiptBreakdownValue: {
    fontSize: 12,
    color: '#fff',
    flex: 1,
    textAlign: 'right',
  },
  receiptDeduction: {
    color: '#f43f5e',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  receiptNetRow: {
    marginTop: 4,
  },
  receiptNetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  receiptNetValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
    flex: 1,
    textAlign: 'right',
  },
  receiptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  receiptFooterText: {
    fontSize: 11,
    color: '#f97316',
    flex: 1,
  },
  receiptActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  receiptAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  receiptActionText: {
    fontSize: 12,
    color: '#f97316',
  },
  transactionInfo: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingOverlayText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
    
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  typeFilters: {
    flex: 1,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeFilterChip: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    maxWidth: 150,
  },
  dateFilterText: {
    fontSize: 12,
    color: '#f97316',
    flex: 1,
  },
  resultsCount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
  },
  clearFilters: {
    fontSize: 12,
    color: '#f97316',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalBody: {
    gap: 8,
  },
  dateRangeOption: {
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  dateRangeOptionSelected: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  dateRangeText: {
    fontSize: 14,
    color: '#fff',
  },
  dateRangeTextSelected: {
    color: '#f97316',
  },
  // Base styles from the original
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
        paddingBottom:60,

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
  },
  totalCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weeklyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  growthText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 10,
    color: '#666',
  },
  balanceCard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f97316',
  },
  withdrawButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  withdrawButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  payoutInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  payoutInfoText: {
    fontSize: 11,
    color: '#666',
  },
  transactionsSection: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },

  emptyTransactions: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  emptyText: {
    color: '#666',
    marginTop: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionType: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  transactionId: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 10,
    color: '#666',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusCompleted: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  statusPending: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  statusFailed: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  statusText: {
    fontSize: 9,
    color: '#10b981',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  positiveAmount: {
    color: '#10b981',
  },
  negativeAmount: {
    color: '#ef4444',
  },

});


