// app/screens/admin/AdminAnnouncementsScreen.tsx
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
  TextInput,
  Switch,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  target_roles: string[];
  action_link: string | null;
  action_label: string | null;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
  created_by: string;
}

const ROLE_OPTIONS = [
  { label: 'Customers', value: 'customer', color: '#f97316' },
  { label: 'Vendors', value: 'vendor', color: '#10b981' },
  { label: 'Riders', value: 'rider', color: '#8b5cf6' },
  { label: 'Business', value: 'business', color: '#f59e0b' },
  { label: 'Admin', value: 'admin', color: '#ef4444' },
  { label: 'All Users', value: 'all', color: '#f97316' },
];

const ACTION_LINKS = [
  { label: 'None', value: null },
  { label: 'Home', value: '/home' },
  { label: 'Orders', value: '/orders' },
  { label: 'Vendor Menu', value: '/vendor/menu' },
  { label: 'Available Deliveries', value: '/deliveries' },
  { label: 'Earnings', value: '/earnings' },
  { label: 'Promotions', value: '/promotions' },
];

export function AdminAnnouncementsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateType, setDateType] = useState<'start' | 'end'>('start');

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null); // Local URI for preview
  const [imageUrl, setImageUrl] = useState<string | null>(null); // Uploaded URL
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [actionLink, setActionLink] = useState<string | null>(null);
  const [actionLabel, setActionLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      Alert.alert('Error', 'Failed to load announcements');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const selectedUri = result.assets[0].uri;
      console.log('📸 Selected image URI:', selectedUri);
      
      // Set local URI for immediate preview
      setImageUri(selectedUri);
      setImageUrl(null); // Clear previous uploaded URL
    }
  };

