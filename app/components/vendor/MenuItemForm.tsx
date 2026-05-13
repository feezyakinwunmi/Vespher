// // app/components/vendor/MenuItemForm.tsx
// import React, { useEffect, useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   ScrollView,
//   Switch,
//   Alert,
//   ActivityIndicator,
//   Image,
//   KeyboardAvoidingView,
//   Platform,
// } from 'react-native';
// import { Feather } from '@expo/vector-icons';
// import { LinearGradient } from 'expo-linear-gradient';
// import * as ImagePicker from 'expo-image-picker';
// import { supabase } from '../../lib/supabase';

// interface MenuItemFormProps {
//   onClose: () => void;
//   onSubmit: (data: any) => Promise<void>;
//   initialData?: any;
//   vendorId?: string | null;
// }

// const categories = [
//   'Rice Dishes',
//   'Pasta',
//   'Swallow',
//   'Soups & Stews',
//   'Grilled & Fried',
//   'Small Chops',
//   'Beverages',
//   'Desserts',
//   'Specials',
//   'Drinks',
//   'Snacks',
//   'Bake'
// ];

// export function MenuItemForm({ onClose, onSubmit, initialData, vendorId }: MenuItemFormProps) {
//   const [formData, setFormData] = useState({
//     name: initialData?.name || '',
//     description: initialData?.description || '',
//     price: initialData?.price?.toString() || '',
//     original_price: initialData?.original_price?.toString() || '',
//     category: initialData?.category || '',
//     preparation_time: initialData?.preparation_time || '20-30 min',
//     is_popular: initialData?.is_popular || false,
//     quantity_available: initialData?.quantity_available?.toString() || '',
//     image_url: initialData?.image_url || '',
//   });
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [uploadingImage, setUploadingImage] = useState(false);



//   // In MenuItemForm, add this debug
// useEffect(() => {
//   console.log('📸 MenuItemForm initialData:', {
//     hasImage: !!initialData?.image_url,
//     image_url: initialData?.image_url,
//     formDataImage: formData.image_url
//   });
  
//   // If initialData has image_url, set it in formData
//   if (initialData?.image_url && !formData.image_url) {
//     setFormData(prev => ({ ...prev, image_url: initialData.image_url }));
//   }
// }, [initialData]);

//   // ✅ FIXED: Using the SAME upload method as promotions (works!)
//   const uploadImage = async (imageUri: string): Promise<string | null> => {
//     if (!imageUri) return null;
    
//     setUploadingImage(true);
//     try {
//       // Create unique filename
//       const fileName = `menu_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
//       const filePath = `${vendorId}/${fileName}`;
      
//       // Fetch the image
//       const response = await fetch(imageUri);
//       const blob = await response.blob();
      
//       console.log('📸 Image size:', blob.size, 'bytes');
      
//       if (blob.size === 0) {
//         throw new Error('Selected image is empty');
//       }
      
//       // Convert blob to base64 (like promotion does)
//       const reader = new FileReader();
//       const base64 = await new Promise<string>((resolve, reject) => {
//         reader.onload = () => resolve(reader.result as string);
//         reader.onerror = reject;
//         reader.readAsDataURL(blob);
//       });
      
//       // Extract base64 data
//       const base64Data = base64.split(',')[1];
      
//       // Convert base64 to ArrayBuffer
//       const binaryString = atob(base64Data);
//       const bytes = new Uint8Array(binaryString.length);
//       for (let i = 0; i < binaryString.length; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//       }
      
//       console.log('📦 Image bytes length:', bytes.length);
      
//       // Upload using Uint8Array (same as promotion)
//       const { data, error } = await supabase.storage
//         .from('product-images')
//         .upload(filePath, bytes, {
//           contentType: 'image/jpeg',
//           cacheControl: '3600',
//           upsert: true,
//         });
      
//       if (error) {
//         console.error('Upload error:', error);
//         throw error;
//       }
      
//       const { data: { publicUrl } } = supabase.storage
//         .from('product-images')
//         .getPublicUrl(filePath);
      
//       console.log('✅ Image uploaded successfully:', publicUrl);
      
