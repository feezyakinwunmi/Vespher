// app/components/vendor/PromoCodeManager.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import * as Clipboard from 'expo-clipboard';

interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number;
  usage_limit: number | null;
  usage_per_user: number;
  applies_to: 'all' | 'vendor_only';
  end_date: string | null;
  is_active: boolean;
  times_used?: number;
}

export function PromoCodeManager() {
  const { user } = useAuth();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    usage_limit_type: 'unlimited' as 'unlimited' | 'limited' | 'lucky',
    usage_limit_value: '',
    usage_per_user: '1',
    applies_to: 'vendor_only' as 'all' | 'vendor_only',
    end_date: '',
  });

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    const initialize = async () => {
      await checkUserRole();
      await fetchVendorId();
    };
    
    initialize();
  }, [user]);

  useEffect(() => {
    if (vendorId !== null) {
      fetchPromoCodes();
    }
  }, [vendorId, isAdmin]);

  const checkUserRole = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user?.id)
        .single();
      
      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const fetchVendorId = async () => {
    if (isAdmin) {
      setVendorId('platform');
      return;
    }

    try {
      const { data } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user?.id)
        .maybeSingle();
      
      setVendorId(data?.id || null);
    } catch (error) {
      console.error('Error fetching vendor ID:', error);
      setVendorId(null);
    }
  };

  const fetchPromoCodes = async () => {
    if (!vendorId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      let query = supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get usage counts
      const codesWithUsage = await Promise.all(
        (data || []).map(async (code) => {
          const { count } = await supabase
            .from('promo_code_usage')
            .select('*', { count: 'exact', head: true })
            .eq('promo_code_id', code.id);
          
          return { ...code, times_used: count || 0 };
        })
      );

      setPromoCodes(codesWithUsage);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      Alert.alert('Error', 'Failed to load promo codes');
    } finally {
      setIsLoading(false);
    }
  };

  const generateCode = () => {
    const prefixes = {
      percentage: ['SAVE', 'DISCOUNT', 'SPECIAL', 'DEAL', 'OFFER'],
      fixed: ['CASH', 'MONEY', 'SAVE', 'BONUS']
    };
    const prefixList = prefixes[formData.discount_type];
    const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData({ ...formData, code: `${prefix}${random}` });
  };

  const copyToClipboard = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Success', 'Code copied to clipboard');
  };

  const getSampleDescription = () => {
    if (formData.discount_type === 'percentage') {
      return `🎉 Special Offer! Get ${formData.discount_value || '20'}% OFF on all orders above ₦${parseInt(formData.min_order_amount || '0').toLocaleString()}. Don't miss out on this amazing deal! Valid for a limited time only. Share with friends and family.`;
    } else {
      return `💰 Limited Time Offer! Save ₦${parseInt(formData.discount_value || '1000').toLocaleString()} on your next order when you spend ₦${parseInt(formData.min_order_amount || '5000').toLocaleString()} or more. Perfect for family meals and group orders!`;
    }
  };

  const applySample = () => {
    const discountVal = formData.discount_type === 'percentage' ? '20' : '2000';
    const minAmount = formData.discount_type === 'percentage' ? '5000' : '15000';
    
    setFormData({
      ...formData,
      description: getSampleDescription(),
      discount_value: formData.discount_value || discountVal,
      min_order_amount: formData.min_order_amount || minAmount,
    });
    setShowSampleModal(false);
    Alert.alert('Sample Applied', 'Sample description and values have been added. You can edit them before creating.');
  };

  const handleSubmit = async () => {
    if (!vendorId && !isAdmin) {
      Alert.alert('Error', 'Vendor information missing');
      return;
    }

    try {
      if (!formData.code) {
        Alert.alert('Error', 'Please enter a promo code');
        return;
      }

      if (!formData.discount_value || parseInt(formData.discount_value) <= 0) {
        Alert.alert('Error', 'Please enter a valid discount value');
        return;
      }

      let usageLimit = null;
      if (formData.usage_limit_type === 'limited' || formData.usage_limit_type === 'lucky') {
        usageLimit = parseInt(formData.usage_limit_value);
        if (isNaN(usageLimit) || usageLimit < 1) {
          Alert.alert('Error', 'Please enter a valid usage limit');
          return;
        }
      }

      const promoData: any = {
        code: formData.code.toUpperCase(),
        description: formData.description,
        discount_type: formData.discount_type,
        discount_value: parseInt(formData.discount_value),
        min_order_amount: parseInt(formData.min_order_amount) || 0,
        max_discount_amount: parseInt(formData.max_discount_amount) || null,
        usage_limit: usageLimit,
        usage_per_user: parseInt(formData.usage_per_user) || 1,
        applies_to: formData.applies_to,
        end_date: formData.end_date || null,
        is_active: true,
      };

      if (formData.applies_to === 'vendor_only') {
        if (isAdmin) {
          if (!vendorId) {
            Alert.alert('Error', 'Please select a vendor');
            return;
          }
          promoData.vendor_id = vendorId;
        } else {
          promoData.vendor_id = vendorId;
        }
      } else {
        promoData.vendor_id = null;
      }

      if (editingCode) {
        const { error } = await supabase
          .from('promo_codes')
          .update(promoData)
          .eq('id', editingCode.id);

        if (error) throw error;
        Alert.alert('Success', 'Promo code updated');
      } else {
        const { error } = await supabase
          .from('promo_codes')
          .insert([promoData]);

        if (error) throw error;
        Alert.alert('Success', 'Promo code created! Customers will be notified immediately.');
      }

      setShowForm(false);
      setEditingCode(null);
      fetchPromoCodes();
    } catch (error) {
      console.error('Error saving promo code:', error);
      Alert.alert('Error', 'Failed to save promo code');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Promo Code',
      'Are you sure you want to delete this promo code?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('promo_codes')
                .delete()
                .eq('id', id);

              if (error) throw error;
              Alert.alert('Success', 'Promo code deleted');
              fetchPromoCodes();
            } catch (error) {
              console.error('Error deleting promo code:', error);
              Alert.alert('Error', 'Failed to delete promo code');
            }
          },
        },
      ]
    );
  };

  const toggleActive = async (code: PromoCode) => {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !code.is_active })
        .eq('id', code.id);

      if (error) throw error;
      fetchPromoCodes();
    } catch (error) {
      console.error('Error toggling promo code:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Promo Codes</Text>
          <Text style={styles.subtitle}>
            {isAdmin ? 'Manage platform-wide promo codes' : 'Create promotions for your customers'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => setShowHelpModal(true)}
            style={styles.helpButton}
          >
            <Feather name="help-circle" size={22} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setEditingCode(null);
              setFormData({
                code: '',
                description: '',
                discount_type: 'percentage',
                discount_value: '',
                min_order_amount: '',
                max_discount_amount: '',
                usage_limit_type: 'unlimited',
                usage_limit_value: '',
                usage_per_user: '1',
                applies_to: 'vendor_only',
                end_date: '',
              });
              setShowForm(true);
            }}
            style={styles.createButton}
          >
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              style={styles.createButtonGradient}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.createButtonText}>Create Promo Code</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Feather name="tag" size={20} color="#f97316" />
          <Text style={styles.statNumber}>{promoCodes.length}</Text>
          <Text style={styles.statLabel}>Total Codes</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="trending-up" size={20} color="#10b981" />
          <Text style={styles.statNumber}>
            {promoCodes.reduce((sum, c) => sum + (c.times_used || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Total Uses</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="clock" size={20} color="#f59e0b" />
          <Text style={styles.statNumber}>
            {promoCodes.filter(c => c.is_active).length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
      </View>

      {/* Promo Codes List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {promoCodes.length > 0 ? (
          promoCodes.map((code) => (
            <View key={code.id} style={styles.codeCard}>
            <View style={styles.codeHeader}>
  <View style={styles.codeInfo}>
    <View style={styles.codeTitleRow}>
      <Text style={styles.codeText}>{code.code}</Text>
      <TouchableOpacity
        onPress={() => copyToClipboard(code.code)}
        style={styles.copyButton}
      >
        <Feather name="copy" size={14} color="#666" />
      </TouchableOpacity>
    </View>
    <View style={styles.badgeRow}>
      <View style={[
        styles.badge,
        code.applies_to === 'all' ? styles.platformBadge : styles.vendorBadge
      ]}>
        <Text style={styles.badgeText}>
          {code.applies_to === 'all' ? '🌍 Platform Wide' : '🏪 Store Only'}
        </Text>
      </View>
      <View style={[
        styles.badge,
        code.is_active ? styles.activeBadge : styles.inactiveBadge
      ]}>
        <Text style={styles.badgeText}>
          {code.is_active ? '✅ Active' : '⏸ Inactive'}
        </Text>
      </View>
    </View>
    {code.description ? (
      <Text style={styles.codeDescription} numberOfLines={2}>
        {code.description}
      </Text>
    ) : null}
  </View>
  
  <View style={styles.actionButtons}>
    <TouchableOpacity
      onPress={() => toggleActive(code)}
      style={styles.actionButton}
    >
      <Feather 
        name={code.is_active ? 'pause-circle' : 'play-circle'} 
        size={20} 
        color={code.is_active ? '#f59e0b' : '#10b981'} 
      />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => {
        setEditingCode(code);
        setFormData({
          code: code.code,
          description: code.description || '',
          discount_type: code.discount_type,
          discount_value: code.discount_value.toString(),
          min_order_amount: code.min_order_amount.toString(),
          max_discount_amount: code.max_discount_amount?.toString() || '',
          usage_limit_type: code.usage_limit === null ? 'unlimited' : 'limited',
          usage_limit_value: code.usage_limit?.toString() || '',
          usage_per_user: code.usage_per_user.toString(),
          applies_to: code.applies_to,
          end_date: code.end_date ? new Date(code.end_date).toISOString().slice(0, 16) : '',
        });
        setShowForm(true);
      }}
      style={styles.actionButton}
    >
      <Feather name="edit-2" size={18} color="#666" />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => handleDelete(code.id)}
      style={styles.actionButton}
    >
      <Feather name="trash-2" size={18} color="#ef4444" />
    </TouchableOpacity>
  </View>
</View>

              <View style={styles.codeStats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Discount</Text>
                  <Text style={styles.statValue}>
                    {code.discount_type === 'percentage' 
                      ? `${code.discount_value}%` 
                      : `₦${code.discount_value.toLocaleString()}`}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Min Order</Text>
                  <Text style={styles.statValue}>₦{code.min_order_amount.toLocaleString()}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Used</Text>
                  <Text style={styles.statValue}>
                    {code.times_used}
                    {code.usage_limit ? `/${code.usage_limit}` : ' ∞'}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Ends</Text>
                  <Text style={styles.statValue}>
                    {code.end_date ? new Date(code.end_date).toLocaleDateString() : 'Never'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="tag" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No promo codes yet</Text>
            <Text style={styles.emptyText}>
              Create your first promo code to start offering discounts to customers
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEditingCode(null);
                setFormData({
                  code: '',
                  description: '',
                  discount_type: 'percentage',
                  discount_value: '',
                  min_order_amount: '',
                  max_discount_amount: '',
                  usage_limit_type: 'unlimited',
                  usage_limit_value: '',
                  usage_per_user: '1',
                  applies_to: 'vendor_only',
                  end_date: '',
                });
                setShowForm(true);
              }}
              style={styles.emptyButton}
            >
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                style={styles.emptyButtonGradient}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.emptyButtonText}>Create Your First Promo Code</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Promo Code Form Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCode ? 'Edit' : 'Create'} Promo Code
              </Text>
              <View style={styles.modalHeaderRight}>
                <TouchableOpacity
                  onPress={() => setShowSampleModal(true)}
                  style={styles.sampleButton}
                >
                  <Feather name="eye" size={18} color="#f97316" />
                  <Text style={styles.sampleButtonText}>Sample</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowForm(false)} style={styles.closeButton}>
                  <Feather name="x" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Code Generation */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Promo Code *</Text>
                <View style={styles.codeInputRow}>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    value={formData.code}
                    onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
                    placeholder="SAVE20"
                    placeholderTextColor="#666"
                    autoCapitalize="characters"
                    maxLength={20}
                  />
                  <TouchableOpacity onPress={generateCode} style={styles.generateButton}>
                    <Text style={styles.generateButtonText}>Generate</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>
                  Use a short, memorable code like "SAVE20" or "FREEDELIVERY"
                </Text>
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Describe your offer... (this will be shown to customers)"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <Text style={styles.helperText}>
                  Customers will see this in their notifications. Make it exciting!
                </Text>
              </View>

              {/* Discount Type & Value */}
              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Discount Type</Text>
                  <View style={styles.pickerContainer}>
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, discount_type: 'percentage' })}
                      style={[
                        styles.typeButton,
                        formData.discount_type === 'percentage' && styles.typeButtonActive,
                      ]}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        formData.discount_type === 'percentage' && styles.typeButtonTextActive,
                      ]}>
                        % OFF
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, discount_type: 'fixed' })}
                      style={[
                        styles.typeButton,
                        formData.discount_type === 'fixed' && styles.typeButtonActive,
                      ]}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        formData.discount_type === 'fixed' && styles.typeButtonTextActive,
                      ]}>
                        ₦ OFF
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Value *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.discount_value}
                    onChangeText={(text) => setFormData({ ...formData, discount_value: text })}
                    placeholder={formData.discount_type === 'percentage' ? '20' : '2000'}
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Order Limits */}
              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Min Order (₦)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.min_order_amount}
                    onChangeText={(text) => setFormData({ ...formData, min_order_amount: text })}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Max Discount (₦)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.max_discount_amount}
                    onChangeText={(text) => setFormData({ ...formData, max_discount_amount: text })}
                    placeholder="Unlimited"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Usage Type */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Usage Limit</Text>
                <View style={styles.usageTypeGrid}>
                  <TouchableOpacity
                    onPress={() => setFormData({ ...formData, usage_limit_type: 'unlimited', usage_limit_value: '' })}
                    style={[
                      styles.usageTypeCard,
                      formData.usage_limit_type === 'unlimited' && styles.usageTypeCardActive,
                    ]}
                  >
                    <Feather name="feather" size={20} color={formData.usage_limit_type === 'unlimited' ? '#f97316' : '#666'} />
                    <Text style={[
                      styles.usageTypeText,
                      formData.usage_limit_type === 'unlimited' && styles.usageTypeTextActive,
                    ]}>Unlimited</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setFormData({ ...formData, usage_limit_type: 'limited' })}
                    style={[
                      styles.usageTypeCard,
                      formData.usage_limit_type === 'limited' && styles.usageTypeCardActive,
                    ]}
                  >
                    <Feather name="hash" size={20} color={formData.usage_limit_type === 'limited' ? '#f97316' : '#666'} />
                    <Text style={[
                      styles.usageTypeText,
                      formData.usage_limit_type === 'limited' && styles.usageTypeTextActive,
                    ]}>Limited</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setFormData({ ...formData, usage_limit_type: 'lucky' })}
                    style={[
                      styles.usageTypeCard,
                      formData.usage_limit_type === 'lucky' && styles.usageTypeCardActive,
                    ]}
                  >
                    <Feather name="star" size={20} color={formData.usage_limit_type === 'lucky' ? '#f97316' : '#666'} />
                    <Text style={[
                      styles.usageTypeText,
                      formData.usage_limit_type === 'lucky' && styles.usageTypeTextActive,
                    ]}>Lucky</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Usage Limit Value */}
              {(formData.usage_limit_type === 'limited' || formData.usage_limit_type === 'lucky') && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {formData.usage_limit_type === 'limited' ? 'Total Uses Allowed' : 'Lucky Number of Uses'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={formData.usage_limit_value}
                    onChangeText={(text) => setFormData({ ...formData, usage_limit_value: text })}
                    placeholder={formData.usage_limit_type === 'limited' ? 'e.g., 100' : 'e.g., 50'}
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>
              )}

              {/* Per User Limit */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Uses Per Customer</Text>
                <TextInput
                  style={styles.input}
                  value={formData.usage_per_user}
                  onChangeText={(text) => setFormData({ ...formData, usage_per_user: text })}
                  placeholder="1"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
                <Text style={styles.helperText}>How many times can one customer use this code?</Text>
              </View>

              {/* End Date */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>End Date (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.end_date}
                  onChangeText={(text) => setFormData({ ...formData, end_date: text })}
                  placeholder="YYYY-MM-DDTHH:MM"
                  placeholderTextColor="#666"
                />
                <Text style={styles.helperText}>Leave empty for no expiration date</Text>
              </View>



{/* Live Preview Section - Inline */}
<View style={styles.previewSection}>
  <View style={styles.previewHeader}>
    <Text style={styles.previewTitle}>📱 Live Preview</Text>
    <TouchableOpacity
      onPress={() => {
        // Apply sample values
        const discountVal = formData.discount_type === 'percentage' ? '20' : '2000';
        const minAmount = formData.discount_type === 'percentage' ? '5000' : '15000';
        
        setFormData({
          ...formData,
          description: formData.discount_type === 'percentage' 
            ? `🎉 Special Offer! Get ${formData.discount_value || '20'}% OFF on all orders above ₦${parseInt(formData.min_order_amount || '5000').toLocaleString()}. Don't miss out on this amazing deal! Valid for a limited time only.`
            : `💰 Limited Time Offer! Save ₦${parseInt(formData.discount_value || '2000').toLocaleString()} on your next order when you spend ₦${parseInt(formData.min_order_amount || '15000').toLocaleString()} or more. Perfect for family meals!`,
          discount_value: formData.discount_value || discountVal,
          min_order_amount: formData.min_order_amount || minAmount,
        });
      }}
      style={styles.applySampleButton}
    >
      <Feather name="zap" size={14} color="#f97316" />
      <Text style={styles.applySampleButtonText}>Use Sample</Text>
    </TouchableOpacity>
  </View>
  
  <View style={styles.previewCard}>
    <View style={styles.previewNotification}>
      <View style={styles.previewNotificationHeader}>
        <Feather name="bell" size={14} color="#f97316" />
        <Text style={styles.previewNotificationText}>Push Notification Preview</Text>
      </View>
      <Text style={styles.previewTitleText}>
        🎉 {formData.code || 'SAVE20'} - {formData.discount_value || '20'}% off
      </Text>
      <Text style={styles.previewBodyText}>
        Your Store: {formData.discount_value || '20'}% off when you spend ₦{parseInt(formData.min_order_amount || '0').toLocaleString()}
      </Text>
    </View>
    
    <View style={styles.previewDivider} />
    
    <View style={styles.previewModal}>
      <View style={styles.previewModalHeader}>
        <Feather name="tag" size={14} color="#f97316" />
        <Text style={styles.previewModalText}>In-App Modal Preview</Text>
      </View>
      <Text style={styles.previewModalCode}>{formData.code || 'SAVE20'}</Text>
      <Text style={styles.previewModalDiscount}>
        {formData.discount_type === 'percentage' 
          ? `${formData.discount_value || '20'}% OFF`
          : `₦${parseInt(formData.discount_value || '2000').toLocaleString()} OFF`}
      </Text>
      <Text style={styles.previewModalDesc} numberOfLines={2}>
        {formData.description || 'Your promo description will appear here'}
      </Text>
    </View>
  </View>
</View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={handleSubmit}
                style={styles.submitButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.submitGradient}
                >
                  <Text style={styles.submitText}>
                    {editingCode ? 'Update' : 'Create'} Promo Code
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.helpModalOverlay}>
          <View style={styles.helpModalContent}>
            <View style={styles.helpModalHeader}>
              <Text style={styles.helpModalTitle}>📖 How Promo Codes Work</Text>
              <TouchableOpacity onPress={() => setShowHelpModal(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.helpModalBody}>
              <View style={styles.helpSection}>
                <Feather name="tag" size={20} color="#f97316" />
                <Text style={styles.helpSectionTitle}>What are Promo Codes?</Text>
                <Text style={styles.helpText}>
                  Promo codes are special codes customers can enter at checkout to get discounts. They're a great way to attract new customers and reward loyal ones!
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Feather name="percent" size={20} color="#f97316" />
                <Text style={styles.helpSectionTitle}>Discount Types</Text>
                <Text style={styles.helpSubtitle}>• Percentage (%) OFF</Text>
                <Text style={styles.helpText}>Give customers a percentage off their total. Example: 20% off</Text>
                <Text style={styles.helpSubtitle}>• Fixed Amount (₦) OFF</Text>
                <Text style={styles.helpText}>Give a fixed amount off. Example: ₦2,000 off</Text>
              </View>

              <View style={styles.helpSection}>
                <Feather name="settings" size={20} color="#f97316" />
                <Text style={styles.helpSectionTitle}>Usage Limits</Text>
                <Text style={styles.helpSubtitle}>• Unlimited</Text>
                <Text style={styles.helpText}>Anyone can use it any number of times (within per-user limit)</Text>
                <Text style={styles.helpSubtitle}>• Limited</Text>
                <Text style={styles.helpText}>Only a certain number of total uses (e.g., 100 total redemptions)</Text>
                <Text style={styles.helpSubtitle}>• Lucky</Text>
                <Text style={styles.helpText}>Limited to a specific number (e.g., only 50 customers can use it)</Text>
              </View>

              <View style={styles.helpSection}>
                <Feather name="bell" size={20} color="#f97316" />
                <Text style={styles.helpSectionTitle}>Customer Notifications</Text>
                <Text style={styles.helpText}>
                  When you create an active promo code, ALL customers will receive:
                  • Push notification on their phone
                  • In-app notification in their notifications list
                  
                  This helps drive immediate traffic to your store!
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Feather name="info" size={20} color="#f97316" />
                <Text style={styles.helpSectionTitle}>Pro Tips</Text>
                <Text style={styles.helpText}>✨ Use short, memorable codes like "SAVE20" or "WELCOME"</Text>
                <Text style={styles.helpText}>✨ Set a minimum order amount to increase average order value</Text>
                <Text style={styles.helpText}>✨ Create urgency with expiration dates</Text>
                <Text style={styles.helpText}>✨ Limited-time offers drive more conversions</Text>
                <Text style={styles.helpText}>✨ Track usage to see which promotions work best</Text>
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowHelpModal(false)}
              style={styles.helpModalButton}
            >
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                style={styles.helpModalButtonGradient}
              >
                <Text style={styles.helpModalButtonText}>Got it!</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sample Modal */}
      <Modal
        visible={showSampleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSampleModal(false)}
      >
        <View style={styles.sampleModalOverlay}>
          <View style={styles.sampleModalContent}>
            <View style={styles.sampleModalHeader}>
              <Text style={styles.sampleModalTitle}>✨ Sample Promo Code</Text>
              <TouchableOpacity onPress={() => setShowSampleModal(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sampleModalBody}>
              <Text style={styles.sampleModalSubtitle}>Here's what a great promo code looks like:</Text>

              {/* Sample Display */}
              <View style={styles.sampleDisplay}>
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sampleDisplayGradient}
                >
                  <Feather name="tag" size={32} color="#fff" />
                  <Text style={styles.sampleDisplayCode}>SAVE20</Text>
                  <Text style={styles.sampleDisplayDiscount}>20% OFF</Text>
                </LinearGradient>

                <View style={styles.sampleDisplayContent}>
                  <Text style={styles.sampleDisplayTitle}>🎉 Special Offer!</Text>
                  <Text style={styles.sampleDisplayDescription}>
                    Get 20% OFF on all orders above ₦5,000. Don't miss out on this amazing deal! Valid for a limited time only.
                  </Text>
                  
                  <View style={styles.sampleDisplayTerms}>
                    <View style={styles.sampleTermItem}>
                      <Feather name="shopping-bag" size={14} color="#f97316" />
                      <Text style={styles.sampleTermText}>Min order: ₦5,000</Text>
                    </View>
                    <View style={styles.sampleTermItem}>
                      <Feather name="users" size={14} color="#f97316" />
                      <Text style={styles.sampleTermText}>1 use per customer</Text>
                    </View>
                    <View style={styles.sampleTermItem}>
                      <Feather name="calendar" size={14} color="#f97316" />
                      <Text style={styles.sampleTermText}>Valid for 7 days</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.sampleTipBox}>
                <Feather name="info" size={20} color="#f59e0b" />
                <Text style={styles.sampleTipText}>
                  This is just an example! Your customers will see something similar when you create a promo code. Make your description exciting to encourage orders!
                </Text>
              </View>

              <View style={styles.sampleButtons}>
                <TouchableOpacity
                  onPress={() => setShowSampleModal(false)}
                  style={styles.sampleCancelButton}
                >
                  <Text style={styles.sampleCancelButtonText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={applySample}
                  style={styles.sampleApplyButton}
                >
                  <LinearGradient
                    colors={['#f97316', '#f43f5e']}
                    style={styles.sampleApplyGradient}
                  >
                    <Feather name="check" size={16} color="#fff" />
                    <Text style={styles.sampleApplyButtonText}>Use This Sample</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  helpButton: {
    padding: 8,
  },
  createButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
  },
  list: {
    flex: 1,
  },
  codeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
