
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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';

type UserRole = 'customer' | 'vendor' | 'rider' | 'admin' | 'business';
type UserStatus = 'all' | 'active' | 'suspended' | 'pending';

interface User {

  
  // Vendor specific fields (from vendors table)
  vendor_id?: string;
  vendor_name?: string;
  vendor_description?: string;
  vendor_category?: string;
  vendor_image_url?: string;
  vendor_cover_url?: string;
  vendor_address?: string;
  vendor_phone?: string;
  vendor_email?: string;
  vendor_rating?: string;
  vendor_review_count?: number;
  vendor_delivery_time?: string;
  vendor_delivery_fee?: number;
  vendor_min_order?: number;
  vendor_is_open?: boolean;
  vendor_opening_hours?: string;
  vendor_delivery_radius?: number;
  vendor_latitude?: number;
  vendor_longitude?: number;
  

  

  
  // Location

  
  // Stats
 

  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  is_online?: boolean;
  is_approved: boolean;
  is_suspended: boolean;
  is_available?: boolean;
  
  // Vendor specific fields
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  license_number?: string | null;
  total_deliveries?: number;
  address?: string | null;
  description?: string | null;
  website?: string | null;
  tax_id?: string | null;
  business_reg_number?: string | null;
  cover_url?: string | null;
  
  // Bank details
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  
  // Location
  current_latitude?: number | null;
  current_longitude?: number | null;
  last_location_update?: string | null;
  
  // Stats (calculated)
  average_rating?: number;
  total_reviews?: number;
  total_orders?: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  user_id: string;
  created_at: string;
  user_name?: string;
}

