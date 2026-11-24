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
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import Toast from 'react-native-toast-message';
import { TAB_BAR_SPACE } from '../../navigation/tabBarOptions';
import { TC } from '../../theme/palette';
import { AppearanceSetting } from '../../components/AppearanceSetting';

interface PlatformSettings {
  id: number;
  platform_fee_percentage: string;
  delivery_fee_per_km: number;
  min_delivery_fee: number;
  max_delivery_fee: number;
  weight_rate_per_kg: number;
  promotion_cost_per_day: number;
  // NEW: Rider percentage settings
  company_vehicle_rider_percentage: number;
  personal_vehicle_rider_percentage: number;
  pro_monthly_price?: number;
  pro_yearly_price?: number;
  free_recommendation_limit?: number;
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
  const [promotionCostPerDay, setPromotionCostPerDay] = useState('');
  // NEW: Rider percentage state
  const [companyVehicleRiderPercent, setCompanyVehicleRiderPercent] = useState('');
  const [personalVehicleRiderPercent, setPersonalVehicleRiderPercent] = useState('');
  // Vesphe Pro (customer subscription)
  const [proMonthlyPrice, setProMonthlyPrice] = useState('');
  const [proYearlyPrice, setProYearlyPrice] = useState('');
  const [freeRecommendationLimit, setFreeRecommendationLimit] = useState('');

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
      setWeightRatePerKg(data.weight_rate_per_kg?.toString() || '100');
      setPromotionCostPerDay(data.promotion_cost_per_day?.toString() || '300');
      // NEW: Set rider percentage values
      setCompanyVehicleRiderPercent(data.company_vehicle_rider_percentage?.toString() || '50');
      setPersonalVehicleRiderPercent(data.personal_vehicle_rider_percentage?.toString() || '80');
      setProMonthlyPrice(data.pro_monthly_price?.toString() || '1500');
      setProYearlyPrice(data.pro_yearly_price?.toString() || '15000');
      setFreeRecommendationLimit(data.free_recommendation_limit?.toString() || '3');
      
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

    // Promotion cost per day
    const promotionCost = parseFloat(promotionCostPerDay);
    if (isNaN(promotionCost) || promotionCost < 100) {
      showToast('Promotion cost per day must be at least ₦100', 'error');
      return false;
    }

    // NEW: Rider percentage validation
    const companyPercent = parseFloat(companyVehicleRiderPercent);
    if (isNaN(companyPercent) || companyPercent < 0 || companyPercent > 100) {
      showToast('Company vehicle rider percentage must be between 0 and 100', 'error');
      return false;
    }

    const personalPercent = parseFloat(personalVehicleRiderPercent);
    if (isNaN(personalPercent) || personalPercent < 0 || personalPercent > 100) {
      showToast('Personal vehicle rider percentage must be between 0 and 100', 'error');
      return false;
    }

