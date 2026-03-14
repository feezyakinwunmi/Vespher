// app/screens/CustomerSignupScreen.tsx
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

type RegistrationStep = 'auth' | 'details' | 'success';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  address?: string;
  apartment?: string;
}

export function CustomerSignupScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<RegistrationStep>('auth');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    address: '',
    apartment: '',
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

  const handleNext = async () => {
    setError('');

    if (step === 'auth') {
      if (!formData.fullName || !formData.email || !formData.password || !formData.phone) {
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

      if (formData.phone.length < 10) {
        setError('Please enter a valid phone number');
        return;
      }

      setStep('details');
    } else if (step === 'details') {
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
            name: formData.fullName,
            role: 'customer'
          },
          // Don't automatically sign in - wait for OTP verification
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

      // Store the user ID and show OTP modal
      setPendingUserId(authData.user.id);
      setMaskedEmail(maskEmail(formData.email));
      
      // Show OTP verification modal
      setShowOTPModal(true);
      setCanResend(false);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOTPChange = (text: string, index: number) => {
    const newOtp = [...otpCode];
    newOtp[index] = text;
    setOtpCode(newOtp);
    setOtpError('');

    // Auto-focus next input
    if (text && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newOtp.every(digit => digit !== '') && !isVerifyingOTP) {
      handleVerifyOTP();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace to focus previous input
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
      // Verify OTP
      const { error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otpString,
        type: 'signup'
      });

      if (error) throw error;

      // OTP verified successfully - now create the user profile
      await completeUserRegistration();
      
    } catch (error: any) {
      setOtpError(error.message || 'Invalid OTP. Please try again.');
      // Clear OTP fields on error
      setOtpCode(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;
    
    try {
      // Resend OTP
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

  const completeUserRegistration = async () => {
    try {
      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: pendingUserId,
            email: formData.email,
            name: formData.fullName,
            phone: formData.phone,
            role: 'customer',
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileError) throw profileError;

      // Add address if provided
      if (formData.address) {
        const { error: addressError } = await supabase
          .from('addresses')
          .insert([
            {
              user_id: pendingUserId,
              label: 'Home',
              street: formData.address,
              area: formData.apartment || 'Default Area',
              phone: formData.phone,
              is_default: true,
            },
          ]);

        if (addressError) throw addressError;
      }

      // Close OTP modal and show success
      setShowOTPModal(false);
      setStep('success');
      
    } catch (err: any) {
      Alert.alert('Error', 'Failed to complete registration. Please contact support.');
      console.error(err);
    }
  };

  const steps = [
    { key: 'auth', label: 'Account' },
    { key: 'details', label: 'Details' },
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex(s => s.key === step);
  };

  const renderStep = () => {
    switch (step) {
      case 'auth':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Create Your Account</Text>
              <Text style={styles.subtitle}>
                Sign up to start ordering from your favorite vendors
              </Text>
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
                    value={formData.fullName}
                    onChangeText={(text) => updateField('fullName', text)}
                    placeholder="John Doe"
                    placeholderTextColor="#666"
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
                <Text style={styles.hint}>Must be at least 6 characters</Text>
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

      case 'details':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Delivery Details</Text>
              <Text style={styles.subtitle}>
                Add your delivery address (optional for now)
              </Text>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              {/* Street Address */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Street Address</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="map-pin" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.address}
                    onChangeText={(text) => updateField('address', text)}
                    placeholder="e.g., 123 Main Street"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Apartment */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Apartment/Suite (Optional)</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="home" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.apartment}
                    onChangeText={(text) => updateField('apartment', text)}
                    placeholder="e.g., Apartment 4B"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Feather name="info" size={20} color="#f97316" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Email Verification Required</Text>
                  <Text style={styles.infoText}>
                    After creating your account, we'll send a 6-digit verification code to your email. You'll need to enter it to complete registration.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );

      case 'success':
        return (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Feather name="check-circle" size={50} color="#10b981" />
            </View>
            <Text style={styles.successTitle}>Welcome to veshpe! 🎉</Text>
            <Text style={styles.successText}>
              Your account has been created and verified successfully. Start exploring vendors and placing orders!
            </Text>
            
            <View style={styles.successButtons}>
              <TouchableOpacity
                onPress={() => navigation.navigate('CustomerTabs' as never)}
                style={styles.primaryButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGradient}
                >
                  <Text style={styles.primaryButtonText}>Browse Vendors</Text>
                  <Feather name="chevron-right" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('CustomerTabs' as never)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Add Delivery Address</Text>
              </TouchableOpacity>
            </View>
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
            <TouchableOpacity
              onPress={() => {
                if (step === 'auth') {
                  navigation.goBack();
                } else {
                  setStep('auth');
                }
              }}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>
                {step === 'auth' ? 'Create Customer Account' : 'Delivery Details'}
              </Text>
              <Text style={styles.headerStep}>
                Step {getCurrentStepIndex() + 1} of {steps.length}
              </Text>
            </View>
          </View>

          {/* Progress Bar - Hide on success */}
          {step !== 'success' && (
            <View style={styles.progressContainer}>
              {steps.map((s, index) => (
                <View
                  key={s.key}
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
                      <Text style={styles.buttonText}>Creating Account...</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.buttonText}>
                        {step === 'details' ? 'Create Account' : 'Continue'}
                      </Text>
                      <Feather name="chevron-right" size={20} color="#fff" />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {step === 'auth' && (
                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
                    <Text style={styles.loginLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              )}
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

              {/* OTP Input Boxes */}
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

              {/* Resend Code */}
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
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 4,
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
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
    marginBottom: 32,
  },
  successButtons: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  primaryGradient: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  secondaryButtonText: {
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
  loginContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 16,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#f97316',
    fontSize: 14,
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