export function AdminUsersScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<UserStatus>('all');
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userReviews, setUserReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  // Action modal
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'delete' | 'approve'>('suspend');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, selectedRole, selectedStatus]);

 const fetchUsers = async () => {
  try {
    setLoading(true);
    
    // Fetch all users from auth/users table
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    // Fetch all vendors
    const { data: vendorsData, error: vendorsError } = await supabase
      .from('vendors')
      .select('*');

    if (vendorsError) throw vendorsError;

    // Create a map of vendor data by owner_id
    const vendorMap = new Map();
    vendorsData?.forEach(vendor => {
      vendorMap.set(vendor.owner_id, {
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_description: vendor.description,
        vendor_category: vendor.category,
        vendor_image_url: vendor.image_url,
        vendor_cover_url: vendor.cover_image_url,
        vendor_address: vendor.address,
        vendor_phone: vendor.phone,
        vendor_email: vendor.email,
        vendor_rating: parseFloat(vendor.rating) || 0,
        vendor_review_count: vendor.review_count || 0,
        vendor_delivery_time: vendor.delivery_time,
        vendor_delivery_fee: vendor.delivery_fee,
        vendor_min_order: vendor.min_order,
        vendor_is_open: vendor.is_open,
        vendor_is_approved: vendor.is_approved,
        vendor_is_suspended: vendor.is_suspended,
        vendor_opening_hours: vendor.opening_hours,
        vendor_delivery_radius: vendor.delivery_radius,
        vendor_latitude: vendor.latitude,
        vendor_longitude: vendor.longitude,
        bank_name: vendor.bank_name,
        account_number: vendor.account_number,
        account_name: vendor.account_name,
      });
    });

    // Combine user data with vendor data
    const usersWithVendorData = usersData?.map(user => {
      const vendorData = vendorMap.get(user.id) || {};
      
      // For vendor role, override certain fields with vendor data
      if (user.role === 'vendor') {
        return {
          ...user,
          ...vendorData,
          // Use vendor approval/suspension status
          is_approved: vendorData.vendor_is_approved ?? user.is_approved,
          is_suspended: vendorData.vendor_is_suspended ?? user.is_suspended,
          // Set ratings from vendor table
          average_rating: vendorData.vendor_rating || 0,
          total_reviews: vendorData.vendor_review_count || 0,
          // Bank details from vendor table
          bank_name: vendorData.bank_name,
          account_number: vendorData.account_number,
          account_name: vendorData.account_name,
        };
      }
      
      return user;
    }) || [];

    setUsers(usersWithVendorData);
  } catch (error) {
    console.error('Error fetching users:', error);
    Toast.show({
      type: 'error',
      text1: 'Failed to load users',
    });
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Filter by role
    if (selectedRole !== 'all') {
      filtered = filtered.filter(u => u.role === selectedRole);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'active') {
        filtered = filtered.filter(u => !u.is_suspended && u.is_approved);
      } else if (selectedStatus === 'suspended') {
        filtered = filtered.filter(u => u.is_suspended);
      } else if (selectedStatus === 'pending') {
        filtered = filtered.filter(u => !u.is_approved && u.role === 'vendor');
      }
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(u => 
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.phone?.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  };

  const fetchUserReviews = async (userId: string, role: UserRole) => {
    if (role !== 'vendor') return;
    
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:user_id(name, email)
        `)
        .eq('vendor_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReviews = data?.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        user_id: review.user_id,
        created_at: review.created_at,
        user_name: review.user?.name || 'Anonymous',
      })) || [];

      setUserReviews(formattedReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleUserPress = async (user: User) => {
    setSelectedUser(user);
    setUserReviews([]);
    
    if (user.role === 'vendor') {
      await fetchUserReviews(user.id, user.role);
    }
    
    setShowUserModal(true);
  };

  const handleSuspendUser = (user: User) => {
    setSelectedUser(user);
    setActionType('suspend');
    setShowActionModal(true);
  };

  const handleUnsuspendUser = (user: User) => {
    setSelectedUser(user);
    setActionType('unsuspend');
    setShowActionModal(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setActionType('delete');
    setShowActionModal(true);
  };

  const handleApproveUser = (user: User) => {
    setSelectedUser(user);
    setActionType('approve');
    setShowActionModal(true);
  };

 const confirmAction = async () => {
  if (!selectedUser) return;

  setActionLoading(true);
  try {
    let error;

    if (selectedUser.role === 'vendor') {
      // For vendors, update the vendors table
      switch (actionType) {
        case 'suspend':
          ({ error } = await supabase
            .from('vendors')
            .update({ is_suspended: true })
            .eq('owner_id', selectedUser.id));
          break;
        case 'unsuspend':
          ({ error } = await supabase
            .from('vendors')
            .update({ is_suspended: false })
            .eq('owner_id', selectedUser.id));
          break;
        case 'approve':
          ({ error } = await supabase
            .from('vendors')
            .update({ is_approved: true })
            .eq('owner_id', selectedUser.id));
          break;
        case 'delete':
          // First delete vendor record, then user
          await supabase
            .from('vendors')
            .delete()
            .eq('owner_id', selectedUser.id);
          ({ error } = await supabase
            .from('users')
            .delete()
            .eq('id', selectedUser.id));
          break;
      }
    } else {
      // For other roles, update users table
      switch (actionType) {
        case 'suspend':
          ({ error } = await supabase
            .from('users')
            .update({ is_suspended: true })
            .eq('id', selectedUser.id));
          break;
        case 'unsuspend':
          ({ error } = await supabase
            .from('users')
            .update({ is_suspended: false })
            .eq('id', selectedUser.id));
          break;
        case 'delete':
          ({ error } = await supabase
            .from('users')
            .delete()
            .eq('id', selectedUser.id));
          break;
      }
    }

    if (error) throw error;

    Toast.show({
      type: 'success',
      text1: `User ${actionType === 'delete' ? 'deleted' : actionType === 'suspend' ? 'suspended' : actionType === 'unsuspend' ? 'unsuspended' : 'approved'} successfully`,
    });

    setShowActionModal(false);
    setShowUserModal(false);
    fetchUsers(); // Refresh the list
  } catch (error) {
    console.error('Error performing action:', error);
    Toast.show({
      type: 'error',
      text1: `Failed to ${actionType} user`,
    });
  } finally {
    setActionLoading(false);
  }
};
  const getRoleColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      customer: '#3b82f6',
      vendor: '#f97316',
      rider: '#10b981',
      admin: '#8b5cf6',
      business: '#f43f5e',
    };
    return colors[role] || '#666';
  };

  const getRoleIcon = (role: UserRole): keyof typeof Feather.glyphMap => {
    const icons: Record<UserRole, keyof typeof Feather.glyphMap> = {
      customer: 'user',
      vendor: 'shopping-bag',
      rider: 'truck',
      admin: 'shield',
      business: 'briefcase',
    };
    return icons[role];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

 const renderStars = (rating: number) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      stars.push(
        <Feather
          key={i}
          name="star"
          size={14}
          color="#fbbf24"
          style={{ marginRight: 2 }}
        />
      );
    } else if (i === fullStars + 1 && hasHalfStar) {
      stars.push(
        <Feather
          key={i}
          name="star"
          size={14}
          color="#fbbf24"
          style={{ marginRight: 2, opacity: 0.5 }}
        />
      );
    } else {
      stars.push(
        <Feather
          key={i}
          name="star"
          size={14}
          color="#374151"
          style={{ marginRight: 2 }}
        />
      );
    }
  }
  return stars;
};

  const roles: Array<{ label: string; value: UserRole | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Customer', value: 'customer' },
    { label: 'Vendor', value: 'vendor' },
    { label: 'Rider', value: 'rider' },
    { label: 'Business', value: 'business' },
    { label: 'Admin', value: 'admin' },
  ];

  const statuses: Array<{ label: string; value: UserStatus }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Pending', value: 'pending' },
  ];

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading users...</Text>
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
        <Text style={styles.headerTitle}>User Management</Text>
        <TouchableOpacity onPress={fetchUsers} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, phone..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={18} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Role Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        <View style={styles.filters}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.value}
              style={[
                styles.filterChip,
                selectedRole === role.value && styles.filterChipActive,
              ]}
              onPress={() => setSelectedRole(role.value as typeof selectedRole)}
            >
              <Text style={[
                styles.filterChipText,
                selectedRole === role.value && styles.filterChipTextActive,
              ]}>
                {role.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Status Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
        <View style={styles.filters}>
          {statuses.map((status) => (
            <TouchableOpacity
              key={status.value}
              style={[
                styles.filterChip,
                selectedStatus === status.value && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(status.value)}
            >
              <Text style={[
                styles.filterChipText,
                selectedStatus === status.value && styles.filterChipTextActive,
              ]}>
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredUsers.length} of {users.length} users
        </Text>
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
        renderItem={({ item: user }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => handleUserPress(user)}
            activeOpacity={0.7}
          >
            {/* User Avatar */}
            <View style={styles.userAvatar}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <LinearGradient
                  colors={[getRoleColor(user.role), getRoleColor(user.role) + '80']}
                  style={styles.avatarPlaceholder}
                >
                  <Text style={styles.avatarText}>
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </LinearGradient>
              )}
              
              {/* Online/Offline indicator */}
              {user.is_online && <View style={styles.onlineDot} />}
            </View>

            {/* User Info */}
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.name || 'No name'}
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) + '20' }]}>
                  <Feather name={getRoleIcon(user.role)} size={10} color={getRoleColor(user.role)} />
                  <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>
                    {user.role.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
              
              <View style={styles.userFooter}>
                <View style={styles.userMeta}>
                  <Feather name="calendar" size={12} color="#666" />
                  <Text style={styles.metaText}>{formatDate(user.created_at)}</Text>
                </View>

                {user.role === 'vendor' && user.average_rating ? (
                  <View style={styles.ratingContainer}>
                    {renderStars(user.average_rating)}
                    <Text style={styles.ratingText}>
                      {user.average_rating} ({user.total_reviews})
                    </Text>
                  </View>
                ) : null}

                {/* Status indicators */}
               {/* Status indicators */}
<View style={styles.statusContainer}>
  {user.is_suspended && (
    <View style={styles.suspendedBadge}>
      <Feather name="alert-circle" size={10} color="#ef4444" />
      <Text style={styles.suspendedText}>Suspended</Text>
    </View>
  )}
  {!user.is_approved && user.role === 'vendor' && (
    <View style={styles.pendingBadge}>
      <Feather name="clock" size={10} color="#f59e0b" />
      <Text style={styles.pendingText}>Pending</Text>
    </View>
  )}
  {user.role === 'vendor' && user.vendor_is_open && !user.is_suspended && user.is_approved && (
    <View style={styles.openBadge}>
      <Feather name="check-circle" size={10} color="#10b981" />
      <Text style={styles.openText}>Open</Text>
    </View>
  )}
  {user.role === 'vendor' && !user.vendor_is_open && !user.is_suspended && user.is_approved && (
    <View style={styles.closedBadge}>
      <Feather name="x-circle" size={10} color="#666" />
      <Text style={styles.closedText}>Closed</Text>
    </View>
  )}
</View>
              </View>
            </View>

            {/* Action buttons */}
        {/* Action buttons - different for each role */}
<View style={styles.userActions}>
  {/* Vendor-specific actions */}
  {user.role === 'vendor' && !user.is_approved && (
    <TouchableOpacity
      style={styles.approveButton}
      onPress={() => handleApproveUser(user)}
    >
      <Feather name="check-circle" size={18} color="#10b981" />
    </TouchableOpacity>
  )}
  
  {/* Suspend/Unsuspend for all roles */}
  {user.is_suspended ? (
    <TouchableOpacity
      style={styles.unsuspendButton}
      onPress={() => handleUnsuspendUser(user)}
    >
      <Feather name="user-check" size={18} color="#10b981" />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      style={styles.suspendButton}
      onPress={() => handleSuspendUser(user)}
    >
      <Feather name="user-x" size={18} color="#f59e0b" />
    </TouchableOpacity>
  )}
  
  {/* Delete for all roles */}
  <TouchableOpacity
    style={styles.deleteButton}
    onPress={() => handleDeleteUser(user)}
  >
    <Feather name="trash-2" size={18} color="#ef4444" />
  </TouchableOpacity>
</View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters</Text>
          </View>
        }
      />

      {/* User Details Modal */}
      <Modal visible={showUserModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedUser && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>User Details</Text>
                  <TouchableOpacity onPress={() => setShowUserModal(false)}>
                    <Feather name="x" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* User Profile Header */}
                <View style={styles.modalProfileHeader}>
                  <View style={styles.modalAvatarContainer}>
                    {selectedUser.avatar_url ? (
                      <Image source={{ uri: selectedUser.avatar_url }} style={styles.modalAvatar} />
                    ) : (
                      <LinearGradient
                        colors={[getRoleColor(selectedUser.role), getRoleColor(selectedUser.role) + '80']}
                        style={styles.modalAvatarPlaceholder}
                      >
                        <Text style={styles.modalAvatarText}>
                          {selectedUser.name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                  
                  <View style={styles.modalProfileInfo}>
                    <Text style={styles.modalUserName}>{selectedUser.name || 'No name'}</Text>
                    <View style={[styles.modalRoleBadge, { backgroundColor: getRoleColor(selectedUser.role) + '20' }]}>
                      <Feather name={getRoleIcon(selectedUser.role)} size={12} color={getRoleColor(selectedUser.role)} />
                      <Text style={[styles.modalRoleText, { color: getRoleColor(selectedUser.role) }]}>
                        {selectedUser.role.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Status Badges */}
                <View style={styles.modalStatusContainer}>
                  {selectedUser.is_suspended && (
                    <View style={styles.modalStatusBadgeSuspended}>
                      <Feather name="alert-circle" size={14} color="#ef4444" />
                      <Text style={styles.modalStatusTextSuspended}>Suspended</Text>
                    </View>
                  )}
                  {!selectedUser.is_approved && selectedUser.role === 'vendor' && (
                    <View style={styles.modalStatusBadgePending}>
                      <Feather name="clock" size={14} color="#f59e0b" />
                      <Text style={styles.modalStatusTextPending}>Pending Approval</Text>
                    </View>
                  )}
                  {selectedUser.is_online && (
                    <View style={styles.modalStatusBadgeOnline}>
                      <View style={styles.onlineDotLarge} />
                      <Text style={styles.modalStatusTextOnline}>Online</Text>
                    </View>
                  )}
                </View>

                {/* Contact Information */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Contact Information</Text>
                  <View style={styles.modalInfoRow}>
                    <Feather name="mail" size={16} color="#666" />
                    <Text style={styles.modalInfoLabel}>Email:</Text>
                    <Text style={styles.modalInfoValue}>{selectedUser.email}</Text>
                  </View>
                  {selectedUser.phone && (
                    <View style={styles.modalInfoRow}>
                      <Feather name="phone" size={16} color="#666" />
                      <Text style={styles.modalInfoLabel}>Phone:</Text>
                      <Text style={styles.modalInfoValue}>{selectedUser.phone}</Text>
                    </View>
                  )}
                </View>

                {/* Vendor Specific Information */}
                {selectedUser.role === 'vendor' && (
                  <>
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Business Information</Text>
                      {selectedUser.address && (
                        <View style={styles.modalInfoRow}>
                          <Feather name="map-pin" size={16} color="#666" />
                          <Text style={styles.modalInfoLabel}>Address:</Text>
                          <Text style={styles.modalInfoValue}>{selectedUser.address}</Text>
                        </View>
                      )}
                      {selectedUser.description && (
                        <View style={styles.modalInfoRow}>
                          <Feather name="info" size={16} color="#666" />
                          <Text style={styles.modalInfoLabel}>Description:</Text>
                          <Text style={styles.modalInfoValue}>{selectedUser.description}</Text>
                        </View>
                      )}
                      {selectedUser.website && (
                        <View style={styles.modalInfoRow}>
                          <Feather name="globe" size={16} color="#666" />
                          <Text style={styles.modalInfoLabel}>Website:</Text>
                          <Text style={styles.modalInfoValue}>{selectedUser.website}</Text>
                        </View>
                      )}
                      {selectedUser.tax_id && (
                        <View style={styles.modalInfoRow}>
                          <Feather name="hash" size={16} color="#666" />
                          <Text style={styles.modalInfoLabel}>Tax ID:</Text>
                          <Text style={styles.modalInfoValue}>{selectedUser.tax_id}</Text>
                        </View>
                      )}
                      {selectedUser.business_reg_number && (
                        <View style={styles.modalInfoRow}>
                          <Feather name="file-text" size={16} color="#666" />
                          <Text style={styles.modalInfoLabel}>Reg Number:</Text>
                          <Text style={styles.modalInfoValue}>{selectedUser.business_reg_number}</Text>
                        </View>
                      )}
                    </View>

                    {/* Bank Information */}
                    {(selectedUser.bank_name || selectedUser.account_number) && (
                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionTitle}>Bank Information</Text>
                        {selectedUser.bank_name && (
                          <View style={styles.modalInfoRow}>
                            <Feather name="home" size={16} color="#666" />
                            <Text style={styles.modalInfoLabel}>Bank:</Text>
                            <Text style={styles.modalInfoValue}>{selectedUser.bank_name}</Text>
                          </View>
                        )}
                        {selectedUser.account_number && (
                          <View style={styles.modalInfoRow}>
                            <Feather name="credit-card" size={16} color="#666" />
                            <Text style={styles.modalInfoLabel}>Account:</Text>
                            <Text style={styles.modalInfoValue}>{selectedUser.account_number}</Text>
                          </View>
                        )}
                        {selectedUser.account_name && (
                          <View style={styles.modalInfoRow}>
                            <Feather name="user" size={16} color="#666" />
                            <Text style={styles.modalInfoLabel}>Account Name:</Text>
                            <Text style={styles.modalInfoValue}>{selectedUser.account_name}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Rider Specific Information */}
{selectedUser && selectedUser.role === ('rider' as UserRole) && (
  <View style={styles.modalSection}>
    <Text style={styles.modalSectionTitle}>Rider Information</Text>
    {selectedUser.vehicle_type && (
      <View style={styles.modalInfoRow}>
        <Feather name="truck" size={16} color="#666" />
        <Text style={styles.modalInfoLabel}>Vehicle:</Text>
        <Text style={styles.modalInfoValue}>{selectedUser.vehicle_type}</Text>
      </View>
    )}
    {selectedUser.vehicle_number && (
      <View style={styles.modalInfoRow}>
        <Feather name="hash" size={16} color="#666" />
        <Text style={styles.modalInfoLabel}>Plate:</Text>
        <Text style={styles.modalInfoValue}>{selectedUser.vehicle_number}</Text>
      </View>
    )}
    {selectedUser.license_number && (
      <View style={styles.modalInfoRow}>
        <Feather name="award" size={16} color="#666" />
        <Text style={styles.modalInfoLabel}>License:</Text>
        <Text style={styles.modalInfoValue}>{selectedUser.license_number}</Text>
      </View>
    )}
    <View style={styles.modalInfoRow}>
      <Feather name="package" size={16} color="#666" />
      <Text style={styles.modalInfoLabel}>Deliveries:</Text>
      <Text style={styles.modalInfoValue}>{selectedUser.total_deliveries || 0}</Text>
    </View>
    <View style={styles.modalInfoRow}>
      <Feather name="activity" size={16} color="#666" />
      <Text style={styles.modalInfoLabel}>Available:</Text>
      <Text style={[styles.modalInfoValue, { color: selectedUser.is_available ? '#10b981' : '#ef4444' }]}>
        {selectedUser.is_available ? 'Yes' : 'No'}
      </Text>
    </View>
  </View>
)}

                    {/* Reviews Section */}
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>
                        Reviews ({selectedUser.total_reviews || 0})
                      </Text>
                      
                      {loadingReviews ? (
                        <ActivityIndicator size="small" color="#f97316" style={styles.reviewsLoader} />
                      ) : userReviews.length > 0 ? (
                        userReviews.map((review) => (
                          <View key={review.id} style={styles.reviewItem}>
                            <View style={styles.reviewHeader}>
                              <Text style={styles.reviewerName}>{review.user_name}</Text>
                              <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
                            </View>
                            <View style={styles.reviewStars}>
                              {renderStars(review.rating)}
                            </View>
                            {review.comment && (
                              <Text style={styles.reviewComment}>{review.comment}</Text>
                            )}
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noReviewsText}>No reviews yet</Text>
                      )}
                    </View>
                  </>
                )}

                {/* Account Information */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Account Information</Text>
                  <View style={styles.modalInfoRow}>
                    <Feather name="calendar" size={16} color="#666" />
                    <Text style={styles.modalInfoLabel}>Joined:</Text>
                    <Text style={styles.modalInfoValue}>{formatDate(selectedUser.created_at)}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Feather name="clock" size={16} color="#666" />
                    <Text style={styles.modalInfoLabel}>Last Updated:</Text>
                    <Text style={styles.modalInfoValue}>{formatDate(selectedUser.updated_at)}</Text>
                  </View>
                </View>

                {/* Modal Actions */}
             {/* Modal Actions */}
<View style={styles.modalActions}>
  {selectedUser.role === 'vendor' && !selectedUser.is_approved && (
    <TouchableOpacity
      style={[styles.modalActionButton, styles.modalApproveButton]}
      onPress={() => {
        setShowUserModal(false);
        handleApproveUser(selectedUser);
      }}
    >
      <Feather name="check-circle" size={20} color="#fff" />
      <Text style={styles.modalActionText}>Approve</Text>
    </TouchableOpacity>
  )}
  
  {selectedUser.is_suspended ? (
    <TouchableOpacity
      style={[styles.modalActionButton, styles.modalUnsuspendButton]}
      onPress={() => {
        setShowUserModal(false);
        handleUnsuspendUser(selectedUser);
      }}
    >
      <Feather name="user-check" size={20} color="#fff" />
      <Text style={styles.modalActionText}>Unsuspend</Text>
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      style={[styles.modalActionButton, styles.modalSuspendButton]}
      onPress={() => {
        setShowUserModal(false);
        handleSuspendUser(selectedUser);
      }}
    >
      <Feather name="user-x" size={20} color="#fff" />
      <Text style={styles.modalActionText}>Suspend</Text>
    </TouchableOpacity>
  )}
  
  <TouchableOpacity
    style={[styles.modalActionButton, styles.modalDeleteButton]}
    onPress={() => {
      setShowUserModal(false);
      handleDeleteUser(selectedUser);
    }}
  >
    <Feather name="trash-2" size={20} color="#fff" />
    <Text style={styles.modalActionText}>Delete</Text>
  </TouchableOpacity>
</View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={showActionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIcon}>
              <Feather 
                name={actionType === 'delete' ? 'alert-triangle' : 'info'} 
                size={40} 
                color={actionType === 'delete' ? '#ef4444' : '#f97316'} 
              />
            </View>
            
            <Text style={styles.confirmTitle}>
              {actionType === 'suspend' && 'Suspend User'}
              {actionType === 'unsuspend' && 'Unsuspend User'}
              {actionType === 'delete' && 'Delete User'}
              {actionType === 'approve' && 'Approve User'}
            </Text>
            
            <Text style={styles.confirmMessage}>
              {actionType === 'suspend' && `Are you sure you want to suspend ${selectedUser?.name}? They will not be able to access their account.`}
              {actionType === 'unsuspend' && `Are you sure you want to unsuspend ${selectedUser?.name}? They will regain access to their account.`}
              {actionType === 'delete' && `Are you sure you want to delete ${selectedUser?.name}? This action cannot be undone.`}
              {actionType === 'approve' && `Are you sure you want to approve ${selectedUser?.name}? They will be able to start selling.`}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setShowActionModal(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  actionType === 'delete' && styles.confirmDeleteButton,
                  actionType === 'suspend' && styles.confirmSuspendButton,
                  actionType === 'unsuspend' && styles.confirmUnsuspendButton,
                  actionType === 'approve' && styles.confirmApproveButton,
                ]}
                onPress={confirmAction}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {actionType === 'suspend' && 'Yes, Suspend'}
                    {actionType === 'unsuspend' && 'Yes, Unsuspend'}
                    {actionType === 'delete' && 'Yes, Delete'}
                    {actionType === 'approve' && 'Yes, Approve'}
                  </Text>
                )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
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
  filtersContainer: {
    minHeight: 40,
    maxHeight:40,
    paddingVertical:5,
    marginBottom: 8,
  },
  statusFilters: {
    minHeight: 40,
     maxHeight:40,
    marginBottom: 8,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
  resultsContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  userAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  roleText: {
    fontSize: 8,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  userFooter: {
    gap: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  suspendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  suspendedText: {
    fontSize: 8,
    color: '#ef4444',
    fontWeight: '600',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  pendingText: {
    fontSize: 8,
    color: '#f59e0b',
    fontWeight: '600',
  },
  userActions: {
    justifyContent: 'space-around',
    gap: 8,
    marginLeft: 8,
  },
  approveButton: {
    padding: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 8,
  },
  suspendButton: {
    padding: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
  },
  unsuspendButton: {
    padding: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 8,
  },
  deleteButton: {
    padding: 6,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalAvatarContainer: {
    marginRight: 16,
  },
  modalAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  modalAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalProfileInfo: {
    flex: 1,
  },
  modalUserName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modalRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  modalRoleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalStatusContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modalStatusBadgeSuspended: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  modalStatusTextSuspended: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  modalStatusBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  modalStatusTextPending: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
  },
  modalStatusBadgeOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  modalStatusTextOnline: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  onlineDotLarge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  modalInfoLabel: {
    fontSize: 12,
    color: '#666',
    width: 70,
  },
  modalInfoValue: {
    flex: 1,
    fontSize: 12,
    color: '#fff',
  },
  reviewsLoader: {
    marginVertical: 20,
  },
  reviewItem: {
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  reviewDate: {
    fontSize: 10,
    color: '#666',
  },
  reviewStars: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  reviewComment: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  noReviewsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  modalApproveButton: {
    backgroundColor: '#10b981',
  },
  modalSuspendButton: {
    backgroundColor: '#f59e0b',
  },
  modalUnsuspendButton: {
    backgroundColor: '#10b981',
  },
  modalDeleteButton: {
    backgroundColor: '#ef4444',
  },
  modalActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmModal: {
    width: '80%',
    maxWidth: 300,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  openBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(16,185,129,0.1)',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 12,
  gap: 4,
},
openText: {
  fontSize: 8,
  color: '#10b981',
  fontWeight: '600',
},
closedBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(107,114,128,0.1)',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 12,
  gap: 4,
},
closedText: {
  fontSize: 8,
  color: '#666',
  fontWeight: '600',
},
  confirmCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmCancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmDeleteButton: {
    backgroundColor: '#ef4444',
  },
  confirmSuspendButton: {
    backgroundColor: '#f59e0b',
  },
  confirmUnsuspendButton: {
    backgroundColor: '#10b981',
  },
  confirmApproveButton: {
    backgroundColor: '#10b981',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});