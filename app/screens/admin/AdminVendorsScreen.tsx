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
import { verifyBankAccount } from '../../utils/flutterwave'; // Only verifyBankAccount

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
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  owner: {
    name: string;
    email: string;
    phone: string;
  } | null;
}

interface PlatformSettings {
  platform_fee_percentage: string;
  delivery_fee_per_km: number;
  min_delivery_fee: number;
  max_delivery_fee: number;
  weight_rate_per_kg: number;
  service_fee: string;
}

// Bank list with codes
const banks = [
  { label: 'Access Bank', value: 'access', code: '044' },
  { label: 'Citibank', value: 'citibank', code: '023' },
  { label: 'Ecobank', value: 'ecobank', code: '050' },
  { label: 'Fidelity Bank', value: 'fidelity', code: '070' },
  { label: 'First Bank of Nigeria', value: 'first', code: '011' },
  { label: 'FCMB', value: 'fcmb', code: '214' },
  { label: 'GTBank', value: 'gtb', code: '058' },
  { label: 'Heritage Bank', value: 'heritage', code: '030' },
  { label: 'Keystone Bank', value: 'keystone', code: '082' },
  { label: 'Polaris Bank', value: 'polaris', code: '076' },
  { label: 'Stanbic IBTC', value: 'stanbic', code: '221' },
  { label: 'Standard Chartered', value: 'standard', code: '068' },
  { label: 'Sterling Bank', value: 'sterling', code: '232' },
  { label: 'Union Bank', value: 'union', code: '032' },
  { label: 'UBA', value: 'uba', code: '033' },
  { label: 'Wema Bank', value: 'wema', code: '035' },
  { label: 'Zenith Bank', value: 'zenith', code: '057' },
  { label: 'Kuda Bank', value: 'kuda', code: '090267' },
  { label: 'OPay', value: 'opay', code: '100052' },
  { label: 'PalmPay', value: 'palmpay', code: '100033' },
];

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
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'delete';
    vendor: Vendor;
  } | null>(null);
  
  // Edit bank details states
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [editedBankDetails, setEditedBankDetails] = useState({
    bank_name: '',
    bank_code: '',
    account_number: '',
    account_name: '',
  });
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  
  // Platform settings
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    fetchVendors();
    fetchPlatformSettings();
  }, []);

  useEffect(() => {
    filterVendors();
  }, [vendors, searchQuery, statusFilter]);

  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setPlatformSettings(data);
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    }
  };

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

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.name.toLowerCase().includes(query) ||
        v.owner?.name?.toLowerCase().includes(query) ||
        v.email?.toLowerCase().includes(query)
      );
    }

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
    fetchPlatformSettings();
  };

  const startEditingBank = (vendor: Vendor) => {
    setEditedBankDetails({
      bank_name: vendor.bank_name || '',
      bank_code: vendor.bank_code || '',
      account_number: vendor.account_number || '',
      account_name: vendor.account_name || '',
    });
    setBankVerified(false);
    setVerificationError('');
    setIsEditingBank(true);
  };

  const cancelEditingBank = () => {
    setIsEditingBank(false);
    setEditedBankDetails({
      bank_name: '',
      bank_code: '',
      account_number: '',
      account_name: '',
    });
    setBankVerified(false);
    setVerificationError('');
  };

  const selectBank = (bankValue: string) => {
    const selectedBank = banks.find(b => b.value === bankValue);
    if (selectedBank) {
      setEditedBankDetails({
        ...editedBankDetails,
        bank_name: selectedBank.label,
        bank_code: selectedBank.code,
      });
      setBankVerified(false);
    }
    setShowBankDropdown(false);
  };

  const handleVerifyBank = async () => {
    if (!editedBankDetails.account_number || !editedBankDetails.bank_code) {
      setVerificationError('Please select bank and enter account number');
      return;
    }

    setIsVerifyingBank(true);
    setVerificationError('');

    try {
      const result = await verifyBankAccount(
        editedBankDetails.account_number,
        editedBankDetails.bank_code
      );

      if (result.status === 'success' && result.data) {
        setEditedBankDetails(prev => ({ 
          ...prev, 
          account_name: result.data?.account_name || '',
        }));
        setBankVerified(true);
        Alert.alert('Success', `Account verified: ${result.data.account_name}`);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setVerificationError(error.message || 'Invalid account details');
      setBankVerified(false);
    } finally {
      setIsVerifyingBank(false);
    }
  };

  const saveBankDetails = async () => {
    if (!selectedVendor) return;

    if (!editedBankDetails.bank_name || !editedBankDetails.account_number || !editedBankDetails.account_name) {
      Alert.alert('Error', 'Please fill in all bank details');
      return;
    }

    if (!bankVerified) {
      Alert.alert('Error', 'Please verify the bank account first');
      return;
    }

    try {
      const { error } = await supabase
        .from('vendors')
        .update({
          bank_name: editedBankDetails.bank_name,
          bank_code: editedBankDetails.bank_code,
          account_number: editedBankDetails.account_number,
          account_name: editedBankDetails.account_name,
        })
        .eq('id', selectedVendor.id);

      if (error) throw error;

      Alert.alert('Success', 'Bank details updated successfully');
      fetchVendors();
      setIsEditingBank(false);

    } catch (error: any) {
      console.error('Error updating bank details:', error);
      Alert.alert('Error', error.message || 'Failed to update bank details');
    }
  };

  const handleVendorAction = (vendor: Vendor, actionType: 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'delete') => {
    setConfirmAction({ type: actionType, vendor });
    setShowActionsModal(false);
    setShowConfirmModal(true);
  };

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

      if (successMessage) {
        Alert.alert('Success', successMessage);
      }
      fetchVendors();
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
            Alert.alert('Platform Fee', `Current platform fee: ${platformSettings?.platform_fee_percentage || 10}%`);
          }} 
          style={styles.addButton}
        >
          <Feather name="info" size={24} color="#f97316" />
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
                  
                  {/* Bank Details */}
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedVendor(vendor);
                      setShowPaymentDetailsModal(true);
                    }}
                    style={styles.paymentStatusRow}
                  >
                    <Feather name="credit-card" size={14} color="#f97316" />
                    <Text style={styles.paymentStatusText}>
                      View Bank Details
                    </Text>
                    <Feather name="chevron-right" size={14} color="#666" style={styles.paymentChevron} />
                  </TouchableOpacity>
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

      {/* Payment Details Modal - Bank Info Only */}
      <Modal
        visible={showPaymentDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowPaymentDetailsModal(false);
          setIsEditingBank(false);
          setBankVerified(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModal}>
            <View style={styles.paymentModalHeader}>
              <Text style={styles.paymentModalTitle}>Bank Details</Text>
              <TouchableOpacity onPress={() => {
                setShowPaymentDetailsModal(false);
                setIsEditingBank(false);
                setBankVerified(false);
              }}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedVendor && (
              <ScrollView style={styles.paymentModalBody}>
                {/* Bank Details Section */}
                <View style={styles.paymentSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.paymentSectionTitle}>Bank Information</Text>
                    {!isEditingBank ? (
                      <TouchableOpacity onPress={() => startEditingBank(selectedVendor)}>
                        <Feather name="edit-2" size={16} color="#f97316" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {!isEditingBank ? (
                    // View Mode
                    <>
                      <View style={styles.paymentDetailRow}>
                        <Text style={styles.paymentDetailLabel}>Bank Name:</Text>
                        <Text style={styles.paymentDetailValue}>
                          {banks.find(b => b.value === selectedVendor.bank_name)?.label || selectedVendor.bank_name || 'Not provided'}
                        </Text>
                      </View>
                      <View style={styles.paymentDetailRow}>
                        <Text style={styles.paymentDetailLabel}>Account Number:</Text>
                        <Text style={styles.paymentDetailValue}>
                          {selectedVendor.account_number || 'Not provided'}
                        </Text>
                      </View>
                      <View style={styles.paymentDetailRow}>
                        <Text style={styles.paymentDetailLabel}>Account Name:</Text>
                        <Text style={styles.paymentDetailValue}>
                          {selectedVendor.account_name || 'Not provided'}
                        </Text>
                      </View>
                    </>
                  ) : (
                    // Edit Mode
                    <>
                      {/* Bank Dropdown */}
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Bank Name</Text>
                        <TouchableOpacity 
                          style={styles.dropdownButton}
                          onPress={() => setShowBankDropdown(true)}
                        >
                          <Text style={[
                            styles.dropdownButtonText,
                            !editedBankDetails.bank_name && styles.dropdownPlaceholder
                          ]}>
                            {editedBankDetails.bank_name || 'Select bank'}
                          </Text>
                          <Feather name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                      </View>

                      {/* Account Number with Verify Button */}
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Account Number</Text>
                        <View style={styles.verificationRow}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={editedBankDetails.account_number}
                            onChangeText={(text) => {
                              setEditedBankDetails({ ...editedBankDetails, account_number: text });
                              setBankVerified(false);
                            }}
                            placeholder="10-digit account number"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            maxLength={10}
                          />
                          <TouchableOpacity
                            onPress={handleVerifyBank}
                            disabled={!editedBankDetails.account_number || !editedBankDetails.bank_code || isVerifyingBank || bankVerified}
                            style={[
                              styles.verifyButton,
                              bankVerified && styles.verifyButtonSuccess
                            ]}
                          >
                            {isVerifyingBank ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : bankVerified ? (
                              <Feather name="check" size={20} color="#fff" />
                            ) : (
                              <Text style={styles.verifyButtonText}>Verify</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                        {verificationError ? (
                          <Text style={styles.verificationError}>{verificationError}</Text>
                        ) : null}
                      </View>

                      {/* Account Name */}
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Account Name</Text>
                        <TextInput
                          style={[styles.input, bankVerified && styles.verifiedInput]}
                          value={editedBankDetails.account_name}
                          onChangeText={(text) => setEditedBankDetails({ ...editedBankDetails, account_name: text })}
                          placeholder="Account name"
                          placeholderTextColor="#666"
                          editable={!bankVerified}
                        />
                      </View>

                      {bankVerified && (
                        <View style={styles.verificationSuccess}>
                          <Feather name="check-circle" size={16} color="#10b981" />
                          <Text style={styles.verificationSuccessText}>Account verified successfully</Text>
                        </View>
                      )}

                      {/* Edit Mode Buttons */}
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={[styles.editButton, styles.cancelEditButton]}
                          onPress={cancelEditingBank}
                        >
                          <Text style={styles.cancelEditText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.editButton, styles.saveEditButton]}
                          onPress={saveBankDetails}
                          disabled={!bankVerified}
                        >
                          <LinearGradient
                            colors={['#f97316', '#f43f5e']}
                            style={styles.saveEditGradient}
                          >
                            <Text style={styles.saveEditText}>Save Changes</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>

                {/* Platform Fee Info */}
                <View style={[styles.paymentSection, styles.platformFeeSection]}>
                  <Feather name="info" size={16} color="#f97316" />
                  <Text style={styles.platformFeeText}>
                    Platform Fee: {platformSettings?.platform_fee_percentage || 10}% per transaction
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Bank Dropdown Modal */}
      <Modal
        visible={showBankDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBankDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Select Bank</Text>
              <TouchableOpacity onPress={() => setShowBankDropdown(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {banks.map((bank) => (
                <TouchableOpacity
                  key={bank.value}
                  style={styles.dropdownItem}
                  onPress={() => selectBank(bank.value)}
                >
                  <Text style={styles.dropdownItemText}>{bank.label}</Text>
                  {editedBankDetails.bank_name === bank.label && (
                    <Feather name="check" size={20} color="#f97316" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    height: 44,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    height: 44,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  dropdownPlaceholder: {
    color: '#666',
  },
  dropdownModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 16,
    maxHeight: '70%',
    width: '90%',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#fff',
  },
  verificationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifyButton: {
    width: 80,
    height: 44,
    backgroundColor: '#f97316',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonSuccess: {
    backgroundColor: '#10b981',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  verificationError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  verificationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  verificationSuccessText: {
    color: '#10b981',
    fontSize: 12,
  },
  verifiedInput: {
    backgroundColor: '#1a2a1a',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cancelEditButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelEditText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  saveEditButton: {
    overflow: 'hidden',
  },
  saveEditGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveEditText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingBottom: 60,
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
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  paymentChevron: {
    marginLeft: 'auto',
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
  paymentModal: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  paymentModalBody: {
    padding: 16,
  },
  paymentSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  paymentSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 12,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  paymentDetailValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  platformFeeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  platformFeeText: {
    fontSize: 12,
    color: '#f97316',
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