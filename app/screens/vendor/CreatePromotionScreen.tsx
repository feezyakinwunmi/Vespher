// app/screens/vendor/CreatePromotionScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Toast from 'react-native-toast-message';
import { FlutterwavePayment } from '../../components/FlutterwavePayment';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

interface Vendor {
  id: string;
  name: string;
}

export function CreatePromotionScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // Form state
  const [promotionType, setPromotionType] = useState<'flyer' | 'product_offer' | 'combo'>('flyer');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Vendor data
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loadingVendor, setLoadingVendor] = useState(true);
  
  // Product offer state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [maxPerCustomer, setMaxPerCustomer] = useState('0');
  
  // Combo state
  const [mainProductId, setMainProductId] = useState<string>('');
  const [freeProductId, setFreeProductId] = useState<string>('');
  const [buyQuantity, setBuyQuantity] = useState('1');
  const [getQuantity, setGetQuantity] = useState('1');
  
  // Duration state
  const [daysCount, setDaysCount] = useState('7');
  const [costPerDay, setCostPerDay] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  
  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [creatingPromotion, setCreatingPromotion] = useState(false);
  
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type: type,
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  // Fetch vendor ID from user
  useEffect(() => {
    const fetchVendor = async () => {
      if (!user?.id) {
        console.log('⚠️ No user ID found');
        setLoadingVendor(false);
        setLoadingProducts(false);
        return;
      }
      
      try {
        console.log('🔍 Fetching vendor for owner_id:', user.id);
        
        const { data, error } = await supabase
          .from('vendors')
          .select('id, name')
          .eq('owner_id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching vendor:', error);
          showToast('Failed to load vendor profile', 'error');
          setLoadingVendor(false);
          setLoadingProducts(false);
          return;
        }
        
        if (!data) {
          console.log('⚠️ No vendor found for user');
          showToast('Vendor profile not found', 'error');
          setLoadingVendor(false);
          setLoadingProducts(false);
          return;
        }
        
        console.log('✅ Vendor found:', data);
        setVendor(data);
        setLoadingVendor(false);
        
        // Fetch products for this vendor
        await fetchProducts(data.id);
        
      } catch (error) {
        console.error('Error in fetchVendor:', error);
        setLoadingVendor(false);
        setLoadingProducts(false);
      }
    };
    
    fetchVendor();
  }, [user?.id]);

  const fetchProducts = async (vendorId: string) => {
    try {
      setLoadingProducts(true);
      console.log('🔍 Fetching products for vendor ID:', vendorId);
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .eq('vendor_id', vendorId)
        .eq('approval_status', 'approved')
        .order('name');

      if (error) throw error;
      
      console.log('✅ Products fetched:', data?.length || 0);
      setProducts(data || []);
      
      if (data?.length === 0) {
        console.log('⚠️ No products found for this vendor');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      showToast('Failed to load products', 'error');
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('promotion_cost_per_day')
        .single();

      if (error) throw error;
      setCostPerDay(data.promotion_cost_per_day || 300);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setCostPerDay(300); // Default
    }
  };

  useEffect(() => {
    fetchPlatformSettings();
  }, []);

  useEffect(() => {
    // Calculate total cost when days or cost per day changes
    const days = parseInt(daysCount) || 0;
    const total = days * costPerDay;
    setTotalCost(total);
  }, [daysCount, costPerDay]);

const pickImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow access to your photos to upload images');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [16, 9],
    quality: 1, // Set to 1 for best quality
    base64: false, // Don't get base64, we'll fetch the URI
  });

  if (!result.canceled) {
    const uri = result.assets[0].uri;
    console.log('📸 Selected image URI:', uri);
    
    // Verify the file exists by checking its size
    const response = await fetch(uri);
    const blob = await response.blob();
    console.log('📸 Image file size:', blob.size, 'bytes');
    
    if (blob.size === 0) {
      Alert.alert('Error', 'Selected image appears to be empty. Please try another image.');
      return;
    }
    
    setImageUri(uri);
  }
};

// In CreatePromotionScreen.tsx, update uploadImage:

