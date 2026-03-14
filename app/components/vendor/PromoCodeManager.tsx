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
  applies_to: 'vendor' | 'platform';
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
    applies_to: 'vendor' as 'vendor' | 'platform',
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
    const prefix = formData.discount_type === 'percentage' ? 'SAVE' : 'OFF';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData({ ...formData, code: `${prefix}${random}` });
  };

  const copyToClipboard = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Success', 'Code copied to clipboard');
  };

  const handleSubmit = async () => {
    if (!vendorId && !isAdmin) {
      Alert.alert('Error', 'Vendor information missing');
      return;
    }

    try {
      // Validate required fields
      if (!formData.code) {
        Alert.alert('Error', 'Please enter a promo code');
        return;
      }

      if (!formData.discount_value || parseInt(formData.discount_value) <= 0) {
        Alert.alert('Error', 'Please enter a valid discount value');
        return;
      }

      // Calculate usage limit based on type
      let usageLimit = null;
      if (formData.usage_limit_type === 'limited' || formData.usage_limit_type === 'lucky') {
        usageLimit = parseInt(formData.usage_limit_value);
        if (isNaN(usageLimit) || usageLimit < 1) {
          Alert.alert('Error', 'Please enter a valid usage limit');
          return;
        }
      }

      const promoData = {
        vendor_id: isAdmin ? 'platform' : vendorId,
        code: formData.code.toUpperCase(),
        description: formData.description,
        discount_type: formData.discount_type,
        discount_value: parseInt(formData.discount_value),
        min_order_amount: parseInt(formData.min_order_amount) || 0,
        max_discount_amount: parseInt(formData.max_discount_amount) || null,
        usage_limit: usageLimit,
        usage_per_user: parseInt(formData.usage_per_user) || 1,
        applies_to: isAdmin ? formData.applies_to : 'vendor',
        end_date: formData.end_date || null,
        is_active: true,
      };

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
        Alert.alert('Success', 'Promo code created');
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
        <View>
          <Text style={styles.title}>Promo Codes</Text>
          <Text style={styles.subtitle}>
            {isAdmin ? 'Manage platform-wide promo codes' : 'Create promotions for your customers'}
          </Text>
        </View>
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
              applies_to: 'vendor',
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

      {/* Promo Codes List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {promoCodes.length > 0 ? (
          promoCodes.map((code) => (
            <View key={code.id} style={styles.codeCard}>
              <View style={styles.codeHeader}>
                <View>
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
                      code.applies_to === 'platform' ? styles.platformBadge : styles.vendorBadge
                    ]}>
                      <Text style={styles.badgeText}>
                        {code.applies_to === 'platform' ? 'Platform' : 'Vendor'}
                      </Text>
                    </View>
                    <View style={[
                      styles.badge,
                      code.is_active ? styles.activeBadge : styles.inactiveBadge
                    ]}>
                      <Text style={styles.badgeText}>
                        {code.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  {code.description ? (
                    <Text style={styles.codeDescription}>{code.description}</Text>
                  ) : null}
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={() => toggleActive(code)}
                    style={styles.actionButton}
                  >
                    <Feather 
                      name={code.is_active ? 'pause-circle' : 'play-circle'} 
                      size={18} 
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
              Create your first promo code to start offering discounts
            </Text>
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
              <TouchableOpacity onPress={() => setShowForm(false)} style={styles.closeButton}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
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
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="20% off on all items"
                  placeholderTextColor="#666"
                />
              </View>

              {/* Discount Type */}
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
                        Percentage (%)
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
                        Fixed (₦)
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
                    placeholder={formData.discount_type === 'percentage' ? '20' : '1000'}
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Limits */}
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
                <Text style={styles.label}>Usage Type</Text>
                <View style={styles.usageTypeGrid}>
                  <TouchableOpacity
                    onPress={() => setFormData({ ...formData, usage_limit_type: 'unlimited', usage_limit_value: '' })}
                    style={[
                      styles.usageTypeCard,
                      formData.usage_limit_type === 'unlimited' && styles.usageTypeCardActive,
                    ]}
                  >
                    <Feather name="x" size={20} color={formData.usage_limit_type === 'unlimited' ? '#f97316' : '#666'} />
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
                    {formData.usage_limit_type === 'limited' ? 'Number of Uses' : 'Lucky Number'}
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
                <Text style={styles.label}>Per User Limit</Text>
                <TextInput
                  style={styles.input}
                  value={formData.usage_per_user}
                  onChangeText={(text) => setFormData({ ...formData, usage_per_user: text })}
                  placeholder="1"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
              </View>

              {/* Applies To - Only show for admins */}
              {isAdmin && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Applies To</Text>
                  <View style={styles.pickerContainer}>
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, applies_to: 'platform' })}
                      style={[
                        styles.typeButton,
                        formData.applies_to === 'platform' && styles.typeButtonActive,
                      ]}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        formData.applies_to === 'platform' && styles.typeButtonTextActive,
                      ]}>Platform Wide</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, applies_to: 'vendor' })}
                      style={[
                        styles.typeButton,
                        formData.applies_to === 'vendor' && styles.typeButtonActive,
                      ]}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        formData.applies_to === 'vendor' && styles.typeButtonTextActive,
                      ]}>Specific Vendor</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

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
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
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
    minWidth: '40%',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
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
});