
// app/screens/customer/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import type { Address } from '../../types';
import Toast from 'react-native-toast-message';


type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UserStats {
  orders: number;
  favorites: number;
  rewards: number;
}

const menuItems = [
  { icon: 'heart', label: 'Favorites', path: 'Favorites', color: '#ef4444' },
  { icon: 'map-pin', label: 'Saved Addresses', path: 'Addresses', color: '#f97316' },
  { icon: 'shield', label: 'Privacy & Security', path: 'Privacy', color: '#10b981' },
  { icon: 'help-circle', label: 'Help & Support', path: 'Support', color: '#f59e0b' },
];

export function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, signOut } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [stats, setStats] = useState<UserStats>({
    orders: 0,
    favorites: 0,
    rewards: 0
  });
  const [isLoading, setIsLoading] = useState(true);
 const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  // New address form state
  const [newAddress, setNewAddress] = useState({
    label: '',
    street: '',
    area: '',
    landmark: '',
    phone: user?.phone || '',
  });

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Fetch addresses
      const { data: addressesData, error: addressesError } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (addressesError) throw addressesError;
      setAddresses(addressesData || []);

      // Fetch orders count
      const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', user.id);

      if (ordersError) throw ordersError;

      // Fetch favorites count
      const { count: favoritesCount, error: favoritesError } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (favoritesError && favoritesError.code !== 'PGRST116') throw favoritesError;

      setStats({
        orders: ordersCount || 0,
        favorites: favoritesCount || 0,
        rewards: 0
      });

    } catch (error) {
     
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editedName })
        .eq('id', user.id);

      if (error) throw error;

      showToast( 'Profile updated successfully');
      setShowEditProfile(false);
      
      // Refresh user data (you might want to update the auth context)
      fetchUserData();
    } catch (error) {
      showToast('Failed to update profile');
    }
  };

  const handleSaveAddress = async () => {
    if (!user) return;

    // Validate
    if (!newAddress.label || !newAddress.street || !newAddress.area || !newAddress.phone) {
      showToast('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('addresses')
        .insert({
          user_id: user.id,
          label: newAddress.label,
          street: newAddress.street,
          area: newAddress.area,
          landmark: newAddress.landmark || null,
          phone: newAddress.phone,
          is_default: addresses.length === 0,
        });

      if (error) throw error;

      showToast( 'Address added successfully');
      setShowAddAddress(false);
      setNewAddress({ label: '', street: '', area: '', landmark: '', phone: user.phone || '' });
      fetchUserData();
    } catch (error) {
      showToast('Failed to add address');
    }
  };

  const handleDeleteAddress = (addressId: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('addresses')
                .delete()
                .eq('id', addressId);

              if (error) throw error;

              showToast( 'Address deleted');
              fetchUserData();
            } catch (error) {
              showToast('Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;

      showToast('Default address updated');
      fetchUserData();
    } catch (error) {
      showToast( 'Failed to update default address');
    }
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notLoggedInContainer}>
          <View style={styles.notLoggedInIcon}>
            <Feather name="user" size={40} color="#666" />
          </View>
          <Text style={styles.notLoggedInTitle}>Sign in to continue</Text>
          <Text style={styles.notLoggedInText}>
            Access your orders, saved addresses, and more
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.signInButton}
          >
            <LinearGradient
              colors={['#f97316', '#10b981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signInGradient}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setEditedName(user.name);
            setShowEditProfile(true);
          }}
          style={styles.editButton}
        >
          <Feather name="edit-2" size={18} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#f97316', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarPlaceholder}
              >
                <Text style={styles.avatarInitials}>{getUserInitials()}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            {user.phone && (
              <View style={styles.profileDetail}>
                <Feather name="phone" size={14} color="#666" />
                <Text style={styles.profileDetailText}>{user.phone}</Text>
              </View>
            )}
            {user.email && (
              <View style={styles.profileDetail}>
                <Feather name="mail" size={14} color="#666" />
                <Text style={styles.profileDetailText} numberOfLines={1}>{user.email}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.orders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.favorites}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.rewards}</Text>
            <Text style={styles.statLabel}>Rewards</Text>
          </View>
        </View>

        {/* Saved Addresses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            <TouchableOpacity
              onPress={() => setShowAddAddress(true)}
              style={styles.addButton}
            >
              <Feather name="plus" size={16} color="#f97316" />
              <Text style={styles.addButtonText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {addresses.length > 0 ? (
            <View style={styles.addressesList}>
              {addresses.map(address => (
                <View key={address.id} style={styles.addressCard}>
                  <View style={styles.addressIcon}>
                    <Feather name="map-pin" size={20} color="#f97316" />
                  </View>
                  <View style={styles.addressInfo}>
                    <View style={styles.addressHeader}>
                      <Text style={styles.addressLabel}>{address.label}</Text>
                      {address.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressText}>
                      {address.street}, {address.area}
                    </Text>
                    {address.landmark && (
                      <Text style={styles.addressDetail}>
                        Landmark: {address.landmark}
                      </Text>
                    )}
                  </View>
                  <View style={styles.addressActions}>
                    {!address.is_default && (
                      <TouchableOpacity
                        onPress={() => handleSetDefaultAddress(address.id)}
                        style={styles.addressAction}
                      >
                        <Feather name="star" size={16} color="#666" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => handleDeleteAddress(address.id)}
                      style={styles.addressAction}
                    >
                      <Feather name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowAddAddress(true)}
              style={styles.emptyAddresses}
            >
              <Feather name="map-pin" size={24} color="#666" />
              <Text style={styles.emptyAddressesText}>No saved addresses</Text>
              <Text style={styles.emptyAddressesSubtext}>Tap to add your first address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => navigation.navigate(item.path as never)}
              style={styles.menuItem}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                <Feather name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <View style={styles.logoutIcon}>
            <Feather name="log-out" size={20} color="#ef4444" />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Your name"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Phone</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalInputDisabled]}
                  value={user.phone}
                  editable={false}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Email</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalInputDisabled]}
                  value={user.email}
                  editable={false}
                />
              </View>

              <TouchableOpacity onPress={handleSaveProfile} style={styles.modalButton}>
                <LinearGradient
                  colors={['#f97316', '#10b981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Save Changes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Address Modal */}
      <Modal
        visible={showAddAddress}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddAddress(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.addressModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Address</Text>
              <TouchableOpacity onPress={() => setShowAddAddress(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Label *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAddress.label}
                  onChangeText={(text) => setNewAddress({...newAddress, label: text})}
                  placeholder="e.g., Home, School, Office"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Street Address *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAddress.street}
                  onChangeText={(text) => setNewAddress({...newAddress, street: text})}
                  placeholder="Enter street address"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Area *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAddress.area}
                  onChangeText={(text) => setNewAddress({...newAddress, area: text})}
                  placeholder="e.g., Epe, Ikorodu"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Landmark (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAddress.landmark}
                  onChangeText={(text) => setNewAddress({...newAddress, landmark: text})}
                  placeholder="Nearby landmark"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Phone Number *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAddress.phone}
                  onChangeText={(text) => setNewAddress({...newAddress, phone: text})}
                  placeholder="Contact number for delivery"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity onPress={handleSaveAddress} style={styles.modalButton}>
                <LinearGradient
                  colors={['#f97316', '#10b981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Save Address</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  notLoggedInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  notLoggedInIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  notLoggedInTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  notLoggedInText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  signInGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#0a0a0a',
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
  avatarInitials: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  profileDetailText: {
    fontSize: 13,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignSelf: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 13,
    color: '#f97316',
  },
  addressesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    color: '#f97316',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  addressDetail: {
    fontSize: 11,
    color: '#666',
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addressAction: {
    padding: 4,
  },
  emptyAddresses: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  emptyAddressesText: {
    fontSize: 14,
    color: '#666',
  },
  emptyAddressesSubtext: {
    fontSize: 12,
    color: '#f97316',
  },
  menuSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    gap: 12,
  },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
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
    maxHeight: '70%',
  },
  addressModalContent: {
    maxHeight: '80%',
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
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    gap: 16,
  },
  modalField: {
    gap: 6,
  },
  modalFieldLabel: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  modalInput: {
    height: 44,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 14,
  },
  modalInputDisabled: {
    backgroundColor: '#1a1a1a',
    color: '#666',
  },
  modalButton: {
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  modalButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});