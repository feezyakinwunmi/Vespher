// app/screens/VendorSignupScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { verifyBankAccount } from '../utils/flutterwave';



type RegistrationStep = 'auth' | 'business' | 'documents' | 'review' | 'success';

interface FormData {
  // Auth fields
  email: string;
  password: string;
  confirmPassword: string;
  ownerName: string;
  phone: string;
  
  // Business fields
  businessName: string;
  address: string;
  category: string;
  description: string;
  logo: string | null;
  
  // Document fields
  cacNumber: string;
  bankName: string;
  bankCode: string; // ✅ NEW: Store bank code separately
  accountNumber: string;
  accountName: string;
  accountVerified: boolean; // ✅ NEW: Track if account was verified
}

// ✅ EXPANDED categories for your platform (not just food)
const categories = [
  // Food & Restaurants
  { label: 'Restaurant', value: 'restaurant' },
  { label: 'Fast Food', value: 'fastfood' },
  { label: 'Local Cuisine', value: 'local' },
  { label: 'Seafood', value: 'seafood' },
  { label: 'Bakeries', value: 'bakery' },
  { label: 'Grills & Barbecue', value: 'grill' },
  
  // Groceries & Raw Foods
  { label: 'Groceries', value: 'groceries' },
  { label: 'Fresh Produce', value: 'produce' },
  { label: 'Meat & Fish', value: 'meat' },
  { label: 'Beverages', value: 'beverages' },
  
  // Other Categories
  { label: 'Pharmacy', value: 'pharmacy' },
  { label: 'Electronics', value: 'electronics' },
  { label: 'Fashion', value: 'fashion' },
  { label: 'Home & Kitchen', value: 'home' },
  { label: 'Beauty & Personal Care', value: 'beauty' },
  { label: 'Books & Stationery', value: 'books' },
  { label: 'Pets & Pet Supplies', value: 'pets' },
  { label: 'Baby & Kids', value: 'baby' },
  { label: 'Sports & Outdoors', value: 'sports' },
  { label: 'Automotive', value: 'auto' },
];

// ✅ COMPREHENSIVE bank list with Flutterwave bank codes
const banks = [
  // Major Nigerian Banks
  { label: 'Access Bank', value: 'access', code: '044' },
  { label: 'Citibank', value: 'citibank', code: '023' },
  { label: 'Ecobank', value: 'ecobank', code: '050' },
  { label: 'Fidelity Bank', value: 'fidelity', code: '070' },
  { label: 'First Bank of Nigeria', value: 'first', code: '011' },
  { label: 'First City Monument Bank (FCMB)', value: 'fcmb', code: '214' },
  { label: 'Globus Bank', value: 'globus', code: '001' }, // Check code
  { label: 'Guaranty Trust Bank (GTBank)', value: 'gtb', code: '058' },
  { label: 'Heritage Bank', value: 'heritage', code: '030' },
  { label: 'Keystone Bank', value: 'keystone', code: '082' },
  { label: 'Parallex Bank', value: 'parallex', code: '526' },
  { label: 'Polaris Bank', value: 'polaris', code: '076' },
  { label: 'Providus Bank', value: 'providus', code: '101' },
  { label: 'Stanbic IBTC Bank', value: 'stanbic', code: '221' },
  { label: 'Standard Chartered Bank', value: 'standard', code: '068' },
  { label: 'Sterling Bank', value: 'sterling', code: '232' },
  { label: 'Suntrust Bank', value: 'suntrust', code: '100' },
  { label: 'Titan Trust Bank', value: 'titan', code: '102' },
  { label: 'Union Bank', value: 'union', code: '032' },
  { label: 'United Bank for Africa (UBA)', value: 'uba', code: '033' },
  { label: 'Unity Bank', value: 'unity', code: '215' },
  { label: 'Wema Bank', value: 'wema', code: '035' },
  { label: 'Zenith Bank', value: 'zenith', code: '057' },
  
  // Microfinance & Digital Banks
  { label: 'Kuda Bank', value: 'kuda', code: '090267' }, // Check code
  { label: 'OPay', value: 'opay', code: '100052' },
  { label: 'PalmPay', value: 'palmpay', code: '100033' }, // Check code
  { label: 'Moniepoint', value: 'moniepoint', code: '090315' }, // Check code
  { label: 'FairMoney', value: 'fairmoney', code: '090318' }, // Check code
  { label: 'Rubies Bank', value: 'rubies', code: '090175' }, // Check code
  { label: 'Sparkle Bank', value: 'sparkle', code: '090325' }, // Check code
  { label: 'VBank', value: 'vbank', code: '090110' }, // Check code
  { label: 'Mint Bank', value: 'mint', code: '090340' }, // Check code
  { label: 'Eyowo', value: 'eyowo', code: '090328' }, // Check code
];

