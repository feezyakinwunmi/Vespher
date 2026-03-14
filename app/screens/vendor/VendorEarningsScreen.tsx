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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useVendorEarnings } from '../../hooks/vendor/useVendorEarnings';
import { PayoutModal } from '../../components/vendor/PayoutModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
type FilterType = 'all' | 'order' | 'payout';
type DateRangeType = 'all' | 'today' | 'week' | 'month' | 'custom';

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

  // Filter and search transactions
 const filteredTransactions = useMemo(() => {
  let filtered = [...transactions];

  // Filter by type
  if (filterType !== 'all') {
    filtered = filtered.filter(t => t.type === filterType); // Now matches: 'order' vs 'order', 'payout' vs 'payout'
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
            <Text style={styles.weeklyText}>
              This week: ₦{earnings.weeklyEarnings.toLocaleString()}
            </Text>
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

        {/* Available Balance */}
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
              <View key={txn.id} style={styles.transactionCard}>
                <View style={styles.transactionLeft}>
                  <View style={styles.transactionIcon}>
                    <Feather 
                      name={txn.type === 'order' ? 'shopping-bag' : 'credit-card'} 
                      size={16} 
                      color={txn.type === 'order' ? '#f97316' : '#8b5cf6'} 
                    />
                  </View>
                  <View>
                    <Text style={styles.transactionType}>
                      {txn.type === 'order' ? 'Order Payment' : 'Payout'}
                    </Text>
                    <Text style={styles.transactionId}>{txn.id.slice(0, 8)}...</Text>
                    <Text style={styles.transactionDate}>{txn.date}</Text>
                    {txn.status && txn.type === 'payout' && (
                      <View style={[
                        styles.statusBadge,
                        txn.status === 'completed' ? styles.statusCompleted :
                        txn.status === 'pending' ? styles.statusPending :
                        styles.statusFailed
                      ]}>
                        <Text style={styles.statusText}>{txn.status}</Text>
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
              </View>
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
              showToast( 'End date must be after start date');
            }
            setShowDatePicker(false);
          }}
        />
      )}

      {/* Payout Modal */}
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
    </SafeAreaView>
  );
}

// Add these new styles to your existing StyleSheet
const newStyles = {
    
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
  
};
// At the very bottom of VendorEarningsScreen.tsx, replace the styles section with:

const styles = StyleSheet.create({
  // Base styles from the original
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
});


