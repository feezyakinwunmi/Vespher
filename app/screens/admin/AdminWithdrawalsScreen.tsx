// app/screens/admin/AdminWithdrawalsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Toast from 'react-native-toast-message';

type WithdrawalStatus = 'all' | 'pending' | 'completed' | 'failed';

interface Withdrawal {
  id: string;
  user_id: string;
  user_type: 'vendor' | 'rider';
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reference: string;
  created_at: string;
  processed_at?: string;
  notes?: string;
  user?: {
    name: string;
    email: string;
    role: string;
    avatar_url?: string;
  };
}

export function AdminWithdrawalsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'vendor' | 'rider'>('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
   const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject';
    withdrawal: Withdrawal;
  } | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  useEffect(() => {
    filterWithdrawals();
  }, [withdrawals, searchQuery, statusFilter, userTypeFilter]);

  const fetchWithdrawals = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('withdrawals')
        .select(`
          *,
          user:user_id (
            name,
            email,
            role,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setWithdrawals(data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      showToast( 'Failed to load withdrawals');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const filterWithdrawals = () => {
    let filtered = [...withdrawals];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(w => 
        w.user?.name?.toLowerCase().includes(query) ||
        w.user?.email?.toLowerCase().includes(query) ||
        w.bank_name?.toLowerCase().includes(query) ||
        w.reference?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(w => w.status === statusFilter);
    }

    // User type filter
    if (userTypeFilter !== 'all') {
      filtered = filtered.filter(w => w.user_type === userTypeFilter);
    }

    setFilteredWithdrawals(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWithdrawals();
  };

  const handleProcessWithdrawal = async (withdrawalId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const status = action === 'approve' ? 'completed' : 'failed';
      
      const { error } = await supabase
        .from('withdrawals')
        .update({ 
          status, 
          processed_at: new Date().toISOString(),
          notes: notes || null
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      showToast( `Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      fetchWithdrawals();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      showToast( 'Failed to process withdrawal');
    }
  };

  const handleAction = (withdrawal: Withdrawal, actionType: 'approve' | 'reject') => {
    if (actionType === 'reject') {
      setSelectedWithdrawal(withdrawal);
      setRejectNotes('');
      setShowNotesModal(true);
    } else {
      setConfirmAction({ type: actionType, withdrawal });
      setShowConfirmModal(true);
    }
    setShowActionsModal(false);
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    await handleProcessWithdrawal(
      confirmAction.withdrawal.id, 
      confirmAction.type
    );

    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const executeRejectWithNotes = async () => {
    if (!selectedWithdrawal) return;

    await handleProcessWithdrawal(
      selectedWithdrawal.id, 
      'reject', 
      rejectNotes
    );

    setShowNotesModal(false);
    setSelectedWithdrawal(null);
    setRejectNotes('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'processing': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      default: return '#666';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'pending': return 'rgba(245,158,11,0.1)';
      case 'processing': return 'rgba(59,130,246,0.1)';
      case 'completed': return 'rgba(16,185,129,0.1)';
      case 'failed': return 'rgba(239,68,68,0.1)';
      default: return 'rgba(102,102,102,0.1)';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTotalPending = () => {
    return withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + w.amount, 0);
  };

  const getTotalCompleted = () => {
    return withdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + w.amount, 0);
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading withdrawals...</Text>
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
        <Text style={styles.headerTitle}>Withdrawals</Text>
        <TouchableOpacity onPress={fetchWithdrawals} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={['#f97316', '#f43f5e']}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Total Withdrawn</Text>
          <Text style={styles.statValue}>₦{getTotalCompleted().toLocaleString()}</Text>
        </LinearGradient>

        <View style={styles.statCardSecondary}>
          <Feather name="clock" size={20} color="#f59e0b" />
          <Text style={styles.statNumber}>₦{getTotalPending().toLocaleString()}</Text>
          <Text style={styles.statLabelSmall}>Pending</Text>
        </View>

        <View style={styles.statCardSecondary}>
          <Feather name="check-circle" size={20} color="#10b981" />
          <Text style={styles.statNumber}>{withdrawals.filter(w => w.status === 'completed').length}</Text>
          <Text style={styles.statLabelSmall}>Completed</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, email, bank..."
          placeholderTextColor="#666"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={18} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
        <View style={styles.filterTabsContent}>
          <TouchableOpacity
            onPress={() => setUserTypeFilter('all')}
            style={[
              styles.filterTab,
              userTypeFilter === 'all' && styles.filterTabActive,
            ]}
          >
            <Text style={[
              styles.filterTabText,
              userTypeFilter === 'all' && styles.filterTabTextActive,
            ]}>All Types</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setUserTypeFilter('vendor')}
            style={[
              styles.filterTab,
              userTypeFilter === 'vendor' && styles.filterTabActive,
            ]}
          >
            <Feather name="home" size={14} color={userTypeFilter === 'vendor' ? '#f97316' : '#666'} />
            <Text style={[
              styles.filterTabText,
              userTypeFilter === 'vendor' && styles.filterTabTextActive,
            ]}>Vendors</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setUserTypeFilter('rider')}
            style={[
              styles.filterTab,
              userTypeFilter === 'rider' && styles.filterTabActive,
            ]}
          >
            <Feather name="truck" size={14} color={userTypeFilter === 'rider' ? '#f97316' : '#666'} />
            <Text style={[
              styles.filterTabText,
              userTypeFilter === 'rider' && styles.filterTabTextActive,
            ]}>Riders</Text>
          </TouchableOpacity>

          <View style={styles.filterDivider} />

          <TouchableOpacity
            onPress={() => setStatusFilter('all')}
            style={[
              styles.filterChip,
              statusFilter === 'all' && styles.filterChipActive,
            ]}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === 'all' && styles.filterChipTextActive,
            ]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStatusFilter('pending')}
            style={[
              styles.filterChip,
              statusFilter === 'pending' && styles.filterChipActive,
              { borderColor: '#f59e0b' }
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'pending' && styles.filterChipTextActive,
            ]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStatusFilter('completed')}
            style={[
              styles.filterChip,
              statusFilter === 'completed' && styles.filterChipActive,
              { borderColor: '#10b981' }
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'completed' && styles.filterChipTextActive,
            ]}>Completed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStatusFilter('failed')}
            style={[
              styles.filterChip,
              statusFilter === 'failed' && styles.filterChipActive,
              { borderColor: '#ef4444' }
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'failed' && styles.filterChipTextActive,
            ]}>Failed</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredWithdrawals.length} of {withdrawals.length} withdrawals
        </Text>
      </View>

      {/* Withdrawals List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredWithdrawals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="credit-card" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No withdrawals found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters</Text>
          </View>
        ) : (
          filteredWithdrawals.map((withdrawal) => (
            <View key={withdrawal.id} style={styles.withdrawalCard}>
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <View style={styles.avatarContainer}>
                    {withdrawal.user?.avatar_url ? (
                      <Image source={{ uri: withdrawal.user.avatar_url }} style={styles.avatar} />
                    ) : (
                      <LinearGradient
                        colors={['#f97316', '#f43f5e']}
                        style={styles.avatarPlaceholder}
                      >
                        <Text style={styles.avatarText}>
                          {withdrawal.user?.name?.charAt(0) || withdrawal.user_type.charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View>
                    <Text style={styles.userName}>{withdrawal.user?.name || 'Unknown'}</Text>
                    <View style={styles.userTypeBadge}>
                      <Feather 
                        name={withdrawal.user_type === 'vendor' ? 'home' : 'truck'} 
                        size={10} 
                        color={withdrawal.user_type === 'vendor' ? '#f97316' : '#10b981'} 
                      />
                      <Text style={[
                        styles.userTypeText,
                        { color: withdrawal.user_type === 'vendor' ? '#f97316' : '#10b981' }
                      ]}>
                        {withdrawal.user_type}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedWithdrawal(withdrawal);
                    setShowActionsModal(true);
                  }}
                  style={styles.menuButton}
                >
                  <Feather name="more-vertical" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Amount</Text>
                <Text style={styles.amount}>₦{withdrawal.amount.toLocaleString()}</Text>
              </View>

              <View style={styles.bankDetails}>
                <Feather name="credit-card" size={14} color="#666" />
                <Text style={styles.bankText}>{withdrawal.bank_name}</Text>
              </View>
              <Text style={styles.accountText}>{withdrawal.account_number} • {withdrawal.account_name}</Text>

              <View style={styles.referenceRow}>
                <Text style={styles.referenceLabel}>Ref:</Text>
                <Text style={styles.reference}>{withdrawal.reference}</Text>
              </View>

              <View style={styles.footer}>
                <View style={styles.dateContainer}>
                  <Feather name="calendar" size={12} color="#666" />
                  <Text style={styles.date}>{formatDate(withdrawal.created_at)}</Text>
                </View>

                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusBgColor(withdrawal.status) }
                ]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(withdrawal.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(withdrawal.status) }]}>
                    {withdrawal.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {withdrawal.notes && (
                <View style={styles.notesContainer}>
                  <Feather name="message-circle" size={12} color="#666" />
                  <Text style={styles.notes}>{withdrawal.notes}</Text>
                </View>
              )}

              {withdrawal.processed_at && (
                <View style={styles.processedContainer}>
                  <Feather name="check-circle" size={12} color="#10b981" />
                  <Text style={styles.processedText}>
                    Processed: {formatDate(withdrawal.processed_at)}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Actions Modal */}
      <Modal
        visible={showActionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={styles.actionsModal}>
            {selectedWithdrawal?.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => handleAction(selectedWithdrawal, 'approve')}
                >
                  <Feather name="check-circle" size={18} color="#10b981" />
                  <Text style={styles.actionText}>Approve Withdrawal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemDelete]}
                  onPress={() => handleAction(selectedWithdrawal, 'reject')}
                >
                  <Feather name="x-circle" size={18} color="#ef4444" />
                  <Text style={[styles.actionText, styles.actionTextDelete]}>Reject Withdrawal</Text>
                </TouchableOpacity>
              </>
            )}

            {selectedWithdrawal?.status !== 'pending' && (
              <View style={styles.actionInfo}>
                <Feather name="info" size={18} color="#666" />
                <Text style={styles.actionInfoText}>
                  This withdrawal is already {selectedWithdrawal?.status}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIcon}>
              <Feather name="alert-triangle" size={40} color="#f97316" />
            </View>
            
            <Text style={styles.confirmTitle}>Confirm Action</Text>
            <Text style={styles.confirmMessage}>
              {confirmAction?.type === 'approve' 
                ? `Are you sure you want to approve this withdrawal of ₦${confirmAction?.withdrawal.amount.toLocaleString()}?` 
                : `Are you sure you want to reject this withdrawal?`}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  confirmAction?.type === 'approve' ? styles.approveConfirmButton : styles.rejectConfirmButton
                ]}
                onPress={executeAction}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmAction?.type === 'approve' ? 'Approve' : 'Reject'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rejection Notes Modal */}
      <Modal
        visible={showNotesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notesModal}>
            <View style={styles.notesModalHeader}>
              <Text style={styles.notesModalTitle}>Rejection Reason</Text>
              <TouchableOpacity onPress={() => setShowNotesModal(false)}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.notesModalLabel}>
              Please provide a reason for rejecting this withdrawal
            </Text>

            <TextInput
              style={styles.notesInput}
              value={rejectNotes}
              onChangeText={setRejectNotes}
              placeholder="Enter reason..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.notesModalActions}>
              <TouchableOpacity
                style={[styles.notesButton, styles.notesCancelButton]}
                onPress={() => {
                  setShowNotesModal(false);
                  setSelectedWithdrawal(null);
                  setRejectNotes('');
                }}
              >
                <Text style={styles.notesCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.notesButton, styles.notesSubmitButton]}
                onPress={executeRejectWithNotes}
                disabled={!rejectNotes.trim()}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.notesSubmitGradient}
                >
                  <Text style={styles.notesSubmitText}>Submit</Text>
                </LinearGradient>
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  statCardSecondary: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabelSmall: {
    fontSize: 10,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
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
  filterTabs: {
    maxHeight: 50,
    marginBottom: 12,
  },
  filterTabsContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  filterTabText: {
    fontSize: 12,
    color: '#666',
  },
  filterTabTextActive: {
    color: '#f97316',
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  filterChipText: {
    fontSize: 11,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#f97316',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  resultsContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  withdrawalCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userTypeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  menuButton: {
    padding: 4,
  },
  amountContainer: {
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  amount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f97316',
  },
  bankDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bankText: {
    fontSize: 13,
    color: '#fff',
  },
  accountText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  referenceLabel: {
    fontSize: 11,
    color: '#666',
  },
  reference: {
    fontSize: 11,
    color: '#f97316',
    fontFamily: 'monospace',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  date: {
    fontSize: 10,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  notes: {
    flex: 1,
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  processedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  processedText: {
    fontSize: 9,
    color: '#10b981',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
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
  actionsModal: {
    width: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionItemDelete: {
    borderBottomWidth: 0,
  },
  actionText: {
    fontSize: 14,
    color: '#fff',
  },
  actionTextDelete: {
    color: '#ef4444',
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  actionInfoText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  confirmModal: {
    width: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2a2a2a',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  approveConfirmButton: {
    backgroundColor: '#10b981',
  },
  rejectConfirmButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  notesModal: {
    width: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
  },
  notesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  notesModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  notesModalLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 13,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  notesModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  notesButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesCancelButton: {
    backgroundColor: '#2a2a2a',
  },
  notesCancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  notesSubmitButton: {
    overflow: 'hidden',
  },
  notesSubmitGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});