export function VendorSignupScreen() {
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();  
const [step, setStep] = useState<RegistrationStep>('auth');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Dropdown states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  
  // ✅ NEW: Account verification state
  const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  
  // OTP State
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const otpInputs = useRef<Array<TextInput | null>>([]);

  // ✅ Initialize Flutterwave
 

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    ownerName: '',
    phone: '',
    businessName: '',
    address: '',
    category: '',
    description: '',
    logo: null,
    cacNumber: '',
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: '',
    accountVerified: false,
  });

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!canResend && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
      setCountdown(60);
    }
    return () => clearTimeout(timer);
  }, [canResend, countdown]);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // If bank or account number changes, reset verification
    if (field === 'bankName' || field === 'accountNumber') {
      setAccountVerified(false);
      setFormData(prev => ({ ...prev, accountVerified: false }));
      setVerificationError('');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFormData(prev => ({ ...prev, logo: result.assets[0].uri }));
    }
  };

  const validateEmail = (email: string) => {
    return email.includes('@') && email.includes('.');
  };

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    
    const firstTwo = localPart.slice(0, 2);
    const lastTwo = localPart.slice(-2);
    const maskedLocal = firstTwo + '*'.repeat(Math.max(0, localPart.length - 4)) + lastTwo;
    
    return `${maskedLocal}@${domain}`;
  };

  // ✅ NEW: Verify bank account with Flutterwave
