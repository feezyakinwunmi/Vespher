// app/screens/admin/OutstandingPaymentsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Share,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

type TabType = 'vendors' | 'riders';
type DetailModalType = 'vendor' | 'rider';

interface OutstandingVendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  walletBalance: number;
  totalEarned: number;
  pendingWithdrawals: number;
  completedWithdrawals: number;
  lastWithdrawalDate?: string;
}

interface OutstandingRider {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalEarnings: number;
  pendingWithdrawals: number;
  completedWithdrawals: number;
  availableBalance: number;
  lastWithdrawalDate?: string;
}

interface WithdrawalHistory {
  id: string;
  amount: number;
  status: string;
  reference: string;
  created_at: string;
  processed_at?: string;
  notes?: string;
  bank_name?: string;
  account_number?: string;
}

export function OutstandingPaymentsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>('vendors');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vendors, setVendors] = useState<OutstandingVendor[]>([]);
  const [riders, setRiders] = useState<OutstandingRider[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<DetailModalType>('vendor');
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistory[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'vendors') {
        await fetchVendorsOutstanding();
      } else {
        await fetchRidersOutstanding();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Toast.show({ type: 'error', text1: 'Failed to load data' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

const fetchVendorsOutstanding = async () => {
  try {
    // Fetch all vendors
    const { data: vendorsData } = await supabase
      .from('vendors')
      .select('id, name, email, phone, owner_id');

    // Fetch all delivered orders with vendor payouts
    const { data: ordersData } = await supabase
      .from('orders')
      .select('vendor_id, vendor_payout, status')
      .eq('status', 'delivered');

    // Fetch ALL withdrawals for vendors
    const { data: withdrawalsData } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_type', 'vendor');

    // Fetch ALL wallets for vendors
    const { data: walletsData } = await supabase
      .from('vendor_wallets')
      .select('*');

    console.log('All withdrawals:', withdrawalsData);
    console.log('All wallets:', walletsData);
    console.log('Vendors:', vendorsData);

    const vendorWithdrawals = withdrawalsData || [];
    const vendorWallets = walletsData || [];
    
    // Calculate total earnings per vendor from orders
    const vendorEarningsMap = new Map<string, number>();
    ordersData?.forEach(order => {
      const vendorId = order.vendor_id;
      const payout = typeof order.vendor_payout === 'string' 
        ? parseFloat(order.vendor_payout) 
        : (Number(order.vendor_payout) || 0);
      
      vendorEarningsMap.set(vendorId, (vendorEarningsMap.get(vendorId) || 0) + payout);
    });

    const vendorsWithOutstanding: OutstandingVendor[] = [];

    for (const vendor of vendorsData || []) {
      // Find or create wallet for this vendor
      let wallet = vendorWallets.find(w => w.vendor_id === vendor.id);
      
      // If no wallet exists, calculate earnings and create one
      const totalEarned = vendorEarningsMap.get(vendor.id) || 0;
      
      if (!wallet && totalEarned > 0) {
        // Create wallet for this vendor
        const { data: newWallet, error: createError } = await supabase
          .from('vendor_wallets')
          .insert({
            vendor_id: vendor.id,
            balance: totalEarned,
            total_earned: totalEarned,
            pending_balance: 0,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (!createError && newWallet) {
          wallet = newWallet;
          console.log(`✅ Created wallet for ${vendor.name} with balance ₦${totalEarned}`);
        }
      }
      
      // Get withdrawals for this vendor using owner_id
      const vendorWithdrawalsList = vendorWithdrawals.filter((w: any) => w.user_id === vendor.owner_id);
      
      // Calculate completed withdrawals (money already sent)
      const completedWithdrawals = vendorWithdrawalsList
        .filter((w: any) => w.status === 'completed')
        .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);
      
      // Calculate pending withdrawals (including processing)
      const pendingWithdrawals = vendorWithdrawalsList
        .filter((w: any) => w.status === 'pending' || w.status === 'processing')
        .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);
      
      // Wallet balance (available to withdraw)
      const walletBalance = wallet ? Number(wallet.balance) : 0;
      
      // Total earned from wallet
      const totalFromWallet = wallet ? Number(wallet.total_earned) : totalEarned;
      
      const lastWithdrawal = vendorWithdrawalsList
        .filter((w: any) => w.status === 'completed')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      console.log(`Vendor ${vendor.name}:`, {
        totalEarned: totalFromWallet,
        walletBalance: walletBalance,
        completedWithdrawals,
        pendingWithdrawals,
        withdrawalsList: vendorWithdrawalsList
      });
      
      // Only show vendors with outstanding money
      if (walletBalance > 0 || pendingWithdrawals > 0) {
        vendorsWithOutstanding.push({
          id: vendor.id,
          name: vendor.name || 'Unknown Vendor',
          email: vendor.email || '',
          phone: vendor.phone || '',
          walletBalance: walletBalance,           // Available to withdraw
          totalEarned: totalFromWallet,            // All time earnings
          pendingWithdrawals: pendingWithdrawals,  // In progress
          completedWithdrawals: completedWithdrawals,
          lastWithdrawalDate: lastWithdrawal?.created_at,
        });
      }
    }

    console.log('Vendors with outstanding:', vendorsWithOutstanding);
    setVendors(vendorsWithOutstanding);
  } catch (error) {
    console.error('Error fetching vendors:', error);
  }
};

const fetchRidersOutstanding = async () => {
  try {
    // Fetch all riders (users with role 'rider')
    const { data: ridersData } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('role', 'rider');

    // Fetch rider earnings from delivered orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('rider_id, rider_earnings, status')
      .eq('status', 'delivered')
      .not('rider_id', 'is', null);

    // Fetch ALL withdrawals for riders
    const { data: withdrawalsData } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_type', 'rider');

    console.log('Riders:', ridersData);
    console.log('Rider withdrawals:', withdrawalsData);
    console.log('Rider earnings from orders:', ordersData);

    const riderWithdrawals = withdrawalsData || [];
    
    // Calculate total earnings per rider from orders
    const riderEarningsMap = new Map<string, number>();
    ordersData?.forEach(order => {
      const riderId = order.rider_id;
      const earnings = typeof order.rider_earnings === 'string' 
        ? parseFloat(order.rider_earnings) 
        : (Number(order.rider_earnings) || 0);
      
      riderEarningsMap.set(riderId, (riderEarningsMap.get(riderId) || 0) + earnings);
    });

    const ridersWithOutstanding: OutstandingRider[] = [];

    for (const rider of ridersData || []) {
      const totalEarnings = riderEarningsMap.get(rider.id) || 0;
      
      // Get withdrawals for this rider
      const riderWithdrawalsList = riderWithdrawals.filter((w: any) => w.user_id === rider.id);
      
      // Calculate completed withdrawals
      const completedWithdrawals = riderWithdrawalsList
        .filter((w: any) => w.status === 'completed')
        .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);
      
      // Calculate pending withdrawals
      const pendingWithdrawals = riderWithdrawalsList
        .filter((w: any) => w.status === 'pending' || w.status === 'processing')
        .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);
      
      // Available balance = total earnings - completed - pending
      const availableBalance = totalEarnings - completedWithdrawals - pendingWithdrawals;
      
      const lastWithdrawal = riderWithdrawalsList
        .filter((w: any) => w.status === 'completed')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      console.log(`Rider ${rider.name}:`, {
        totalEarnings,
        availableBalance,
        completedWithdrawals,
        pendingWithdrawals,
        withdrawalsList: riderWithdrawalsList
      });
      
      // Only show riders with outstanding balance
      if (availableBalance > 0 || pendingWithdrawals > 0) {
        ridersWithOutstanding.push({
          id: rider.id,
          name: rider.name || 'Unknown Rider',
          email: rider.email || '',
          phone: rider.phone || '',
          totalEarnings,
          availableBalance,
          pendingWithdrawals,
          completedWithdrawals,
          lastWithdrawalDate: lastWithdrawal?.created_at,
        });
      }
    }

    console.log('Riders with outstanding:', ridersWithOutstanding);
    setRiders(ridersWithOutstanding);
  } catch (error) {
    console.error('Error fetching riders:', error);
  }
};

const fetchWithdrawalHistory = async (userId: string, userType: 'vendor' | 'rider') => {
  setLoadingHistory(true);
  try {
    // First get the vendor to get owner_id if needed
    let finalUserId = userId;
    
    if (userType === 'vendor') {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('owner_id')
        .eq('id', userId)
        .single();
      
      if (vendor) {
        finalUserId = vendor.owner_id;
      }
    }
    
    const { data } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', finalUserId)
      .eq('user_type', userType)
      .order('created_at', { ascending: false });

    console.log('Withdrawal history for user:', finalUserId, data);
    setWithdrawalHistory(data || []);
  } catch (error) {
    console.error('Error fetching history:', error);
  } finally {
    setLoadingHistory(false);
  }
};

  const handleViewHistory = async (user: any, type: DetailModalType) => {
    setSelectedUser(user);
    setSelectedType(type);
    await fetchWithdrawalHistory(user.id, type === 'vendor' ? 'vendor' : 'rider');
    setShowHistoryModal(true);
  };

  const handleShareHistory = async () => {
    if (!selectedUser) return;
    
    const historyText = withdrawalHistory.map(w => {
      const date = new Date(w.created_at).toLocaleDateString();
      const amount = `₦${(Number(w.amount) || 0).toLocaleString()}`;
      const status = (w.status || 'unknown').toUpperCase();
      return `${date} - ${amount} - ${status} - Ref: ${w.reference}`;
    }).join('\n');
    
    const summary = `
=== ${selectedType === 'vendor' ? 'VENDOR' : 'RIDER'} WITHDRAWAL HISTORY ===
Name: ${selectedUser.name}
Email: ${selectedUser.email}
${selectedType === 'vendor' ? `Total Earned: ₦${(selectedUser.totalEarned || 0).toLocaleString()}
Available Balance: ₦${(selectedUser.walletBalance || 0).toLocaleString()}
Pending Withdrawals: ₦${(selectedUser.pendingWithdrawals || 0).toLocaleString()}` : `Total Earnings: ₦${(selectedUser.totalEarnings || 0).toLocaleString()}
Available Balance: ₦${(selectedUser.availableBalance || 0).toLocaleString()}
Pending Withdrawals: ₦${(selectedUser.pendingWithdrawals || 0).toLocaleString()}`}

=== WITHDRAWAL HISTORY ===
${historyText || 'No withdrawal history found.'}

Generated: ${new Date().toLocaleString()}
    `;
    
    try {
      await Share.share({
        message: summary,
        title: `${selectedType === 'vendor' ? 'Vendor' : 'Rider'} Withdrawal History`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getTotalVendorOutstanding = () => {
    return vendors.reduce((sum: number, v: OutstandingVendor) => sum + v.walletBalance, 0);
  };

  const getTotalRiderOutstanding = () => {
    return riders.reduce((sum: number, r: OutstandingRider) => sum + r.availableBalance, 0);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading outstanding payments...</Text>
      </View>
    );
  }

  const totalVendorOutstanding = getTotalVendorOutstanding();
  const totalRiderOutstanding = getTotalRiderOutstanding();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Outstanding Payments</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            style={styles.summaryGradient}
          >
            <Text style={styles.summaryLabel}>Total Vendor Outstanding</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalVendorOutstanding)}</Text>
            <Text style={styles.summarySubtext}>{vendors.length} vendors with pending balance</Text>
          </LinearGradient>
        </View>

        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#3b82f6', '#8b5cf6']}
            style={styles.summaryGradient}
          >
            <Text style={styles.summaryLabel}>Total Rider Outstanding</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalRiderOutstanding)}</Text>
            <Text style={styles.summarySubtext}>{riders.length} riders with pending balance</Text>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vendors' && styles.tabActive]}
          onPress={() => setActiveTab('vendors')}
        >
          <Feather name="home" size={18} color={activeTab === 'vendors' ? '#f97316' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'vendors' && styles.tabTextActive]}>
            Vendors
          </Text>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{vendors.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'riders' && styles.tabActive]}
          onPress={() => setActiveTab('riders')}
        >
          <Feather name="truck" size={18} color={activeTab === 'riders' ? '#f97316' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'riders' && styles.tabTextActive]}>
            Riders
          </Text>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{riders.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {activeTab === 'vendors' ? (
          vendors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="check-circle" size={48} color="#10b981" />
              <Text style={styles.emptyTitle}>No Outstanding Vendors</Text>
              <Text style={styles.emptyText}>All vendors have been paid out</Text>
            </View>
          ) : (
            vendors.map((vendor) => (
              <TouchableOpacity
                key={vendor.id}
                style={styles.listItem}
                onPress={() => handleViewHistory(vendor, 'vendor')}
              >
                <View style={styles.listItemLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{vendor.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.listItemName}>{vendor.name}</Text>
                    <Text style={styles.listItemEmail}>{vendor.email}</Text>
                  </View>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemAmount}>{formatCurrency(vendor.walletBalance)}</Text>
                  <Text style={styles.listItemSubtext}>Available</Text>
                  {vendor.pendingWithdrawals > 0 && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending: {formatCurrency(vendor.pendingWithdrawals)}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          riders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="check-circle" size={48} color="#10b981" />
              <Text style={styles.emptyTitle}>No Outstanding Riders</Text>
              <Text style={styles.emptyText}>All riders have been paid out</Text>
            </View>
          ) : (
            riders.map((rider) => (
              <TouchableOpacity
                key={rider.id}
                style={styles.listItem}
                onPress={() => handleViewHistory(rider, 'rider')}
              >
                <View style={styles.listItemLeft}>
                  <View style={[styles.avatar, styles.riderAvatar]}>
                    <Text style={styles.avatarText}>{rider.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.listItemName}>{rider.name}</Text>
                    <Text style={styles.listItemEmail}>{rider.email}</Text>
                  </View>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemAmount}>{formatCurrency(rider.availableBalance)}</Text>
                  <Text style={styles.listItemSubtext}>Available</Text>
                  {rider.pendingWithdrawals > 0 && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending: {formatCurrency(rider.pendingWithdrawals)}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedType === 'vendor' ? 'Vendor' : 'Rider'} Withdrawal History
              </Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

         {selectedUser && (
  <View style={styles.modalUserInfo}>
    <Text style={styles.modalUserName}>{selectedUser.name}</Text>
    <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
    
    <View style={styles.modalStatsRow}>
      <View style={styles.modalStat}>
        <Text style={styles.modalStatLabel}>Total Earned</Text>
        <Text style={styles.modalStatValue}>
          {formatCurrency(selectedUser.totalEarned)}
        </Text>
      </View>
      <View style={styles.modalStat}>
        <Text style={styles.modalStatLabel}>Available Balance</Text>
        <Text style={[styles.modalStatValue, { color: '#10b981' }]}>
          {formatCurrency(selectedUser.walletBalance)}
        </Text>
      </View>
      <View style={styles.modalStat}>
        <Text style={styles.modalStatLabel}>Pending Withdrawal</Text>
        <Text style={[styles.modalStatValue, { color: '#f59e0b' }]}>
          {formatCurrency(selectedUser.pendingWithdrawals)}
        </Text>
      </View>
    </View>

    {selectedUser.pendingWithdrawals > 0 && (
      <View style={styles.pendingInfoBox}>
        <Feather name="clock" size={14} color="#f59e0b" />
        <Text style={styles.pendingInfoText}>
          Pending withdrawal of {formatCurrency(selectedUser.pendingWithdrawals)} is being processed
        </Text>
      </View>
    )}

    {selectedUser.lastWithdrawalDate && (
      <Text style={styles.lastWithdrawalText}>
        Last withdrawal: {formatDate(selectedUser.lastWithdrawalDate)}
      </Text>
    )}
  </View>
)}

            <View style={styles.modalHistoryHeader}>
              <Text style={styles.modalHistoryTitle}>Transaction History</Text>
              <TouchableOpacity onPress={handleShareHistory} style={styles.shareButton}>
                <Feather name="share-2" size={16} color="#f97316" />
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <ActivityIndicator size="large" color="#f97316" style={styles.modalLoader} />
            ) : withdrawalHistory.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Feather name="inbox" size={40} color="#666" />
                <Text style={styles.modalEmptyText}>No withdrawal history</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalHistoryList}>
                {withdrawalHistory.map((item) => (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={styles.historyLeft}>
                      <View style={[
                        styles.historyIcon,
                        item.status === 'completed' ? styles.historyIconSuccess :
                        item.status === 'failed' ? styles.historyIconFailed :
                        styles.historyIconPending
                      ]}>
                        <Feather 
                          name={item.status === 'completed' ? 'check-circle' : 
                                item.status === 'failed' ? 'x-circle' : 'clock'} 
                          size={16} 
                          color={item.status === 'completed' ? '#10b981' : 
                                item.status === 'failed' ? '#ef4444' : '#f59e0b'} 
                        />
                      </View>
                      <View>
                        <Text style={styles.historyAmount}>{formatCurrency(Number(item.amount))}</Text>
                        <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                        {item.reference && (
                          <Text style={styles.historyReference}>Ref: {item.reference.slice(0, 12)}...</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.historyRight}>
                      <View style={[
                        styles.historyStatus,
                        item.status === 'completed' ? styles.historyStatusSuccess :
                        item.status === 'failed' ? styles.historyStatusFailed :
                        styles.historyStatusPending
                      ]}>
                        <Text style={[
                          styles.historyStatusText,
                          item.status === 'completed' ? styles.historyStatusTextSuccess :
                          item.status === 'failed' ? styles.historyStatusTextFailed :
                          styles.historyStatusTextPending
                        ]}>
                          {(item.status || 'unknown').toUpperCase()}
                        </Text>
                      </View>
                      {item.processed_at && (
                        <Text style={styles.historyProcessed}>
                          Processed: {formatDate(item.processed_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowHistoryModal(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    minHeight:'100%'
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
  summaryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxHeight:200,
  },
  summaryCard: {
    width: width - 48,
    minHeight:200,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    
  },
  summaryGradient: {
    padding: 20,
    height:160,
    borderRadius:15,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 0,
  },
  summarySubtext: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tabActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: '#f97316',
  },
  tabBadge: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 10,
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderAvatar: {
    backgroundColor: '#3b82f6',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  listItemEmail: {
    fontSize: 12,
    color: '#666',
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listItemAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
  },
  listItemSubtext: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  pendingBadgeText: {
    fontSize: 9,
    color: '#f59e0b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  pendingInfoBox: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: 'rgba(245,158,11,0.1)',
  padding: 10,
  borderRadius: 8,
  marginTop: 12,
},
pendingInfoText: {
  fontSize: 11,
  color: '#f59e0b',
  flex: 1,
},
  modalUserInfo: {
    padding: 16,
    backgroundColor: '#2a2a2a',
    marginBottom: 16,
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modalUserEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  modalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalStat: {
    alignItems: 'center',
    flex: 1,
  },
  modalStatLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  lastWithdrawalText: {
    fontSize: 11,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  modalHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalHistoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareButtonText: {
    fontSize: 12,
    color: '#f97316',
  },
  modalLoader: {
    padding: 40,
  },
  modalEmpty: {
    alignItems: 'center',
    padding: 40,
  },
  modalEmptyText: {
    fontSize: 13,
    color: '#666',
    marginTop: 12,
  },
  modalHistoryList: {
    maxHeight: 400,
    paddingHorizontal: 16,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyIconSuccess: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  historyIconFailed: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  historyIconPending: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  historyDate: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  historyReference: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyStatusSuccess: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  historyStatusFailed: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  historyStatusPending: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  historyStatusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  historyStatusTextSuccess: {
    color: '#10b981',
  },
  historyStatusTextFailed: {
    color: '#ef4444',
  },
  historyStatusTextPending: {
    color: '#f59e0b',
  },
  historyProcessed: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  modalCloseButton: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  modalCloseText: {
    fontSize: 14,
    color: '#fff',
  },
});