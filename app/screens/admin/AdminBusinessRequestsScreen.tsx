import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';

type RequestStatus = 'pending' | 'accepted' | 'cancelled' | 'paid' | 'assigned' | 'picked_up' | 'delivered';

interface BusinessRequest {
  id: string;
  request_number: string;
  business_id: string;
  business_name: string;
  business_phone: string;
  business_email: string;
  
  // Package details (flattened)
  package_name: string;
  package_type: string;
  weight_kg: number;
  quantity: number;
  package_description?: string;
  declared_value?: number;
  handling_instructions?: string;
  
  // Pickup location (flattened)
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_instructions?: string;
  
  // Delivery location (flattened)
  delivery_address: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_contact_name: string;
  delivery_contact_phone: string;
  delivery_instructions?: string;
  
  // Receiver
  receiver_phone: string;
  
  // Pricing
  distance_km?: number;
  calculated_fee?: number;
  rider_share?: number;
  platform_share?: number;
  rider_percentage?: number;
  
  // Status
  status: RequestStatus;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_reference?: string;
  paid_at?: string;
  
  // Assignment
  rider_id?: string;
  rider_name?: string;
  rider_phone?: string;
  rider_vehicle?: string;
  assigned_by?: string;
  assigned_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string;
  
  // Notes
  admin_notes?: string;
  business_notes?: string;
}

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  is_available: boolean;
  current_latitude?: number;
  current_longitude?: number;
}

interface PlatformSettings {
  rider_percentage: number;
  platform_percentage: number;
}