// Update the verifyBankAccount function (make sure it's named differently from the import)
const handleVerifyBankAccount = async () => {
  if (!formData.accountNumber || !formData.bankCode) {
    setVerificationError('Please select bank and enter account number');
    return;
  }

  setIsVerifyingAccount(true);
  setVerificationError('');

  try {
    const result = await verifyBankAccount(
      formData.accountNumber,
      formData.bankCode
    );

    if (result.status === 'success' && result.data) {
      setFormData(prev => ({ 
        ...prev, 
        accountName: result.data?.account_name || '',
        accountVerified: true 
      }));
      setAccountVerified(true);
      
      Alert.alert('Success', `Account verified: ${result.data.account_name}`);
    } else {
      throw new Error(result.message);
    }
  } catch (error: any) {
    console.error('Verification error:', error);
    setVerificationError(error.message || 'Invalid account details');
    setAccountVerified(false);
    setFormData(prev => ({ ...prev, accountVerified: false }));
  } finally {
    setIsVerifyingAccount(false);
  }
};


  const handleNext = async () => {
    setError('');
    
    if (step === 'auth') {
      if (!formData.ownerName || !formData.email || !formData.password || !formData.phone) {
        setError('Please fill in all required fields');
        return;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      
      if (!validateEmail(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }
      
      setStep('business');
    }
    else if (step === 'business') {
      if (!formData.businessName || !formData.address) {
        setError('Please fill in all required business fields');
        return;
      }
      setStep('documents');
    }
    else if (step === 'documents') {
      if (!formData.bankName || !formData.accountNumber || !formData.accountName) {
        setError('Please fill in all payment details');
        return;
      }
      
      // ✅ Require account verification
      if (!formData.accountVerified) {
        setError('Please verify your bank account first');
        return;
      }
      
      setStep('review');
    }
    else if (step === 'review') {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.ownerName,
            role: 'vendor'
          },
          emailRedirectTo: undefined
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          throw new Error('This email is already registered. Please login instead.');
        }
        throw signUpError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      setPendingUserId(authData.user.id);
      setMaskedEmail(maskEmail(formData.email));
      setShowOTPModal(true);
      setCanResend(false);
      
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOTPChange = (text: string, index: number) => {
    // Only allow single digit
    if (text.length > 1) text = text.slice(-1);
    if (!/^\d?$/.test(text)) return; // only digits or empty

    const newOtp = [...otpCode];
    newOtp[index] = text;
    setOtpCode(newOtp);
    setOtpError('');

    // Auto-focus next input
    if (text && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-focus previous on backspace
    if (!text && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    const otpString = otpCode.join('');
    
    // Only trigger when we have exactly 6 digits and not already verifying
    if (otpString.length === 6 && !isVerifyingOTP) {
      handleVerifyOTP();
    }
  }, [otpCode, isVerifyingOTP]);

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otpCode.join('');
    if (otpString.length !== 6) {
      setOtpError('Please enter all 6 digits');
      return;
    }

    setIsVerifyingOTP(true);
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otpString,
        type: 'signup'
      });

      if (error) throw error;

      await completeVendorRegistration();
      
    } catch (error: any) {
      setOtpError(error.message || 'Invalid OTP. Please try again.');
      setOtpCode(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
      });

      if (error) throw error;
      
      setCanResend(false);
      Alert.alert('Success', 'A new verification code has been sent to your email');
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code');
    }
  };