const uploadImage = async (): Promise<string | null> => {
  if (!imageUri) return null;
  
  setUploadingImage(true);
  try {
    const fileName = `promotion_${Date.now()}.jpg`;
    const filePath = `${vendor?.id}/${fileName}`;
    
    // Read the image file as base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    // Extract base64 data (remove the data:image/jpeg;base64, prefix)
    const base64Data = base64.split(',')[1];
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('📦 Image bytes length:', bytes.length);
    
    // Upload using Uint8Array
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, bytes, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });
    
    if (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);
    
    console.log('✅ Image uploaded to product-images:', publicUrl);
    console.log('📦 Uploaded file size:', bytes.length, 'bytes');
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    showToast('Failed to upload image: ' + error);
    return null;
  } finally {
    setUploadingImage(false);
  }
};

const createPromotionRecord = async (imageUrl: string) => {
  if (!vendor?.id) return null;
  
  const days = parseInt(daysCount);
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  // Base promotion data
  const promotionData: any = {
    vendor_id: vendor.id,
    title: title.trim(),
    description: description.trim() || null,
    image_url: imageUrl,
    promotion_type: promotionType,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    days_count: days,
    cost_per_day: costPerDay,
    status: 'pending_payment',
    payment_amount: totalCost,
    payment_status: 'pending',
    // Set combo_discount_type to null for all types
    combo_discount_type: null,
    combo_discount_value: null,
  };
  
  // Add product-specific fields based on type
  if (promotionType === 'product_offer') {
    promotionData.product_id = selectedProductId;
    promotionData.discounted_price = parseInt(discountedPrice);
    promotionData.max_per_customer = parseInt(maxPerCustomer) || 0;
    // Set combo fields to NULL
    promotionData.main_product_id = null;
    promotionData.free_product_id = null;
    promotionData.buy_quantity = null;
    promotionData.get_quantity = null;
    promotionData.main_product_original_price = null;
    promotionData.free_product_original_price = null;
  } else if (promotionType === 'combo') {
    promotionData.main_product_id = mainProductId;
    promotionData.free_product_id = freeProductId;
    promotionData.buy_quantity = parseInt(buyQuantity);
    promotionData.get_quantity = parseInt(getQuantity);
    promotionData.max_per_customer = parseInt(maxPerCustomer) || 0;
    
    // Store original prices
    const mainProduct = products.find(p => p.id === mainProductId);
    const freeProduct = products.find(p => p.id === freeProductId);
    promotionData.main_product_original_price = mainProduct?.price;
    promotionData.free_product_original_price = freeProduct?.price;
    
    // Set product_offer fields to NULL
    promotionData.product_id = null;
    promotionData.discounted_price = null;
  } else if (promotionType === 'flyer') {
    // Set all product-related fields to NULL
    promotionData.product_id = null;
    promotionData.discounted_price = null;
    promotionData.max_per_customer = null;
    promotionData.main_product_id = null;
    promotionData.free_product_id = null;
    promotionData.buy_quantity = null;
    promotionData.get_quantity = null;
    promotionData.main_product_original_price = null;
    promotionData.free_product_original_price = null;
  }
  
  console.log('📦 Creating promotion with type:', promotionType);
  
  const { data, error } = await supabase
    .from('promotions')
    .insert(promotionData)
    .select()
    .single();
  
  if (error) {
    console.error('Error details:', error);
    throw error;
  }
  return data;
};

  const handlePaymentSuccess = async (response: any) => {
    setCreatingPromotion(true);
    
    try {
      // Upload image first
      const imageUrl = await uploadImage();
      if (!imageUrl) {
        showToast('Failed to upload image', 'error');
        return;
      }
      
      // Create promotion record
      const promotion = await createPromotionRecord(imageUrl);
      if (!promotion) throw new Error('Failed to create promotion');
      
      // Update payment status
      const { error: updateError } = await supabase
        .from('promotions')
        .update({
          payment_status: 'paid',
          payment_reference: response.tx_ref,
          status: 'pending_approval',
        })
        .eq('id', promotion.id);
      
      if (updateError) throw updateError;
      
      showToast('Promotion created! Waiting for admin approval');
      navigation.goBack();
      
    } catch (error) {
      console.error('Error creating promotion:', error);
      showToast('Failed to create promotion', 'error');
    } finally {
      setCreatingPromotion(false);
      setShowPayment(false);
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      showToast('Please enter a title', 'error');
      return false;
    }
    
    if (!imageUri) {
      showToast('Please upload an image', 'error');
      return false;
    }
    
    if (promotionType === 'product_offer') {
      if (!selectedProductId) {
        showToast('Please select a product', 'error');
        return false;
      }
      const discount = parseInt(discountedPrice);
      const product = products.find(p => p.id === selectedProductId);
      if (isNaN(discount) || discount <= 0) {
        showToast('Please enter a valid discounted price', 'error');
        return false;
      }
      if (product && discount >= product.price) {
        showToast('Discounted price must be less than original price', 'error');
        return false;
      }
    } else if (promotionType === 'combo') {
      if (!mainProductId) {
        showToast('Please select main product', 'error');
        return false;
      }
      if (!freeProductId) {
        showToast('Please select free product', 'error');
        return false;
      }
      if (mainProductId === freeProductId) {
        showToast('Main product and free product must be different', 'error');
        return false;
      }
      const buy = parseInt(buyQuantity);
      const get = parseInt(getQuantity);
      if (isNaN(buy) || buy < 1) {
        showToast('Buy quantity must be at least 1', 'error');
        return false;
      }
      if (isNaN(get) || get < 1) {
        showToast('Get quantity must be at least 1', 'error');
        return false;
      }
    }
    
    const days = parseInt(daysCount);
    if (isNaN(days) || days < 1) {
      showToast('Please enter valid number of days (minimum 1)', 'error');
      return false;
    }
    
    return true;
  };

  const handleProceedToPayment = () => {
    if (!validateForm()) return;
    
    const ref = `PROMO-${Date.now().toString(36).substring(2, 10)}`;
    setPaymentReference(ref);
    setShowPayment(true);
  };

  // Show loading while fetching vendor and products
  if (loadingVendor || loadingProducts) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>
          {loadingVendor ? 'Loading vendor profile...' : 'Loading products...'}
        </Text>
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Vendor Not Found</Text>
        <Text style={styles.errorText}>
          Please complete your vendor profile first.
        </Text>
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderProductSelector = (selectedId: string, onSelect: (id: string) => void, title: string) => {
    if (products.length === 0) {
      return (
        <View style={styles.emptyProductsContainer}>
          <Feather name="shopping-bag" size={32} color="#666" />
          <Text style={styles.emptyProductsText}>No products found</Text>
          <Text style={styles.emptyProductsSubtext}>
            Add products to your menu first before creating promotions
          </Text>
        </View>
      );
    }
    
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productList}>
        {products.map((product) => (
          <TouchableOpacity
            key={product.id}
            onPress={() => onSelect(product.id)}
            style={[
              styles.productCard,
              selectedId === product.id && styles.productCardSelected,
            ]}
          >
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.productImage} />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Feather name="shopping-bag" size={20} color="#666" />
              </View>
            )}
            <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
            <Text style={styles.productPrice}>₦{product.price.toLocaleString()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  if (creatingPromotion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Creating your promotion...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Promotion</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Vendor Info */}
          <View style={styles.vendorInfo}>
            <Feather name="home" size={16} color="#f97316" />
            <Text style={styles.vendorName}>{vendor.name}</Text>
          </View>

          {/* Promotion Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Promotion Type</Text>
            <View style={styles.typeContainer}>
              <TouchableOpacity
                onPress={() => setPromotionType('flyer')}
                style={[styles.typeButton, promotionType === 'flyer' && styles.typeButtonActive]}
              >
                <Feather name="image" size={20} color={promotionType === 'flyer' ? '#f97316' : '#666'} />
                <Text style={[styles.typeText, promotionType === 'flyer' && styles.typeTextActive]}>Flyer</Text>
                <Text style={styles.typeDesc}>Just an image banner</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setPromotionType('product_offer')}
                style={[styles.typeButton, promotionType === 'product_offer' && styles.typeButtonActive]}
              >
                <Feather name="tag" size={20} color={promotionType === 'product_offer' ? '#f97316' : '#666'} />
                <Text style={[styles.typeText, promotionType === 'product_offer' && styles.typeTextActive]}>Product Offer</Text>
                <Text style={styles.typeDesc}>Discounted single product</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setPromotionType('combo')}
                style={[styles.typeButton, promotionType === 'combo' && styles.typeButtonActive]}
              >
                <Feather name="gift" size={20} color={promotionType === 'combo' ? '#f97316' : '#666'} />
                <Text style={[styles.typeText, promotionType === 'combo' && styles.typeTextActive]}>Combo</Text>
                <Text style={styles.typeDesc}>Buy X Get Y Free</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Weekend Special Pizza Deal"
                placeholderTextColor="#666"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your offer..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Promotion Image *</Text>
              <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Feather name="image" size={32} color="#666" />
                    <Text style={styles.imagePlaceholderText}>Tap to upload image</Text>
                    <Text style={styles.imageHint}>16:9 ratio recommended</Text>
                  </View>
                )}
              </TouchableOpacity>
              {uploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color="#f97316" />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Product Offer Fields */}
          {promotionType === 'product_offer' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Product Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Select Product *</Text>
                {renderProductSelector(selectedProductId, setSelectedProductId, 'Select Product')}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Discounted Price (₦) *</Text>
                <TextInput
                  style={styles.input}
                  value={discountedPrice}
                  onChangeText={setDiscountedPrice}
                  placeholder="e.g., 9000"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max per Customer (0 = unlimited)</Text>
                <TextInput
                  style={styles.input}
                  value={maxPerCustomer}
                  onChangeText={setMaxPerCustomer}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}

          {/* Combo Fields */}
          {promotionType === 'combo' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Combo Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Main Product *</Text>
                {renderProductSelector(mainProductId, setMainProductId, 'Select Main Product')}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Free Product *</Text>
                {renderProductSelector(freeProductId, setFreeProductId, 'Select Free Product')}
              </View>
              
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Buy Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    value={buyQuantity}
                    onChangeText={setBuyQuantity}
                    placeholder="1"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                  />
                </View>
                
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Get Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    value={getQuantity}
                    onChangeText={setGetQuantity}
                    placeholder="1"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max per Customer (0 = unlimited)</Text>
                <TextInput
                  style={styles.input}
                  value={maxPerCustomer}
                  onChangeText={setMaxPerCustomer}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}

          {/* Duration & Pricing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration & Pricing</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Number of Days *</Text>
                <TextInput
                  style={styles.input}
                  value={daysCount}
                  onChangeText={setDaysCount}
                  placeholder="7"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Cost per Day</Text>
                <View style={styles.costDisplay}>
                  <Text style={styles.costValue}>₦{costPerDay.toLocaleString()}</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Cost</Text>
              <Text style={styles.totalValue}>₦{totalCost.toLocaleString()}</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity onPress={handleProceedToPayment} style={styles.submitButton}>
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              <Text style={styles.submitText}>Proceed to Payment</Text>
              <Feather name="arrow-right" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Payment Modal */}
      {showPayment && (
        <FlutterwavePayment
          visible={showPayment}
          amount={totalCost}
          email={user?.email || ''}
          reference={paymentReference}
          customerName={user?.name}
          phone={user?.phone}
          isScheduled={false}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowPayment(false)}
        />
      )}
    </SafeAreaView>
  );
}

// Styles remain the same as before...
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
  },
  vendorName: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  typeButtonActive: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  typeTextActive: {
    color: '#f97316',
  },
  typeDesc: {
    fontSize: 10,
    color: '#666',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  textArea: {
    minHeight: 80,
  },
  imagePicker: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    minHeight: 160,
  },
  previewImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    color: '#666',
    fontSize: 14,
  },
  imageHint: {
    color: '#666',
    fontSize: 11,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  uploadingText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 12,
  },
  productList: {
    flexDirection: 'row',
  },
  productCard: {
    width: 120,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  productCardSelected: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 6,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  productName: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 11,
    color: '#f97316',
  },
  emptyProductsContainer: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyProductsText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  emptyProductsSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  addProductButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f97316',
    borderRadius: 8,
  },
  addProductButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  costDisplay: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  costValue: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '500',
  },
  totalCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
  },
  totalLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f97316',
  },
  submitButton: {
    margin: 16,
    marginTop: 8,
    marginBottom: 32,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});