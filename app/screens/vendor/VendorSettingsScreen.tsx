// app/screens/vendor/VendorSettingsScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { BusinessHours, useVendorProfile, VendorProfile } from '../../hooks/vendor/useVendorProfile';
import { PromoCodeManager } from '../../components/vendor/PromoCodeManager';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';
type VendorScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SettingsTab = 'profile' | 'business' | 'bank' | 'preferences' | 'promos';
type NotificationKey = keyof VendorProfile['notifications'];
const banks = ['GTBank', 'First Bank', 'UBA', 'Zenith', 'Access', 'Kuda', 'OPay', 'PalmPay'];


type DayKey = keyof BusinessHours;
const businessCategories = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fastfood', label: 'Fast Food' },
  { value: 'local', label: 'Local Cuisine' },
  { value: 'seafood', label: 'Seafood' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'pharmacy', label: 'Pharmacy' },
];

const days: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export function VendorSettingsScreen() {
    const navigation = useNavigation<VendorScreenNavigationProp>();
  const { signOut } = useAuth();
  const { profile, isLoading, updateProfile } = useVendorProfile();
   const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isUploading, setIsUploading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
const notificationItems: { key: NotificationKey; label: string }[] = [
  { key: 'newOrders', label: 'New Order Alerts' },
  { key: 'orderUpdates', label: 'Order Status Updates' },
  { key: 'payments', label: 'Payment Notifications' },
];

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
             await signOut();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'business', label: 'Business', icon: 'home' },
    { id: 'bank', label: 'Bank', icon: 'credit-card' },
    { id: 'preferences', label: 'Settings', icon: 'clock' },
    { id: 'promos', label: 'Promos', icon: 'tag' },
  ];

  const handleEdit = () => {
    setFormData({
      ...profile,
      businessHours: { ...profile.businessHours }
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateProfile(formData);
      setIsEditing(false);
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  const pickImage = async (type: 'avatar' | 'logo' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'cover' ? [16, 9] : [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      try {
        const file = result.assets[0];
        const fileName = `${type}-${Date.now()}.jpg`;
        const filePath = `vendors/${profile.id}/${fileName}`;

        // Convert uri to blob
        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from(`vendor-${type}s`)
          .upload(filePath, blob, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(`vendor-${type}s`)
          .getPublicUrl(filePath);

        if (type === 'avatar') {
          setFormData({ ...formData, avatar_url: publicUrl });
        } else if (type === 'logo') {
          setFormData({ ...formData, businessLogo: publicUrl });
        } else {
          setFormData({ ...formData, businessCover: publicUrl });
        }

        showToast('Image uploaded successfully');
      } catch (error) {
        console.error('Error uploading image:', error);
       showToast('Failed to upload image');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          {formData.avatar_url || profile.avatar_url ? (
            <Image 
              source={{ uri: formData.avatar_url || profile.avatar_url }} 
              style={styles.avatarImage}
            />
          ) : (
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              style={styles.avatarPlaceholder}
            >
              <Text style={styles.avatarText}>
                {profile.name?.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </View>
        {isEditing && (
          <TouchableOpacity
            onPress={() => pickImage('avatar')}
            style={styles.avatarEditButton}
            disabled={isUploading}
          >
            <Feather name="camera" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Full Name</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.name || ''}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Your name"
            placeholderTextColor="#666"
          />
        ) : (
          <Text style={styles.value}>{profile.name}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile.email}</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone Number</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.phone || ''}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="Phone number"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
          />
        ) : (
          <Text style={styles.value}>{profile.phone || 'Not provided'}</Text>
        )}
      </View>

      <View style={styles.settingsCard}>
  <TouchableOpacity
    onPress={() => navigation.navigate('VendorAddresses')}
    style={styles.menuItem}
  >
    <View style={styles.menuItemLeft}>
      <Feather name="map-pin" size={20} color="#f97316" />
      <View>
        <Text style={styles.menuItemTitle}>Business Addresses</Text>
        <Text style={styles.menuItemSubtitle}>Manage your pickup and delivery locations</Text>
      </View>
    </View>
    <Feather name="chevron-right" size={20} color="#666" />
  </TouchableOpacity>
</View>
    </View>
  );

  const renderBusinessTab = () => (
    <View style={styles.tabContent}>
      {/* Logo Upload */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Business Logo</Text>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            {formData.businessLogo || profile.businessLogo ? (
              <Image 
                source={{ uri: formData.businessLogo || profile.businessLogo }} 
                style={styles.logoImage}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Feather name="image" size={24} color="#666" />
              </View>
            )}
          </View>
          {isEditing && (
            <TouchableOpacity
              onPress={() => pickImage('logo')}
              style={styles.uploadButton}
              disabled={isUploading}
            >
              <Text style={styles.uploadButtonText}>
                {isUploading ? 'Uploading...' : 'Upload Logo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Cover Image */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Cover Image</Text>
        <View style={styles.coverContainer}>
          {formData.businessCover || profile.businessCover ? (
            <Image 
              source={{ uri: formData.businessCover || profile.businessCover }} 
              style={styles.coverImage}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Feather name="image" size={32} color="#666" />
            </View>
          )}
          {isEditing && (
            <TouchableOpacity
              onPress={() => pickImage('cover')}
              style={styles.coverEditButton}
              disabled={isUploading}
            >
              <Text style={styles.coverEditText}>
                {isUploading ? 'Uploading...' : 'Change Cover'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Business Details */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Business Name</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.businessName || ''}
            onChangeText={(text) => setFormData({ ...formData, businessName: text })}
            placeholder="Business name"
            placeholderTextColor="#666"
          />
        ) : (
          <Text style={styles.value}>{profile.businessName}</Text>
        )}
      </View>

     <View style={styles.formGroup}>
  <Text style={styles.label}>Category</Text>
  {isEditing ? (
    <View style={styles.pickerContainer}>
      {businessCategories.map((cat) => (
        <TouchableOpacity
          key={cat.value}
          onPress={() => setFormData({ ...formData, businessCategory: cat.value })}
          style={[
            styles.categoryChip,
            formData.businessCategory === cat.value && styles.categoryChipSelected,
          ]}
        >
          <Text style={[
            styles.categoryChipText,
            formData.businessCategory === cat.value && styles.categoryChipTextSelected,
          ]}>
            {cat.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ) : (
    <Text style={styles.value}>
      {businessCategories.find(c => c.value === profile.businessCategory)?.label || profile.businessCategory || 'Not set'}
    </Text>
  )}
</View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Business Address</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.businessAddress || ''}
            onChangeText={(text) => setFormData({ ...formData, businessAddress: text })}
            placeholder="Business address"
            placeholderTextColor="#666"
            multiline
          />
        ) : (
          <Text style={styles.value}>{profile.businessAddress}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.businessDescription || ''}
            onChangeText={(text) => setFormData({ ...formData, businessDescription: text })}
            placeholder="Describe your business..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        ) : (
          <Text style={styles.value}>{profile.businessDescription || 'No description'}</Text>
        )}
      </View>
    </View>
  );

  const renderBankTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Bank Name</Text>
        {isEditing ? (
          <View style={styles.pickerContainer}>
            {['GTBank', 'First Bank', 'UBA', 'Zenith', 'Access', 'Kuda', 'OPay', 'PalmPay'].map((bank) => (
              <TouchableOpacity
                key={bank}
                onPress={() => setFormData({ ...formData, bankName: bank })}
                style={[
                  styles.bankChip,
                  formData.bankName === bank && styles.bankChipSelected,
                ]}
              >
                <Text style={[
                  styles.bankChipText,
                  formData.bankName === bank && styles.bankChipTextSelected,
                ]}>
                  {bank}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.value}>{profile.bankName || 'Not set'}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Account Number</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.accountNumber || ''}
            onChangeText={(text) => setFormData({ ...formData, accountNumber: text })}
            placeholder="10-digit account number"
            placeholderTextColor="#666"
            keyboardType="numeric"
            maxLength={10}
          />
        ) : (
          <Text style={styles.value}>{profile.accountNumber || 'Not set'}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Account Name</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.accountName || ''}
            onChangeText={(text) => setFormData({ ...formData, accountName: text })}
            placeholder="Account name"
            placeholderTextColor="#666"
          />
        ) : (
          <Text style={styles.value}>{profile.accountName || 'Not set'}</Text>
        )}
      </View>
    </View>
  );

  const renderPreferencesTab = () => (
    <View style={styles.tabContent}>
     <View style={styles.settingsCard}>
  <Text style={styles.settingsCardTitle}>Notifications</Text>
  
  {notificationItems.map((item) => (
    <View key={item.key} style={styles.notificationRow}>
      <Text style={styles.notificationLabel}>{item.label}</Text>
      {isEditing ? (
        <Switch
          value={formData.notifications?.[item.key] ?? true}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              notifications: { ...formData.notifications, [item.key]: value }
            })
          }
          trackColor={{ false: '#2a2a2a', true: '#f97316' }}
          thumbColor="#fff"
        />
      ) : (
        <View style={[
          styles.notificationIndicator,
          profile.notifications?.[item.key] && styles.notificationActive
        ]}>
          <Feather 
            name={profile.notifications?.[item.key] ? 'check' : 'x'} 
            size={14} 
            color={profile.notifications?.[item.key] ? '#10b981' : '#666'} 
          />
        </View>
      )}
    </View>
  ))}
</View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>Business Hours</Text>
        
        {days.map(({ key, label }) => (
          <View key={key} style={styles.hoursRow}>
            <Text style={styles.hoursLabel}>{label}</Text>
            {isEditing ? (
              <TextInput
                style={styles.hoursInput}
                value={formData.businessHours?.[key] || 'Closed'}
                onChangeText={(text) => 
                  setFormData({
                    ...formData,
                    businessHours: { ...formData.businessHours, [key]: text }
                  })
                }
                placeholder="9:00-21:00"
                placeholderTextColor="#666"
              />
            ) : (
              <Text style={styles.hoursValue}>
                {profile.businessHours?.[key] || 'Closed'}
              </Text>
            )}
          </View>
        ))}
      </View>

     <View style={styles.settingsCard}>
  <Text style={styles.settingsCardTitle}>Notifications</Text>
  
  {notificationItems.map((item) => (
    <View key={item.key} style={styles.notificationRow}>
      <Text style={styles.notificationLabel}>{item.label}</Text>
      {isEditing ? (
        <Switch
          value={formData.notifications?.[item.key] ?? true}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              notifications: { ...formData.notifications, [item.key]: value }
            })
          }
          trackColor={{ false: '#2a2a2a', true: '#f97316' }}
          thumbColor="#fff"
        />
      ) : (
        <View style={[
          styles.notificationIndicator,
          profile.notifications?.[item.key] && styles.notificationActive
        ]}>
          <Feather 
            name={profile.notifications?.[item.key] ? 'check' : 'x'} 
            size={14} 
            color={profile.notifications?.[item.key] ? '#10b981' : '#666'} 
          />
        </View>
      )}
    </View>
  ))}
</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Mobile Menu Toggle */}
      <TouchableOpacity
        style={styles.mobileMenuToggle}
        onPress={() => setShowMobileMenu(!showMobileMenu)}
      >
        <Text style={styles.mobileMenuText}>
          {tabs.find(t => t.id === activeTab)?.label || 'Menu'}
        </Text>
        <Feather name={showMobileMenu ? 'chevron-up' : 'chevron-down'} size={20} color="#f97316" />
      </TouchableOpacity>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <View style={styles.mobileMenu}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                setActiveTab(tab.id as SettingsTab);
                setShowMobileMenu(false);
              }}
              style={[
                styles.mobileMenuItem,
                activeTab === tab.id && styles.mobileMenuItemActive,
              ]}
            >
              <Feather 
                name={tab.icon as any} 
                size={18} 
                color={activeTab === tab.id ? '#fff' : '#666'} 
              />
              <Text style={[
                styles.mobileMenuItemText,
                activeTab === tab.id && styles.mobileMenuItemTextActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Desktop Tabs (hidden on mobile) */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.desktopTabs}
        contentContainerStyle={styles.desktopTabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as SettingsTab)}
            style={[
              styles.desktopTab,
              activeTab === tab.id && styles.desktopTabActive,
            ]}
          >
            <Feather 
              name={tab.icon as any} 
              size={16} 
              color={activeTab === tab.id ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.desktopTabText,
              activeTab === tab.id && styles.desktopTabTextActive,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {isEditing ? (
          <>
            <TouchableOpacity
              onPress={handleCancel}
              style={[styles.actionButton, styles.cancelButton]}
            >
              <Feather name="x" size={18} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.actionButton, styles.saveButton]}
            >
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                style={styles.saveButtonGradient}
              >
                <Feather name="save" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={handleEdit}
            style={[styles.actionButton, styles.editButton]}
          >
            <Feather name="edit-2" size={18} color="#f97316" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'business' && renderBusinessTab()}
          {activeTab === 'bank' && renderBankTab()}
          {activeTab === 'preferences' && renderPreferencesTab()}
          {activeTab === 'promos' && <PromoCodeManager />}
        </View>

        {/* Logout Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Feather name="log-out" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingBottom:80,
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
  headerRight: {
    width: 40,
  },
  mobileMenuToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
  },
  mobileMenuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  mobileMenu: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 8,
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  mobileMenuItemActive: {
    backgroundColor: '#f97316',
  },
  mobileMenuItemText: {
    fontSize: 14,
    color: '#666',
  },
  mobileMenuItemTextActive: {
    color: '#fff',
  },
  desktopTabs: {
    maxHeight: 60,
    display: 'none', // Hide on mobile, show on web
  },
  desktopTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  desktopTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  desktopTabActive: {
    backgroundColor: '#f97316',
  },
  desktopTabText: {
    fontSize: 13,
    color: '#666',
  },
  desktopTabTextActive: {
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  editButtonText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentCard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tabContent: {
    gap: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  avatarImage: {
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
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    color: '#fff',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#2a2a2a',
  padding: 16,
  borderRadius: 8,
},
menuItemLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  flex: 1,
},
menuItemTitle: {
  fontSize: 15,
  fontWeight: '500',
  color: '#fff',
  marginBottom: 2,
},
menuItemSubtitle: {
  fontSize: 11,
  color: '#666',
},
  uploadButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '500',
  },
  coverContainer: {
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverEditButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  coverEditText: {
    color: '#fff',
    fontSize: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
  },
  categoryChipSelected: {
    backgroundColor: '#f97316',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  bankChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
  },
  bankChipSelected: {
    backgroundColor: '#f97316',
  },
  bankChipText: {
    fontSize: 12,
    color: '#666',
  },
  bankChipTextSelected: {
    color: '#fff',
  },
  settingsCard: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hoursLabel: {
    fontSize: 13,
    color: '#666',
  },
  hoursValue: {
    fontSize: 13,
    color: '#fff',
  },
  hoursInput: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    width: 120,
    textAlign: 'right',
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationLabel: {
    fontSize: 13,
    color: '#666',
  },
  notificationIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationActive: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
});