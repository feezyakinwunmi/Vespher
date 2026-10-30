// components/vendor/MenuItemForm.tsx
import React, { useEffect, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import { detectAllergens, allergenById } from '../../services/foodSafety';
import { findDishTemplate, MealTime } from '../../services/dishTemplates';
import { functionErrorMessage } from '../../utils/paystack';
import { EmojiIcon } from '../EmojiIcon';

const MEAL_TIME_OPTIONS: { id: MealTime; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
];

interface HealthTag {
  id: string;
  tag: string;
  category: string;
  label: string;
  description: string;
  severity: string;
}

interface MenuItemFormProps {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  vendorId?: string | null;
}

const categories = [
  'Rice Dishes',
  'Pasta',
  'Swallow',
  'Soups & Stews',
  'Grilled & Fried',
  'Small Chops',
  'Beverages',
  'Desserts',
  'Specials',
  'Drinks',
  'Snacks',
  'Bake'
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
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // NEW: Health tags state
  const [healthTags, setHealthTags] = useState<HealthTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.health_tags || []);
  const [ingredients, setIngredients] = useState<string>('');
  const [ingredientsList, setIngredientsList] = useState<string[]>(initialData?.ingredients || []);
  const [loadingTags, setLoadingTags] = useState(false);
  const [mealTimes, setMealTimes] = useState<MealTime[]>(initialData?.meal_times || []);
  const [autoFilling, setAutoFilling] = useState(false);

  // One-tap listing for busy vendors: typical ingredients, description, tags and meal
  // times from the dish name. Built-in templates first (instant), then AI.
  const applySuggestion = (s: { ingredients: string[]; description?: string; healthTags?: string[]; mealTimes?: MealTime[] }) => {
    setIngredientsList(prev => {
      const seen = new Set(prev.map(i => i.toLowerCase()));
      return [...prev, ...s.ingredients.filter(i => !seen.has(i.toLowerCase()))];
    });
    if (s.description && !formData.description.trim()) {
      setFormData(prev => ({ ...prev, description: s.description! }));
    }
    const knownTags = new Set(healthTags.map(t => t.tag));
    const tags = (s.healthTags || []).filter(t => knownTags.has(t));
    if (tags.length) setSelectedTags(prev => Array.from(new Set([...prev, ...tags])));
    if (s.mealTimes?.length && mealTimes.length === 0) setMealTimes(s.mealTimes);
  };

  const handleAutoFill = async () => {
    const name = formData.name.trim();
    if (name.length < 2) {
      Alert.alert('Dish name needed', 'Enter the dish name first, e.g. "Jollof Rice with Chicken".');
      return;
    }

    const template = findDishTemplate(name);
    if (template) {
      applySuggestion({
        ingredients: template.ingredients,
        description: template.description,
        healthTags: template.healthTags,
        mealTimes: template.mealTimes,
      });
      Alert.alert('Details added', 'We filled in the typical recipe. Please check it matches how you cook it, then edit anything that differs.');
      return;
    }

    setAutoFilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-dish-info', {
        body: {
          name,
          description: formData.description,
          category: formData.category,
          allowed_health_tags: healthTags.map(t => t.tag),
        },
      });
      if (error || !data?.status) {
        const message = error ? await functionErrorMessage(error, 'Could not get suggestions') : data?.message;
        Alert.alert('Auto-fill unavailable', message || 'Please add the ingredients manually.');
        return;
      }
      applySuggestion({
        ingredients: data.data.ingredients || [],
        description: data.data.description,
        healthTags: data.data.health_tags,
        mealTimes: data.data.meal_times,
      });
      Alert.alert('Details added', 'AI suggested the typical recipe. Please check it matches how you cook it, then edit anything that differs.');
    } finally {
      setAutoFilling(false);
    }
  };

  const toggleMealTime = (id: MealTime) => {
    setMealTimes(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));
  };

  // Fetch health tags reference
  useEffect(() => {
    fetchHealthTags();
  }, []);

  const fetchHealthTags = async () => {
    setLoadingTags(true);
    const { data, error } = await supabase
      .from('health_tags_reference')
      .select('*')
      .order('category', { ascending: true });
    
    if (!error && data) {
      setHealthTags(data);
    }
    setLoadingTags(false);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const addIngredient = () => {
    if (ingredients.trim()) {
      const newIngredients = ingredients.split(',').map(i => i.trim()).filter(i => i);
      setIngredientsList(prev => [...prev, ...newIngredients]);
      setIngredients('');
    }
  };

  const removeIngredient = (index: number) => {
    setIngredientsList(prev => prev.filter((_, i) => i !== index));
  };

  // Ingredients typed but not yet added with "+" still count.
  const pendingIngredients = ingredients.split(',').map(i => i.trim()).filter(Boolean);
  const allIngredients = [...ingredientsList, ...pendingIngredients];

  // Allergens detected from the dish name, description and ingredients.
  const detectedAllergens = detectAllergens({
    name: formData.name,
    description: formData.description,
    ingredients: allIngredients,
  });

  useEffect(() => {
    console.log('📸 MenuItemForm initialData:', {
      hasImage: !!initialData?.image_url,
      image_url: initialData?.image_url,
      formDataImage: formData.image_url
    });
    
    if (initialData?.image_url && !formData.image_url) {
      setFormData(prev => ({ ...prev, image_url: initialData.image_url }));
    }
  }, [initialData]);

  const uploadImage = async (imageUri: string): Promise<string | null> => {
    if (!imageUri) return null;
    
    setUploadingImage(true);
    try {
      const fileName = `menu_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
      const filePath = `${vendorId}/${fileName}`;
      
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      console.log('📸 Image size:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('Selected image is empty');
      }
      
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const base64Data = base64.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', `Could not upload image: ${error}`);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      
      if (blob.size === 0) {
        Alert.alert('Error', 'Selected image appears to be empty. Please try another image.');
        return;
      }
      
      setFormData({ ...formData, image_url: uri });
    }
  };

  const validateForm = () => {
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
    if (allIngredients.length === 0) {
      Alert.alert('Error', 'Please list the ingredients. Admins review them before the dish goes live, and customers with allergies rely on them.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      let finalImageUrl = initialData?.image_url || null;
      
      if (formData.image_url && formData.image_url.startsWith('file://')) {
        const uploadedUrl = await uploadImage(formData.image_url);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          finalImageUrl = initialData?.image_url || null;
        }
      } else if (formData.image_url && formData.image_url.startsWith('http')) {
        finalImageUrl = formData.image_url;
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
        image_url: finalImageUrl,
        // NEW: Add health tags and ingredients
        health_tags: selectedTags,
        ingredients: allIngredients,
        // Allergens the vendor tagged plus those detected from the ingredients.
        allergens: Array.from(new Set([
          ...selectedTags.filter(t => allergenById(t)),
          ...detectedAllergens.map(d => d.allergen.id),
        ])),
        nutritional_flags: [],
        meal_times: mealTimes,
      };
      
      console.log('Submitting data:', submitData);
      
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to save menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group tags by category
  const groupedTags = healthTags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, HealthTag[]>);

  const categoryLabels: Record<string, string> = {
    allergy: 'Allergies & Intolerances',
    dietary: 'Dietary Preferences',
    nutrition: 'Nutritional Info',
    preparation: 'Preparation Method',
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
              <Image 
                source={{ uri: formData.image_url }} 
                style={styles.imagePreview}
                onError={() => console.log('❌ Failed to load image:', formData.image_url)}
                onLoad={() => console.log('✅ Image loaded:', formData.image_url)}
              />
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
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="e.g., Jollof Rice"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
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
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Original Price (Optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.original_price}
              onChangeText={(text) => setFormData({ ...formData, original_price: text })}
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
                    onPress={() => setFormData({ ...formData, category: cat })}
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

          {/* Quick fill for busy vendors */}
          <TouchableOpacity style={styles.autoFillCard} onPress={handleAutoFill} disabled={autoFilling}>
            <View style={styles.autoFillIcon}>
              {autoFilling ? <ActivityIndicator size="small" color="#f97316" /> : <Feather name="zap" size={18} color="#f97316" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.autoFillTitle}>Auto-fill from dish name</Text>
              <Text style={styles.autoFillText}>
                No time to type? We'll add typical ingredients, description and tags. You just check and edit.
              </Text>
            </View>
          </TouchableOpacity>

          {/* When this dish is eaten (drives customer meal-time suggestions) */}
          <View style={styles.section}>
            <Text style={styles.label}>Best for</Text>
            <View style={styles.ingredientsList}>
              {MEAL_TIME_OPTIONS.map(option => {
                const active = mealTimes.includes(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => toggleMealTime(option.id)}
                    style={[styles.mealChip, active && styles.mealChipActive]}
                  >
                    <Text style={[styles.mealChipText, active && styles.mealChipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.helperText}>Helps us show this dish to customers at the right time of day.</Text>
          </View>

          {/* NEW: Ingredients Section */}
          <View style={styles.section}>
            <Text style={[styles.label, styles.requiredText]}>Ingredients</Text>
            <View style={styles.ingredientsInputRow}>
              <TextInput
                style={[styles.input, styles.ingredientsInput]}
                value={ingredients}
                onChangeText={setIngredients}
                placeholder="Add ingredients separated by commas (e.g., Rice, Tomatoes, Onions)"
                placeholderTextColor="#666"
              />
              <TouchableOpacity style={styles.addIngredientButton} onPress={addIngredient}>
                <Feather name="plus" size={20} color="#f97316" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.ingredientsList}>
              {ingredientsList.map((ing, index) => (
                <View key={index} style={styles.ingredientChip}>
                  <Text style={styles.ingredientText}>{ing}</Text>
                  <TouchableOpacity onPress={() => removeIngredient(index)}>
                    <Feather name="x" size={14} color="#666" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <Text style={styles.helperText}>
              List all ingredients to help customers with dietary restrictions
            </Text>

            {detectedAllergens.length > 0 && (
              <View style={styles.allergenBox}>
                <View style={styles.allergenHeader}>
                  <Feather name="alert-triangle" size={14} color="#f59e0b" />
                  <Text style={styles.allergenTitle}>Allergens detected (saved automatically)</Text>
                </View>
                <View style={styles.ingredientsList}>
                  {detectedAllergens.map(d => (
                    <View key={d.allergen.id} style={styles.allergenChip}>
                      <Text style={styles.allergenChipText}>
                        <EmojiIcon emoji={d.allergen.icon} size={12} color="#f59e0b" /> {d.allergen.label}
                      </Text>
                      <Text style={styles.allergenSource}>({d.matches.join(', ')})</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* NEW: Health Tags Section */}
          <View style={styles.section}>
            <Text style={[styles.label, styles.requiredText]}>Health Tags</Text>
            <Text style={styles.helperText}>
              Select all that apply. Helps customers filter food based on their health needs.
            </Text>
            
            {loadingTags ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              Object.entries(groupedTags).map(([category, tags]) => (
                <View key={category} style={styles.tagCategory}>
                  <Text style={styles.categoryTitle}>{categoryLabels[category] || category}</Text>
                  <View style={styles.tagsGrid}>
                    {tags.map((tag) => (
                      <TouchableOpacity
                        key={tag.id}
                        style={[
                          styles.tagChip,
                          selectedTags.includes(tag.tag) && styles.tagChipSelected,
                          tag.severity === 'high' && selectedTags.includes(tag.tag) && styles.tagChipHigh,
                        ]}
                        onPress={() => toggleTag(tag.tag)}
                      >
                        <Text style={[
                          styles.tagText,
                          selectedTags.includes(tag.tag) && styles.tagTextSelected,
                        ]}>
                          {tag.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Additional Options */}
          <View style={styles.section}>
            <Text style={styles.label}>Preparation Time</Text>
            <TextInput
              style={styles.input}
              value={formData.preparation_time}
              onChangeText={(text) => setFormData({ ...formData, preparation_time: text })}
              placeholder="e.g., 20-30 min"
              placeholderTextColor="#666"
            />

            <View style={styles.switchContainer}>
              <Text style={styles.label}>Mark as Popular</Text>
              <Switch
                value={formData.is_popular}
                onValueChange={(value) => setFormData({ ...formData, is_popular: value })}
                trackColor={{ false: '#2a2a2a', true: '#f97316' }}
                thumbColor="#fff"
              />
            </View>

            <Text style={styles.label}>Available Quantity (Optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.quantity_available}
              onChangeText={(text) => setFormData({ ...formData, quantity_available: text })}
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
  requiredText: {
    color: '#f97316',
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
  // NEW styles for ingredients and tags
  ingredientsInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ingredientsInput: {
    flex: 1,
  },
  addIngredientButton: {
    width: 44,
    height: 44,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 6,
  },
  ingredientText: {
    color: '#fff',
    fontSize: 12,
  },
  allergenBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  allergenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  allergenTitle: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  allergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  allergenChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  allergenSource: {
    color: '#aaa',
    fontSize: 11,
  },
  tagCategory: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 8,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  tagChipSelected: {
    backgroundColor: 'rgba(249,115,22,0.2)',
    borderColor: '#f97316',
  },
  tagChipHigh: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderColor: '#ef4444',
  },
  tagText: {
    fontSize: 12,
    color: '#aaa',
  },
  tagTextSelected: {
    color: '#f97316',
  },
  autoFillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  autoFillIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(249,115,22,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoFillTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  autoFillText: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 16,
  },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mealChipActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: '#f97316',
  },
  mealChipText: {
    color: '#aaa',
    fontSize: 13,
  },
  mealChipTextActive: {
    color: '#f97316',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
});