//       return publicUrl;
//     } catch (error) {
//       console.error('Error uploading image:', error);
//       Alert.alert('Upload Failed', `Could not upload image: ${error}`);
//       return null;
//     } finally {
//       setUploadingImage(false);
//     }
//   };

//   const pickImage = async () => {
//     const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
//     if (status !== 'granted') {
//       Alert.alert('Permission needed', 'Please allow access to your photos');
//       return;
//     }

//     const result = await ImagePicker.launchImageLibraryAsync({
//       mediaTypes: ImagePicker.MediaTypeOptions.Images,
//       allowsEditing: true,
//       aspect: [1, 1],
//       quality: 1,
//     });

//     if (!result.canceled) {
//       const uri = result.assets[0].uri;
//       console.log('📸 Selected image URI:', uri);
      
//       // Verify file size
//       const response = await fetch(uri);
//       const blob = await response.blob();
//       console.log('📸 Image file size:', blob.size, 'bytes');
      
//       if (blob.size === 0) {
//         Alert.alert('Error', 'Selected image appears to be empty. Please try another image.');
//         return;
//       }
      
//       setFormData({ ...formData, image_url: uri });
//     }
//   };

//   const validateForm = () => {
//     if (!formData.name.trim()) {
//       Alert.alert('Error', 'Please enter item name');
//       return false;
//     }
//     if (!formData.price || parseFloat(formData.price) <= 0) {
//       Alert.alert('Error', 'Please enter a valid price');
//       return false;
//     }
//     if (!formData.category) {
//       Alert.alert('Error', 'Please select a category');
//       return false;
//     }
//     return true;
//   };

//   const handleSubmit = async () => {
//     if (!validateForm()) return;

//     setIsSubmitting(true);
    
//     try {
//       let finalImageUrl = initialData?.image_url || null;
      
//       // Upload new image if selected
//       if (formData.image_url && formData.image_url.startsWith('file://')) {
//         console.log('📤 Uploading new image...');
//         const uploadedUrl = await uploadImage(formData.image_url);
        
//         if (uploadedUrl) {
//           finalImageUrl = uploadedUrl;
//           console.log('✅ Image uploaded, URL:', finalImageUrl);
//         } else {
//           console.warn('⚠️ Image upload failed');
//           finalImageUrl = initialData?.image_url || null;
//         }
//       } else if (formData.image_url && formData.image_url.startsWith('http')) {
//         finalImageUrl = formData.image_url;
//       }
      
//       const submitData = {
//         name: formData.name.trim(),
//         description: formData.description.trim(),
//         price: parseFloat(formData.price),
//         original_price: formData.original_price ? parseFloat(formData.original_price) : null,
//         category: formData.category,
//         preparation_time: formData.preparation_time,
//         is_popular: formData.is_popular,
//         quantity_available: formData.quantity_available ? parseInt(formData.quantity_available) : null,
//         image_url: finalImageUrl,
//       };
      
//       console.log('Submitting data with image URL:', submitData.image_url);
      
//       await onSubmit(submitData);
//       onClose();
//     } catch (error) {
//       console.error('Submit error:', error);
//       Alert.alert('Error', 'Failed to save menu item');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <View style={styles.container}>
//       <View style={styles.header}>
//         <TouchableOpacity onPress={onClose} style={styles.closeButton}>
//           <Feather name="x" size={24} color="#fff" />
//         </TouchableOpacity>
//         <Text style={styles.title}>
//           {initialData ? 'Edit Menu Item' : 'Add New Menu Item'}
//         </Text>
//         <View style={styles.headerRight} />
//       </View>

//       <KeyboardAvoidingView 
//         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//         style={{ flex: 1 }}
//       >
//         <ScrollView 
//           style={styles.content} 
//           showsVerticalScrollIndicator={false}
//           keyboardShouldPersistTaps="handled"
//         >       
//         {/* Image Upload Section */}
// <TouchableOpacity 
//   onPress={pickImage} 
//   style={styles.imageUpload}
//   disabled={uploadingImage}
// >
//   {uploadingImage ? (
//     <View style={styles.imagePlaceholder}>
//       <ActivityIndicator size="large" color="#f97316" />
//       <Text style={styles.imageUploadText}>Uploading...</Text>
//     </View>
//   ) : formData.image_url ? (
//     <Image 
//       source={{ uri: formData.image_url }} 
//       style={styles.imagePreview}
//       onError={() => console.log('❌ Failed to load image:', formData.image_url)}
//       onLoad={() => console.log('✅ Image loaded:', formData.image_url)}
//     />
//   ) : (
//     <View style={styles.imagePlaceholder}>
//       <Feather name="camera" size={32} color="#666" />
//       <Text style={styles.imageUploadText}>Upload Image</Text>
//     </View>
//   )}
// </TouchableOpacity>

