// app/screens/admin/AdminMenuScreen.tsx
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
import Toast from 'react-native-toast-message';

type MenuStatus = 'all' | 'pending' | 'approved' | 'rejected';

interface MenuItem {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url?: string;
  category: string;
  is_available: boolean;
  is_popular: boolean;
  preparation_time?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  vendor?: {
    id: string;
    name: string;
    owner_id: string;
    image_url?: string;
  };
}

export function AdminMenuScreen() {
  const navigation = useNavigation();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MenuStatus>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
   const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterItems();
  }, [menuItems, searchQuery, statusFilter, vendorFilter]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch vendors for filter
      const { data: vendorsData } = await supabase
        .from('vendors')
        .select('id, name')
        .order('name');

      setVendors(vendorsData || []);

      // Fetch menu items with vendor details
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendor:vendor_id (
            id,
            name,
            owner_id,
            image_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      showToast('Failed to load menu items');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const filterItems = () => {
    let filtered = [...menuItems];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.vendor?.name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.approval_status === statusFilter);
    }

    // Vendor filter
    if (vendorFilter !== 'all') {
      filtered = filtered.filter(item => item.vendor_id === vendorFilter);
    }

    setFilteredItems(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleApprove = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          approval_status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;

      showToast( 'Menu item approved');
      fetchData();
      setShowActionModal(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Error approving item:', error);
      showToast('Failed to approve item');
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !rejectReason.trim()) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          approval_status: 'rejected',
          rejection_reason: rejectReason,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedItem.id);

      if (error) throw error;

      showToast( 'Menu item rejected');
      fetchData();
      setShowRejectModal(false);
      setSelectedItem(null);
      setRejectReason('');
    } catch (error) {
      console.error('Error rejecting item:', error);
      showToast('Failed to reject item');
    }
  };

  const handleDelete = async (itemId: string) => {
    Alert.alert(
      'Delete Menu Item',
      'Are you sure you want to delete this item? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', itemId);

              if (error) throw error;

              showToast( 'Menu item deleted');
              fetchData();
              setShowActionModal(false);
              setSelectedItem(null);
            } catch (error) {
              console.error('Error deleting item:', error);
              showToast('Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#666';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'pending': return 'rgba(245,158,11,0.1)';
      case 'approved': return 'rgba(16,185,129,0.1)';
      case 'rejected': return 'rgba(239,68,68,0.1)';
      default: return 'rgba(102,102,102,0.1)';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading menu items...</Text>
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
        <Text style={styles.headerTitle}>Menu Management</Text>
        <TouchableOpacity onPress={fetchData} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={['#f97316', '#f43f5e']}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Total Items</Text>
          <Text style={styles.statValue}>{menuItems.length}</Text>
        </LinearGradient>

        <View style={styles.statCardSecondary}>
          <Feather name="clock" size={20} color="#f59e0b" />
          <Text style={styles.statNumber}>{menuItems.filter(i => i.approval_status === 'pending').length}</Text>
          <Text style={styles.statLabelSmall}>Pending</Text>
        </View>

        <View style={styles.statCardSecondary}>
          <Feather name="check-circle" size={20} color="#10b981" />
          <Text style={styles.statNumber}>{menuItems.filter(i => i.approval_status === 'approved').length}</Text>
          <Text style={styles.statLabelSmall}>Approved</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, description, vendor..."
          placeholderTextColor="#666"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={18} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <View style={styles.filterContent}>
          {/* Status Filters */}
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
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'pending' && styles.filterChipTextActive,
            ]}>Pending</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStatusFilter('approved')}
            style={[
              styles.filterChip,
              statusFilter === 'approved' && styles.filterChipActive,
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'approved' && styles.filterChipTextActive,
            ]}>Approved</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStatusFilter('rejected')}
            style={[
              styles.filterChip,
              statusFilter === 'rejected' && styles.filterChipActive,
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'rejected' && styles.filterChipTextActive,
            ]}>Rejected</Text>
          </TouchableOpacity>

          <View style={styles.filterDivider} />

          {/* Vendor Filter */}
          <TouchableOpacity
            onPress={() => setVendorFilter('all')}
            style={[
              styles.filterChip,
              vendorFilter === 'all' && styles.filterChipActive,
            ]}
          >
            <Text style={[
              styles.filterChipText,
              vendorFilter === 'all' && styles.filterChipTextActive,
            ]}>All Vendors</Text>
          </TouchableOpacity>

          {vendors.slice(0, 3).map(vendor => (
            <TouchableOpacity
              key={vendor.id}
              onPress={() => setVendorFilter(vendor.id)}
              style={[
                styles.filterChip,
                vendorFilter === vendor.id && styles.filterChipActive,
              ]}
            >
              <Text style={[
                styles.filterChipText,
                vendorFilter === vendor.id && styles.filterChipTextActive,
              ]}>{vendor.name}</Text>
            </TouchableOpacity>
          ))}

          {vendors.length > 3 && (
            <TouchableOpacity style={styles.filterChip}>
              <Text style={styles.filterChipText}>+{vendors.length - 3}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredItems.length} of {menuItems.length} items
        </Text>
      </View>

      {/* Menu Items Grid */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        <View style={styles.grid}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="coffee" size={48} color="#666" />
              <Text style={styles.emptyTitle}>No menu items found</Text>
              <Text style={styles.emptyText}>Try adjusting your filters</Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuCard}
                onPress={() => {
                  setSelectedItem(item);
                  setShowDetailsModal(true);
                }}
              >
                <View style={styles.menuImageContainer}>
                  {item.image_url && !imageError[item.id] ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.menuImage}
                      onError={() => setImageError(prev => ({ ...prev, [item.id]: true }))}
                    />
                  ) : (
                    <LinearGradient
                      colors={['#f97316', '#f43f5e']}
                      style={styles.menuImagePlaceholder}
                    >
                      <Feather name="image" size={24} color="#fff" />
                    </LinearGradient>
                  )}
                  
                  <View style={[
                    styles.menuStatusBadge,
                    { backgroundColor: getStatusBgColor(item.approval_status) }
                  ]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.approval_status) }]} />
                    <Text style={[styles.menuStatusText, { color: getStatusColor(item.approval_status) }]}>
                      {item.approval_status}
                    </Text>
                  </View>
                </View>

                <View style={styles.menuInfo}>
                  <Text style={styles.menuName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.menuVendor}>{item.vendor?.name || 'Unknown Vendor'}</Text>
                  
                  <View style={styles.menuPriceRow}>
                    <Text style={styles.menuPrice}>{formatCurrency(item.price)}</Text>
                    {item.original_price && (
                      <Text style={styles.menuOriginalPrice}>
                        {formatCurrency(item.original_price)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.menuMeta}>
                    {item.is_popular && (
                      <View style={styles.popularBadge}>
                        <Feather name="star" size={10} color="#fbbf24" />
                        <Text style={styles.popularText}>Popular</Text>
                      </View>
                    )}
                    <Text style={styles.menuCategory}>{item.category}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Menu Item Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <ScrollView style={styles.modalBody}>
                {/* Item Image */}
                <View style={styles.detailImageContainer}>
                  {selectedItem.image_url && !imageError[selectedItem.id] ? (
                    <Image
                      source={{ uri: selectedItem.image_url }}
                      style={styles.detailImage}
                      onError={() => setImageError(prev => ({ ...prev, [selectedItem.id]: true }))}
                    />
                  ) : (
                    <LinearGradient
                      colors={['#f97316', '#f43f5e']}
                      style={styles.detailImagePlaceholder}
                    >
                      <Feather name="image" size={40} color="#fff" />
                    </LinearGradient>
                  )}
                </View>

                {/* Status */}
                <View style={styles.detailStatus}>
                  <View style={[
                    styles.detailStatusBadge,
                    { backgroundColor: getStatusBgColor(selectedItem.approval_status) }
                  ]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedItem.approval_status) }]} />
                    <Text style={[styles.detailStatusText, { color: getStatusColor(selectedItem.approval_status) }]}>
                      {selectedItem.approval_status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Basic Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Item Name</Text>
                  <Text style={styles.detailValue}>{selectedItem.name}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>{selectedItem.description || 'No description'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={[styles.detailSection, { flex: 1 }]}>
                    <Text style={styles.detailLabel}>Price</Text>
                    <Text style={styles.detailPrice}>{formatCurrency(selectedItem.price)}</Text>
                  </View>
                  {selectedItem.original_price && (
                    <View style={[styles.detailSection, { flex: 1 }]}>
                      <Text style={styles.detailLabel}>Original Price</Text>
                      <Text style={styles.detailOriginalPrice}>{formatCurrency(selectedItem.original_price)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailRow}>
                  <View style={[styles.detailSection, { flex: 1 }]}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{selectedItem.category}</Text>
                  </View>
                  <View style={[styles.detailSection, { flex: 1 }]}>
                    <Text style={styles.detailLabel}>Prep Time</Text>
                    <Text style={styles.detailValue}>{selectedItem.preparation_time || 'N/A'}</Text>
                  </View>
                </View>

                {/* Vendor Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Vendor</Text>
                  <View style={styles.vendorInfo}>
                    <View style={styles.vendorAvatar}>
                      {selectedItem.vendor?.image_url ? (
                        <Image source={{ uri: selectedItem.vendor.image_url }} style={styles.vendorAvatarImage} />
                      ) : (
                        <LinearGradient
                          colors={['#f97316', '#f43f5e']}
                          style={styles.vendorAvatarPlaceholder}
                        >
                          <Text style={styles.vendorAvatarText}>
                            {selectedItem.vendor?.name?.charAt(0) || 'V'}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                    <View>
                      <Text style={styles.vendorName}>{selectedItem.vendor?.name || 'Unknown'}</Text>
                      <Text style={styles.vendorId}>ID: {selectedItem.vendor_id.slice(0, 8)}</Text>
                    </View>
                  </View>
                </View>

                {/* Rejection Reason (if rejected) */}
                {selectedItem.approval_status === 'rejected' && selectedItem.rejection_reason && (
                  <View style={[styles.detailSection, styles.rejectionSection]}>
                    <Feather name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                    <Text style={styles.rejectionText}>{selectedItem.rejection_reason}</Text>
                  </View>
                )}

                {/* Dates */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailDate}>
                    {new Date(selectedItem.created_at).toLocaleString()}
                  </Text>
                </View>

                {/* Action Buttons */}
                {selectedItem.approval_status === 'pending' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => {
                        setShowDetailsModal(false);
                        setShowRejectModal(true);
                      }}
                    >
                      <Feather name="x-circle" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => {
                        setShowDetailsModal(false);
                        handleApprove(selectedItem.id);
                      }}
                    >
                      <Feather name="check-circle" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedItem.approval_status !== 'pending' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => {
                      setShowDetailsModal(false);
                      handleDelete(selectedItem.id);
                    }}
                  >
                    <Feather name="trash-2" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Delete Item</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rejectModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Menu Item</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.rejectModalBody}>
              <Text style={styles.rejectLabel}>
                Please provide a reason for rejection:
              </Text>
              <TextInput
                style={styles.rejectInput}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Enter reason..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.rejectActions}>
                <TouchableOpacity
                  style={[styles.rejectButton, styles.rejectCancel]}
                  onPress={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}
                >
                  <Text style={styles.rejectCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.rejectButton, styles.rejectConfirm]}
                  onPress={handleReject}
                  disabled={!rejectReason.trim()}
                >
                  <LinearGradient
                    colors={['#f97316', '#f43f5e']}
                    style={styles.rejectConfirmGradient}
                  >
                    <Text style={styles.rejectConfirmText}>Submit</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
  filterRow: {
    maxHeight: 50,
    marginBottom: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#f97316',
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 4,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  menuCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  menuImageContainer: {
    height: 120,
    position: 'relative',
  },
  menuImage: {
    width: '100%',
    height: '100%',
  },
  menuImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuStatusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  menuStatusText: {
    fontSize: 8,
    fontWeight: '600',
  },
  menuInfo: {
    padding: 12,
  },
  menuName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  menuVendor: {
    fontSize: 10,
    color: '#666',
    marginBottom: 6,
  },
  menuPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  menuPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f97316',
  },
  menuOriginalPrice: {
    fontSize: 10,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  menuMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  popularText: {
    fontSize: 8,
    color: '#f59e0b',
  },
  menuCategory: {
    fontSize: 9,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    width: '100%',
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
  detailsModal: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
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
  modalBody: {
    padding: 16,
  },
  detailImageContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailStatus: {
    alignItems: 'center',
    marginBottom: 16,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  detailStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  detailPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
  },
  detailOriginalPrice: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
  },
  vendorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  vendorAvatarImage: {
    width: '100%',
    height: '100%',
  },
  vendorAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  vendorId: {
    fontSize: 10,
    color: '#666',
  },
  detailDate: {
    fontSize: 12,
    color: '#666',
  },
  rejectionSection: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  rejectionLabel: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  rejectionText: {
    fontSize: 12,
    color: '#ef4444',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectModal: {
    width: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  rejectModalBody: {
    padding: 16,
  },
  rejectLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  rejectInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 13,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  rejectActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectCancel: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectCancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  rejectConfirm: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 8,
  },
  rejectConfirmGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});