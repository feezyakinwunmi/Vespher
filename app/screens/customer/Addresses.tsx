// app/screens/customer/AddressesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { AddressModal } from '../../components/customer/AddressModal';
import type { Address } from '../../types';
import { useLocation } from '../../contexts/LocationContext';
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';
type AddressesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Addresses'>;
type AddressesScreenRouteProp = RouteProp<RootStackParamList, 'Addresses'>;

export function AddressesScreen() {
  const navigation = useNavigation<AddressesScreenNavigationProp>();
  const route = useRoute<AddressesScreenRouteProp>();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
   const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
const { 
  currentLocationAddress, 
  requestLocation, 
  saveCurrentLocationAsAddress, // Add this
  isLoading: locationLoading 
} = useLocation();
  // Get selectMode from route params
  const selectMode = route.params?.selectMode || false;

  useEffect(() => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    fetchAddresses();
  }, [user]);

// In AddressesScreen.tsx, ensure fetchAddresses is working:

const fetchAddresses = async () => {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user?.id)
      .order('is_default', { ascending: false });

    if (error) throw error;
    setAddresses(data || []);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    showToast('Failed to load addresses');
  } finally {
    setIsLoading(false);
    setRefreshing(false);
  }
};

  const onRefresh = () => {
    setRefreshing(true);
    fetchAddresses();
  };

// app/screens/customer/AddressesScreen.tsx

const handleUseCurrentLocation = async () => {
  try {
    const savedAddress = await saveCurrentLocationAsAddress();
    if (savedAddress) {
      showToast('Current location saved to your addresses');
      await fetchAddresses(); // Refresh the list
      
      if (selectMode) {
        // If in select mode, go back with the saved address
        navigation.navigate('Cart', { selectedAddress: savedAddress });
      }
    }
  } catch (error) {
    showToast('Failed to save current location');
  }
};

