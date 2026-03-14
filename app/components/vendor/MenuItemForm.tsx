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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

interface MenuItemFormProps {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
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

export function MenuItemForm({ onClose, onSubmit, initialData }: MenuItemFormProps) {
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

  console.log('Initial form data:', formData);

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
      setSelectedImage(result.assets[0].uri);
      setFormData({ ...formData, image_url: result.assets[0].uri });
      console.log('Image selected:', result.assets[0].uri);
    }
  };

  const validateForm = () => {
    console.log('Validating form...');
    
    if (!formData.name.trim()) {
      console.log('Validation failed: No name');
      Alert.alert('Error', 'Please enter item name');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      console.log('Validation failed: Invalid price', formData.price);
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    if (!formData.category) {
      console.log('Validation failed: No category', formData.category);
      Alert.alert('Error', 'Please select a category');
      return false;
    }
    console.log('Validation passed');
    return true;
  };

  const handleSubmit = async () => {
    console.log('Submit button pressed');
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    console.log('Form data before submission:', formData);

    setIsSubmitting(true);
    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        category: formData.category,
        preparation_time: formData.preparation_time,
        is_popular: formData.is_popular,
        quantity_available: formData.quantity_available ? parseInt(formData.quantity_available) : null,
        image_url: formData.image_url || null,
      };
      
      console.log('Submitting data:', submitData);
      
      await onSubmit(submitData);
      console.log('Submit successful');
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to save menu item');
    } finally {
      setIsSubmitting(false);
      console.log('Submit finished');
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Upload */}
        <TouchableOpacity onPress={pickImage} style={styles.imageUpload}>
          {formData.image_url ? (
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
              console.log('Name changed:', text);
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
              console.log('Description changed:', text);
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
              console.log('Price changed:', text);
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
              console.log('Original price changed:', text);
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
                    console.log('Category selected:', cat);
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
              console.log('Prep time changed:', text);
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
                console.log('Popular switch:', value);
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
              console.log('Quantity changed:', text);
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

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={styles.submitButton}
        >
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            style={styles.submitGradient}
          >
            {isSubmitting ? (
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