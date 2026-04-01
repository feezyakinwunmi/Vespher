// app/components/vendor/MenuItemForm.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase'; // Add this import
import { useAuth } from '../../contexts/AuthContext'; // Add this if you need vendor ID

interface MenuItemFormProps {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  vendorId?: string | null; // Add vendorId prop
}

const categories = [
  'Rice Dishes',
  'Swallow',
  'Soups & Stews',
  'Grilled & Fried',
  'Small Chops',
  'Beverages',
  'Desserts',
  'Specials',
];

export function MenuItemForm({ onClose, onSubmit, initialData, vendorId }: MenuItemFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price?.toString() || '',
    original_price: initialData?.original_price?.toString() || '',
    category: initialData?.category || '',
    preparation_time: initialData?.preparation_time || '20-30 min',
    is_popular: initialData?.is_popular || false,
    quantity_available: initialData?.quantity_available?.toString() || '',
    image_url: initialData?.image_url || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  console.log('Initial form data:', formData);

  // ✅ NEW: Upload image to Supabase Storage
  const uploadImageToSupabase = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      
      // Step 1: Fetch the image as a blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      console.log('📸 Image size:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('Selected image is empty');
      }
      
      // Step 2: Create a unique filename
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `menu_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      
      // Use vendor ID if available, otherwise use a temp folder
      const folder = vendorId || 'temp';
      const filePath = `${folder}/${fileName}`;
      
      console.log('📤 Uploading to:', filePath);
      
      // Step 3: Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          cacheControl: '3600',
          upsert: false,
        });
      
      if (error) {
        console.error('Upload error:', error);
        throw error;
      }
      
      // Step 4: Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);
      
      console.log('✅ Image uploaded successfully:', publicUrl);
      
      return publicUrl;
      
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const pickImage = async () => {
    console.log('Opening image picker...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    console.log('Image picker result:', result);

    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setSelectedImage(localUri);
      // Store local URI temporarily, will upload on submit
      setFormData({ ...formData, image_url: localUri });
      console.log('Image selected (local):', localUri);
    }
  };

  const validateForm = () => {
    console.log('Validating form...');
    
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter item name');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    if (!formData.category) {
      Alert.alert('Error', 'Please select a category');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    console.log('Submit button pressed');
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      let finalImageUrl = initialData?.image_url || null;
      
      // ✅ NEW: Upload image if it's a local file (starts with file://)
      if (formData.image_url && formData.image_url.startsWith('file://')) {
        console.log('📤 Uploading new image to Supabase...');
        const uploadedUrl = await uploadImageToSupabase(formData.image_url);
        
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
          console.log('✅ Image uploaded, URL:', finalImageUrl);
        } else {
          // If upload fails, keep existing image or use null
          console.warn('⚠️ Image upload failed, using existing image or null');
          finalImageUrl = initialData?.image_url || null;
        }
      } else if (formData.image_url && formData.image_url.startsWith('http')) {
        // Already a remote URL, keep it
        finalImageUrl = formData.image_url;
        console.log('📸 Using existing remote image URL:', finalImageUrl);
      }
      
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        category: formData.category,
        preparation_time: formData.preparation_time,
        is_popular: formData.is_popular,
        quantity_available: formData.quantity_available ? parseInt(formData.quantity_available) : null,
        image_url: finalImageUrl, // ✅ This is now the public Supabase URL
      };
      
      console.log('Submitting data with image URL:', submitData.image_url);
      
      await onSubmit(submitData);
      console.log('Submit successful');
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to save menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {initialData ? 'Edit Menu Item' : 'Add New Menu Item'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >       
          {/* Image Upload Section */}
          <TouchableOpacity 
            onPress={pickImage} 
            style={styles.imageUpload}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <View style={styles.imagePlaceholder}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.imageUploadText}>Uploading...</Text>
              </View>
            ) : formData.image_url ? (
              <Image source={{ uri: formData.image_url }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Feather name="camera" size={32} color="#666" />
                <Text style={styles.imageUploadText}>Upload Image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => {
                setFormData({ ...formData, name: text });
              }}
              placeholder="e.g., Jollof Rice"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => {
                setFormData({ ...formData, description: text });
              }}
              placeholder="Describe your dish..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Pricing */}
          <View style={styles.section}>
            <Text style={styles.label}>Price (₦) *</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={(text) => {
                setFormData({ ...formData, price: text });
              }}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Original Price (Optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.original_price}
              onChangeText={(text) => {
                setFormData({ ...formData, original_price: text });
              }}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryContainer}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setFormData({ ...formData, category: cat });
                    }}
                    style={[
                      styles.categoryChip,
                      formData.category === cat && styles.categoryChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        formData.category === cat && styles.categoryTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Additional Options */}
          <View style={styles.section}>
            <Text style={styles.label}>Preparation Time</Text>
            <TextInput
              style={styles.input}
              value={formData.preparation_time}
              onChangeText={(text) => {
                setFormData({ ...formData, preparation_time: text });
              }}
              placeholder="e.g., 20-30 min"
              placeholderTextColor="#666"
            />

            <View style={styles.switchContainer}>
              <Text style={styles.label}>Mark as Popular</Text>
              <Switch
                value={formData.is_popular}
                onValueChange={(value) => {
                  setFormData({ ...formData, is_popular: value });
                }}
                trackColor={{ false: '#2a2a2a', true: '#f97316' }}
                thumbColor="#fff"
              />
            </View>

            <Text style={styles.label}>Available Quantity (Optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.quantity_available}
              onChangeText={(text) => {
                setFormData({ ...formData, quantity_available: text });
              }}
              placeholder="Leave empty for unlimited"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>

          {/* Info Note */}
          <View style={styles.noteContainer}>
            <Feather name="info" size={16} color="#f97316" />
            <Text style={styles.noteText}>
              New items will require admin approval before appearing to customers
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || uploadingImage}
          style={styles.submitButton}
        >
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            style={styles.submitGradient}
          >
            {isSubmitting || uploadingImage ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {initialData ? 'Update Item' : 'Add Item'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Styles remain the same...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  imageUpload: {
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
  },
  imageUploadText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#f97316',
  },
  categoryText: {
    fontSize: 13,
    color: '#666',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(249,115,22,0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#f97316',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});