    const monthly = parseInt(proMonthlyPrice);
    const yearly = parseInt(proYearlyPrice);
    if (isNaN(monthly) || monthly < 100 || isNaN(yearly) || yearly < 100) {
      showToast('Pro prices must be at least ₦100', 'error');
      return false;
    }
    const freeLimit = parseInt(freeRecommendationLimit);
    if (isNaN(freeLimit) || freeLimit < 0 || freeLimit > 20) {
      showToast('Free recommendations must be between 0 and 20', 'error');
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
          promotion_cost_per_day: parseInt(promotionCostPerDay),
          // NEW: Save rider percentages
          company_vehicle_rider_percentage: parseFloat(companyVehicleRiderPercent),
          personal_vehicle_rider_percentage: parseFloat(personalVehicleRiderPercent),
          pro_monthly_price: parseInt(proMonthlyPrice),
          pro_yearly_price: parseInt(proYearlyPrice),
          free_recommendation_limit: parseInt(freeRecommendationLimit),
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
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
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
  const examplePromotionDays = 7; // 7 days
  const exampleDeliveryFee = 1500; // Example delivery fee for rider calculation

  const calculatedDeliveryFee = (parseInt(deliveryFeePerKm || '0') * exampleDistance) + 
                                (parseInt(weightRatePerKg || '0') * exampleWeight);
  const calculatedPlatformFee = exampleOrderAmount * (parseFloat(platformFee || '0') / 100);
  const totalCustomerPay = exampleOrderAmount + calculatedDeliveryFee;
  
  // Promotion cost calculation
  const promotionCostPerDayNum = parseInt(promotionCostPerDay || '0');
  const totalPromotionCost = promotionCostPerDayNum * examplePromotionDays;

  // NEW: Rider earnings example
  const companyRiderEarnings = exampleDeliveryFee * (parseFloat(companyVehicleRiderPercent || '50') / 100);
  const personalRiderEarnings = exampleDeliveryFee * (parseFloat(personalVehicleRiderPercent || '80') / 100);
  const companyPlatformEarnings = exampleDeliveryFee - companyRiderEarnings;
  const personalPlatformEarnings = exampleDeliveryFee - personalRiderEarnings;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#ea580c' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Platform settings</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Feather name="info" size={20} color="#f97316" />
            <Text style={styles.infoText}>
              These settings affect all deliveries and platform transactions. Changes take effect immediately.
            </Text>
          </View>

          <TouchableOpacity 
                   style={styles.menuCard}
                   onPress={() => navigation.navigate('AdminAnnouncements' as never)}
                 >
                   <View style={[styles.menuIcon, { backgroundColor: '#8b5cf6' }]}>
                     <Feather name="mic" size={24} color="#fff" />
                   </View>
                   <View style={styles.menuInfo}>
                     <Text style={styles.menuTitle}>Create announcement</Text>
                     <Text style={styles.menuDescription}>
Send Announcements to all users or targeted users                     </Text>
                   </View>
                   <Feather name="chevron-right" size={20} color={TC.muted} />
                 </TouchableOpacity>

          {/* Platform Fee Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="percent" size={20} color="#f97316" />
              <Text style={styles.sectionTitle}>Platform fee</Text>
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
                  placeholderTextColor={TC.muted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.inputSuffix}>%</Text>
              </View>
              <Text style={styles.hint}>
                Current: {settings?.platform_fee_percentage}% • Range: 0-100%
              </Text>
            </View>
          </View>

          {/* NEW: Rider Earnings Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="user" size={20} color="#f97316" />
              <Feather name="truck" size={20} color="#f97316" />
              <Text style={styles.sectionTitle}>Rider earnings</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Percentage of delivery fee that riders earn based on vehicle ownership
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company Vehicle Rider (%)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={companyVehicleRiderPercent}
                  onChangeText={(text) => setCompanyVehicleRiderPercent(formatCurrency(text))}
                  placeholder="50"
                  placeholderTextColor={TC.muted}
                  keyboardType="number-pad"
                />
                <Text style={styles.inputSuffix}>%</Text>
              </View>
              <Text style={styles.hint}>
                Current: {settings?.company_vehicle_rider_percentage || 50}% • Rider gets this % of delivery fee
              </Text>
              <View style={styles.exampleRowSmall}>
                <Text style={styles.exampleLabelSmall}>Example (₦{exampleDeliveryFee.toLocaleString()} fee):</Text>
                <Text style={styles.exampleValueSmall}>Rider earns ₦{companyRiderEarnings.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Personal Vehicle Rider (%)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={personalVehicleRiderPercent}
                  onChangeText={(text) => setPersonalVehicleRiderPercent(formatCurrency(text))}
                  placeholder="80"
                  placeholderTextColor={TC.muted}
                  keyboardType="number-pad"
                />
                <Text style={styles.inputSuffix}>%</Text>
              </View>
              <Text style={styles.hint}>
                Current: {settings?.personal_vehicle_rider_percentage || 80}% • Rider gets this % of delivery fee
              </Text>
              <View style={styles.exampleRowSmall}>
                <Text style={styles.exampleLabelSmall}>Example (₦{exampleDeliveryFee.toLocaleString()} fee):</Text>
                <Text style={styles.exampleValueSmall}>Rider earns ₦{personalRiderEarnings.toLocaleString()}</Text>
              </View>
            </View>

            {/* Rider Earnings Example Card */}
            <View style={styles.riderExampleCard}>
              <Text style={styles.exampleTitle}>Rider earnings breakdown</Text>
              <Text style={styles.exampleSubtitle}>For a ₦{exampleDeliveryFee.toLocaleString()} delivery fee</Text>
              
              <View style={styles.exampleDivider} />
              
              <Text style={styles.riderTypeTitle}>Company vehicle</Text>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Rider ({companyVehicleRiderPercent || 50}%):</Text>
                <Text style={styles.exampleValue}>₦{companyRiderEarnings.toLocaleString()}</Text>
              </View>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Platform ({100 - parseFloat(companyVehicleRiderPercent || '50')}%):</Text>
                <Text style={styles.exampleValue}>₦{companyPlatformEarnings.toLocaleString()}</Text>
              </View>
              
              <View style={styles.exampleDivider} />
              
              <Text style={styles.riderTypeTitle}>Personal vehicle</Text>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Rider ({personalVehicleRiderPercent || 80}%):</Text>
                <Text style={styles.exampleValue}>₦{personalRiderEarnings.toLocaleString()}</Text>
              </View>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Platform ({100 - parseFloat(personalVehicleRiderPercent || '80')}%):</Text>
                <Text style={styles.exampleValue}>₦{personalPlatformEarnings.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Delivery Fee Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="truck" size={20} color="#f97316" />
              <Text style={styles.sectionTitle}>Delivery fees</Text>
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
                  placeholderTextColor={TC.muted}
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
                  placeholderTextColor={TC.muted}
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
                    placeholderTextColor={TC.muted}
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
                    placeholderTextColor={TC.muted}
                    keyboardType="number-pad"
                  />
                </View>
                <Text style={styles.hint}>
                  Max: ₦{settings?.max_delivery_fee?.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Promotion Settings Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="phone" size={20} color="#f97316" />
              <Text style={styles.sectionTitle}>Promotion settings</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Cost for vendors to run promotions on the home screen banner slider
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cost per Day (₦)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>₦</Text>
                <TextInput
                  style={[styles.input, styles.inputWithPrefix]}
                  value={promotionCostPerDay}
                  onChangeText={(text) => setPromotionCostPerDay(formatCurrency(text))}
                  placeholder="300"
                  placeholderTextColor={TC.muted}
                  keyboardType="number-pad"
                />
              </View>
              <Text style={styles.hint}>
                Current: ₦{settings?.promotion_cost_per_day?.toLocaleString()}/day
              </Text>
            </View>

            {/* Promotion Cost Example */}
            <View style={styles.exampleCard}>
              <Text style={styles.exampleTitle}>Promotion cost example</Text>
              <Text style={styles.exampleSubtitle}>7-day promotion campaign</Text>
              
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Days:</Text>
                <Text style={styles.exampleValue}>{examplePromotionDays} days</Text>
              </View>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Cost per day:</Text>
                <Text style={styles.exampleValue}>₦{promotionCostPerDayNum.toLocaleString()}</Text>
              </View>
              <View style={styles.exampleDivider} />
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabelTotal}>Total Promotion Cost:</Text>
                <Text style={styles.exampleValueTotal}>₦{totalPromotionCost.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Vesphe Pro Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="award" size={20} color="#f97316" />
              <Text style={styles.sectionTitle}>Vesphe Pro</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Customer subscription: unlimited personalised recommendations and the weekly meal timetable. New prices apply to the next purchase.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monthly price (₦)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>₦</Text>
                <TextInput
                  style={[styles.input, styles.inputWithPrefix]}
                  value={proMonthlyPrice}
                  onChangeText={(text) => setProMonthlyPrice(formatCurrency(text))}
                  placeholder="1500"
                  placeholderTextColor={TC.muted}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Yearly price (₦)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>₦</Text>
                <TextInput
                  style={[styles.input, styles.inputWithPrefix]}
                  value={proYearlyPrice}
                  onChangeText={(text) => setProYearlyPrice(formatCurrency(text))}
                  placeholder="15000"
                  placeholderTextColor={TC.muted}
                  keyboardType="number-pad"
                />
              </View>
              {!!proMonthlyPrice && !!proYearlyPrice && parseInt(proYearlyPrice) < parseInt(proMonthlyPrice) * 12 && (
                <Text style={styles.hint}>
                  Customers save {Math.round((1 - parseInt(proYearlyPrice) / (parseInt(proMonthlyPrice) * 12)) * 100)}% with yearly
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Free recommendations shown</Text>
              <TextInput
                style={styles.input}
                value={freeRecommendationLimit}
                onChangeText={(text) => setFreeRecommendationLimit(formatCurrency(text))}
                placeholder="3"
                placeholderTextColor={TC.muted}
                keyboardType="number-pad"
              />
              <Text style={styles.hint}>How many personalised picks free customers see per meal time</Text>
            </View>
          </View>

          {/* Example Calculation Card */}
          <View style={[styles.exampleCard, { backgroundColor: TC.surface }]}>
            <Text style={styles.exampleTitle}>Fee calculation example</Text>
            <Text style={styles.exampleSubtitle}>Order: ₦10,000 | Distance: 5km | Weight: 2kg</Text>
            
            <View style={styles.exampleRow}>
              <Text style={styles.exampleLabel}>Order Amount:</Text>
              <Text style={styles.exampleValue}>₦{exampleOrderAmount.toLocaleString()}</Text>
            </View>
            <View style={styles.exampleRow}>
              <Text style={styles.exampleLabel}>Delivery Fee:</Text>
              <Text style={styles.exampleValue}>₦{calculatedDeliveryFee.toLocaleString()}</Text>
            </View>
            <View style={styles.exampleRow}>
              <Text style={styles.exampleLabel}>Platform Fee ({platformFee}%):</Text>
              <Text style={styles.exampleValue}>₦{calculatedPlatformFee.toLocaleString()}</Text>
            </View>
            <View style={styles.exampleDivider} />
            <View style={styles.exampleRow}>
              <Text style={styles.exampleLabelTotal}>Customer Pays:</Text>
              <Text style={styles.exampleValueTotal}>₦{totalCustomerPay.toLocaleString()}</Text>
            </View>
          </View>

          <AppearanceSetting style={{ marginHorizontal: 16, marginBottom: 16 }} />

          {/* Sign Out Button */}
          <TouchableOpacity 
            style={styles.signOutFooter}
            onPress={handleSignOut}
          >
            <Feather name="log-out" size={20} color="#ef4444" />
            <Text style={styles.signOutFooterText}>Sign out</Text>
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
    backgroundColor: TC.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: TC.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: TC.muted,
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
    color: TC.text,
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
    color: TC.text,
    lineHeight: 18,
  },
   menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TC.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TC.hairline,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TC.text,
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 12,
    color: TC.muted,
    marginBottom: 8,
  },
  section: {
    backgroundColor: TC.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TC.hairline,
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
    color: TC.text,
  },
  sectionDescription: {
    fontSize: 12,
    color: TC.muted,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: TC.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TC.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TC.hairline,
    height: 50,
  },
  input: {
    flex: 1,
    color: TC.text,
    fontSize: 15,
    paddingHorizontal: 12,
    height: '100%',
  },
  inputWithPrefix: {
    paddingLeft: 8,
  },
  inputPrefix: {
    color: TC.muted,
    fontSize: 15,
    paddingLeft: 12,
  },
  inputSuffix: {
    color: TC.muted,
    fontSize: 15,
    paddingRight: 12,
  },
  hint: {
    fontSize: 11,
    color: TC.muted,
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
    backgroundColor: TC.surface,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TC.text,
    marginBottom: 2,
  },
  exampleSubtitle: {
    fontSize: 11,
    color: TC.muted,
    marginBottom: 12,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  exampleLabel: {
    fontSize: 12,
    color: TC.muted,
  },
  exampleValue: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '500',
  },
  exampleDivider: {
    height: 1,
    backgroundColor: TC.hairline,
    marginVertical: 8,
  },
  exampleLabelTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: TC.text,
  },
  exampleValueTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  // NEW: Rider example styles
  riderExampleCard: {
    backgroundColor: TC.bg,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  riderTypeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TC.text,
    marginBottom: 6,
  },
  exampleRowSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  exampleLabelSmall: {
    fontSize: 10,
    color: TC.muted,
  },
  exampleValueSmall: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  footerText: {
    fontSize: 10,
    color: TC.muted,
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