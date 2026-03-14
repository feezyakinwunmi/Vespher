import React, { useState } from 'react';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

type Step = 'auth' | 'personal' | 'vehicle' | 'documents';

interface FormData {
  // Auth fields
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  
  // Personal & Vehicle fields
  address: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  
  // Document fields
  bankName: string;
  accountNumber: string;
  accountName: string;
  
  // File uploads
  profilePhoto: string | null;
  licensePhoto: string | null;
  idCard: string | null;
}

const vehicleTypes = ['Motorcycle', 'Bicycle', 'Car', 'Van', 'Truck', 'Scooter', 'Tricycle'];
const banks = [
  'GTBank', 'First Bank', 'UBA', 'Zenith Bank', 'Access Bank', 
  'Kuda Bank', 'OPay', 'PalmPay', 'Moniepoint'
];

export function AdminCreateLogisticScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<Step>('auth');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    address: '',
    vehicleType: '',
    vehicleNumber: '',
    licenseNumber: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    profilePhoto: null,
    licensePhoto: null,
    idCard: null,
  });

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const pickImage = async (field: 'profilePhoto' | 'licensePhoto' | 'idCard') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFormData(prev => ({ ...prev, [field]: result.assets[0].uri }));
    }
  };

  const validateStep = (): boolean => {
    setError('');

    if (step === 'auth') {
      if (!formData.fullName || !formData.email || !formData.password || !formData.phone) {
        setError('Please fill in all required fields');
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
      
      if (!formData.email.includes('@') || !formData.email.includes('.')) {
        setError('Please enter a valid email address');
        return false;
      }

      if (formData.phone.length < 10) {
        setError('Please enter a valid phone number');
        return false;
      }
    }
    else if (step === 'personal') {
      if (!formData.address) {
        setError('Please enter your address');
        return false;
      }
    }
    else if (step === 'vehicle') {
      if (!formData.vehicleType || !formData.vehicleNumber || !formData.licenseNumber) {
        setError('Please fill in all vehicle details');
        return false;
      }
    }
    else if (step === 'documents') {
      if (!formData.bankName || !formData.accountNumber || !formData.accountName) {
        setError('Please fill in all payment details');
        return false;
      }
      if (formData.accountNumber.length !== 10) {
        setError('Account number must be 10 digits');
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (step === 'auth') setStep('personal');
    else if (step === 'personal') setStep('vehicle');
    else if (step === 'vehicle') setStep('documents');
    else if (step === 'documents') handleSubmit();
  };

  const handleBack = () => {
    if (step === 'auth') navigation.goBack();
    else if (step === 'personal') setStep('auth');
    else if (step === 'vehicle') setStep('personal');
    else if (step === 'documents') setStep('vehicle');
  };

  const uploadImage = async (uri: string, path: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop();
      const fileName = `${path}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('rider-documents')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('rider-documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Step 1: Create auth user with email/password
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Step 2: Upload images if provided
      let profilePhotoUrl = null;
      let licensePhotoUrl = null;
      let idCardUrl = null;

      if (formData.profilePhoto) {
        profilePhotoUrl = await uploadImage(
          formData.profilePhoto,
          `riders/${authData.user.id}/profile`
        );
      }

      if (formData.licensePhoto) {
        licensePhotoUrl = await uploadImage(
          formData.licensePhoto,
          `riders/${authData.user.id}/license`
        );
      }

      if (formData.idCard) {
        idCardUrl = await uploadImage(
          formData.idCard,
          `riders/${authData.user.id}/id-card`
        );
      }

      // Step 3: Create user profile in users table
      const { error: profileError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id,
          email: formData.email,
          name: formData.fullName,
          phone: formData.phone,
          role: 'rider',
          avatar_url: profilePhotoUrl,
          vehicle_type: formData.vehicleType.toLowerCase(),
          vehicle_number: formData.vehicleNumber,
          license_number: formData.licenseNumber,
          is_available: true,
          is_suspended: false,
          total_deliveries: 0,
          rating: 0,
          created_at: new Date().toISOString(),
        }]);

      if (profileError) throw profileError;

      // Step 4: Create rider application record
      const { error: applicationError } = await supabase
        .from('rider_applications')
        .insert([{
          user_id: authData.user.id,
          full_name: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          vehicle_type: formData.vehicleType.toLowerCase(),
          vehicle_number: formData.vehicleNumber,
          license_number: formData.licenseNumber,
          license_photo_url: licensePhotoUrl,
          id_card_url: idCardUrl,
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          account_name: formData.accountName,
          status: 'approved', // Auto-approve since admin is creating
          created_at: new Date().toISOString(),
        }]);

      if (applicationError) throw applicationError;

      // Success!
      Alert.alert(
        'Success',
        `Rider ${formData.fullName} created successfully!`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (err: any) {
      console.error('Creation error:', err);
      setError(err.message || 'Failed to create rider. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { key: 'auth', label: 'Account', icon: 'user' },
    { key: 'personal', label: 'Personal', icon: 'map-pin' },
    { key: 'vehicle', label: 'Vehicle', icon: 'truck' },
    { key: 'documents', label: 'Documents', icon: 'file-text' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Create Logistic Partner</Text>
          <Text style={styles.headerSubtitle}>
            Step {currentStepIndex + 1} of {steps.length}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {steps.map((s, index) => (
          <View
            key={s.key}
            style={[
              styles.progressStep,
              index <= currentStepIndex && styles.progressStepActive,
            ]}
          />
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Error Message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Step Content */}
        {step === 'auth' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Create Account</Text>
            <Text style={styles.stepDescription}>Set up the rider's account credentials</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="user" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.fullName}
                    onChangeText={(text) => updateField('fullName', text)}
                    placeholder="John Doe"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="phone" size={18} color="#666" style={styles.inputIcon} />
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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="mail" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(text) => updateField('email', text)}
                    placeholder="rider@example.com"
                    placeholderTextColor="#666"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.password}
                    onChangeText={(text) => updateField('password', text)}
                    placeholder="Create password"
                    placeholderTextColor="#666"
                    secureTextEntry
                  />
                </View>
                <Text style={styles.hint}>Must be at least 6 characters</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.confirmPassword}
                    onChangeText={(text) => updateField('confirmPassword', text)}
                    placeholder="Confirm password"
                    placeholderTextColor="#666"
                    secureTextEntry
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {step === 'personal' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepDescription}>Tell us more about the rider</Text>

            {/* Profile Photo Upload */}
            <TouchableOpacity 
              style={styles.photoUploadContainer}
              onPress={() => pickImage('profilePhoto')}
            >
              {formData.profilePhoto ? (
                <Image source={{ uri: formData.profilePhoto }} style={styles.photoPreview} />
              ) : (
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.photoPlaceholder}
                >
                  <Feather name="camera" size={30} color="#fff" />
                </LinearGradient>
              )}
              <View style={styles.photoUploadBadge}>
                <Feather name="upload" size={16} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Home Address *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="map-pin" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.address}
                    onChangeText={(text) => updateField('address', text)}
                    placeholder="Rider's address"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {step === 'vehicle' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Vehicle Information</Text>
            <Text style={styles.stepDescription}>What will the rider use for deliveries?</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Vehicle Type *</Text>
                <View style={styles.vehicleGrid}>
                  {vehicleTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.vehicleOption,
                        formData.vehicleType === type && styles.vehicleOptionActive,
                      ]}
                      onPress={() => updateField('vehicleType', type)}
                    >
                      <Feather 
                        name="truck" 
                        size={20} 
                        color={formData.vehicleType === type ? '#f97316' : '#666'} 
                      />
                      <Text style={[
                        styles.vehicleOptionText,
                        formData.vehicleType === type && styles.vehicleOptionTextActive,
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Vehicle Number *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="hash" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleNumber}
                    onChangeText={(text) => updateField('vehicleNumber', text)}
                    placeholder="e.g., LND 123 XK"
                    placeholderTextColor="#666"
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Driver's License Number *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="credit-card" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.licenseNumber}
                    onChangeText={(text) => updateField('licenseNumber', text)}
                    placeholder="License number"
                    placeholderTextColor="#666"
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* License Photo Upload */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>License Photo</Text>
                <TouchableOpacity 
                  style={styles.documentUpload}
                  onPress={() => pickImage('licensePhoto')}
                >
                  {formData.licensePhoto ? (
                    <View style={styles.documentPreview}>
                      <Image source={{ uri: formData.licensePhoto }} style={styles.documentImage} />
                      <View style={styles.documentOverlay}>
                        <Feather name="check-circle" size={24} color="#10b981" />
                        <Text style={styles.documentUploadedText}>License uploaded</Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Feather name="upload-cloud" size={32} color="#666" />
                      <Text style={styles.documentUploadText}>Tap to upload license photo</Text>
                      <Text style={styles.documentUploadHint}>JPG, PNG up to 5MB</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* ID Card Upload */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>ID Card</Text>
                <TouchableOpacity 
                  style={styles.documentUpload}
                  onPress={() => pickImage('idCard')}
                >
                  {formData.idCard ? (
                    <View style={styles.documentPreview}>
                      <Image source={{ uri: formData.idCard }} style={styles.documentImage} />
                      <View style={styles.documentOverlay}>
                        <Feather name="check-circle" size={24} color="#10b981" />
                        <Text style={styles.documentUploadedText}>ID uploaded</Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Feather name="upload-cloud" size={32} color="#666" />
                      <Text style={styles.documentUploadText}>Tap to upload ID card</Text>
                      <Text style={styles.documentUploadHint}>National ID, Voter's Card, or Passport</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {step === 'documents' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Payment Details</Text>
            <Text style={styles.stepDescription}>Where the rider will receive earnings</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bank Name *</Text>
                <View style={styles.pickerContainer}>
                  <Feather name="credit-card" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.bankName}
                    onChangeText={(text) => updateField('bankName', text)}
                    placeholder="Select or type bank name"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Number *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="hash" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.accountNumber}
                    onChangeText={(text) => updateField('accountNumber', text)}
                    placeholder="10-digit account number"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Name *</Text>
                <View style={styles.inputContainer}>
                  <Feather name="user" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.accountName}
                    onChangeText={(text) => updateField('accountName', text)}
                    placeholder="Name on account"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Info Box */}
              <LinearGradient
                colors={['rgba(249,115,22,0.1)', 'rgba(244,63,94,0.1)']}
                style={styles.infoBox}
              >
                <Feather name="info" size={20} color="#f97316" />
                <Text style={styles.infoText}>
                  The rider will be created and ready to start accepting deliveries immediately.
                  They'll receive login credentials via email.
                </Text>
              </LinearGradient>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleNext}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>
                {step === 'documents' ? 'Create Rider' : 'Continue'}
              </Text>
              <Feather name="arrow-right" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  progressStep: {
    flex: 1,
    height: 3,
    backgroundColor: '#1a1a1a',
    borderRadius: 1.5,
  },
  progressStepActive: {
    backgroundColor: '#f97316',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stepContainer: {
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 13,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 50,
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    height: '100%',
  },
  hint: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  photoUploadContainer: {
    alignSelf: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#f97316',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f97316',
  },
  photoUploadBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vehicleOptionActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  vehicleOptionText: {
    fontSize: 12,
    color: '#666',
  },
  vehicleOptionTextActive: {
    color: '#f97316',
  },
  documentUpload: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  documentPreview: {
    width: '100%',
    position: 'relative',
  },
  documentImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  documentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  documentUploadedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  documentUploadText: {
    fontSize: 14,
    color: '#666',
  },
  documentUploadHint: {
    fontSize: 11,
    color: '#666',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 50,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  continueButton: {
    backgroundColor: '#f97316',
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});