// Replace the existing codeHeader and related styles with these:

codeHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start', // Changed from 'center' to 'flex-start'
  marginBottom: 12,
},
codeInfo: {
  flex: 1,
  marginRight: 12, // Add space between content and buttons
},
actionButtons: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  marginLeft: 'auto', // Push buttons to the right
},
actionButton: {
  padding: 6,
  minWidth: 32,
  alignItems: 'center',
},
  codeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  previewHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
},
previewTitle: {
  fontSize: 13,
  fontWeight: '600',
  color: '#fff',
},
applySampleButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  backgroundColor: 'rgba(249,115,22,0.1)',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 6,
},
applySampleButtonText: {
  fontSize: 11,
  color: '#f97316',
},
previewCard: {
  backgroundColor: '#2a2a2a',
  borderRadius: 12,
  overflow: 'hidden',
},
previewNotification: {
  padding: 12,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.05)',
},
previewNotificationHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 8,
},
previewNotificationText: {
  fontSize: 10,
  color: '#f97316',
},
previewTitleText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#fff',
  marginBottom: 4,
},
previewBodyText: {
  fontSize: 11,
  color: '#666',
},
previewDivider: {
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.05)',
},
previewModal: {
  padding: 12,
},
previewModalHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 8,
},
previewModalText: {
  fontSize: 10,
  color: '#f97316',
},
previewModalCode: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#f97316',
  fontFamily: 'monospace',
  marginBottom: 4,
},
previewModalDiscount: {
  fontSize: 12,
  color: '#f97316',
  backgroundColor: 'rgba(249,115,22,0.1)',
  alignSelf: 'flex-start',
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 4,
  marginBottom: 8,
},
previewModalDesc: {
  fontSize: 11,
  color: '#666',
  lineHeight: 16,
},
  vendorBadge: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  platformBadge: {
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  activeBadge: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  inactiveBadge: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  badgeText: {
    fontSize: 9,
    color: '#fff',
  },
  codeDescription: {
    fontSize: 12,
    color: '#666',
  },

  codeStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 12,
    gap: 12,
  },
  stat: {
    minWidth: '22%',
  },

  statValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
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
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  sampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sampleButtonText: {
    fontSize: 12,
    color: '#f97316',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  codeInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeInput: {
    flex: 1,
  },
  generateButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  typeButtonText: {
    fontSize: 13,
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#f97316',
  },
  usageTypeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  usageTypeCard: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  usageTypeCardActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  usageTypeText: {
    fontSize: 12,
    color: '#666',
  },
  usageTypeTextActive: {
    color: '#f97316',
  },
  previewSection: {
    marginTop: 8,
    marginBottom: 16,
  },

  previewHeaderText: {
    fontSize: 11,
    color: '#f97316',
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
  // Help Modal Styles
  helpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  helpModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
  },
  helpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  helpModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  helpModalBody: {
    padding: 20,
  },
  helpSection: {
    marginBottom: 24,
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
    marginBottom: 8,
  },
  helpSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f97316',
    marginTop: 8,
    marginBottom: 4,
  },
  helpText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 20,
  },
  helpModalButton: {
    margin: 20,
    marginTop: 0,
    borderRadius: 10,
    overflow: 'hidden',
  },
  helpModalButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  helpModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Sample Modal Styles
  sampleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sampleModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
  },
  sampleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sampleModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  sampleModalBody: {
    padding: 20,
  },
  sampleModalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  sampleDisplay: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  sampleDisplayGradient: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  sampleDisplayCode: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  sampleDisplayDiscount: {
    fontSize: 16,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  sampleDisplayContent: {
    padding: 16,
    backgroundColor: '#2a2a2a',
  },
  sampleDisplayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  sampleDisplayDescription: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 12,
  },
  sampleDisplayTerms: {
    gap: 6,
  },
  sampleTermItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sampleTermText: {
    fontSize: 12,
    color: '#666',
  },
  sampleTipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,158,11,0.1)',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  sampleTipText: {
    flex: 1,
    fontSize: 12,
    color: '#f59e0b',
    lineHeight: 18,
  },
  sampleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sampleCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sampleCancelButtonText: {
    color: '#666',
    fontSize: 14,
  },
  sampleApplyButton: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sampleApplyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  sampleApplyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});