const uploadImage = async () => {
  if (!imageUri) return null;

  setUploadingImage(true);
  try {
    // Read file as base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    
    // Extract base64 data
    const base64Data = base64.split(',')[1];
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('📸 Bytes length:', bytes.length);
    
    if (bytes.length === 0) {
      throw new Error('Image data is empty');
    }
    
    const fileExt = imageUri.split('.').pop() || 'png';
    const fileName = `announcement_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('announcements')
      .upload(fileName, bytes, {
        contentType: `image/${fileExt}`,
        cacheControl: '3600',
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('announcements')
      .getPublicUrl(fileName);

    console.log('✅ Uploaded:', publicUrl);
    return publicUrl;
    
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    Alert.alert('Error', error.message || 'Failed to upload image');
    return null;
  } finally {
    setUploadingImage(false);
  }
};

  const removeImage = () => {
    setImageUri(null);
    setImageUrl(null);
  };

  const toggleRole = (roleValue: string) => {
    if (roleValue === 'all') {
      if (selectedRoles.includes('all')) {
        setSelectedRoles([]);
      } else {
        setSelectedRoles(['all']);
      }
    } else {
      setSelectedRoles(prev => {
        let newRoles;
        if (prev.includes(roleValue)) {
          newRoles = prev.filter(r => r !== roleValue);
        } else {
          newRoles = [...prev, roleValue];
        }
        if (newRoles.includes('all')) {
          newRoles = newRoles.filter(r => r !== 'all');
        }
        return newRoles;
      });
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setImageUri(null);
    setImageUrl(null);
    setSelectedRoles([]);
    setActionLink(null);
    setActionLabel('');
    setIsActive(true);
    setStartDate(new Date());
    setEndDate(null);
    setEditingAnnouncement(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setMessage(announcement.message);
    setImageUrl(announcement.image_url);
    setImageUri(null); // No local URI for existing
    setSelectedRoles(announcement.target_roles);
    setActionLink(announcement.action_link);
    setActionLabel(announcement.action_label || '');
    setIsActive(announcement.is_active);
    setStartDate(new Date(announcement.start_date));
    setEndDate(announcement.end_date ? new Date(announcement.end_date) : null);
    setShowModal(true);
  };

const handleSubmit = async () => {
  if (!title.trim()) {
    Alert.alert('Error', 'Please enter a title');
    return;
  }
  if (!message.trim()) {
    Alert.alert('Error', 'Please enter a message');
    return;
  }
  if (selectedRoles.length === 0) {
    Alert.alert('Error', 'Please select at least one target role');
    return;
  }

  setIsSubmitting(true);
  try {
    // Upload image if there's a local URI
    let finalImageUrl = imageUrl;
    if (imageUri) {
      finalImageUrl = await uploadImage();
    }

    let error;
    
    if (editingAnnouncement) {
      // For editing, use direct update (no need to resend notifications)
      const { error: updateError } = await supabase
        .from('announcements')
        .update({
          title: title.trim(),
          message: message.trim(),
          image_url: finalImageUrl,
          target_roles: selectedRoles,
          action_link: actionLink,
          action_label: actionLabel || null,
          is_active: isActive,
          start_date: startDate.toISOString(),
          end_date: endDate ? endDate.toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingAnnouncement.id);
      error = updateError;
    } else {
      // For new announcement, use the RPC function that sends notifications
      const { error: rpcError } = await supabase
        .rpc('create_announcement_and_notify', {
          p_title: title.trim(),
          p_message: message.trim(),
          p_target_roles: selectedRoles,
          p_image_url: finalImageUrl,
          p_action_link: actionLink,
          p_action_label: actionLabel || null
        });
      error = rpcError;
    }

    if (error) throw error;

    Alert.alert('Success', editingAnnouncement ? 'Announcement updated' : 'Announcement created and sent to users');
    setShowModal(false);
    resetForm();
    fetchAnnouncements();
  } catch (error) {
    console.error('Error saving announcement:', error);
    Alert.alert('Error', 'Failed to save announcement');
  } finally {
    setIsSubmitting(false);
  }
};
  const handleDelete = (announcement: Announcement) => {
    Alert.alert(
      'Delete Announcement',
      `Are you sure you want to delete "${announcement.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', announcement.id);
              if (error) throw error;
              fetchAnnouncements();
              Alert.alert('Success', 'Announcement deleted');
            } catch (error) {
              console.error('Error deleting announcement:', error);
              Alert.alert('Error', 'Failed to delete announcement');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (announcement: Announcement) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: !announcement.is_active, updated_at: new Date().toISOString() })
        .eq('id', announcement.id);
      if (error) throw error;
      fetchAnnouncements();
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const getRoleBadges = (roles: string[]) => {
    if (roles.includes('all')) return 'All Users';
    return roles.map(r => {
      const option = ROLE_OPTIONS.find(o => o.value === r);
      return option?.label.split(' ')[0] || r;
    }).join(', ');
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcements</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
          <Feather name="plus" size={24} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {announcements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="phone" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>No announcements</Text>
            <Text style={styles.emptyText}>Create your first announcement to notify users</Text>
            <TouchableOpacity onPress={openCreateModal} style={styles.emptyButton}>
              <LinearGradient colors={['#f97316', '#f43f5e']} style={styles.emptyButtonGradient}>
                <Text style={styles.emptyButtonText}>Create Announcement</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.announcementsList}>
            {announcements.map((announcement) => (
              <View key={announcement.id} style={styles.announcementCard}>
                {announcement.image_url && (
                  <Image 
                    source={{ uri: announcement.image_url }} 
                    style={styles.cardImage}
                    onError={() => console.log('Failed to load image')}
                  />
                )}
                <View style={styles.cardHeader}>
                  <View style={styles.titleContainer}>
                    <Text style={styles.announcementTitle} numberOfLines={1}>
                      {announcement.title}
                    </Text>
                    <View style={[styles.statusBadge, announcement.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                      <Text style={styles.statusText}>
                        {announcement.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEditModal(announcement)} style={styles.actionIcon}>
                      <Feather name="edit-2" size={18} color="#f97316" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(announcement)} style={styles.actionIcon}>
                      <Feather name="trash-2" size={18} color="#ef4444" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleToggleStatus(announcement)} style={styles.actionIcon}>
                      <Feather name={announcement.is_active ? 'eye-off' : 'eye'} size={18} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.announcementMessage} numberOfLines={2}>
                  {announcement.message}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.rolesContainer}>
                    <Feather name="users" size={12} color="#666" />
                    <Text style={styles.rolesText}>{getRoleBadges(announcement.target_roles)}</Text>
                  </View>
                  <Text style={styles.dateText}>
                    {new Date(announcement.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Image Upload with Preview */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Image (Optional)</Text>
                <TouchableOpacity onPress={pickImage} style={styles.imageUploadButton}>
                  {(imageUri || imageUrl) ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image 
                        source={{ uri: imageUri || imageUrl || undefined }} 
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                      <TouchableOpacity onPress={removeImage} style={styles.removeImageButton}>
                        <Feather name="x-circle" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Feather name="image" size={32} color="#666" />
                      <Text style={styles.imagePlaceholderText}>Tap to upload image</Text>
                      <Text style={styles.imagePlaceholderSubtext}>PNG, JPG up to 2MB</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {uploadingImage && (
                  <View style={styles.uploadingIndicator}>
                    <ActivityIndicator size="small" color="#f97316" />
                    <Text style={styles.uploadingText}>Uploading image...</Text>
                  </View>
                )}
              </View>

              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter announcement title"
                  placeholderTextColor="#666"
                />
              </View>

              {/* Message */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Message *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Enter announcement message"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Target Roles */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Target Audience *</Text>
                <View style={styles.rolesGrid}>
                  {ROLE_OPTIONS.map((role) => (
                    <TouchableOpacity
                      key={role.value}
                      onPress={() => toggleRole(role.value)}
                      style={[
                        styles.roleChip,
                        selectedRoles.includes(role.value) && styles.roleChipSelected,
                      ]}
                    >
                      <Text style={[
                        styles.roleChipText,
                        selectedRoles.includes(role.value) && styles.roleChipTextSelected,
                      ]}>
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Action Link */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Action Link (Optional)</Text>
                <View style={styles.linksGrid}>
                  {ACTION_LINKS.map((link) => (
                    <TouchableOpacity
                      key={link.value || 'none'}
                      onPress={() => {
                        setActionLink(link.value);
                        if (link.value === '/home') setActionLabel('Go to Home');
                        else if (link.value === '/orders') setActionLabel('View Orders');
                        else if (link.value === '/vendor/menu') setActionLabel('View Menu');
                        else if (link.value === '/deliveries') setActionLabel('View Deliveries');
                        else if (link.value === '/earnings') setActionLabel('View Earnings');
                        else if (link.value === '/promotions') setActionLabel('View Promotions');
                        else setActionLabel('');
                      }}
                      style={[
                        styles.linkChip,
                        actionLink === link.value && styles.linkChipSelected,
                      ]}
                    >
                      <Text style={[
                        styles.linkChipText,
                        actionLink === link.value && styles.linkChipTextSelected,
                      ]}>
                        {link.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {actionLink && (
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    value={actionLabel}
                    onChangeText={setActionLabel}
                    placeholder="Custom button text (optional)"
                    placeholderTextColor="#666"
                  />
                )}
              </View>

              {/* Active Status */}
              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Active</Text>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: '#2a2a2a', true: '#f97316' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {/* Dates */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setDateType('start');
                    setShowDatePicker(true);
                  }}
                >
                  <Feather name="calendar" size={18} color="#f97316" />
                  <Text style={styles.dateButtonText}>
                    {startDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>End Date (Optional)</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setDateType('end');
                    setShowDatePicker(true);
                  }}
                >
                  <Feather name="calendar" size={18} color="#f97316" />
                  <Text style={styles.dateButtonText}>
                    {endDate ? endDate.toLocaleDateString() : 'No end date'}
                  </Text>
                </TouchableOpacity>
                {endDate && (
                  <TouchableOpacity onPress={() => setEndDate(null)} style={styles.clearDateButton}>
                    <Text style={styles.clearDateText}>Clear end date</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting} style={styles.submitButton}>
                <LinearGradient colors={['#f97316', '#f43f5e']} style={styles.submitGradient}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {editingAnnouncement ? 'Update' : 'Create'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={dateType === 'start' ? startDate : endDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              if (dateType === 'start') {
                setStartDate(selectedDate);
              } else {
                setEndDate(selectedDate);
              }
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  content: {
    flex: 1,
    padding: 16,
  },
  announcementsList: {
    gap: 12,
  },
  announcementCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  inactiveBadge: {
    backgroundColor: 'rgba(107,114,128,0.2)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    padding: 4,
  },
  announcementMessage: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rolesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rolesText: {
    fontSize: 11,
    color: '#666',
  },
  dateText: {
    fontSize: 10,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '90%',
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
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    maxHeight: '70%',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 6,
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
  smallInput: {
    marginTop: 8,
  },
  imageUploadButton: {
    alignItems: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  imagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    color: '#666',
    marginTop: 8,
  },
  imagePlaceholderSubtext: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  uploadingText: {
    color: '#f97316',
    fontSize: 12,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
  },
  roleChipSelected: {
    backgroundColor: '#f97316',
  },
  roleChipText: {
    fontSize: 12,
    color: '#fff',
  },
  roleChipTextSelected: {
    color: '#fff',
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
  },
  linkChipSelected: {
    backgroundColor: '#f97316',
  },
  linkChipText: {
    fontSize: 12,
    color: '#fff',
  },
  linkChipTextSelected: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  clearDateButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  clearDateText: {
    color: '#ef4444',
    fontSize: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});