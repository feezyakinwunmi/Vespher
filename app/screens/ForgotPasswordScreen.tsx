// app/screens/ForgotPasswordScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthLabel } from '../utils/passwordValidation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type ScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<ScreenNavigationProp>();
  
  // Step 1: Email
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  
  // Step 2: OTP Verification
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const otpInputs = useRef<Array<TextInput | null>>([]);
  
  // Step 3: Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
// Replace the passwordStrength state with this:
const [passwordStrength, setPasswordStrength] = useState<{
  score: number;
  feedback: string[];  // Changed from never[] to string[]
  isValid: boolean;
}>({ score: 0, feedback: [], isValid: false });
  // Password validation effect
 useEffect(() => {
    if (password) {
      const validation = validatePassword(password);
      setPasswordStrength(validation);
    } else {
      setPasswordStrength({ score: 0, feedback: [], isValid: false });
    }
  }, [password]);

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

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    
    const firstTwo = localPart.slice(0, 2);
    const lastTwo = localPart.slice(-2);
    const maskedLocal = firstTwo + '*'.repeat(Math.max(0, localPart.length - 4)) + lastTwo;
    
    return `${maskedLocal}@${domain}`;
  };

  const handleSendOTP = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    try {
      // Check if user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single();

      if (userError || !user) {
        Alert.alert('Error', 'No account found with this email');
        return;
      }

      // Send OTP for password reset
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'yourapp://reset-password', // Optional: deep link if you still want to support links
      });
      
      if (error) throw error;
      
      setMaskedEmail(maskEmail(email));
      setEmailSent(true);
      setShowOTPModal(true);
      setCanResend(false);
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
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
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: otpString,
        type: 'recovery'
      });

      if (error) throw error;

      // OTP verified successfully
      setShowOTPModal(false);
      setShowResetModal(true);
      
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
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      
      setCanResend(false);
      Alert.alert('Success', 'A new OTP has been sent to your email');
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!passwordStrength.isValid) {
      Alert.alert('Error', 'Please meet all password requirements');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsResetting(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      
      Alert.alert(
        'Success',
        'Password updated successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowResetModal(false);
              setEmailSent(false);
              setEmail('');
              navigation.navigate('Login');
            },
          },
        ]
      );
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update password');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          {!emailSent ? (
            // Step 1: Email Input Screen
            <>
              <View style={styles.iconContainer}>
                <Feather name="lock" size={50} color="#f97316" />
              </View>

              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you a 6-digit code to reset your password.
              </Text>

              <View style={styles.inputContainer}>
                <Feather name="mail" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#666"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
              </View>

              <TouchableOpacity
                onPress={handleSendOTP}
                disabled={isLoading}
                style={styles.submitButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.submitGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Send Reset Code</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            // Step 2: Email Sent Confirmation
            <>
              <View style={styles.iconContainer}>
                <Feather name="mail" size={50} color="#f97316" />
              </View>

              <Text style={styles.title}>Check Your Email</Text>
              
              <Text style={styles.message}>
                We've sent a 6-digit verification code to:
              </Text>
              <Text style={styles.maskedEmail}>{maskedEmail}</Text>
              
              <Text style={styles.instruction}>
                Enter the code in the next screen to reset your password.
              </Text>

              <TouchableOpacity
                onPress={() => setEmailSent(false)}
                style={styles.resendButton}
              >
                <Text style={styles.resendText}>Wrong email? Go back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Return to Login</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
                Enter the 6-digit code sent to {maskedEmail}
              </Text>

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
                  disabled={!canResend || isLoading}
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
                    <Text style={styles.submitText}>Verify Code</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={showResetModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowResetModal(false)}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* New Password */}
              <View style={styles.inputContainer}>
                <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="New password"
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

              {/* Password Strength */}
              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarContainer}>
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthBar,
                          {
                            backgroundColor: level <= passwordStrength.score 
                              ? getPasswordStrengthColor(passwordStrength.score)
                              : '#2a2a2a',
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: getPasswordStrengthColor(passwordStrength.score) }]}>
                    {getPasswordStrengthLabel(passwordStrength.score)}
                  </Text>
                </View>
              )}

              {/* Password Requirements */}
              {password.length > 0 && passwordStrength.feedback.length > 0 && (
                <View style={styles.requirementsContainer}>
                  {passwordStrength.feedback.map((req, index) => (
                    <View key={index} style={styles.requirementRow}>
                      <Feather name="x-circle" size={12} color="#ef4444" />
                      <Text style={styles.requirementText}>{req}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Feather name="lock" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
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

              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}

              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={isResetting || !passwordStrength.isValid || password !== confirmPassword}
                style={styles.modalButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.submitGradient}
                >
                  {isResetting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Reset Password</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#fff',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  submitButton: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
  },
  submitGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  maskedEmail: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f97316',
    textAlign: 'center',
    marginBottom: 30,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  resendButton: {
    marginBottom: 20,
  },
  resendText: {
    color: '#f97316',
    fontSize: 14,
    textAlign: 'center',
  },
  loginButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
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
  modalBody: {
    padding: 16,
  },
  modalButton: {
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 20,
  },
  strengthContainer: {
    marginBottom: 16,
  },
  strengthBarContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  requirementsContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    color: '#666',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 16,
  },
  // OTP specific styles
  otpDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  otpInput: {
    width: 45,
    height: 45,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    textAlign: 'center',
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
    textAlign: 'center',
    marginBottom: 16,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
});