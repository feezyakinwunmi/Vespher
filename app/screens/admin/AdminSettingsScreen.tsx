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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';

interface PlatformSettings {
  id: number;
  platform_fee_percentage: string;
  delivery_fee_per_km: number;
  min_delivery_fee: number;
  max_delivery_fee: number;
  weight_rate_per_kg: number;
  updated_at: string;
  updated_by: string | null;
}

export function AdminSettingsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type: type,
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  
  // Form state
  const [platformFee, setPlatformFee] = useState('');
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState('');
  const [minDeliveryFee, setMinDeliveryFee] = useState('');
  const [maxDeliveryFee, setMaxDeliveryFee] = useState('');
  const [weightRatePerKg, setWeightRatePerKg] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('id', { ascending: true })
        .limit(1)
        .single();

      if (error) throw error;

      setSettings(data);
      
      // Populate form
      setPlatformFee(data.platform_fee_percentage);
      setDeliveryFeePerKm(data.delivery_fee_per_km.toString());
      setMinDeliveryFee(data.min_delivery_fee.toString());
      setMaxDeliveryFee(data.max_delivery_fee.toString());
      setWeightRatePerKg(data.weight_rate_per_kg?.toString());
      
    } catch (error) {
      console.error('Error fetching settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateInputs = (): boolean => {
    // Platform fee validation
    const fee = parseFloat(platformFee);
    if (isNaN(fee) || fee < 0 || fee > 100) {
      showToast('Platform fee must be between 0 and 100 percent', 'error');
      return false;
    }

    // Delivery fee per km
    const perKm = parseFloat(deliveryFeePerKm);
    if (isNaN(perKm) || perKm < 10) {
      showToast('Delivery fee per km must be at least ₦10', 'error');
      return false;
    }

    // Min delivery fee
    const min = parseFloat(minDeliveryFee);
    if (isNaN(min) || min < 100) {
      showToast('Minimum delivery fee must be at least ₦100', 'error');
      return false;
    }

    // Max delivery fee
    const max = parseFloat(maxDeliveryFee);
    if (isNaN(max) || max <= min) {
      showToast('Maximum delivery fee must be greater than minimum fee', 'error');
      return false;
    }

    // Weight rate per kg
    const weightRate = parseFloat(weightRatePerKg);
    if (isNaN(weightRate) || weightRate < 1) {
      showToast('Weight rate per kg must be at least ₦1', 'error');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;

    setSaving(true);
    try {
      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        showToast('Not authenticated', 'error');
        return;
      }

      const { error } = await supabase
        .from('platform_settings')
        .update({
          platform_fee_percentage: parseFloat(platformFee).toFixed(2),
          delivery_fee_per_km: parseInt(deliveryFeePerKm),
          min_delivery_fee: parseInt(minDeliveryFee),
          max_delivery_fee: parseInt(maxDeliveryFee),
          weight_rate_per_kg: parseInt(weightRatePerKg),
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings?.id);

      if (error) throw error;

      showToast('Settings updated successfully', 'success');
      fetchSettings(); // Refresh data
      
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: string) => {
    // Remove non-numeric characters
    const numeric = value.replace(/[^0-9]/g, '');
    return numeric;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Navigation will be handled by your auth state change
            } catch (error) {
              console.error('Error signing out:', error);
              showToast('Failed to sign out', 'error');
            }
          },
        },
      ]
    );
  };

  // Calculate example values for preview
  const exampleDistance = 5; // 5km
  const exampleWeight = 2; // 2kg
  const exampleOrderAmount = 10000; // ₦10,000

  const calculatedDeliveryFee = (parseInt(deliveryFeePerKm || '0') * exampleDistance) + 
                                (parseInt(weightRatePerKg || '0') * exampleWeight);
  const calculatedPlatformFee = exampleOrderAmount * (parseFloat(platformFee || '0') / 100);
  const totalCustomerPay = exampleOrderAmount + calculatedDeliveryFee;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#f97316', '#f43f5e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Platform Settings</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Feather name="info" size={20} color="#f97316" />
            <Text style={styles.infoText}>
              These settings affect all deliveries and platform transactions. Changes take effect immediately.
            </Text>
          </View>

          {/* Platform Fee Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="percent" size={20} color="#f97316" />
              <Text style={styles.sectionTitle}>Platform Fee</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Percentage charged on each order total
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Platform Fee (%)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={platformFee}
                  onChangeText={setPlatformFee}
                  placeholder="10.00"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.inputSuffix}>%</Text>
              </View>
              <Text style={styles.hint}>
                Current: {settings?.platform_fee_percentage}% • Range: 0-100%
              </Text>
            </View>
          </View>

          {/* Delivery Fee Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="truck" size={20} color="#f97316" />
              <Text style={styles.sectionTitle}>Delivery Fees</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Base delivery charges calculated by distance and weight
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fee per Kilometer (₦)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>₦</Text>
                <TextInput
                  style={[styles.input, styles.inputWithPrefix]}
                  value={deliveryFeePerKm}
                  onChangeText={(text) => setDeliveryFeePerKm(formatCurrency(text))}
                  placeholder="300"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              </View>
              <Text style={styles.hint}>
                Current: ₦{settings?.delivery_fee_per_km?.toLocaleString()}/km
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Weight Rate per Kilogram (₦)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>₦</Text>
                <TextInput
                  style={[styles.input, styles.inputWithPrefix]}
                  value={weightRatePerKg}
                  onChangeText={(text) => setWeightRatePerKg(formatCurrency(text))}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              </View>
              <Text style={styles.hint}>
                Current: ₦{settings?.weight_rate_per_kg?.toLocaleString()}/kg • Additional fee per kg
              </Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Minimum Fee (₦)</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputPrefix}>₦</Text>
                  <TextInput
                    style={[styles.input, styles.inputWithPrefix]}
                    value={minDeliveryFee}
                    onChangeText={(text) => setMinDeliveryFee(formatCurrency(text))}
                    placeholder="500"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                  />
                </View>
                <Text style={styles.hint}>
                  Min: ₦{settings?.min_delivery_fee?.toLocaleString()}
                </Text>
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Maximum Fee (₦)</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputPrefix}>₦</Text>
                  <TextInput
                    style={[styles.input, styles.inputWithPrefix]}
                    value={maxDeliveryFee}
                    onChangeText={(text) => setMaxDeliveryFee(formatCurrency(text))}
                    placeholder="5000"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                  />
                </View>
                <Text style={styles.hint}>
                  Max: ₦{settings?.max_delivery_fee?.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

        

          {/* Sign Out Button */}
          <TouchableOpacity 
            style={styles.signOutFooter}
            onPress={handleSignOut}
          >
            <Feather name="log-out" size={20} color="#ef4444" />
            <Text style={styles.signOutFooterText}>Sign Out</Text>
          </TouchableOpacity>

          {/* Last Updated Info */}
          {settings?.updated_at && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Last updated: {new Date(settings.updated_at).toLocaleString()}
              </Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(249,115,22,0.1)',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  section: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sectionDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 50,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingHorizontal: 12,
    height: '100%',
  },
  inputWithPrefix: {
    paddingLeft: 8,
  },
  inputPrefix: {
    color: '#666',
    fontSize: 15,
    paddingLeft: 12,
  },
  inputSuffix: {
    color: '#666',
    fontSize: 15,
    paddingRight: 12,
  },
  hint: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  exampleCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  exampleSubtitle: {
    fontSize: 11,
    color: '#666',
    marginBottom: 12,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  exampleLabel: {
    fontSize: 12,
    color: '#666',
  },
  exampleValue: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '500',
  },
  exampleDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 8,
  },
  exampleLabelTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  exampleValueTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  footerText: {
    fontSize: 10,
    color: '#666',
  },
  bottomPadding: {
    height: 20,
  },
  signOutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 20,
    padding: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  signOutFooterText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});