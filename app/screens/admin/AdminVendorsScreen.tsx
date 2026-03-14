// app/screens/admin/AdminVendorsScreen.tsx
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

type VendorStatus = 'all' | 'pending' | 'approved' | 'suspended';

interface Vendor {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  category: string;
  image_url: string;
  is_approved: boolean;
  is_suspended: boolean;
  created_at: string;
  owner: {
    name: string;
    email: string;
    phone: string;
  } | null;
}

export function AdminVendorsScreen() {
  const navigation = useNavigation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatus>('all');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'delete';
    vendor: Vendor;
  } | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    filterVendors();
  }, [vendors, searchQuery, statusFilter]);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('vendors')
        .select(`
          *,
          owner:owner_id (
            name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      Alert.alert('Error', 'Failed to load vendors');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const filterVendors = () => {
    let filtered = [...vendors];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.name.toLowerCase().includes(query) ||
        v.owner?.name?.toLowerCase().includes(query) ||
        v.email?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(v => {
        if (statusFilter === 'pending') return !v.is_approved;
        if (statusFilter === 'approved') return v.is_approved && !v.is_suspended;
        if (statusFilter === 'suspended') return v.is_suspended;
        return true;
      });
    }

    setFilteredVendors(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVendors();
  };

  const handleVendorAction = (vendor: Vendor, actionType: 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'delete') => {
    setConfirmAction({ type: actionType, vendor });
    setShowActionsModal(false);
    setShowConfirmModal(true);
  };

 // In AdminVendorsScreen.tsx, update the executeAction function

const executeAction = async () => {
  if (!confirmAction) return;

  const { type, vendor } = confirmAction;

  try {
    let successMessage = '';
    
    switch (type) {
      case 'approve':
        await supabase
          .from('vendors')
          .update({ 
            is_approved: true,
            is_suspended: false 
          })
          .eq('id', vendor.id);
        successMessage = 'Vendor approved successfully';
        break;

      case 'reject':
      case 'delete':
        await supabase
          .from('vendors')
          .delete()
          .eq('id', vendor.id);
        successMessage = 'Vendor deleted successfully';
        break;

      case 'suspend':
        await supabase
          .from('vendors')
          .update({ is_suspended: true })
          .eq('id', vendor.id);
        successMessage = 'Vendor suspended successfully';
        break;

      case 'unsuspend':
        await supabase
          .from('vendors')
          .update({ is_suspended: false })
          .eq('id', vendor.id);
        successMessage = 'Vendor unsuspended successfully';
        break;
    }

    Alert.alert('Success', successMessage);
    fetchVendors(); // Refresh the list
  } catch (error) {
    console.error('Error:', error);
    Alert.alert('Error', `Failed to ${type} vendor`);
  } finally {
    setShowConfirmModal(false);
    setConfirmAction(null);
  }
};
  const getVendorStatus = (vendor: Vendor) => {
    if (vendor.is_suspended) return { label: 'Suspended', color: '#ef4444' };
    if (!vendor.is_approved) return { label: 'Pending', color: '#f59e0b' };
    return { label: 'Approved', color: '#10b981' };
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
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
        <Text style={styles.headerTitle}>Vendor Management</Text>
        <TouchableOpacity 
          onPress={() => {
            // Navigate to create vendor screen
            Alert.alert('Coming Soon', 'Create vendor functionality coming soon');
          }} 
          style={styles.addButton}
        >
          <Feather name="plus" size={24} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search vendors by name, email..."
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
          {[
            { value: 'all', label: 'All', color: '#f97316' },
            { value: 'pending', label: 'Pending', color: '#f59e0b' },
            { value: 'approved', label: 'Approved', color: '#10b981' },
            { value: 'suspended', label: 'Suspended', color: '#ef4444' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setStatusFilter(tab.value as VendorStatus)}
              style={[
                styles.filterTab,
                statusFilter === tab.value && styles.filterTabActive,
                statusFilter === tab.value && { borderColor: tab.color }
              ]}
            >
              <Text style={[
                styles.filterTabText,
                statusFilter === tab.value && { color: tab.color }
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredVendors.length} of {vendors.length} vendors
        </Text>
      </View>

      {/* Vendors List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredVendors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No vendors found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters</Text>
          </View>
        ) : (
          filteredVendors.map((vendor) => {
            const status = getVendorStatus(vendor);
            
            return (
              <View key={vendor.id} style={styles.vendorCard}>
                <View style={styles.vendorHeader}>
                  <View style={styles.vendorInfo}>
                    <View style={styles.vendorImageContainer}>
                      {vendor.image_url ? (
                        <Image source={{ uri: vendor.image_url }} style={styles.vendorImage} />
                      ) : (
                        <LinearGradient
                          colors={['#f97316', '#f43f5e']}
                          style={styles.vendorImagePlaceholder}
                        >
                          <Text style={styles.vendorInitial}>
                            {vendor.name.charAt(0).toUpperCase()}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                    <View>
                      <Text style={styles.vendorName}>{vendor.name}</Text>
                      <Text style={styles.vendorEmail}>{vendor.email}</Text>
                    </View>
                  </View>

                  <View style={styles.vendorHeaderRight}>
                    <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedVendor(vendor);
                        setShowActionsModal(true);
                      }}
                      style={styles.menuButton}
                    >
                      <Feather name="more-vertical" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.vendorDetails}>
                  <Text style={styles.vendorDetail}>
                    <Feather name="user" size={12} color="#666" /> Owner: {vendor.owner?.name || 'N/A'}
                  </Text>
                  <Text style={styles.vendorDetail}>
                    <Feather name="phone" size={12} color="#666" /> {vendor.phone}
                  </Text>
                  <Text style={styles.vendorDetail}>
                    <Feather name="map-pin" size={12} color="#666" /> {vendor.address}
                  </Text>
                  <Text style={styles.vendorDetail}>
                    <Feather name="tag" size={12} color="#666" /> {vendor.category}
                  </Text>
                </View>

                <View style={styles.vendorFooter}>
                  <Text style={styles.vendorDate}>
                    Joined: {new Date(vendor.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          })
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
            {selectedVendor && !selectedVendor.is_approved && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleVendorAction(selectedVendor, 'approve')}
              >
                <Feather name="check-circle" size={18} color="#10b981" />
                <Text style={styles.actionText}>Approve Vendor</Text>
              </TouchableOpacity>
            )}

            {selectedVendor && selectedVendor.is_approved && !selectedVendor.is_suspended && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleVendorAction(selectedVendor, 'suspend')}
              >
                <Feather name="pause-circle" size={18} color="#f59e0b" />
                <Text style={styles.actionText}>Suspend Vendor</Text>
              </TouchableOpacity>
            )}

            {selectedVendor && selectedVendor.is_suspended && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleVendorAction(selectedVendor, 'unsuspend')}
              >
                <Feather name="play-circle" size={18} color="#10b981" />
                <Text style={styles.actionText}>Unsuspend Vendor</Text>
              </TouchableOpacity>
            )}

            {selectedVendor && !selectedVendor.is_approved && (
              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDelete]}
                onPress={() => handleVendorAction(selectedVendor, 'reject')}
              >
                <Feather name="x-circle" size={18} color="#ef4444" />
                <Text style={[styles.actionText, styles.actionTextDelete]}>Reject Vendor</Text>
              </TouchableOpacity>
            )}

            {selectedVendor && (
              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDelete]}
                onPress={() => handleVendorAction(selectedVendor, 'delete')}
              >
                <Feather name="trash-2" size={18} color="#ef4444" />
                <Text style={[styles.actionText, styles.actionTextDelete]}>Delete Vendor</Text>
              </TouchableOpacity>
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
              {confirmAction?.type === 'approve' && `Are you sure you want to approve ${confirmAction.vendor.name}?`}
              {confirmAction?.type === 'reject' && `Are you sure you want to reject ${confirmAction.vendor.name}? This action cannot be undone.`}
              {confirmAction?.type === 'suspend' && `Are you sure you want to suspend ${confirmAction.vendor.name}?`}
              {confirmAction?.type === 'unsuspend' && `Are you sure you want to unsuspend ${confirmAction.vendor.name}?`}
              {confirmAction?.type === 'delete' && `Are you sure you want to delete ${confirmAction.vendor.name}? This action cannot be undone.`}
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
                  confirmAction?.type === 'approve' ? styles.approveConfirmButton :
                  confirmAction?.type === 'suspend' ? styles.suspendConfirmButton :
                  confirmAction?.type === 'unsuspend' ? styles.unsuspendConfirmButton :
                  styles.deleteConfirmButton
                ]}
                onPress={executeAction}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmAction?.type === 'approve' ? 'Approve' :
                   confirmAction?.type === 'reject' ? 'Reject' :
                   confirmAction?.type === 'suspend' ? 'Suspend' :
                   confirmAction?.type === 'unsuspend' ? 'Unsuspend' : 'Delete'}
                </Text>
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
        paddingBottom:60,

  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    margin: 16,
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
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  filterTabText: {
    fontSize: 13,
    color: '#666',
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
  vendorCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  vendorImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
  vendorImage: {
    width: '100%',
    height: '100%',
  },
  vendorImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  vendorEmail: {
    fontSize: 11,
    color: '#666',
  },
  vendorHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
  },
  vendorDetails: {
    marginBottom: 12,
    gap: 6,
  },
  vendorDetail: {
    fontSize: 12,
    color: '#666',
  },
  vendorFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  vendorDate: {
    fontSize: 10,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
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
    fontSize: 14,
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
  suspendConfirmButton: {
    backgroundColor: '#f59e0b',
  },
  unsuspendConfirmButton: {
    backgroundColor: '#10b981',
  },
  deleteConfirmButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});