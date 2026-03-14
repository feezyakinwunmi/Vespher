// app/components/AddressModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Address } from '../../types';

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: any) => Promise<void>;
  address?: Address | null;
}

const labelOptions = [
  { value: 'Home', label: 'Home' },
  { value: 'School', label: 'School' },
  { value: 'Work', label: 'Work' },
  { value: 'Other', label: 'Other' },
];

export function AddressModal({ isOpen, onClose, onSave, address }: AddressModalProps) {
  const [formData, setFormData] = useState({
    label: address?.label || '',
    street: address?.street || '',
    area: address?.area || '',
    landmark: address?.landmark || '',
    phone: address?.phone || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.label) {
      Alert.alert('Error', 'Please select a label');
      return;
    }
    if (!formData.street) {
      Alert.alert('Error', 'Please enter street address');
      return;
    }
    if (!formData.area) {
      Alert.alert('Error', 'Please enter area');
      return;
    }
    if (!formData.phone) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {address ? 'Edit Address' : 'Add New Address'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Label Select */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Label *</Text>
              <View style={styles.optionsContainer}>
                {labelOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setFormData({ ...formData, label: option.value })}
                    style={[
                      styles.optionButton,
                      formData.label === option.value && styles.optionButtonSelected,
                    ]}
                  >
                    <Text style={[
                      styles.optionText,
                      formData.label === option.value && styles.optionTextSelected,
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Street Address */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Street Address *</Text>
              <View style={styles.inputContainer}>
                <Feather name="map-pin" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.street}
                  onChangeText={(text) => setFormData({ ...formData, street: text })}
                  placeholder="e.g., 15 University Road"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            {/* Area */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Area *</Text>
              <View style={styles.inputContainer}>
                <Feather name="navigation" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.area}
                  onChangeText={(text) => setFormData({ ...formData, area: text })}
                  placeholder="e.g., Epe"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            {/* Landmark (Optional) */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Landmark (Optional)</Text>
              <View style={styles.inputContainer}>
                <Feather name="flag" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.landmark}
                  onChangeText={(text) => setFormData({ ...formData, landmark: text })}
                  placeholder="e.g., Beside the market"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            {/* Phone Number */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Phone Number *</Text>
              <View style={styles.inputContainer}>
                <Feather name="phone" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Phone number for delivery"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={styles.saveButton}
            >
              <LinearGradient
                colors={['#3b82f6', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>
                    {address ? 'Update Address' : 'Save Address'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  form: {
    flex: 1,
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextSelected: {
    color: '#3b82f6',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});