const handleSelectAddress = (address: Address) => {
  if (selectMode) {
    // Go back to cart with selected address
    navigation.navigate('Cart', { selectedAddress: address });
  }
};

  const handleSaveAddress = async (addressData: any) => {
    try {
      if (editingAddress) {
        const { error } = await supabase
          .from('addresses')
          .update(addressData)
          .eq('id', editingAddress.id);

        if (error) throw error;
        showToast('Address updated');
      } else {
        const { error } = await supabase
          .from('addresses')
          .insert({
            user_id: user?.id,
            ...addressData,
            is_default: addresses.length === 0,
          });

        if (error) throw error;
        showToast( 'Address added');
      }
      fetchAddresses();
    } catch (error) {
      console.error('Error saving address:', error);
      showToast( 'Failed to save address');
      throw error;
    }
  };

  const handleDelete = (id: string) => {
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
                .eq('id', id);

              if (error) throw error;
              showToast('Address deleted');
              fetchAddresses();
            } catch (error) {
              console.error('Error deleting address:', error);
              showToast('Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (id: string) => {
    try {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user?.id);

      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      showToast( 'Default address updated');
      fetchAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
      showToast( 'Failed to update default address');
    }
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
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {selectMode ? 'Select Delivery Address' : 'Saved Addresses'}
          </Text>
        </View>
        {!selectMode && (
          <TouchableOpacity
            onPress={() => {
              setEditingAddress(null);
              setShowModal(true);
            }}
            style={styles.addButton}
          >
            <Feather name="plus" size={20} color="#f97316" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {/* Current Location Option */}

{!currentLocationAddress ? (
  <TouchableOpacity
    onPress={handleUseCurrentLocation}
    style={[
      styles.addressCard,
      styles.currentLocationCard,
      locationLoading && styles.loadingCard,
    ]}
    disabled={locationLoading}
  >
    <View style={styles.addressHeader}>
      <View style={[styles.addressIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
        <Feather name="navigation" size={20} color="#f97316" />
      </View>
      <View style={styles.addressInfo}>
        <Text style={styles.addressLabel}>📍 Use Current Location</Text>
        {locationLoading ? (
          <View style={styles.locationLoadingContainer}>
            <ActivityIndicator size="small" color="#f97316" />
            <Text style={styles.locationLoadingText}>Getting your location...</Text>
          </View>
        ) : (
          <Text style={styles.addressText}>
            Use your current location for delivery
          </Text>
        )}
      </View>
    </View>
  </TouchableOpacity>
) : (
  <TouchableOpacity
    onPress={handleUseCurrentLocation}
    style={[
      styles.addressCard,
      styles.currentLocationCard,
      locationLoading && styles.loadingCard,
    ]}
    disabled={locationLoading}
  >
    <View style={styles.addressHeader}>
      <View style={[styles.addressIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
        <Feather name="navigation" size={20} color="#f97316" />
      </View>
      <View style={styles.addressInfo}>
        <Text style={styles.addressLabel}>📍 Save Current Location</Text>
        {locationLoading ? (
          <View style={styles.locationLoadingContainer}>
            <ActivityIndicator size="small" color="#f97316" />
            <Text style={styles.locationLoadingText}>Getting your location...</Text>
          </View>
        ) : (
          <Text style={styles.addressText}>
            {currentLocationAddress.street}
          </Text>
        )}
      </View>
    </View>
    {!locationLoading && (
      <View style={styles.saveBadge}>
        <Feather name="download" size={14} color="#f97316" />
        <Text style={styles.saveBadgeText}>Tap to save to your addresses</Text>
      </View>
    )}
  </TouchableOpacity>
)}
        {/* Saved Addresses */}
        {addresses.length > 0 && (
          <View style={styles.addressList}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            {addresses.map(address => (
              <TouchableOpacity
                key={address.id}
                onPress={() => handleSelectAddress(address)}
                style={styles.addressCard}
                disabled={!selectMode}
              >
                <View style={styles.addressHeader}>
                  <View style={styles.addressIcon}>
                    <Feather name="map-pin" size={20} color="#f97316" />
                  </View>
                  <View style={styles.addressInfo}>
                    <View style={styles.addressLabelContainer}>
                      <Text style={styles.addressLabel}>{address.label}</Text>
                      {address.is_default && (
                        <View style={styles.defaultBadge}>
                          <Feather name="star" size={10} color="#f97316" />
                          <Text style={styles.defaultText}>Default</Text>
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
                    <Text style={styles.addressDetail}>
                      Phone: {address.phone}
                    </Text>
                  </View>
                </View>

                {!selectMode && (
                  <View style={styles.addressActions}>
                    {!address.is_default && (
                      <TouchableOpacity
                        onPress={() => handleSetDefault(address.id)}
                        style={styles.actionButton}
                      >
                        <Feather name="star" size={18} color="#666" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        setEditingAddress(address);
                        setShowModal(true);
                      }}
                      style={styles.actionButton}
                    >
                      <Feather name="edit-2" size={18} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(address.id)}
                      style={styles.actionButton}
                    >
                      <Feather name="trash-2" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty State for non-select mode */}
        {addresses.length === 0 && !selectMode && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="map-pin" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>No addresses yet</Text>
            <Text style={styles.emptyText}>
              Add your first delivery address
            </Text>
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              style={styles.emptyButton}
            >
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyButtonGradient}
              >
                <Text style={styles.emptyButtonText}>Add Address</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Address Modal */}
      <AddressModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingAddress(null);
        }}
        onSave={handleSaveAddress}
        address={editingAddress}
      />
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
  // Add to styles:
saveBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 8,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: 'rgba(249,115,22,0.2)',
  gap: 4,
},
saveBadgeText: {
  color: '#f97316',
  fontSize: 12,
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
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  currentLocationCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.05)',
  },
  loadingCard: {
    opacity: 0.7,
  },
  locationLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  locationLoadingText: {
    color: '#f97316',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  addressList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  addressCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  addressHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  addressLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  defaultText: {
    fontSize: 9,
    color: '#f97316',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  addressDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addressActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionButton: {
    padding: 4,
  },
  bottomPadding: {
    height: 20,
  },
});