//           {/* Basic Info */}
//           <View style={styles.section}>
//             <Text style={styles.label}>Item Name *</Text>
//             <TextInput
//               style={styles.input}
//               value={formData.name}
//               onChangeText={(text) => setFormData({ ...formData, name: text })}
//               placeholder="e.g., Jollof Rice"
//               placeholderTextColor="#666"
//             />

//             <Text style={styles.label}>Description</Text>
//             <TextInput
//               style={[styles.input, styles.textArea]}
//               value={formData.description}
//               onChangeText={(text) => setFormData({ ...formData, description: text })}
//               placeholder="Describe your dish..."
//               placeholderTextColor="#666"
//               multiline
//               numberOfLines={3}
//               textAlignVertical="top"
//             />
//           </View>

//           {/* Pricing */}
//           <View style={styles.section}>
//             <Text style={styles.label}>Price (₦) *</Text>
//             <TextInput
//               style={styles.input}
//               value={formData.price}
//               onChangeText={(text) => setFormData({ ...formData, price: text })}
//               placeholder="0"
//               placeholderTextColor="#666"
//               keyboardType="numeric"
//             />

//             <Text style={styles.label}>Original Price (Optional)</Text>
//             <TextInput
//               style={styles.input}
//               value={formData.original_price}
//               onChangeText={(text) => setFormData({ ...formData, original_price: text })}
//               placeholder="0"
//               placeholderTextColor="#666"
//               keyboardType="numeric"
//             />
//           </View>

//           {/* Category */}
//           <View style={styles.section}>
//             <Text style={styles.label}>Category *</Text>
//             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
//               <View style={styles.categoryContainer}>
//                 {categories.map((cat) => (
//                   <TouchableOpacity
//                     key={cat}
//                     onPress={() => setFormData({ ...formData, category: cat })}
//                     style={[
//                       styles.categoryChip,
//                       formData.category === cat && styles.categoryChipSelected,
//                     ]}
//                   >
//                     <Text
//                       style={[
//                         styles.categoryText,
//                         formData.category === cat && styles.categoryTextSelected,
//                       ]}
//                     >
//                       {cat}
//                     </Text>
//                   </TouchableOpacity>
//                 ))}
//               </View>
//             </ScrollView>
//           </View>

//           {/* Additional Options */}
//           <View style={styles.section}>
//             <Text style={styles.label}>Preparation Time</Text>
//             <TextInput
//               style={styles.input}
//               value={formData.preparation_time}
//               onChangeText={(text) => setFormData({ ...formData, preparation_time: text })}
//               placeholder="e.g., 20-30 min"
//               placeholderTextColor="#666"
//             />

//             <View style={styles.switchContainer}>
//               <Text style={styles.label}>Mark as Popular</Text>
//               <Switch
//                 value={formData.is_popular}
//                 onValueChange={(value) => setFormData({ ...formData, is_popular: value })}
//                 trackColor={{ false: '#2a2a2a', true: '#f97316' }}
//                 thumbColor="#fff"
//               />
//             </View>

//             <Text style={styles.label}>Available Quantity (Optional)</Text>
//             <TextInput
//               style={styles.input}
//               value={formData.quantity_available}
//               onChangeText={(text) => setFormData({ ...formData, quantity_available: text })}
//               placeholder="Leave empty for unlimited"
//               placeholderTextColor="#666"
//               keyboardType="numeric"
//             />
//           </View>

//           {/* Info Note */}
//           <View style={styles.noteContainer}>
//             <Feather name="info" size={16} color="#f97316" />
//             <Text style={styles.noteText}>
//               New items will require admin approval before appearing to customers
//             </Text>
//           </View>
//         </ScrollView>
//       </KeyboardAvoidingView>

