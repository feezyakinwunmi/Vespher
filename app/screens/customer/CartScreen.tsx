// app/screens/customer/CartScreen.tsx
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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useVendors } from '../../hooks/customer/useVendors';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import { FlutterwavePayment } from '../../components/FlutterwavePayment';
import { useLocation } from '../../contexts/LocationContext';
import type { Address } from '../../types';
import Toast from 'react-native-toast-message';

type CartScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CartScreenRouteProp = RouteProp<RootStackParamList, 'Cart'>;
type PaymentMethod = 'cash' | 'transfer' | 'card';

// Generate unique reference for payment
const generateReference = () => {
  return `VESP-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`.toUpperCase();
};

export function CartScreen() {
  const navigation = useNavigation<CartScreenNavigationProp>();
  const route = useRoute<CartScreenRouteProp>();
  const { 
    items, 
    removeItem, 
    updateQuantity, 
    getSubtotal, 
    clearCart, 
    vendorId 
  } = useCart();
  const { user } = useAuth();
  const { vendors } = useVendors();
  const { calculateDeliveryToVendor, deliveryDistance, isLoading: locationLoading } = useLocation();

  // UI States
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [appliedPromoData, setAppliedPromoData] = useState<any>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number | null>(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [flutterwaveResponse, setFlutterwaveResponse] = useState<any>(null);
  const [platformSettings, setPlatformSettings] = useState<{ platform_fee_percentage: number } | null>(null);
const [loadingSettings, setLoadingSettings] = useState(true);
  
  const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  
  // Payment States
  const [showFlutterwave, setShowFlutterwave] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');

  const vendor = vendors.find(v => v.id === vendorId);
  const subtotal = getSubtotal();




// Fetch platform settings for commission percentage
useEffect(() => {
  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('platform_fee_percentage')
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setPlatformSettings(data);
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  fetchPlatformSettings();
}, []);



  // Handle selected address from navigation params
  useEffect(() => {
    if (route.params?.selectedAddress) {
      setSelectedAddress(route.params.selectedAddress);
      navigation.setParams({ selectedAddress: undefined });
    }
  }, [route.params?.selectedAddress]);

  // Calculate delivery fee when vendor and selected address are available
  useEffect(() => {
    const calculateFee = async () => {
      if (vendor?.latitude && vendor?.longitude && selectedAddress?.latitude && selectedAddress?.longitude) {
        setIsCalculatingFee(true);
        try {
          const fee = await calculateDeliveryToVendor(
            vendor.latitude, 
            vendor.longitude,
            selectedAddress.latitude,
            selectedAddress.longitude
          );
          setCalculatedDeliveryFee(fee);
        } catch (error) {
          console.error('Error calculating delivery fee:', error);
          setCalculatedDeliveryFee(null);
        } finally {
          setIsCalculatingFee(false);
        }
      } else {
        setCalculatedDeliveryFee(null);
      }
    };

    calculateFee();
  }, [vendor, selectedAddress]);

  // Use calculated fee
  const deliveryFee = calculatedDeliveryFee || 0;
  
  // Calculate discounts
  const firstOrderDiscount = isFirstOrder ? Math.round(subtotal * 0.2) : 0;
  const finalDiscount = Math.max(discount, firstOrderDiscount);
  const total = subtotal + deliveryFee - finalDiscount;

  // Check if first order
  useEffect(() => {
    if (!user) return;
    
    const checkFirstOrder = async () => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', user.id);
      
      setIsFirstOrder(count === 0);
    };
    
    checkFirstOrder();
  }, [user]);

  // Fetch addresses when checkout opens
  useEffect(() => {
    if (!showCheckout || !user) return;
    fetchAddresses();
  }, [showCheckout, user]);

  const fetchAddresses = async () => {
    if (!user) return;
    
    setLoadingAddresses(true);
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      
      setAddresses(data || []);
      
      if (data && data.length > 0 && !selectedAddress) {
        const defaultAddress = data.find(a => a.is_default) || data[0];
        setSelectedAddress(defaultAddress);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      showToast('Failed to load addresses');
    } finally {
      setLoadingAddresses(false);
    }
  };

  const validatePromoCode = async (code: string) => {
    if (!code) return null;

    try {
      const { data: promoData, error: promoError } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (promoError) throw promoError;
      if (!promoData) return { valid: false, message: 'Invalid promo code', discount: 0 };

      if (promoData.end_date && new Date(promoData.end_date) < new Date()) {
        return { valid: false, message: 'Promo code has expired', discount: 0 };
      }

      if (promoData.usage_limit) {
        const { count } = await supabase
          .from('promo_code_usage')
          .select('*', { count: 'exact', head: true })
          .eq('promo_code_id', promoData.id);

        if (count && count >= promoData.usage_limit) {
          return { valid: false, message: 'Promo code has reached its usage limit', discount: 0 };
        }
      }

      if (user && promoData.usage_per_user) {
        const { count } = await supabase
          .from('promo_code_usage')
          .select('*', { count: 'exact', head: true })
          .eq('promo_code_id', promoData.id)
          .eq('user_id', user.id);

        if (count && count >= promoData.usage_per_user) {
          return { valid: false, message: 'You have already used this promo code', discount: 0 };
        }
      }

      if (promoData.applies_to === 'vendor' && promoData.vendor_id !== vendorId) {
        return { valid: false, message: 'This promo code is not valid for this vendor', discount: 0 };
      }

      if (promoData.min_order_amount > subtotal) {
        return { 
          valid: false, 
          message: `Minimum order of ₦${promoData.min_order_amount.toLocaleString()} required`,
          discount: 0
        };
      }

      let discountAmount = 0;
      if (promoData.discount_type === 'percentage') {
        discountAmount = Math.round(subtotal * (promoData.discount_value / 100));
        if (promoData.max_discount_amount) {
          discountAmount = Math.min(discountAmount, promoData.max_discount_amount);
        }
      } else {
        discountAmount = promoData.discount_value;
      }

      return {
        valid: true,
        code: promoData,
        discount: discountAmount,
        message: `Promo code applied! You saved ₦${discountAmount.toLocaleString()}`
      };

    } catch (error) {
      console.error('Error validating promo code:', error);
      return { valid: false, message: 'Error validating promo code', discount: 0 };
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode) return;

    const result = await validatePromoCode(promoCode);
    
    if (result?.valid) {
      setPromoApplied(true);
      setAppliedPromoData(result.code);
      setDiscount(result.discount);
      showToast(result.message);
    } else {
      setPromoApplied(false);
      setAppliedPromoData(null);
      setDiscount(0);
      showToast('Invalid promo code');
    }
  };

const processOrder = async (paymentRef?: string, gatewayResponse?: any) => {
  setIsPlacingOrder(true);

  try {
    // Get platform fee percentage from settings (default to 10 if not loaded)
    const commissionPercentage = platformSettings?.platform_fee_percentage || 10;
    
    // Apply discount to subtotal FIRST (simple approach)
    const discountedSubtotal = subtotal - finalDiscount;
    
    // Calculate platform commission on the DISCOUNTED subtotal
    const platformCommission = Math.round(discountedSubtotal * (commissionPercentage / 100));
    
    // Vendor gets discounted subtotal minus commission
    const vendorPayout = discountedSubtotal - platformCommission;
    
    // Rider gets full delivery fee
    const riderPayout = deliveryFee;
    
    // Get the actual Flutterwave fee from response (or calculate on discounted subtotal)
    const flutterwaveFee = gatewayResponse?.fee || Math.round(discountedSubtotal * 0.02);
    
    // Platform net earnings (commission - flutterwave fee)
    const platformNetEarnings = platformCommission - flutterwaveFee;

    console.log('Inserting order with:', {
      originalSubtotal: subtotal,
      discount: finalDiscount,
      discountedSubtotal,
      platformCommission,
      flutterwaveFee,
      platformNetEarnings,
      vendorPayout
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user?.id,
        vendor_id: vendorId,
        items: items.map(item => ({
          product_id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          options: item.selectedOptions || []
        })),
        status: 'pending',
        subtotal: subtotal, // Keep original subtotal for records
        delivery_fee: deliveryFee,
        discount: finalDiscount,
        total: total, // subtotal + delivery - discount
        payment_method: 'card',
        payment_status: 'paid',
        payment_reference: paymentRef,
        delivery_address: selectedAddress,
        created_at: new Date().toISOString(),
        
        // Financial fields based on discounted subtotal
        flutterwave_fee: flutterwaveFee,
        platform_commission: platformCommission,
        platform_net_earnings: platformNetEarnings,
        payment_gateway_response: gatewayResponse
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order insert error:', orderError);
      throw orderError;
    }

    console.log('Order inserted successfully:', order.id);

    // Record first order discount if applied
    if (isFirstOrder && firstOrderDiscount > 0) {
      await supabase.from('first_order_discounts').insert({
        user_id: user?.id,
        order_id: order.id,
        discount_amount: firstOrderDiscount,
        applied_at: new Date().toISOString(),
      });
    }

    // Record promo code usage if applied
    if (appliedPromoData) {
      await supabase.from('promo_code_usage').insert({
        promo_code_id: appliedPromoData.id,
        user_id: user?.id,
        order_id: order.id,
        discount_amount: discount,
        used_at: new Date().toISOString(),
      });
    }

    // Record platform fees
    await supabase.from('platform_fees').insert({
      order_id: order.id,
      vendor_id: vendorId,
      fee_percentage: commissionPercentage,
      fee_amount: platformCommission,
      flutterwave_fee: flutterwaveFee,
      vendor_payout: vendorPayout,
      rider_payout: riderPayout,
      platform_net: platformNetEarnings,
      created_at: new Date().toISOString(),
    });

    console.log('Platform fees recorded, clearing cart now...');
    
    clearCart();
    
    showToast('Order placed successfully!');
    navigation.navigate('Orders');
    
  } catch (error: any) {
    console.error('Error placing order:', error);
    showToast('Failed to place order: ' + error.message);
  } finally {
    setIsPlacingOrder(false);
    setShowCheckout(false);
    setProcessingPayment(false);
  }
};

  const handleCardPayment = () => {
    if (!user || !selectedAddress || !vendorId) return;
    
    setProcessingPayment(true);
    setShowCheckout(false);
    
    const reference = generateReference();
    setPaymentReference(reference);
    setFlutterwaveResponse(null);
    
    setTimeout(() => {
      setShowFlutterwave(true);
      setProcessingPayment(false);
    }, 500);
  };

const handlePlaceOrder = async () => {
  if (!user) {
    showToast('Please login to place order');
    navigation.navigate('Login');
    return;
  }

  if (!selectedAddress) {
    showToast('Please select a delivery address');
    return;
  }

  if (!vendorId) {
    showToast('Vendor information missing');
    return;
  }

  if (!calculatedDeliveryFee) {
    showToast('Unable to calculate delivery fee. Please ensure your address has valid coordinates.');
    return;
  }

  if (loadingSettings) {
    showToast('Loading platform settings...');
    return;
  }

  handleCardPayment();
};

  const navigateToAddresses = () => {
    setShowCheckout(false);
    navigation.navigate('Addresses', { selectMode: true });
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Cart</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Feather name="shopping-bag" size={40} color="#666" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Looks like you haven't added anything to your cart yet
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Vendors')}
            style={styles.emptyButton}
          >
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyButtonGradient}
            >
              <Text style={styles.emptyButtonText}>Browse Vendors</Text>
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
          <View>
            <Text style={styles.headerTitle}>Your Cart</Text>
            <Text style={styles.headerSubtitle}>{vendor?.name}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <View style={styles.itemsContainer}>
          {items.map((item) => (
            <View key={item.product.id} style={styles.cartItem}>
              <Image 
                source={{ uri: item.product.image || 'https://via.placeholder.com/80' }} 
                style={styles.itemImage}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
                <Text style={styles.itemDescription} numberOfLines={1}>
                  {item.product.description}
                </Text>
                <View style={styles.itemFooter}>
                  <Text style={styles.itemPrice}>
                    ₦{(item.product.price * item.quantity).toLocaleString()}
                  </Text>
                  <View style={styles.quantityControl}>
                    <TouchableOpacity 
                      onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                      style={styles.quantityButton}
                    >
                      <Feather name="minus" size={14} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity 
                      onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                      style={[styles.quantityButton, styles.primaryButton]}
                    >
                      <Feather name="plus" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => removeItem(item.product.id)}
                style={styles.removeButton}
              >
                <Feather name="trash-2" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Promo Code */}
        <View style={styles.promoContainer}>
          <View style={styles.promoInputContainer}>
            <Feather name="tag" size={18} color="#666" style={styles.promoIcon} />
            <TextInput
              style={styles.promoInput}
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Enter promo code"
              placeholderTextColor="#666"
            />
          </View>
          <TouchableOpacity 
            onPress={handleApplyPromo}
            disabled={!promoCode || promoApplied}
            style={[
              styles.applyButton,
              promoApplied && styles.applyButtonApplied,
            ]}
          >
            <Text style={[
              styles.applyButtonText,
              promoApplied && styles.applyButtonTextApplied,
            ]}>
              {promoApplied ? 'Applied' : 'Apply'}
            </Text>
          </TouchableOpacity>
        </View>
        {promoApplied && (
          <Text style={styles.promoSuccess}>Promo code applied! You saved ₦{discount.toLocaleString()}</Text>
        )}
        {isFirstOrder && !promoApplied && (
          <Text style={styles.firstOrderText}>🎉 First order! You get 20% off automatically</Text>
        )}

        {/* Order Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₦{subtotal.toLocaleString()}</Text>
          </View>
          
          {isCalculatingFee ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Calculating delivery...</Text>
              <ActivityIndicator size="small" color="#f97316" />
            </View>
          ) : calculatedDeliveryFee ? (
            <>
              {deliveryDistance && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Distance</Text>
                  <Text style={styles.summaryValue}>
                    {deliveryDistance < 1 
                      ? `${Math.round(deliveryDistance * 1000)}m` 
                      : `${deliveryDistance.toFixed(1)}km`}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee (₦500/km)</Text>
                <Text style={styles.summaryValue}>₦{deliveryFee.toLocaleString()}</Text>
              </View>
            </>
          ) : (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>Select address to calculate</Text>
            </View>
          )}

          {firstOrderDiscount > 0 && !promoApplied && (
            <View style={[styles.summaryRow, styles.discountRow]}>
              <Text style={styles.discountLabel}>First Order Discount (20%)</Text>
              <Text style={styles.discountValue}>-₦{firstOrderDiscount.toLocaleString()}</Text>
            </View>
          )}
          {discount > 0 && (
            <View style={[styles.summaryRow, styles.discountRow]}>
              <Text style={styles.discountLabel}>Promo Discount</Text>
              <Text style={styles.discountValue}>-₦{discount.toLocaleString()}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₦{total.toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          onPress={() => setShowCheckout(true)}
          style={styles.checkoutButton}
        >
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkoutGradient}
          >
            <Text style={styles.checkoutText}>Proceed to Checkout</Text>
            <Feather name="chevron-right" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Checkout Modal */}
      <Modal
        visible={showCheckout}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCheckout(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checkout</Text>
              <TouchableOpacity onPress={() => setShowCheckout(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Delivery Address */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Delivery Address</Text>
                {loadingAddresses ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : addresses.length > 0 ? (
                  <View style={styles.addressList}>
                    {addresses.map(address => (
                      <TouchableOpacity
                        key={address.id}
                        onPress={() => {
                          setSelectedAddress(address);
                        }}
                        style={[
                          styles.addressCard,
                          selectedAddress?.id === address.id && styles.addressCardSelected,
                        ]}
                      >
                        <Feather name="map-pin" size={16} color="#f97316" />
                        <View style={styles.addressInfo}>
                          <Text style={styles.addressLabel}>{address.label}</Text>
                          <Text style={styles.addressText}>
                            {address.street}, {address.area}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity 
                      onPress={navigateToAddresses}
                      style={styles.addAddressButton}
                    >
                      <Text style={styles.addAddressText}>+ Add New Address</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={navigateToAddresses}
                    style={styles.addAddressButton}
                  >
                    <Text style={styles.addAddressText}>+ Add Delivery Address</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Payment Method */}
          {/* Payment Method */}
<View style={styles.modalSection}>
  <Text style={styles.modalSectionTitle}>Payment Method</Text>
  <View style={styles.paymentList}>
    {[
      { value: 'card', label: 'Proceed to payment', icon: 'credit-card' },
    ].map((option) => (
      <TouchableOpacity
        key={option.value}
        onPress={() => setPaymentMethod(option.value as PaymentMethod)}
        style={[
          styles.paymentCard,
          paymentMethod === option.value && styles.paymentCardSelected,
        ]}
      >
        <Feather name={option.icon as any} size={18} color="#f97316" />
        <Text style={styles.paymentLabel}>{option.label}</Text>
        {paymentMethod === option.value && (
          <View style={styles.paymentSelectedDot} />
        )}
      </TouchableOpacity>
    ))}
  </View>
</View>

              {/* Order Summary */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Order Summary</Text>
                <View style={styles.modalSummary}>
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Items ({items.length})</Text>
                    <Text style={styles.modalSummaryValue}>₦{subtotal.toLocaleString()}</Text>
                  </View>
                  
                  {isCalculatingFee ? (
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Calculating delivery...</Text>
                      <ActivityIndicator size="small" color="#f97316" />
                    </View>
                  ) : calculatedDeliveryFee ? (
                    <>
                      {deliveryDistance && (
                        <View style={styles.modalSummaryRow}>
                          <Text style={styles.modalSummaryLabel}>Distance</Text>
                          <Text style={styles.modalSummaryValue}>
                            {deliveryDistance < 1 
                              ? `${Math.round(deliveryDistance * 1000)}m` 
                              : `${deliveryDistance.toFixed(1)}km`}
                          </Text>
                        </View>
                      )}
                      <View style={styles.modalSummaryRow}>
                        <Text style={styles.modalSummaryLabel}>Delivery Fee (₦500/km)</Text>
                        <Text style={styles.modalSummaryValue}>₦{deliveryFee.toLocaleString()}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Delivery Fee</Text>
                      <Text style={styles.modalSummaryValue}>Select address to calculate</Text>
                    </View>
                  )}

                  {firstOrderDiscount > 0 && !promoApplied && (
                    <View style={[styles.modalSummaryRow, styles.modalDiscountRow]}>
                      <Text style={styles.modalDiscountLabel}>First Order Discount (20%)</Text>
                      <Text style={styles.modalDiscountValue}>-₦{firstOrderDiscount.toLocaleString()}</Text>
                    </View>
                  )}
                  {discount > 0 && (
                    <View style={[styles.modalSummaryRow, styles.modalDiscountRow]}>
                      <Text style={styles.modalDiscountLabel}>Promo Discount</Text>
                      <Text style={styles.modalDiscountValue}>-₦{discount.toLocaleString()}</Text>
                    </View>
                  )}
                  <View style={[styles.modalSummaryRow, styles.modalTotalRow]}>
                    <Text style={styles.modalTotalLabel}>Total</Text>
                    <Text style={styles.modalTotalValue}>₦{total.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={handlePlaceOrder}
                disabled={!selectedAddress || !calculatedDeliveryFee || isPlacingOrder || processingPayment || isCalculatingFee}
                style={styles.placeOrderButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.placeOrderGradient}
                >
                  {processingPayment ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.placeOrderText}>Processing Payment...</Text>
                    </View>
                  ) : isPlacingOrder ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.placeOrderText}>Placing Order...</Text>
                    </View>
                  ) : isCalculatingFee ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.placeOrderText}>Calculating Fee...</Text>
                    </View>
                  ) : (
                    <Text style={styles.placeOrderText}>
                      Place Order • ₦{total.toLocaleString()}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showFlutterwave && (
        <FlutterwavePayment
          visible={showFlutterwave}
          amount={total}
          email={user?.email || ''}
          reference={paymentReference}
          customerName={user?.name}
          phone={user?.phone}
          onPaymentComplete={(paymentData) => {
            setFlutterwaveResponse(paymentData);
          }}
          onSuccess={async (response) => {
            setShowFlutterwave(false);
            await processOrder(response.tx_ref || paymentReference, flutterwaveResponse);
          }}
          onClose={() => {
            setShowFlutterwave(false);
            showToast('You cancelled the payment');
            setShowCheckout(true);
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
    paddingBottom:60,
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
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  headerRight: {
    width: 40,
  },
  clearText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  itemsContainer: {
    padding: 16,
    gap: 12,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#f97316',
  },
  quantityText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  promoContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  promoInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  promoIcon: {
    marginRight: 8,
  },
  promoInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 14,
  },
  applyButton: {
    paddingHorizontal: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonApplied: {
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  applyButtonTextApplied: {
    color: '#f97316',
  },
  promoSuccess: {
    color: '#f43f5e',
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  firstOrderText: {
    color: '#f97316',
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#fff',
  },
  discountRow: {
    marginBottom: 4,
  },
  discountLabel: {
    fontSize: 14,
    color: '#f43f5e',
  },
  discountValue: {
    fontSize: 14,
    color: '#f43f5e',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  checkoutButton: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkoutGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
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
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  addressList: {
    gap: 8,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  addressCardSelected: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 12,
    color: '#666',
  },
  addAddressButton: {
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addAddressText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '500',
  },
  paymentList: {
    gap: 8,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  paymentCardSelected: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  paymentLabel: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  paymentSelectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  modalSummary: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 12,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  modalSummaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  modalSummaryValue: {
    fontSize: 13,
    color: '#fff',
  },
  modalDiscountRow: {
    marginBottom: 4,
  },
  modalDiscountLabel: {
    fontSize: 13,
    color: '#f43f5e',
  },
  modalDiscountValue: {
    fontSize: 13,
    color: '#f43f5e',
  },
  modalTotalRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  modalTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  placeOrderButton: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeOrderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});