export function AdminBusinessRequestsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<BusinessRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BusinessRequest | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [calculatedFee, setCalculatedFee] = useState<number>(0);
  const [editedFee, setEditedFee] = useState<string>('');
  const [calculatedDistance, setCalculatedDistance] = useState<number>(0);
  const [editedDistance, setEditedDistance] = useState<string>('');
  const [availableRiders, setAvailableRiders] = useState<Rider[]>([]);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all');
  const [adminNote, setAdminNote] = useState<string>('');
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    rider_percentage: 50,
    platform_percentage: 50,
  });
  const [riderPercentage, setRiderPercentage] = useState<string>('50');
  
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type: type,
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  useEffect(() => {
    fetchRequests();
    fetchPlatformSettings();
  }, []);

  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('rider_percentage, platform_percentage')
        .order('id', { ascending: true })
        .limit(1)
        .single();

      if (error) {
      
        setRiderPercentage('50');
        return;
      }

      if (data) {
        setPlatformSettings({
          rider_percentage: data.rider_percentage || 50,
          platform_percentage: data.platform_percentage || 50,
        });
        setRiderPercentage((data.rider_percentage || 50).toString());
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('business_logistics_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setRequests(data || []);
      
    } catch (error) {
      console.error('Error fetching requests:', error);
      showToast('Failed to load business requests', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Number((R * c).toFixed(2));
  };

  const calculateDeliveryFee = (
    distance: number,
    weight: number,
    packageType: string
  ): number => {
    const baseRate = 350;
    const weightRate = 100;
    
    let multiplier = 1.0;
    if (packageType === 'fragile') multiplier = 1.5;
    if (packageType === 'electronics') multiplier = 1.3;
    if (packageType === 'documents') multiplier = 0.8;
    
    let total = ((distance * baseRate) + (weight * weightRate)) * multiplier;
    
    if (total < 500) total = 500;
    if (total > 50000) total = 50000;
    
    return Math.round(total);
  };

  const handleAcceptRequest = (request: BusinessRequest) => {
    setSelectedRequest(request);
    setAdminNote('');
    
    // Calculate fee if we have coordinates
    if (request.pickup_latitude && request.pickup_longitude && 
        request.delivery_latitude && request.delivery_longitude) {
      const distance = calculateDistance(
        request.pickup_latitude,
        request.pickup_longitude,
        request.delivery_latitude,
        request.delivery_longitude
      );
      
      setCalculatedDistance(distance);
      setEditedDistance(distance.toString());
      
      const fee = calculateDeliveryFee(
        distance,
        request.weight_kg,
        request.package_type
      );
      
      setCalculatedFee(fee);
      setEditedFee(fee.toString());
    } else {
      setCalculatedDistance(5);
      setEditedDistance('5');
      setCalculatedFee(2000);
      setEditedFee('2000');
    }
    
    setShowAcceptModal(true);
  };

  const handleFeeChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setEditedFee(numericValue);
  };

  const handleDistanceChange = (text: string) => {
    const numericValue = text.replace(/[^0-9.]/g, '');
    const parts = numericValue.split('.');
    if (parts.length > 2) return;
    setEditedDistance(numericValue);
  };

  const handleRiderPercentageChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue === '' || (parseInt(numericValue) >= 0 && parseInt(numericValue) <= 100)) {
      setRiderPercentage(numericValue);
    }
  };

  const confirmAcceptRequest = async () => {
    if (!selectedRequest) return;

    const finalFee = parseFloat(editedFee);
    const finalDistance = parseFloat(editedDistance);
    const finalRiderPercentage = parseFloat(riderPercentage) || platformSettings.rider_percentage;

    if (isNaN(finalFee) || finalFee < 500) {
      showToast('Fee must be at least ₦500', 'error');
      return;
    }

    if (isNaN(finalDistance) || finalDistance <= 0) {
      showToast('Please enter a valid distance', 'error');
      return;
    }

    if (isNaN(finalRiderPercentage) || finalRiderPercentage < 0 || finalRiderPercentage > 100) {
      showToast('Rider percentage must be between 0 and 100', 'error');
      return;
    }

    const riderShare = finalFee * (finalRiderPercentage / 100);
    const platformShare = finalFee - riderShare;

    try {
      const updates: any = {
        status: 'accepted',
        calculated_fee: finalFee,
        distance_km: finalDistance,
        rider_percentage: finalRiderPercentage,
        rider_share: Math.round(riderShare),
        platform_share: Math.round(platformShare),
      };

      if (adminNote.trim()) {
        updates.admin_notes = adminNote;
      }

      const { error } = await supabase
        .from('business_logistics')
        .update(updates)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      showToast(`Request accepted! Fee: ₦${finalFee.toLocaleString()}`, 'success');
      setShowAcceptModal(false);
      fetchRequests();
    } catch (error) {
      console.error('Error accepting request:', error);
      showToast('Failed to accept request', 'error');
    }
  };

  const handleAssignRider = async (request: BusinessRequest) => {
    setSelectedRequest(request);
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'rider')
      .eq('is_available', true)
      .eq('is_suspended', false);

    if (error) {
      showToast('Failed to fetch available riders', 'error');
      return;
    }

    setAvailableRiders(data || []);
    setShowAssignModal(true);
  };

  const confirmAssignRider = async () => {
    if (!selectedRequest || !selectedRider) return;

    try {
      const { error } = await supabase
        .from('business_logistics')
        .update({
          rider_id: selectedRider.id,
          status: 'assigned',
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      const riderShare = selectedRequest.rider_share || 
        (selectedRequest.calculated_fee || 0) * ((selectedRequest.rider_percentage || 50) / 100);
      
      await supabase
        .from('rider_earnings')
        .insert({
          rider_id: selectedRider.id,
          order_id: selectedRequest.id,
          amount: Math.round(riderShare),
          order_type: 'business',
          status: 'pending',
        });

      showToast(`Rider ${selectedRider.name} assigned!`, 'success');
      setShowAssignModal(false);
      setSelectedRider(null);
      fetchRequests();
    } catch (error) {
      console.error('Error assigning rider:', error);
      showToast('Failed to assign rider', 'error');
    }
  };

  const markAsPaid = async (request: BusinessRequest) => {
    try {
      const { error } = await supabase
        .from('business_logistics')
        .update({
          payment_status: 'paid',
          status: 'paid',
          payment_reference: `PAID-${Date.now()}`,
          paid_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      showToast('Payment confirmed!', 'success');
      fetchRequests();
    } catch (error) {
      console.error('Error marking as paid:', error);
      showToast('Failed to update payment status', 'error');
    }
  };

  const getStatusColor = (status: RequestStatus) => {
    const colors: Record<RequestStatus, string> = {
      pending: '#f59e0b',
      accepted: '#3b82f6',
      paid: '#8b5cf6',
      assigned: '#10b981',
      picked_up: '#f97316',
      delivered: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#666';
  };

  const getStatusIcon = (status: RequestStatus): keyof typeof Feather.glyphMap => {
    const icons: Record<RequestStatus, keyof typeof Feather.glyphMap> = {
      pending: 'clock',
      accepted: 'check-circle',
      paid: 'credit-card',
      assigned: 'truck',
      picked_up: 'package',
      delivered: 'check',
      cancelled: 'x-circle',
    };
    return icons[status];
  };

  const filteredRequests = filter === 'all' 
    ? requests 
    : requests.filter(r => r.status === filter);

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    paid: requests.filter(r => r.status === 'paid').length,
    assigned: requests.filter(r => r.status === 'assigned').length,
    picked_up: requests.filter(r => r.status === 'picked_up').length,
    delivered: requests.filter(r => r.status === 'delivered').length,
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#f97316', '#f43f5e']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Requests</Text>
        <TouchableOpacity onPress={fetchRequests} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
        <View style={styles.statsContainer}>
          <TouchableOpacity 
            style={[styles.statCard, filter === 'all' && styles.statCardActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={styles.statNumber}>{requests.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, filter === 'pending' && styles.statCardActive]}
            onPress={() => setFilter('pending')}
          >
            <View style={[styles.statDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, filter === 'accepted' && styles.statCardActive]}
            onPress={() => setFilter('accepted')}
          >
            <View style={[styles.statDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.statNumber}>{stats.accepted}</Text>
            <Text style={styles.statLabel}>Accepted</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, filter === 'paid' && styles.statCardActive]}
            onPress={() => setFilter('paid')}
          >
            <View style={[styles.statDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.statNumber}>{stats.paid}</Text>
            <Text style={styles.statLabel}>Paid</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, filter === 'assigned' && styles.statCardActive]}
            onPress={() => setFilter('assigned')}
          >
            <View style={[styles.statDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.statNumber}>{stats.assigned}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Requests List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="package" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No requests found</Text>
            <Text style={styles.emptyText}>Business requests will appear here</Text>
          </View>
        ) : (
          filteredRequests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              {/* Header */}
              <View style={styles.requestHeader}>
                <View style={styles.businessInfo}>
                  <Text style={styles.businessName}>{request.business_name}</Text>
                  <Text style={styles.requestTime}>
                    {new Date(request.created_at).toLocaleString()}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(request.status) + '20' }
                ]}>
                  <Feather 
                    name={getStatusIcon(request.status)} 
                    size={12} 
                    color={getStatusColor(request.status)} 
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                    {request.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Package Info */}
              <View style={styles.packageSection}>
                <Text style={styles.sectionTitle}>📦 Package</Text>
                <View style={styles.packageGrid}>
                  <View style={styles.packageItem}>
                    <Text style={styles.packageLabel}>Name</Text>
                    <Text style={styles.packageValue}>{request.package_name}</Text>
                  </View>
                  <View style={styles.packageItem}>
                    <Text style={styles.packageLabel}>Type</Text>
                    <Text style={styles.packageValue}>{request.package_type}</Text>
                  </View>
                  <View style={styles.packageItem}>
                    <Text style={styles.packageLabel}>Weight</Text>
                    <Text style={styles.packageValue}>{request.weight_kg}kg</Text>
                  </View>
                  <View style={styles.packageItem}>
                    <Text style={styles.packageLabel}>Qty</Text>
                    <Text style={styles.packageValue}>{request.quantity}</Text>
                  </View>
                </View>
              </View>

              {/* Locations */}
              <View style={styles.locationsSection}>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={14} color="#10b981" />
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationLabel}>Pickup</Text>
                    <Text style={styles.locationAddress}>{request.pickup_address}</Text>
                    <Text style={styles.locationContact}>
                      {request.pickup_contact_name} • {request.pickup_contact_phone}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <Feather name="flag" size={14} color="#f97316" />
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationLabel}>Delivery</Text>
                    <Text style={styles.locationAddress}>{request.delivery_address}</Text>
                    <Text style={styles.locationContact}>
                      {request.delivery_contact_name} • {request.delivery_contact_phone}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <Feather name="phone" size={14} color="#666" />
                  <Text style={styles.receiverPhone}>Receiver: {request.receiver_phone}</Text>
                </View>
              </View>

              {/* Fee Info with Split */}
              {request.calculated_fee && (
                <View style={styles.feeSection}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Total Fee:</Text>
                    <Text style={styles.feeValue}>₦{request.calculated_fee.toLocaleString()}</Text>
                  </View>
                  {request.rider_share && request.platform_share && (
                    <View style={styles.splitRow}>
                      <Text style={styles.splitSmallText}>
                        Rider: ₦{request.rider_share.toLocaleString()} ({request.rider_percentage || 50}%)
                      </Text>
                      <Text style={styles.splitSmallText}>
                        Platform: ₦{request.platform_share.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionButtons}>
                {request.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(request)}
                  >
                    <Feather name="check-circle" size={16} color="#fff" />
                    <Text style={styles.acceptButtonText}>Accept & Quote</Text>
                  </TouchableOpacity>
                )}

                {request.status === 'accepted' && (
                  <TouchableOpacity
                    style={styles.paidButton}
                    onPress={() => markAsPaid(request)}
                  >
                    <Feather name="credit-card" size={16} color="#fff" />
                    <Text style={styles.paidButtonText}>Mark as Paid</Text>
                  </TouchableOpacity>
                )}

                {request.status === 'paid' && (
                  <TouchableOpacity
                    style={styles.assignButton}
                    onPress={() => handleAssignRider(request)}
                  >
                    <Feather name="truck" size={16} color="#fff" />
                    <Text style={styles.assignButtonText}>Assign to Rider</Text>
                  </TouchableOpacity>
                )}

                {request.status === 'assigned' && request.rider_name && (
                  <View style={styles.assignedInfo}>
                    <Feather name="user-check" size={16} color="#10b981" />
                    <Text style={styles.assignedText}>Assigned to: {request.rider_name}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Accept Modal with Editable Fields and Split Percentage */}
      <Modal visible={showAcceptModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Accept & Quote</Text>
              <TouchableOpacity onPress={() => setShowAcceptModal(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalLabel}>Edit Bill Details</Text>
                
                {/* Distance Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Distance (km)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      value={editedDistance}
                      onChangeText={handleDistanceChange}
                      placeholder="Enter distance"
                      placeholderTextColor="#123"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Fee Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Delivery Fee (₦)</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.currencyPrefix}>₦</Text>
                    <TextInput
                      style={[styles.input, { paddingLeft: 30 }]}
                      value={editedFee}
                      onChangeText={handleFeeChange}
                      placeholder="Enter fee"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={styles.inputHint}>Min: ₦500, Max: ₦50,000</Text>
                </View>

                {/* Rider Percentage Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Rider Percentage (%)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      value={riderPercentage}
                      onChangeText={handleRiderPercentageChange}
                      placeholder="50"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                    />
                    <Text style={styles.inputSuffix}>%</Text>
                  </View>
                  <Text style={styles.inputHint}>
                    Default: {platformSettings.rider_percentage}% | Platform gets {100 - (parseFloat(riderPercentage) || platformSettings.rider_percentage)}%
                  </Text>
                </View>

                {/* Admin Notes */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Admin Notes (Optional)</Text>
                  <View style={styles.textAreaContainer}>
                    <TextInput
                      style={styles.textArea}
                      value={adminNote}
                      onChangeText={setAdminNote}
                      placeholder="Add any notes or adjustments..."
                      placeholderTextColor="#666"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                {/* Calculation Summary */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Fee Breakdown</Text>
                  
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Distance:</Text>
                    <Text style={styles.summaryValue}>{editedDistance || '0'} km</Text>
                  </View>
                  
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Weight:</Text>
                    <Text style={styles.summaryValue}>{selectedRequest.weight_kg} kg</Text>
                  </View>
                  
                  <View style={styles.summaryDivider} />
                  
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabelTotal}>Total Fee:</Text>
                    <Text style={styles.summaryValueTotal}>
                      ₦{parseFloat(editedFee || '0').toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Split Info */}
                <View style={styles.splitInfo}>
                  <Text style={styles.splitTitle}>Earnings Split</Text>
                  <View style={styles.splitRow}>
                    <Text style={styles.splitLabel}>Rider gets:</Text>
                    <Text style={styles.splitValue}>
                      ₦{(parseFloat(editedFee || '0') * (parseFloat(riderPercentage || '50') / 100)).toLocaleString()} 
                      ({riderPercentage || '50'}%)
                    </Text>
                  </View>
                  <View style={styles.splitRow}>
                    <Text style={styles.splitLabel}>Platform gets:</Text>
                    <Text style={styles.splitValue}>
                      ₦{(parseFloat(editedFee || '0') * (1 - (parseFloat(riderPercentage || '50') / 100))).toLocaleString()} 
                      ({100 - (parseFloat(riderPercentage || '50'))}%)
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowAcceptModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    onPress={confirmAcceptRequest}
                  >
                    <Text style={styles.modalConfirmText}>Accept & Send Bill</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Assign Rider Modal */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Rider</Text>
              <TouchableOpacity onPress={() => {
                setShowAssignModal(false);
                setSelectedRider(null);
              }}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {availableRiders.length === 0 ? (
                <View style={styles.noRidersContainer}>
                  <Feather name="truck" size={40} color="#666" />
                  <Text style={styles.noRidersText}>No available riders</Text>
                </View>
              ) : (
                availableRiders.map((rider) => (
                  <TouchableOpacity
                    key={rider.id}
                    style={[
                      styles.riderItem,
                      selectedRider?.id === rider.id && styles.riderItemSelected,
                    ]}
                    onPress={() => setSelectedRider(rider)}
                  >
                    <View style={styles.riderAvatar}>
                      <Text style={styles.riderAvatarText}>
                        {rider.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.riderInfo}>
                      <Text style={styles.riderName}>{rider.name}</Text>
                      <Text style={styles.riderDetails}>
                        {rider.vehicle_type} • {rider.phone}
                      </Text>
                    </View>
                    {selectedRider?.id === rider.id && (
                      <Feather name="check-circle" size={20} color="#10b981" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {selectedRider && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAssignModal(false);
                    setSelectedRider(null);
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={confirmAssignRider}
                >
                  <Text style={styles.modalConfirmText}>Assign Rider</Text>
                </TouchableOpacity>
              </View>
            )}
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
        paddingBottom:25,

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
  statsScroll: {
    maxHeight: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statCardActive: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  requestCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  requestTime: {
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
    fontSize: 10,
    fontWeight: '600',
  },
  packageSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  packageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  packageItem: {
    flex: 1,
    minWidth: '40%',
  },
  packageLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  packageValue: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500',
  },
  locationsSection: {
    marginBottom: 12,
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: '#fff',
  },
  locationContact: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  receiverPhone: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '500',
  },
  feeSection: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  feeLabel: {
    fontSize: 13,
    color: '#666',
  },
  feeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splitSmallText: {
    fontSize: 10,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  paidButton: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  paidButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  assignButton: {
    flex: 1,
    backgroundColor: '#f97316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  assignedInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 8,
  },
  assignedText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
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
  modalLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 48,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 12,
    height: '100%',
  },
  currencyPrefix: {
    position: 'absolute',
    left: 12,
    color: '#666',
    fontSize: 14,
  },
  inputSuffix: {
    color: '#666',
    fontSize: 14,
    paddingRight: 12,
  },
  inputHint: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  textAreaContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 12,
  },
  textArea: {
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
  },
  summaryCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  summaryValue: {
    fontSize: 13,
    color: '#fff',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 8,
  },
  summaryLabelTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  summaryValueTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  splitInfo: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  splitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 12,
  },

  splitLabel: {
    fontSize: 13,
    color: '#666',
  },
  splitValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  modalConfirmButton: {
    flex: 2,
    backgroundColor: '#f97316',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noRidersContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noRidersText: {
    color: '#666',
    marginTop: 12,
  },
  riderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#0a0a0a',
    marginBottom: 8,
  },
  riderItemSelected: {
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  riderDetails: {
    fontSize: 12,
    color: '#666',
  },
});