//       {/* Submit Button */}
//       <View style={styles.footer}>
//         <TouchableOpacity
//           onPress={handleSubmit}
//           disabled={isSubmitting || uploadingImage}
//           style={styles.submitButton}
//         >
//           <LinearGradient
//             colors={['#f97316', '#f43f5e']}
//             style={styles.submitGradient}
//           >
//             {isSubmitting || uploadingImage ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.submitText}>
//                 {initialData ? 'Update Item' : 'Add Item'}
//               </Text>
//             )}
//           </LinearGradient>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

// // Styles remain the same...
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#1a1a1a',
//     marginTop: 50,
//     borderTopLeftRadius: 20,
//     borderTopRightRadius: 20,
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     padding: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: 'rgba(255,255,255,0.05)',
//   },
//   closeButton: {
//     padding: 4,
//   },
//   title: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#fff',
//   },
//   headerRight: {
//     width: 32,
//   },
//   content: {
//     flex: 1,
//     padding: 16,
//   },
//   imageUpload: {
//     alignItems: 'center',
//     marginBottom: 20,
//   },
//   imagePreview: {
//     width: 120,
//     height: 120,
//     borderRadius: 12,
//   },
//   imagePlaceholder: {
//     width: 120,
//     height: 120,
//     borderRadius: 12,
//     backgroundColor: '#2a2a2a',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderWidth: 2,
//     borderColor: 'rgba(255,255,255,0.05)',
//     borderStyle: 'dashed',
//   },
//   imageUploadText: {
//     color: '#666',
//     fontSize: 12,
//     marginTop: 8,
//   },
//   section: {
//     marginBottom: 20,
//   },
//   label: {
//     fontSize: 14,
//     fontWeight: '500',
//     color: '#fff',
//     marginBottom: 8,
//   },
//   input: {
//     backgroundColor: '#2a2a2a',
//     borderRadius: 8,
//     padding: 12,
//     color: '#fff',
//     fontSize: 14,
//     marginBottom: 12,
//   },
//   textArea: {
//     height: 80,
//     textAlignVertical: 'top',
//   },
//   categoryContainer: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 8,
//   },
//   categoryChip: {
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     backgroundColor: '#2a2a2a',
//     borderRadius: 20,
//     marginRight: 8,
//   },
//   categoryChipSelected: {
//     backgroundColor: '#f97316',
//   },
//   categoryText: {
//     fontSize: 13,
//     color: '#666',
//   },
//   categoryTextSelected: {
//     color: '#fff',
//   },
//   switchContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 12,
//   },
//   noteContainer: {
//     flexDirection: 'row',
//     backgroundColor: 'rgba(249,115,22,0.1)',
//     padding: 12,
//     borderRadius: 8,
//     gap: 8,
//     marginBottom: 20,
//   },
//   noteText: {
//     flex: 1,
//     fontSize: 12,
//     color: '#f97316',
//   },
//   footer: {
//     padding: 16,
//     borderTopWidth: 1,
//     borderTopColor: 'rgba(255,255,255,0.05)',
//   },
//   submitButton: {
//     height: 48,
//     borderRadius: 8,
//     overflow: 'hidden',
//   },
//   submitGradient: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   submitText: {
//     color: '#fff',
//     fontSize: 15,
//     fontWeight: '600',
//   },
// });



















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
        ingredients: ingredientsList,
        allergens: [], // Can be auto-detected or added later
        nutritional_flags: [],
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
    allergy: '🚫 Allergies & Intolerances',
    dietary: '🥗 Dietary Preferences',
    nutrition: '📊 Nutritional Info',
    preparation: '🍳 Preparation Method',
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
                          selectedTags.includes(tag.id) && styles.tagChipSelected,
                          tag.severity === 'high' && selectedTags.includes(tag.id) && styles.tagChipHigh,
                        ]}
                        onPress={() => toggleTag(tag.id)}
                      >
                        <Text style={[
                          styles.tagText,
                          selectedTags.includes(tag.id) && styles.tagTextSelected,
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
  helperText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
});