// app/screens/customer/CartScreen.tsx
import { imageSource } from '../../utils/images';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usePaystackCheckout } from '../../contexts/PaystackCheckoutContext';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useVendors } from '../../hooks/customer/useVendors';
import { supabase } from '../../lib/supabase';
import { estimatePaystackFee, PAYSTACK_FEE_PERCENTAGE } from '../../utils/fees';
import { RootStackParamList } from '../../navigation/types';
import { useLocation } from '../../contexts/LocationContext';
import type { Address, CartItem } from '../../types';
import Toast from 'react-native-toast-message';

type CartScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CartScreenRouteProp = RouteProp<RootStackParamList, 'Cart'>;
type PaymentMethod = 'cash' | 'card';
type OrderType = 'now' | 'schedule';

// Special request categories
const requestCategories = [
  { label: 'Dietary Restrictions', value: 'dietary', icon: 'alert-circle' },
  { label: 'Allergies', value: 'allergies', icon: 'alert-triangle' },
  { label: 'Preparation Instructions', value: 'preparation', icon: 'coffee' },
  { label: 'Packaging Instructions', value: 'packaging', icon: 'package' },
  { label: 'Delivery Instructions', value: 'delivery', icon: 'truck' },
  { label: 'Other', value: 'other', icon: 'more-horizontal' },
];