// ✅ UPDATED: Complete vendor registration with Flutterwave subaccount
const completeVendorRegistration = async () => {
  try {
    let logoUrl = null;
    if (formData.logo) {
      const fileName = `vendor-${pendingUserId}-logo.jpg`;
      const response = await fetch(formData.logo);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage
        .from('vendor-logos')
        .upload(fileName, blob);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('vendor-logos')
          .getPublicUrl(fileName);
        logoUrl = publicUrl;
      }
    }

    // Insert user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: pendingUserId,
          email: formData.email,
          name: formData.ownerName,
          phone: formData.phone,
          role: 'vendor',
          created_at: new Date().toISOString(),
        },
      ]);

    if (profileError) throw profileError;


    // Insert vendor record WITHOUT subaccount ID
    const { error: vendorError } = await supabase
      .from('vendors')
      .insert([
        {
          owner_id: pendingUserId,
          name: formData.businessName,
          description: formData.description,
          category: formData.category,
          image_url: logoUrl,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          is_approved: false,
          bank_name: formData.bankName,
          bank_code: formData.bankCode,
          account_number: formData.accountNumber,
          account_name: formData.accountName,
        },
      ]);

    if (vendorError) throw vendorError;

    // ✅ CREATE VENDOR WALLET
    const { error: walletError } = await supabase
      .from('vendor_wallets')
      .insert({
        vendor_id: pendingUserId,
        balance: 0,
        total_earned: 0,
        updated_at: new Date().toISOString(),
      });

    if (walletError) {
      console.error('Failed to create vendor wallet:', walletError);
    } else {
      console.log('✅ Vendor wallet created successfully');
    }

    setShowOTPModal(false);
    setStep('success');
    
  } catch (err: any) {
    Alert.alert('Error', 'Failed to complete registration. Please contact support.');
    console.error(err);
  }
};

  const handleBack = () => {
    if (step === 'auth') {
      navigation.goBack();
    } else {
      const steps: RegistrationStep[] = ['auth', 'business', 'documents', 'review'];
      const currentIndex = steps.indexOf(step);
      setStep(steps[currentIndex - 1]);
    }
  };

  const getCurrentStepIndex = () => {
    const steps: RegistrationStep[] = ['auth', 'business', 'documents', 'review'];
    return steps.indexOf(step);
  };

  const selectCategory = (categoryValue: string) => {
    updateField('category', categoryValue);
    setShowCategoryDropdown(false);
  };

  const selectBank = (bankValue: string) => {
    const selectedBank = banks.find(b => b.value === bankValue);
    if (selectedBank) {
      updateField('bankName', bankValue);
      updateField('bankCode', selectedBank.code);
      setShowBankDropdown(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'auth':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Create Your Account</Text>
              <Text style={styles.subtitle}>Set up your vendor account credentials</Text>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              {/* Full Name */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Full Name *</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="user" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.ownerName}
                    onChangeText={(text) => updateField('ownerName', text)}
                    placeholder="Your full name"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Phone */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Phone Number *</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="phone" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.phone}
                    onChangeText={(text) => updateField('phone', text)}
                    placeholder="+234 801 234 5678"
                    placeholderTextColor="#666"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email Address *</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="mail" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(text) => updateField('email', text)}
                    placeholder="you@example.com"
                    placeholderTextColor="#666"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.password}
                    onChangeText={(text) => updateField('password', text)}
                    placeholder="Create a password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Confirm Password *</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.confirmPassword}
                    onChangeText={(text) => updateField('confirmPassword', text)}
                    placeholder="Confirm your password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        );

      case 'business':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Business Information</Text>
              <Text style={styles.subtitle}>Tell us about your business</Text>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              {/* Logo Upload */}
              <View style={styles.logoContainer}>
                <TouchableOpacity onPress={pickImage} style={styles.logoUpload}>
                  {formData.logo ? (
                    <Image source={{ uri: formData.logo }} style={styles.logoPreview} />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Feather name="camera" size={32} color="#666" />
                    </View>
                  )}
                  <View style={styles.logoOverlay}>
                    <Feather name="upload" size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Business Name */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Business Name *</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="home" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.businessName}
                    onChangeText={(text) => updateField('businessName', text)}
                    placeholder="e.g., Mama Epe Kitchen"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Address */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Business Address *</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="map-pin" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.address}
                    onChangeText={(text) => updateField('address', text)}
                    placeholder="Full address in Epe"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Category Dropdown */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Business Category</Text>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowCategoryDropdown(true)}
                >
                  <Feather name="grid" size={20} color="#666" style={styles.dropdownIcon} />
                  <Text style={[
                    styles.dropdownButtonText,
                    !formData.category && styles.dropdownPlaceholder
                  ]}>
                    {formData.category 
                      ? categories.find(c => c.value === formData.category)?.label 
                      : 'Select category'}
                  </Text>
                  <Feather name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Category Dropdown Modal */}
              <Modal
                visible={showCategoryDropdown}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCategoryDropdown(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.dropdownModal}>
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownTitle}>Select Category</Text>
                      <TouchableOpacity onPress={() => setShowCategoryDropdown(false)}>
                        <Feather name="x" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <FlatList
                      data={categories}
                      keyExtractor={(item) => item.value}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => selectCategory(item.value)}
                        >
                          <Text style={styles.dropdownItemText}>{item.label}</Text>
                          {formData.category === item.value && (
                            <Feather name="check" size={20} color="#f97316" />
                          )}
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </View>
              </Modal>

              {/* Description */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Business Description</Text>
                <TextInput
                  style={styles.textArea}
                  value={formData.description}
                  onChangeText={(text) => updateField('description', text)}
                  placeholder="Tell customers about your business..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>
        );

      case 'documents':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Payment Details</Text>
              <Text style={styles.subtitle}>How you'll receive payments</Text>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              {/* CAC Number */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>CAC Number (Optional)</Text>
                <TextInput
                  style={styles.simpleInput}
                  value={formData.cacNumber}
                  onChangeText={(text) => updateField('cacNumber', text)}
                  placeholder="RC123456"
                  placeholderTextColor="#666"
                />
              </View>

              {/* Bank Name Dropdown */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Bank Name *</Text>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowBankDropdown(true)}
                >
                  <Feather name="credit-card" size={20} color="#666" style={styles.dropdownIcon} />
                  <Text style={[
                    styles.dropdownButtonText,
                    !formData.bankName && styles.dropdownPlaceholder
                  ]}>
                    {formData.bankName 
                      ? banks.find(b => b.value === formData.bankName)?.label 
                      : 'Select bank'}
                  </Text>
                  <Feather name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Bank Dropdown Modal */}
              <Modal
                visible={showBankDropdown}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowBankDropdown(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.dropdownModal}>
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownTitle}>Select Bank</Text>
                      <TouchableOpacity onPress={() => setShowBankDropdown(false)}>
                        <Feather name="x" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <FlatList
                      data={banks}
                      keyExtractor={(item) => item.value}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => selectBank(item.value)}
                        >
                          <Text style={styles.dropdownItemText}>{item.label}</Text>
                          {formData.bankName === item.value && (
                            <Feather name="check" size={20} color="#f97316" />
                          )}
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </View>
              </Modal>

              {/* Account Number */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Account Number *</Text>
                <View style={styles.verificationRow}>
                  <TextInput
                    style={[styles.simpleInput, { flex: 1 }]}
                    value={formData.accountNumber}
                    onChangeText={(text) => updateField('accountNumber', text)}
                    placeholder="10-digit account number"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                {/* In the documents step, update the Verify button onPress */}
<TouchableOpacity
  onPress={handleVerifyBankAccount}  
  disabled={!formData.accountNumber || !formData.bankCode || isVerifyingAccount || accountVerified}
  style={[
    styles.verifyButton,
    accountVerified && styles.verifyButtonSuccess
  ]}
>
  {isVerifyingAccount ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : accountVerified ? (
    <Feather name="check" size={20} color="#fff" />
  ) : (
    <Text style={styles.verifyButtonText}>Verify</Text>
  )}
</TouchableOpacity>
                </View>
                {verificationError ? (
                  <Text style={styles.verificationError}>{verificationError}</Text>
                ) : null}
                {accountVerified ? (
                  <Text style={styles.verificationSuccess}>✓ Account verified</Text>
                ) : null}
              </View>

              {/* Account Name */}
              {/* Account Number */}
<View style={styles.fieldContainer}>
  <Text style={styles.label}>Account Number *</Text>
  <View style={styles.verificationRow}>
    <TextInput
      style={[styles.simpleInput, { flex: 1 }]}
      value={formData.accountNumber}
      onChangeText={(text) => updateField('accountNumber', text)}
      placeholder="10-digit account number"
      placeholderTextColor="#666"
      keyboardType="numeric"
      maxLength={10}
    />
    <TouchableOpacity
      onPress={handleVerifyBankAccount}
      disabled={!formData.accountNumber || !formData.bankCode || isVerifyingAccount || accountVerified}
      style={[
        styles.verifyButton,
        accountVerified && styles.verifyButtonSuccess
      ]}
    >
      {isVerifyingAccount ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : accountVerified ? (
        <Feather name="check" size={20} color="#fff" />
      ) : (
        <Text style={styles.verifyButtonText}>Verify</Text>
      )}
    </TouchableOpacity>
  </View>
  {verificationError ? (
    <Text style={styles.verificationError}>{verificationError}</Text>
  ) : null}
  {accountVerified ? (
    <Text style={styles.verificationSuccess}>✓ Account verified</Text>
  ) : null}
</View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Feather name="info" size={20} color="#f97316" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Email Verification Required</Text>
                  <Text style={styles.infoText}>
                    After submitting, we'll send a 6-digit verification code to your email. You'll need to enter it to complete registration.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );

      case 'review':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Review Your Information</Text>
              <Text style={styles.subtitle}>Please verify before submitting</Text>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.reviewCards}>
              {/* Account Details */}
              <View style={styles.reviewCard}>
                <Text style={styles.reviewCardTitle}>Account Details</Text>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Name</Text>
                  <Text style={styles.reviewValue}>{formData.ownerName}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Email</Text>
                  <Text style={styles.reviewValue}>{formData.email}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Phone</Text>
                  <Text style={styles.reviewValue}>{formData.phone}</Text>
                </View>
              </View>

              {/* Business Details */}
              <View style={styles.reviewCard}>
                <Text style={styles.reviewCardTitle}>Business Details</Text>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Business Name</Text>
                  <Text style={styles.reviewValue}>{formData.businessName}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Address</Text>
                  <Text style={[styles.reviewValue, styles.reviewValueAddress]}>
                    {formData.address}
                  </Text>
                </View>
                {formData.category && (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Category</Text>
                    <Text style={styles.reviewValue}>
                      {categories.find(c => c.value === formData.category)?.label}
                    </Text>
                  </View>
                )}
              </View>

              {/* Payment Details */}
              <View style={styles.reviewCard}>
                <Text style={styles.reviewCardTitle}>Payment Details</Text>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Bank</Text>
                  <Text style={styles.reviewValue}>
                    {banks.find(b => b.value === formData.bankName)?.label || formData.bankName}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Account Number</Text>
                  <Text style={styles.reviewValue}>{formData.accountNumber}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Account Name</Text>
                  <Text style={styles.reviewValue}>{formData.accountName}</Text>
                </View>
                {formData.accountVerified && (
                  <View style={styles.reviewVerifiedBadge}>
                    <Feather name="check-circle" size={14} color="#10b981" />
                    <Text style={styles.reviewVerifiedText}>Account Verified</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );

      case 'success':
        // Auto-redirect after 3.5 seconds
        useEffect(() => {
          const timer = setTimeout(() => {
            navigation.navigate('Login');
          }, 3500);

          return () => clearTimeout(timer);
        }, [navigation]);

        return (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Feather name="check-circle" size={64} color="#10b981" />
            </View>
            
            <Text style={styles.successTitle}>Registration Successful!</Text>
            
            <Text style={styles.successText}>
              Your vendor application has been submitted and is under review.
            </Text>
            
            <Text style={styles.successSubText}>
              Redirecting you to login page in a few seconds...
            </Text>

            {/* Optional: small loading indicator */}
            <ActivityIndicator 
              size="small" 
              color="#f97316" 
              style={{ marginTop: 24 }} 
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Back */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Register as Vendor</Text>
              {step !== 'success' && (
                <Text style={styles.headerStep}>
                  Step {getCurrentStepIndex() + 1} of 4
                </Text>
              )}
            </View>
          </View>

          {/* Progress Bar - Hide on success */}
          {step !== 'success' && (
            <View style={styles.progressContainer}>
              {['auth', 'business', 'documents', 'review'].map((s, index) => (
                <View
                  key={s}
                  style={[
                    styles.progressBar,
                    index <= getCurrentStepIndex() ? styles.progressActive : styles.progressInactive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {renderStep()}
          </View>

          {/* Footer */}
          {step !== 'success' && (
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleNext}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.footerButton}
                >
                  {isSubmitting ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.buttonText}>Processing...</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.buttonText}>
                        {step === 'review' ? 'Submit Application' : 'Continue'}
                      </Text>
                      <Feather name="chevron-right" size={20} color="#fff" />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* OTP Verification Modal */}
      <Modal
        visible={showOTPModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOTPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify Your Email</Text>
              <TouchableOpacity onPress={() => setShowOTPModal(false)}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.otpDescription}>
                Enter the 6-digit verification code sent to:
              </Text>
              <Text style={styles.maskedEmail}>{maskedEmail}</Text>

              <View style={styles.otpContainer}>
                {otpCode.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      if (ref) {
                        otpInputs.current[index] = ref;
                      }
                    }}
                    style={[
                      styles.otpInput,
                      otpError ? styles.otpInputError : null
                    ]}
                    value={digit}
                    onChangeText={(text) => handleOTPChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="numeric"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!isVerifyingOTP}
                  />
                ))}
              </View>

              {otpError ? (
                <Text style={styles.otpErrorText}>{otpError}</Text>
              ) : null}

              <View style={styles.resendContainer}>
                <Text style={styles.resendInfo}>Didn't receive the code? </Text>
                <TouchableOpacity 
                  onPress={handleResendOTP}
                  disabled={!canResend}
                >
                  <Text style={[
                    styles.resendLink,
                    !canResend && styles.resendLinkDisabled
                  ]}>
                    {canResend ? 'Resend' : `Resend in ${countdown}s`}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleVerifyOTP}
                disabled={isVerifyingOTP || otpCode.some(d => d === '')}
                style={styles.modalButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.submitGradient}
                >
                  {isVerifyingOTP ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Verify Email</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ✅ ADD NEW STYLES for verification features
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerStep: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  progressBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  progressActive: {
    backgroundColor: '#f97316',
  },
  progressInactive: {
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  headerContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
  },
  form: {
    gap: 20,
  },
  fieldContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 4,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  inputIcon: {
    position: 'absolute' as const,
    left: 16,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 56,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingLeft: 48,
    paddingRight: 48,
    fontSize: 16,
    color: '#fff',
  },
  eyeIcon: {
    position: 'absolute' as const,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  logoContainer: {
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  logoUpload: {
    position: 'relative' as const,
  },
  logoPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  logoOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    height: 56,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  dropdownIcon: {
    marginRight: 12,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  dropdownPlaceholder: {
    color: '#666',
  },
  dropdownModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 16,
    maxHeight: '70%',
    width: '90%',
  },
  dropdownHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  dropdownItem: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#fff',
  },
  textArea: {
    height: 100,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    textAlignVertical: 'top' as const,
  },
  simpleInput: {
    height: 56,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  // ✅ New styles for verification
  verificationRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  verifyButton: {
    width: 80,
    height: 56,
    backgroundColor: '#f97316',
    borderRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  verifyButtonSuccess: {
    backgroundColor: '#10b981',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  verificationError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  verificationSuccess: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  verifiedInput: {
    backgroundColor: '#1a2a1a',
    borderColor: '#10b981',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  reviewCards: {
    gap: 16,
  },
  reviewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reviewCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  reviewRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: 14,
    color: '#666',
  },
  reviewValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  reviewValueAddress: {
    flex: 1,
    textAlign: 'right' as const,
    marginLeft: 16,
  },
  reviewVerifiedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  reviewVerifiedText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  successText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  successSubText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center' as const,
    marginBottom: 32,
  },
  successButton: {
    height: 56,
    borderRadius: 14,
    overflow: 'hidden' as const,
    width: '100%',
  },
  successGradient: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    paddingTop: 0,
  },
  footerButton: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  buttonContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal and OTP styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    overflow: 'hidden' as const,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalBody: {
    padding: 16,
  },
  otpDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  maskedEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  otpContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  otpInput: {
    width: 45,
    height: 45,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    textAlign: 'center' as const,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  otpInputError: {
    borderColor: '#ef4444',
  },
  otpErrorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  resendContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 8,
    marginBottom: 20,
  },
  resendInfo: {
    color: '#666',
    fontSize: 14,
  },
  resendLink: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '500',
  },
  resendLinkDisabled: {
    color: '#666',
  },
  modalButton: {
    height: 48,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  submitGradient: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});