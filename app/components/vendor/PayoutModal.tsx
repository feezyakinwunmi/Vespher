// app/components/vendor/PayoutModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface PayoutModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>;
  maxAmount: number;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

const quickAmounts = [5000, 10000, 20000, 50000];

export function PayoutModal({ 
  visible, 
  onClose, 
  onSubmit, 
  maxAmount, 
  bankDetails 
}: PayoutModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const handleAmountChange = (value: string) => {
    setError('');
    setAmount(value);
    
    const numValue = parseInt(value) || 0;
    if (numValue > maxAmount) {
      setError(`Amount cannot exceed ₦${maxAmount.toLocaleString()}`);
    } else if (numValue < 1000 && numValue > 0) {
      setError('Minimum payout is ₦1,000');
    }
  };

  const handleSubmit = async () => {
    const numAmount = parseInt(amount) || 0;
    
    if (numAmount < 1000) {
      setError('Minimum payout is ₦1,000');
      return;
    }
    
    if (numAmount > maxAmount) {
      setError(`Amount cannot exceed ₦${maxAmount.toLocaleString()}`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const success = await onSubmit({
        amount: numAmount,
        bank_name: bankDetails?.bankName || '',
        account_number: bankDetails?.accountNumber || '',
        account_name: bankDetails?.accountName || '',
      });

      if (success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setAmount('');
          onClose();
        }, 2000);
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Payout</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {success ? (
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Feather name="check-circle" size={50} color="#10b981" />
                </View>
                <Text style={styles.successTitle}>Payout Requested!</Text>
                <Text style={styles.successText}>
                  Your request has been submitted and will be processed within 1-2 business days.
                </Text>
              </View>
            ) : (
              <>
                {/* Available Balance */}
                <View style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Available Balance</Text>
                  <Text style={styles.balanceValue}>₦{maxAmount.toLocaleString()}</Text>
                </View>

                {/* Amount Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Amount (₦)</Text>
                  <TextInput
                    style={[styles.input, error ? styles.inputError : null]}
                    value={amount}
                    onChangeText={handleAmountChange}
                    placeholder="Enter amount"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                  {error ? (
                    <View style={styles.errorContainer}>
                      <Feather name="alert-circle" size={12} color="#ef4444" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Quick Amounts */}
                <View style={styles.quickAmountsContainer}>
                  <Text style={styles.quickAmountsLabel}>Quick select</Text>
                  <View style={styles.quickAmountsGrid}>
                    {quickAmounts.map((quickAmount) => (
                      <TouchableOpacity
                        key={quickAmount}
                        onPress={() => handleAmountChange(quickAmount.toString())}
                        disabled={quickAmount > maxAmount}
                        style={[
                          styles.quickAmountButton,
                          quickAmount > maxAmount && styles.quickAmountDisabled,
                        ]}
                      >
                        <Text style={[
                          styles.quickAmountText,
                          quickAmount > maxAmount && styles.quickAmountTextDisabled
                        ]}>
                          ₦{quickAmount.toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Bank Details Summary */}
                <View style={styles.bankDetailsCard}>
                  <View style={styles.bankDetailsHeader}>
                    <Feather name="credit-card" size={16} color="#f97316" />
                    <Text style={styles.bankDetailsTitle}>Bank Account</Text>
                  </View>
                  <Text style={styles.bankName}>{bankDetails?.bankName || 'No bank details set'}</Text>
                  <Text style={styles.bankAccount}>
                    {bankDetails?.accountNumber} • {bankDetails?.accountName}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                   Not this bank? To update bank details, go to your profile settings.
                  </Text>
                </View>

                {/* Info Box */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>• Payouts are processed within 1-2 business days</Text>
                  <Text style={styles.infoText}>• Minimum payout is ₦1,000</Text>
                  <Text style={styles.infoText}>• You'll receive a notification when processed</Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Submit Button */}
          {!success && (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!amount || isSubmitting || !!error || parseInt(amount) > maxAmount}
                style={styles.submitButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.submitGradient}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Request Payout</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
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
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16,185,129,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  balanceCard: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f97316',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
  },
  quickAmountsContainer: {
    marginBottom: 16,
  },
  quickAmountsLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quickAmountDisabled: {
    opacity: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quickAmountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  quickAmountTextDisabled: {
    color: '#666',
  },
  bankDetailsCard: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  bankDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bankDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  bankName: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  bankAccount: {
    fontSize: 12,
    color: '#666',
  },
  infoBox: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 11,
    color: '#f97316',
    marginBottom: 4,
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