export function CartScreen() {
  const navigation = useNavigation<CartScreenNavigationProp>();
  const route = useRoute<CartScreenRouteProp>();
  const { pay } = usePaystackCheckout();
  const {
    items,
    removeItem,
    updateQuantity,
    getSubtotal,
    clearCart,
    vendorId
  } = useCart();
  const { user } = useAuth();
  const { allVendors: vendors } = useVendors();
  const { calculateDeliveryToVendor, deliveryDistance } = useLocation();

  // UI States
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [orderType, setOrderType] = useState<OrderType>('now');
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [specialRequest, setSpecialRequest] = useState('');
  const [selectedRequestCategory, setSelectedRequestCategory] = useState<string>('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [discount, setDiscount] = useState(0);
  // Keep the card on Paystack so next time (and voice orders) can pay without retyping it.
  const [saveCard, setSaveCard] = useState(true);
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [appliedPromoData, setAppliedPromoData] = useState<any>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number | null>(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<{ platform_fee_percentage: number } | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
const [customerRewards, setCustomerRewards] = useState<any>(null);
const [applyFreeDelivery, setApplyFreeDelivery] = useState(false);
const [applyReferralBonus, setApplyReferralBonus] = useState(false);
const [walletBalance, setWalletBalance] = useState(0);
const [applyWallet, setApplyWallet] = useState(false);

  const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };


  const vendor = vendors.find(v => v.id === vendorId);
  const subtotal = getSubtotal();

  // Check if free delivery applies
  const freeDeliveryEligible = isFirstOrder && subtotal > 10000;

  // Calculate first order discount (10% instead of 20%)
  const firstOrderDiscount = isFirstOrder ? Math.round(subtotal * 0.1) : 0;
  const finalDiscount = Math.max(discount, firstOrderDiscount);
  const effectiveDeliveryFee = freeDeliveryEligible ? 0 : (calculatedDeliveryFee || 0);
  const total = subtotal + effectiveDeliveryFee - finalDiscount;


// Calculate final totals with rewards
let finalDeliveryFeeAmount = effectiveDeliveryFee;
let finalWalletUsedAmount = 0;
let finalDiscountAmount = finalDiscount;

if (applyFreeDelivery && customerRewards?.availableFreeDelivery) {
  finalDeliveryFeeAmount = 0;
}

if (applyWallet && walletBalance > 0) {
  finalWalletUsedAmount = Math.min(walletBalance, subtotal + finalDeliveryFeeAmount - finalDiscountAmount);
}

const finalTotal = subtotal + finalDeliveryFeeAmount - finalDiscountAmount - finalWalletUsedAmount;


// Re-validate promo code when cart items change
useEffect(() => {
  if (promoApplied && appliedPromoData) {
    // Re-validate the promo code with new subtotal
    const revalidatePromo = async () => {
      const result = await validatePromoCode(promoCode);
      if (!result?.valid) {
        // If promo is no longer valid, remove it
        setPromoApplied(false);
        setAppliedPromoData(null);
        setDiscount(0);
        showToast(result?.message || 'Promo code no longer valid');
      }
    };
    revalidatePromo();
  }
}, [subtotal, items]); // Re-run when subtotal or items change

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

  // Promo code handed over from a notification: pre-fill it for checkout.
  useEffect(() => {
    const code = route.params?.promoCode;
    if (code) {
      setPromoCode(code.toUpperCase());
      navigation.setParams({ promoCode: undefined });
      showToast(`Promo code ${code.toUpperCase()} added — tap Apply at checkout`);
    }
  }, [route.params?.promoCode]);

  // Calculate delivery fee when vendor and selected address are available
  useEffect(() => {
    const calculateFee = async () => {
      console.log('🔍 Calculating delivery fee...');
    console.log('Vendor coordinates:', vendor?.latitude, vendor?.longitude);
    console.log('Selected address:', selectedAddress);
    console.log('Address coordinates:', selectedAddress?.latitude, selectedAddress?.longitude);


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
              console.log('⚠️ Missing coordinates for distance calculation');

        setCalculatedDeliveryFee(null);
      }
    };

    calculateFee();
  }, [vendor, selectedAddress]);

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
  fetchCustomerRewards(); // Add this line
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

    if (promoData.applies_to === 'vendor_only' && promoData.vendor_id !== vendorId) {
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

    // ✅ Determine if this is a platform/admin created promo
    // Platform promos have vendor_id = null OR created_by_admin = true
    const isPlatformPromo = promoData.vendor_id === null || promoData.created_by_admin === true;

    return {
      valid: true,
      code: promoData,
      discount: discountAmount,
      message: `Promo code applied! You saved ₦${discountAmount.toLocaleString()}`,
      is_platform_promo: isPlatformPromo,  // Add this flag
      vendor_id: promoData.vendor_id,
      created_by_admin: promoData.created_by_admin,
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
    // ✅ Show the actual error message from validation
    showToast(result?.message || 'Invalid promo code');
  }
};

  // Function to decrease product stock after order is placed
const decreaseProductStock = async (items: CartItem[]) => {
  try {
    // Loop through each item in the order
    for (const item of items) {
      // First check if product tracks stock
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('track_stock, stock_quantity')
        .eq('id', item.product.id)
        .single();

      if (fetchError) {
        console.error('Error fetching product stock:', fetchError);
        continue;
      }

      // Only decrease if stock tracking is enabled
      if (product.track_stock) {
        const newStock = (product.stock_quantity || 0) - item.quantity;

        // Ensure stock doesn't go negative
        if (newStock >= 0) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              stock_quantity: newStock,
              quantity_available: newStock // Update both fields
            })
            .eq('id', item.product.id);

          if (updateError) {
            console.error('Error updating stock:', updateError);
          } else {
            console.log(`✅ Stock updated for ${item.product.name}: ${newStock} left`);
          }
        } else {
          console.warn(`⚠️ Stock would go negative for ${item.product.name}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in decreaseProductStock:', error);
  }
};

  const restoreProductStock = async (items: CartItem[]) => {
  for (const item of items) {
    const { data: product } = await supabase
      .from('products')
      .select('track_stock, stock_quantity')
      .eq('id', item.product.id)
      .single();

    if (product?.track_stock) {
      await supabase
        .from('products')
        .update({ stock_quantity: (product.stock_quantity || 0) + item.quantity })
        .eq('id', item.product.id);
    }
  }
};

// Fetch customer rewards (free delivery, referral bonus)
const fetchCustomerRewards = async () => {
  if (!user?.id) return;

  try {
    // Fetch rewards
    const { data: rewards, error: rewardsError } = await supabase
      .from('customer_rewards')
      .select('*')
      .eq('customer_id', user.id)
      .maybeSingle();

    if (rewardsError) throw rewardsError;

    if (rewards) {
      // Check if free delivery has expired
      const hasExpired = rewards.free_delivery_expires_at
        ? new Date(rewards.free_delivery_expires_at) < new Date()
        : false;

      const earned = rewards.free_delivery_earned || 0;
      const used = rewards.free_delivery_used || 0;
      let available = earned - used;

      // If expired, available is 0
      if (hasExpired) {
        available = 0;
      }

      setCustomerRewards({
        ...rewards,
        availableFreeDelivery: available > 0,
        freeDeliveryCount: available,
        freeDeliveryExpiresAt: rewards.free_delivery_expires_at,
        hasExpired: hasExpired
      });
    }

    // Fetch referral bonus (only non-expired ones)
    const { data: referrals, error: referralError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .eq('status', 'completed')
      .eq('referrer_reward_claimed', false);

    if (!referralError && referrals && referrals.length > 0) {
      // Check if referral bonus has expiration
      let totalBonus = 0;
      for (const referral of referrals) {
        const hasReferralExpired = referral.bonus_expires_at
          ? new Date(referral.bonus_expires_at) < new Date()
          : false;

        if (!hasReferralExpired) {
          totalBonus += 500;
        }
      }
      setWalletBalance(Math.min(totalBonus, 2000));
    }

  } catch (error) {
    console.error('Error fetching rewards:', error);
  }
};


const processOrder = async (paymentRef?: string, gatewayResponse?: any) => {
  console.log('💰 processOrder called with:', {
    paymentRef,
    gatewayResponse: gatewayResponse ? {
      transaction_id: gatewayResponse.transaction_id,
      flw_ref: gatewayResponse.flw_ref,
      fee: gatewayResponse.fee,
      charged_amount: gatewayResponse.charged_amount,
      status: gatewayResponse.status
    } : null
  });

  // Paystack transaction id (stored in the legacy flutterwave_transaction_id column)
  const gatewayTransactionId = gatewayResponse?.transaction_id || null;
  let reopenCheckout = false;
  setIsPlacingOrder(true);

  try {
    // Check if user exists
    if (!user?.id) {
      throw new Error('User information is missing');
    }

    // Get platform fee percentage from settings (default to 10 if not loaded)
    const platformFeePercentage = platformSettings?.platform_fee_percentage || 10;

    // Get actual delivery fee
    const actualDeliveryFee = calculatedDeliveryFee || 0;

    // Calculate delivery fee after rewards
    let finalDeliveryFeeAmount = actualDeliveryFee;
    if (applyFreeDelivery && customerRewards?.availableFreeDelivery) {
      finalDeliveryFeeAmount = 0;
    }

    // Calculate wallet usage
    let finalWalletUsedAmount = 0;
    if (applyWallet && walletBalance > 0) {
      finalWalletUsedAmount = Math.min(walletBalance, subtotal + finalDeliveryFeeAmount - finalDiscount);
    }

    // Calculate final total after all rewards (what customer actually pays)
    const finalTotalAmount = subtotal + finalDeliveryFeeAmount - finalDiscount - finalWalletUsedAmount;

    // Check if free delivery applies (first order bonus)
    const freeDeliveryEligible = isFirstOrder && subtotal > 10000;

    // Calculate first order discount (10%)
    const firstOrderDiscount = isFirstOrder ? Math.round(subtotal * 0.1) : 0;
    const totalDiscount = Math.max(discount, firstOrderDiscount);

    // For database constraint, include referral bonus in discount
    const totalDiscountForDB = totalDiscount + finalWalletUsedAmount;

    // What customer pays for delivery (0 if free from first order bonus)
    const customerDeliveryFee = freeDeliveryEligible ? 0 : finalDeliveryFeeAmount;

    // Amount charged through Paystack
    const paystackTotal = subtotal - totalDiscount + customerDeliveryFee;

    // Paystack processing fee (estimate; only card payments incur it). Stored in the
    // legacy flutterwave_fee columns.
    const paystackFeePercentage = paymentMethod === 'card' ? PAYSTACK_FEE_PERCENTAGE : 0;
    const paystackFee = paymentMethod === 'card' ? estimatePaystackFee(paystackTotal) : 0;

    // For database constraint: total must equal subtotal + delivery_fee - discount
    let discountForDB = totalDiscountForDB;
    let deliveryFeeForDB = actualDeliveryFee;

    // If free delivery applies (first order bonus), add the delivery fee to discount
    // Free delivery (first-order bonus or redeemed reward) is recorded as a discount so
    // the stored total always equals what the customer was charged.
    const rewardFreeDelivery = applyFreeDelivery && customerRewards?.availableFreeDelivery;
    if (freeDeliveryEligible || rewardFreeDelivery) {
      discountForDB = totalDiscountForDB + actualDeliveryFee;
      deliveryFeeForDB = actualDeliveryFee;
    }

    // Calculate the total for database
    const dbTotal = subtotal + deliveryFeeForDB - discountForDB;

    // Don't calculate rider earnings at order creation - will be set when rider accepts
    const riderEarnings = 0;
    const platformDeliveryEarnings = 0;

    // =============================================
    // ✅ Calculate who bears the discount and commission
    // =============================================
    let vendorPayout = 0;
    let platformCommission = 0;
    let effectiveDiscount = totalDiscount;

    // Determine if this is a vendor promo code
    const isVendorPromo = appliedPromoData?.vendor_id !== null &&
                          appliedPromoData?.vendor_id !== undefined &&
                          appliedPromoData?.applies_to === 'vendor_only';

    const isPlatformPromo = !isVendorPromo && discount > 0;

    if (isPlatformPromo && discount > 0) {
      // Platform bears the discount - commission on original subtotal
      platformCommission = Math.round(subtotal * (platformFeePercentage / 100));
      vendorPayout = subtotal - platformCommission;
      console.log('🏢 Platform promo: Platform bears discount of ₦', discount);
      console.log('   Commission (10% of ₦', subtotal, '): ₦', platformCommission);
      console.log('   Vendor payout: ₦', vendorPayout);

    } else if (discount > 0) {
      // Vendor bears the discount - commission on ORIGINAL subtotal
      platformCommission = Math.round(subtotal * (platformFeePercentage / 100));
      vendorPayout = subtotal - discount - platformCommission;
      console.log('🏪 Vendor promo: Vendor bears discount of ₦', discount);
      console.log('   Commission (10% of original ₦', subtotal, '): ₦', platformCommission);
      console.log('   Vendor payout: ₦', vendorPayout);

    } else {
      // No discount
      platformCommission = Math.round(subtotal * (platformFeePercentage / 100));
      vendorPayout = subtotal - platformCommission;
      console.log('📦 No discount: Standard commission of ₦', platformCommission);
    }

    // Override for first order discount (platform bears it)
    if (firstOrderDiscount > 0) {
      platformCommission = Math.round(subtotal * (platformFeePercentage / 100));
      vendorPayout = subtotal - platformCommission;
      effectiveDiscount = firstOrderDiscount;
      console.log('🎁 First order discount: Platform bears discount of ₦', firstOrderDiscount);
      console.log('   Vendor payout: ₦', vendorPayout);
    }

    // Stamp duty (₦50 for transactions ₦10,000 and above)
    const stampDuty = paystackTotal >= 10000 ? 50 : 0;

    // Calculate platform net earnings
    let platformNetEarnings = 0;

    if ((isPlatformPromo && discount > 0) || firstOrderDiscount > 0) {
      platformNetEarnings = platformCommission + platformDeliveryEarnings - effectiveDiscount - paystackFee - stampDuty - finalWalletUsedAmount;
      console.log('📉 Platform bears discount: Net earnings reduced by ₦', effectiveDiscount);
    } else {
      platformNetEarnings = platformCommission + platformDeliveryEarnings - paystackFee - stampDuty - finalWalletUsedAmount;
      console.log('📈 Vendor bears discount: Platform keeps full commission');
    }

    console.log('💰 Final Payment breakdown:', {
      subtotal,
      discount: effectiveDiscount,
      delivery_fee: finalDeliveryFeeAmount,
      wallet_used: finalWalletUsedAmount,
      customer_pays: paystackTotal,
      platform_commission: platformCommission,
      vendor_payout: vendorPayout,
      flutterwave_fee: paystackFee,
      stamp_duty: stampDuty,
      platform_net: platformNetEarnings,
      is_platform_promo: isPlatformPromo,
    });

    // Determine event type
    let eventType = 'other';
    if (selectedRequestCategory === 'party') eventType = 'party';
    else if (selectedRequestCategory === 'corporate') eventType = 'corporate';
    else if (selectedRequestCategory === 'family') eventType = 'family';

    const scheduledDateTime = orderType === 'schedule' ? selectedDateTime : null;

    // Auto-cancel logic
    let autoCancelAt = null;

    if (orderType === 'schedule' && scheduledDateTime) {
      const now = new Date();
      const scheduledDate = new Date(scheduledDateTime);
      const timeUntilScheduled = scheduledDate.getTime() - now.getTime();
      const halfWaitTime = Math.min(timeUntilScheduled * 0.5, 3 * 24 * 60 * 60 * 1000);
      autoCancelAt = new Date(now.getTime() + halfWaitTime);
    } else {
      autoCancelAt = new Date();
      autoCancelAt.setMinutes(autoCancelAt.getMinutes() + 60);
    }

    // Orders always start unpaid; card payments are confirmed by the verify-payment
    // edge function after it checks the transaction with Paystack.
    const paymentStatus = 'pending';

    // =============================================
    // ✅ BUILD DISCOUNT METADATA - FIXED FOR VENDOR PROMOS
    // =============================================
    let discountMetadata = null;
    let discountCode = null;
    let discountType = null;
    let discountPercentage = null;

    // Handle promo code discount
    if (promoApplied && appliedPromoData) {
      discountCode = promoCode.toUpperCase();
      discountType = appliedPromoData.discount_type;
      discountPercentage = appliedPromoData.discount_type === 'percentage' ? appliedPromoData.discount_value : null;

      // Determine if this is a vendor promo code
      const isVendorPromoCode = appliedPromoData.vendor_id !== null &&
                                appliedPromoData.vendor_id !== undefined &&
                                appliedPromoData.applies_to === 'vendor_only';

      // Get vendor name if it's a vendor promo
      let vendorName = null;
      if (isVendorPromoCode && appliedPromoData.vendor_id) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('name')
          .eq('id', appliedPromoData.vendor_id)
          .single();
        vendorName = vendor?.name;
      }

      discountMetadata = {
        type: 'promo_code',
        code: appliedPromoData.code,
        discount_type: appliedPromoData.discount_type,
        discount_value: appliedPromoData.discount_value,
        description: appliedPromoData.description || null,
        applied_by: isVendorPromoCode ? 'vendor' : 'platform',
        vendor_id: appliedPromoData.vendor_id || null,
        vendor_name: vendorName,
        is_platform_promo: !isVendorPromoCode,
        applies_to: appliedPromoData.applies_to,
      };
    }
    // Handle first order discount
    else if (firstOrderDiscount > 0) {
      discountCode = 'FIRST_ORDER';
      discountType = 'percentage';
      discountPercentage = 10;

      discountMetadata = {
        type: 'first_order',
        discount_type: 'percentage',
        discount_value: 10,
        description: 'First order discount - 10% off',
        applied_by: 'platform',
      };
    }

    // Add wallet usage to metadata if applicable
    if (finalWalletUsedAmount > 0) {
      discountMetadata = {
        ...(discountMetadata || {}),
        wallet_used: finalWalletUsedAmount,
        referral_bonus_applied: true,
      };
    }

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        vendor_id: vendorId,
        items: items.map(item => ({
          product_id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          options: item.selectedOptions || [],
          promotion_id: (item.product as any).promotion_id || null,
          is_promotion: (item.product as any).is_promotion || false,
          is_free_item: (item.product as any).is_free_item || false,
          is_combo_main: (item.product as any).is_combo_main || false,
          combo_details: (item.product as any).combo_details || null,
          promotion_price: (item.product as any).promotion_price || null,
        })),
        status: 'pending',
        is_scheduled: orderType === 'schedule',
        scheduled_datetime: scheduledDateTime,
        event_type: eventType,
        guest_count: null,
        special_request_category: selectedRequestCategory,
        special_request_text: specialRequest,
        subtotal: subtotal,
        delivery_fee: deliveryFeeForDB,
        discount: discountForDB,
        total: dbTotal,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        payment_reference: paymentRef,
        delivery_address: selectedAddress,
        created_at: new Date().toISOString(),
        auto_cancel_at: autoCancelAt?.toISOString() || null,
        promotion_id: items.some(item => (item.product as any).promotion_id)
          ? items.find(item => (item.product as any).promotion_id)?.product.promotion_id
          : null,
        promotion_details: items.filter(item => (item.product as any).is_promotion).map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          promotion_id: (item.product as any).promotion_id,
          is_free_item: (item.product as any).is_free_item,
          is_combo_main: (item.product as any).is_combo_main,
          combo_details: (item.product as any).combo_details,
          promotion_price: (item.product as any).promotion_price,
          original_price: (item.product as any).original_price,
          quantity: item.quantity,
        })),
        stamp_duty: stampDuty,
        flutterwave_fee: paystackFee,
        flutterwave_fee_percentage: paystackFeePercentage,
        flutterwave_transaction_id: gatewayTransactionId,
        platform_commission: platformCommission,
        platform_commission_percentage: platformFeePercentage,
        platform_delivery_earnings: platformDeliveryEarnings,
        platform_net_earnings: platformNetEarnings,
        vendor_payout: vendorPayout,
        payment_gateway_response: gatewayResponse,
        rider_earnings: riderEarnings,
        // ✅ DISCOUNT FIELDS
        discount_code: discountCode,
        discount_type: discountType,
        discount_percentage: discountPercentage,
        discount_metadata: discountMetadata,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order insert error:', orderError);
      throw orderError;
    }

    console.log('✅ Order inserted successfully:', order.id);

    let paymentConfirmed = paymentMethod !== 'card';
    if (paymentMethod === 'card') {
      const result = await pay('order', order.id, { saveCard });
      if (result.status === 'cancelled' || result.status === 'failed') {
        // Nothing was charged: cancel the order so it never reaches the vendor.
        await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            cancelled_by: 'customer',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            rejection_reason: 'Payment not completed',
          })
          .eq('id', order.id);
        if (result.status === 'failed') {
          Alert.alert('Payment', result.message || 'Could not start payment. Please try again.');
        } else {
          showToast('Payment cancelled');
        }
        reopenCheckout = true;
        return;
      }
      paymentRef = result.reference;
      paymentConfirmed = result.status === 'paid';
    }

    // Decrease product stock
    await decreaseProductStock(items);
    console.log('✅ Product stock updated');

    // Record first order discount if applied
    if (firstOrderDiscount > 0) {
      await supabase.from('first_order_discounts').insert({
        user_id: user.id,
        order_id: order.id,
        discount_amount: firstOrderDiscount,
        free_delivery_applied: freeDeliveryEligible,
        applied_at: new Date().toISOString(),
      });
    }

    // Record promo code usage if applied
    if (promoApplied && appliedPromoData) {
      await supabase.from('promo_code_usage').insert({
        promo_code_id: appliedPromoData.id,
        user_id: user.id,
        order_id: order.id,
        discount_amount: discount,
        used_at: new Date().toISOString(),
      });
    }

    // Record platform fees
    await supabase.from('platform_fees').insert({
      order_id: order.id,
      vendor_id: vendorId,
      fee_percentage: platformFeePercentage,
      fee_amount: platformCommission,
      delivery_earnings: platformDeliveryEarnings,
      stamp_duty: stampDuty,
      flutterwave_fee: paystackFee,
      vendor_payout: vendorPayout,
      platform_net: platformNetEarnings,
      created_at: new Date().toISOString(),
    });

    // Record reward usage if any
    if (applyFreeDelivery && customerRewards?.availableFreeDelivery) {
      await supabase
        .from('customer_rewards')
        .update({
          free_delivery_used: (customerRewards.free_delivery_used || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', user.id);

      await supabase
        .from('reward_redemptions')
        .insert({
          customer_id: user.id,
          order_id: order.id,
          reward_type: 'free_delivery',
          amount_saved: actualDeliveryFee,
          created_at: new Date().toISOString()
        });
    }

    if (applyWallet && finalWalletUsedAmount > 0) {
      await supabase
        .from('reward_redemptions')
        .insert({
          customer_id: user.id,
          order_id: order.id,
          reward_type: 'referral_bonus',
          amount_saved: finalWalletUsedAmount,
          created_at: new Date().toISOString()
        });

      await supabase
        .from('referrals')
        .update({ referrer_reward_claimed: true })
        .eq('referrer_id', user.id)
        .eq('status', 'completed')
        .eq('referrer_reward_claimed', false);
    }

    console.log('✅ Platform fees recorded, clearing cart now...');

    clearCart();

    const successMessage = orderType === 'schedule'
      ? 'Order scheduled successfully!'
      : 'Order placed successfully!';

    if (paymentConfirmed) {
      showToast(successMessage);
    } else {
      Alert.alert(
        'Payment Pending',
        `Your order was placed but we could not confirm your payment yet. Reference: ${paymentRef}. If you were charged, it will be confirmed shortly — contact support if it is not.`
      );
    }
    navigation.navigate('CustomerTabs', { screen: 'Orders' });

  } catch (error: any) {
    console.error('❌ Error placing order:', error);
    showToast('Failed to place order: ' + error.message);
  } finally {
    setIsPlacingOrder(false);
    setShowCheckout(reopenCheckout);
    setProcessingPayment(false);
  }
};

// Card: the order is created first, then paid through Paystack (see processOrder).
const handleCardPayment = async () => {
  if (!user || !selectedAddress || !vendorId) {
    showToast('Please complete all required fields');
    return;
  }
  setShowCheckout(false);
  await processOrder();
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

    const { data: shop } = await supabase.from('vendors').select('name, is_open').eq('id', vendorId).maybeSingle();
    if (shop?.is_open === false) {
      showToast(`${shop.name} has just closed and isn't taking orders right now. Please try again later.`);
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

    // Validate scheduled order
    if (orderType === 'schedule' && !selectedDateTime) {
      showToast('Please select a date and time for your scheduled order');
      return;
    }

    // Validate Cash on Delivery restriction
if (paymentMethod === 'cash' && finalTotal >= 10000) {
      showToast('Cash on delivery is only available for orders below ₦10,000. Please select card payment.');
      return;
    }

    // For card payments, process payment
    if (paymentMethod === 'card') {
      handleCardPayment();
      return;
    }

    // For cash on delivery, proceed directly
    await processOrder();
  };

  const navigateToAddresses = () => {
    setShowCheckout(false);
    navigation.navigate('Addresses', { selectMode: true });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (selectedDateTime) {
        const newDate = new Date(selectedDate);
        newDate.setHours(selectedDateTime.getHours());
        newDate.setMinutes(selectedDateTime.getMinutes());
        setSelectedDateTime(newDate);
      } else {
        selectedDate.setHours(12, 0, 0, 0);
        setSelectedDateTime(selectedDate);
      }
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      if (selectedDateTime) {
        const newDateTime = new Date(selectedDateTime);
        newDateTime.setHours(selectedTime.getHours());
        newDateTime.setMinutes(selectedTime.getMinutes());
        setSelectedDateTime(newDateTime);
      } else {
        const today = new Date();
        today.setHours(selectedTime.getHours());
        today.setMinutes(selectedTime.getMinutes());
        setSelectedDateTime(today);
      }
    }
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
            onPress={() => navigation.navigate('CustomerTabs', { screen: 'Vendors' })}
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

{/* Cart Items */}
<View style={styles.itemsContainer}>
  {items.map((item) => (
    <View key={item.product.id} style={styles.cartItem}>
      <Image
        source={imageSource(item.product.image)}
        style={styles.itemImage}
      />
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
          {item.product.is_promotion && (
            <View style={styles.promoBadge}>
              <Feather name="gift" size={10} color="#f97316" />
              <Text style={styles.promoBadgeText}>Promo</Text>
            </View>
          )}
        </View>
        <Text style={styles.itemDescription} numberOfLines={1}>
          {item.product.description}
        </Text>
        <View style={styles.itemFooter}>
          <View>
            <Text style={styles.itemPrice}>
              ₦{(item.product.price * item.quantity).toLocaleString()}
            </Text>
            {item.product.original_price && item.product.original_price > item.product.price && (
              <Text style={styles.originalPriceText}>
                ₦{item.product.original_price.toLocaleString()}
              </Text>
            )}
          </View>
         {/* Quantity Control */}
<View style={styles.quantityControl}>
  <TouchableOpacity
    onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
    style={[
      styles.quantityButton,
      // Only disable for combo items, not for regular promo items
      (item.product.is_combo_main || item.product.is_free_item) && styles.disabledButton
    ]}
    disabled={item.product.is_combo_main || item.product.is_free_item}
  >
    <Feather name="minus" size={14} color={(item.product.is_combo_main || item.product.is_free_item) ? "#666" : "#fff"} />
  </TouchableOpacity>
  <Text style={styles.quantityText}>{item.quantity}</Text>
  <TouchableOpacity
    onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
    style={[
      styles.quantityButton,
      styles.primaryButton,
      // Only disable for combo items, not for regular promo items
      (item.product.is_combo_main || item.product.is_free_item) && styles.disabledButton
    ]}
    disabled={item.product.is_combo_main || item.product.is_free_item}
  >
    <Feather name="plus" size={14} color={(item.product.is_combo_main || item.product.is_free_item) ? "#666" : "#fff"} />
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
        {isFirstOrder && !promoApplied && subtotal > 10000 && (
          <Text style={styles.firstOrderText}>First order over ₦10,000 gets 10% off + FREE delivery!</Text>
        )}
        {isFirstOrder && !promoApplied && subtotal <= 10000 && (
          <Text style={styles.firstOrderTextSmall}>
            Add ₦{(10000 - subtotal).toLocaleString()} more to get 10% off + FREE delivery on your first order!
          </Text>
        )}

{/* Order Summary */}
<View style={styles.modalSection}>
  <Text style={styles.modalSectionTitle}>Order Summary</Text>
  <View style={styles.modalSummary}>
    <View style={styles.modalSummaryRow}>
      <Text style={styles.modalSummaryLabel}>Items ({items.length})</Text>
      <Text style={styles.modalSummaryValue}>₦{subtotal.toLocaleString()}</Text>
    </View>

    {/* Delivery Fee */}
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
          <Text style={styles.modalSummaryLabel}>Delivery Fee</Text>
          <Text style={[
            styles.modalSummaryValue,
            (freeDeliveryEligible || applyFreeDelivery) && styles.modalDiscountValue
          ]}>
            {freeDeliveryEligible || applyFreeDelivery ? 'FREE' : `₦${calculatedDeliveryFee.toLocaleString()}`}
          </Text>
        </View>
      </>
    ) : (
      <View style={styles.modalSummaryRow}>
        <Text style={styles.modalSummaryLabel}>Delivery Fee</Text>
        <Text style={styles.modalSummaryValue}>Select address to calculate</Text>
      </View>
    )}

    {/* First Order Discount */}
    {firstOrderDiscount > 0 && !promoApplied && (
      <View style={[styles.modalSummaryRow, styles.modalDiscountRow]}>
        <Text style={styles.modalDiscountLabel}>First Order Discount (10%)</Text>
        <Text style={styles.modalDiscountValue}>-₦{firstOrderDiscount.toLocaleString()}</Text>
      </View>
    )}

    {/* Promo Discount */}
    {discount > 0 && (
      <View style={[styles.modalSummaryRow, styles.modalDiscountRow]}>
        <Text style={styles.modalDiscountLabel}>Promo Discount</Text>
        <Text style={styles.modalDiscountValue}>-₦{discount.toLocaleString()}</Text>
      </View>
    )}

    {/* Referral Bonus Applied */}
    {applyWallet && finalWalletUsedAmount > 0 && (
      <View style={[styles.modalSummaryRow, styles.modalDiscountRow]}>
        <Text style={styles.modalDiscountLabel}>Referral Bonus</Text>
        <Text style={styles.modalDiscountValue}>-₦{finalWalletUsedAmount.toLocaleString()}</Text>
      </View>
    )}

    {/* Total */}
    <View style={[styles.modalSummaryRow, styles.modalTotalRow]}>
      <Text style={styles.modalTotalLabel}>Total</Text>
      <Text style={styles.modalTotalValue}>₦{finalTotal.toLocaleString()}</Text>
    </View>

    {/* Notices */}
    {(freeDeliveryEligible || applyFreeDelivery) && (
      <Text style={styles.modalFreeDeliveryNotice}>Free delivery applied to this order!</Text>
    )}
    {applyWallet && finalWalletUsedAmount > 0 && (
      <Text style={styles.modalReferralNotice}>Referral bonus saved you ₦{finalWalletUsedAmount.toLocaleString()}</Text>
    )}
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
                        onPress={() => setSelectedAddress(address)}
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

              {/* Order Type - Schedule Option */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Order Type</Text>
                <View style={styles.orderTypeContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setOrderType('now');
                      setSelectedDateTime(null);
                    }}
                    style={[
                      styles.orderTypeButton,
                      orderType === 'now' && styles.orderTypeButtonActive,
                    ]}
                  >
                    <Feather
                      name="clock"
                      size={20}
                      color={orderType === 'now' ? '#f97316' : '#666'}
                    />
                    <Text style={[
                      styles.orderTypeText,
                      orderType === 'now' && styles.orderTypeTextActive,
                    ]}>
                      Now
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setOrderType('schedule')}
                    style={[
                      styles.orderTypeButton,
                      orderType === 'schedule' && styles.orderTypeButtonActive,
                    ]}
                  >
                    <Feather
                      name="calendar"
                      size={20}
                      color={orderType === 'schedule' ? '#f97316' : '#666'}
                    />
                    <Text style={[
                      styles.orderTypeText,
                      orderType === 'schedule' && styles.orderTypeTextActive,
                    ]}>
                      Schedule
                    </Text>
                  </TouchableOpacity>
                </View>

                {orderType === 'schedule' && (
                  <View style={styles.scheduleOptions}>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Feather name="calendar" size={20} color="#f97316" />
                      <Text style={styles.dateTimeButtonText}>
                        {selectedDateTime
                          ? selectedDateTime.toLocaleDateString()
                          : 'Select Date'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Feather name="clock" size={20} color="#f97316" />
                      <Text style={styles.dateTimeButtonText}>
                        {selectedDateTime
                          ? selectedDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Select Time'}
                      </Text>
                    </TouchableOpacity>

                    {selectedDateTime && (
                      <Text style={styles.selectedDateTimeText}>
                        Scheduled for: {selectedDateTime.toLocaleString()}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Special Request */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Special Request (Optional)</Text>

                <Text style={styles.requestLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.requestCategories}>
                  <View style={styles.requestChips}>
                    {requestCategories.map((category) => (
                      <TouchableOpacity
                        key={category.value}
                        onPress={() => setSelectedRequestCategory(category.value)}
                        style={[
                          styles.requestChip,
                          selectedRequestCategory === category.value && styles.requestChipSelected,
                        ]}
                      >
                        <Feather
                          name={category.icon as any}
                          size={14}
                          color={selectedRequestCategory === category.value ? '#fff' : '#666'}
                        />
                        <Text style={[
                          styles.requestChipText,
                          selectedRequestCategory === category.value && styles.requestChipTextSelected,
                        ]}>
                          {category.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <TextInput
                  style={styles.requestInput}
                  value={specialRequest}
                  onChangeText={setSpecialRequest}
                  placeholder="Tell us about any special requirements..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Payment Method */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Payment Method</Text>
                <View style={styles.paymentList}>
                  {/* Cash on Delivery - Only for orders below ₦10,000 */}
                  <TouchableOpacity
                    onPress={() => {
                      if (total >= 10000) {
                        showToast('Cash on delivery is only available for orders below ₦10,000. Please select card payment.');
                        return;
                      }
                      setPaymentMethod('cash');
                    }}
                    style={[
                      styles.paymentCard,
                      paymentMethod === 'cash' && styles.paymentCardSelected,
                      total >= 10000 && styles.paymentCardUnavailable,
                    ]}
                  >
                    <View style={styles.paymentCardContent}>
                      <View style={styles.paymentLeft}>
                        <Feather name="dollar-sign" size={18} color={total >= 10000 ? "#666" : "#f97316"} />
                        <View>
                          <Text style={[
                            styles.paymentLabel,
                            total >= 10000 && styles.textDisabled
                          ]}>
                            Cash on Delivery
                          </Text>
                          <Text style={styles.paymentDescription}>
                            {total >= 10000
                              ? 'Not available for orders ₦10,000 and above'
                              : 'Pay with cash when your order arrives'
                            }
                          </Text>
                        </View>
                      </View>
                      {paymentMethod === 'cash' && (
                        <View style={styles.paymentSelectedDot} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Card Payment */}
                  <TouchableOpacity
                    onPress={() => setPaymentMethod('card')}
                    style={[
                      styles.paymentCard,
                      paymentMethod === 'card' && styles.paymentCardSelected,
                    ]}
                  >
                    <View style={styles.paymentCardContent}>
                      <View style={styles.paymentLeft}>
                        <Feather name="credit-card" size={18} color="#f97316" />
                        <View>
                          <Text style={styles.paymentLabel}>Card Payment</Text>
                          <Text style={styles.paymentDescription}>
                            Pay securely with your card
                          </Text>
                        </View>
                      </View>
                      {paymentMethod === 'card' && (
                        <View style={styles.paymentSelectedDot} />
                      )}
                    </View>
                  </TouchableOpacity>
                </View>

                {paymentMethod === 'card' && (
                  <TouchableOpacity style={styles.saveCardRow} onPress={() => setSaveCard(v => !v)} activeOpacity={0.7}>
                    <Feather name={saveCard ? 'check-square' : 'square'} size={18} color={saveCard ? '#f97316' : '#666'} />
                    <Text style={styles.saveCardText}>Save this card for faster checkout</Text>
                  </TouchableOpacity>
                )}
                {paymentMethod === 'cash' && finalTotal < 10000 && (
                  <View style={styles.infoBox}>
                    <Feather name="info" size={16} color="#f97316" />
                    <Text style={styles.infoText}>
                      Pay with cash when your order is delivered
                    </Text>
                  </View>
                )}
                {paymentMethod === 'cash' && finalTotal >= 10000 && (
                  <View style={styles.infoBoxWarning}>
                    <Feather name="alert-circle" size={16} color="#f59e0b" />
                    <Text style={styles.infoTextWarning}>
                      Cash on delivery not available for orders ₦10,000 and above. Please select card payment.
                    </Text>
                  </View>
                )}
              </View>

              {/* Rewards Section */}
{(customerRewards?.availableFreeDelivery || walletBalance > 0) && (
  <View style={styles.modalSection}>
    <Text style={styles.modalSectionTitle}>Available Rewards</Text>

   {/* Free Delivery Reward with expiration */}
{customerRewards?.availableFreeDelivery && (
  <TouchableOpacity
    onPress={() => setApplyFreeDelivery(!applyFreeDelivery)}
    style={[
      styles.rewardCard,
      applyFreeDelivery && styles.rewardCardSelected
    ]}
  >
    <View style={styles.rewardCardContent}>
      <View style={styles.rewardIcon}>
        <Feather name="truck" size={20} color="#10b981" />
      </View>
      <View style={styles.rewardInfo}>
        <Text style={styles.rewardTitle}>Free Delivery</Text>
        <Text style={styles.rewardDescription}>
          Use your free delivery reward on this order
        </Text>
        {customerRewards.freeDeliveryExpiresAt && (
          <Text style={styles.rewardExpiry}>
            Expires {new Date(customerRewards.freeDeliveryExpiresAt).toLocaleDateString()}
          </Text>
        )}
      </View>
      {applyFreeDelivery && (
        <View style={styles.rewardCheck}>
          <Feather name="check-circle" size={20} color="#10b981" />
        </View>
      )}
    </View>
  </TouchableOpacity>
)}

    {/* Wallet/Bonus Reward */}
    {walletBalance > 0 && (
      <TouchableOpacity
        onPress={() => setApplyWallet(!applyWallet)}
        style={[
          styles.rewardCard,
          applyWallet && styles.rewardCardSelected
        ]}
      >
        <View style={styles.rewardCardContent}>
          <View style={styles.rewardIcon}>
            <Feather name="gift" size={20} color="#f97316" />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardTitle}>Referral Bonus</Text>
            <Text style={styles.rewardDescription}>
              ₦{walletBalance.toLocaleString()} available from referrals
            </Text>
          </View>
          {applyWallet && (
            <View style={styles.rewardCheck}>
              <Feather name="check-circle" size={20} color="#f97316" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    )}
  </View>
)}

 {/* Order Summary */}
<View style={styles.modalSection}>
  <Text style={styles.modalSectionTitle}>Order Summary</Text>
  <View style={styles.modalSummary}>
    <View style={styles.modalSummaryRow}>
      <Text style={styles.modalSummaryLabel}>Items ({items.length})</Text>
      <Text style={styles.modalSummaryValue}>₦{subtotal.toLocaleString()}</Text>
    </View>

    {/* Delivery Fee */}
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
          <Text style={styles.modalSummaryLabel}>Delivery Fee</Text>
          <Text style={[
            styles.modalSummaryValue,
            (freeDeliveryEligible || applyFreeDelivery) && styles.modalDiscountValue
          ]}>
            {freeDeliveryEligible || applyFreeDelivery ? 'FREE' : `₦${calculatedDeliveryFee.toLocaleString()}`}
          </Text>
        </View>
      </>
    ) : (
      <View style={styles.modalSummaryRow}>
        <Text style={styles.modalSummaryLabel}>Delivery Fee</Text>
        <Text style={styles.modalSummaryValue}>Select address to calculate</Text>
      </View>
    )}

    {/* First Order Discount */}
    {firstOrderDiscount > 0 && !promoApplied && (
      <View style={[styles.modalSummaryRow, styles.modalDiscountRow]}>
        <Text style={styles.modalDiscountLabel}>First Order Discount (10%)</Text>
        <Text style={styles.modalDiscountValue}>-₦{firstOrderDiscount.toLocaleString()}</Text>
      </View>
    )}

    {/* Promo Discount */}
    {discount > 0 && (
      <View style={[styles.modalSummaryRow, styles.modalDiscountRow]}>
        <Text style={styles.modalDiscountLabel}>Promo Discount</Text>
        <Text style={styles.modalDiscountValue}>-₦{discount.toLocaleString()}</Text>
      </View>
    )}

    {/* Referral Bonus Applied */}
    {applyWallet && finalWalletUsedAmount > 0 && (
      <View style={[styles.modalSummaryRow, styles.modalDiscountRow]}>
        <Text style={styles.modalDiscountLabel}>Referral Bonus</Text>
        <Text style={styles.modalDiscountValue}>-₦{finalWalletUsedAmount.toLocaleString()}</Text>
      </View>
    )}

    {/* Total */}
    <View style={[styles.modalSummaryRow, styles.modalTotalRow]}>
      <Text style={styles.modalTotalLabel}>Total</Text>
      <Text style={styles.modalTotalValue}>₦{finalTotal.toLocaleString()}</Text>
    </View>

    {/* Notices */}
    {(freeDeliveryEligible || applyFreeDelivery) && (
      <Text style={styles.modalFreeDeliveryNotice}>Free delivery applied to this order!</Text>
    )}
    {applyWallet && finalWalletUsedAmount > 0 && (
      <Text style={styles.modalReferralNotice}>Referral bonus saved you ₦{finalWalletUsedAmount.toLocaleString()}</Text>
    )}
  </View>
</View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={handlePlaceOrder}
                disabled={!selectedAddress || !calculatedDeliveryFee || isPlacingOrder || processingPayment || isCalculatingFee || loadingSettings}
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
  {orderType === 'schedule' ? 'Schedule Order' : 'Place Order'} • ₦{finalTotal.toLocaleString()}
</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker - Outside Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDateTime || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker - Outside Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedDateTime || new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  saveCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingVertical: 6 },
  saveCardText: { color: '#ccc', fontSize: 13, flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingBottom: 60,
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
  itemHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 2,
},
rewardCard: {
  backgroundColor: '#2a2a2a',
  borderRadius: 12,
  padding: 12,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: 'transparent',
},
rewardCardSelected: {
  borderColor: '#f97316',
  backgroundColor: 'rgba(249,115,22,0.1)',
},
rewardCardContent: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
rewardIcon: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(16,185,129,0.1)',
  justifyContent: 'center',
  alignItems: 'center',
},
rewardInfo: {
  flex: 1,
},
rewardTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#fff',
  marginBottom: 2,
},
rewardDescription: {
  fontSize: 12,
  color: '#666',
},
rewardCheck: {
  width: 24,
  height: 24,
  borderRadius: 12,
  justifyContent: 'center',
  alignItems: 'center',
},
promoBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(249,115,22,0.15)',
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 12,
  gap: 4,
},
promoBadgeText: {
  fontSize: 9,
  color: '#f97316',
  fontWeight: '500',
},
originalPriceText: {
  fontSize: 10,
  color: '#666',
  textDecorationLine: 'line-through',
  marginTop: 2,
},
disabledButton: {
  backgroundColor: '#2a2a2a',
  opacity: 0.5,
},
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  rewardExpiry: {
  fontSize: 10,
  color: '#f59e0b',
  marginTop: 2,
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
  modalStrikethrough: {
  fontSize: 11,
  color: '#666',
  textDecorationLine: 'line-through',
  marginLeft: 4,
},
modalReferralNotice: {
  fontSize: 11,
  color: '#f97316',
  textAlign: 'center',
  marginTop: 8,
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
    fontWeight: '500',
  },
  firstOrderTextSmall: {
    color: '#f97316',
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  freeDeliveryNotice: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
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
  orderTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  orderTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  orderTypeButtonActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  orderTypeText: {
    fontSize: 14,
    color: '#666',
  },
  orderTypeTextActive: {
    color: '#f97316',
    fontWeight: '600',
  },
  scheduleOptions: {
    marginTop: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    gap: 12,
    marginBottom: 10,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  selectedDateTimeText: {
    fontSize: 14,
    color: '#f97316',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  requestLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  requestCategories: {
    marginBottom: 12,
  },
  requestChips: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  requestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  requestChipSelected: {
    backgroundColor: '#f97316',
  },
  requestChipText: {
    fontSize: 11,
    color: '#666',
  },
  requestChipTextSelected: {
    color: '#fff',
  },
  requestInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
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
  paymentCardUnavailable: {
    opacity: 0.6,
    backgroundColor: '#1a1a1a',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  paymentCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#fff',
  },
  paymentDescription: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  paymentSelectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  textDisabled: {
    color: '#666',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoBoxWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  infoText: {
    fontSize: 12,
    color: '#f97316',
    flex: 1,
  },
  infoTextWarning: {
    fontSize: 12,
    color: '#f59e0b',
    flex: 1,
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
  modalFreeDeliveryNotice: {
    fontSize: 11,
    color: '#10b981',
    textAlign: 'center',
    marginTop: 8,
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
