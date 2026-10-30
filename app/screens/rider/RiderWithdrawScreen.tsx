// app/screens/rider/RiderWithdrawScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useRiderWallet } from '../../hooks/rider/useRiderWallet';
import { BANKS, Bank } from '../../constants/banks';
import { verifyBankAccount } from '../../utils/paystack';
import {
  MIN_WITHDRAWAL,
  RiderBankDetails,
  fetchBankDetails,
  requestWithdrawal,
  saveBankDetails,
} from '../../services/riderOrders';
import { R, naira } from '../../components/rider/ui';
import { ModalSafeArea } from '../../components/ModalSafeArea';

export function RiderWithdrawScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { available, withdrawals, hasPending, refresh } = useRiderWallet();

  const [bank, setBank] = useState<RiderBankDetails | null>(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [editingBank, setEditingBank] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchBankDetails(user.id)
      .then(b => {
        setBank(b);
        setEditingBank(!b);
      })
      .finally(() => setLoadingBank(false));
  }, [user?.id]);

  // Resolve the account name as soon as we have 10 digits and a bank.
  useEffect(() => {
    setAccountName('');
    if (!selectedBank || accountNumber.length !== 10) return;
    let cancelled = false;
    setVerifying(true);
    verifyBankAccount(accountNumber, selectedBank.code).then(res => {
      if (cancelled) return;
      setVerifying(false);
      if (res.status === 'success' && res.data) setAccountName(res.data.account_name);
      else Toast.show({ type: 'error', text1: 'Could not verify account', text2: res.message });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedBank, accountNumber]);

  const filteredBanks = useMemo(
    () => BANKS.filter(b => b.label.toLowerCase().includes(bankSearch.toLowerCase())),
    [bankSearch],
  );

  const startEditBank = () => {
    setSelectedBank(BANKS.find(b => b.label === bank?.bank_name) || null);
    setAccountNumber(bank?.account_number || '');
    setEditingBank(true);
  };

  const handleSaveBank = async () => {
    if (!user?.id || !selectedBank || !accountName) return;
    setSavingBank(true);
    try {
      const saved = await saveBankDetails(user.id, {
        id: bank?.id,
        bank_name: selectedBank.label,
        account_number: accountNumber,
        account_name: accountName,
      });
      setBank(saved);
      setEditingBank(false);
      Toast.show({ type: 'success', text1: 'Bank account saved' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Could not save bank account', text2: error?.message });
    } finally {
      setSavingBank(false);
    }
  };

  const value = parseFloat(amount.replace(/,/g, '')) || 0;
  const amountError =
    value <= 0 ? null : value < MIN_WITHDRAWAL ? `Minimum is ${naira(MIN_WITHDRAWAL)}` : value > available ? 'More than your available balance' : null;
  const canSubmit = !!bank && !editingBank && !hasPending && value >= MIN_WITHDRAWAL && value <= available;

  const handleSubmit = () => {
    if (!canSubmit || !user?.id || !bank) return;
    Alert.alert('Confirm withdrawal', `Send ${naira(value)} to ${bank.account_name}\n${bank.bank_name} · ${bank.account_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        onPress: async () => {
          setSubmitting(true);
          try {
            await requestWithdrawal(user.id, value, bank);
            await refresh();
            Toast.show({ type: 'success', text1: 'Withdrawal requested', text2: 'You will be paid within 24 hours.' });
            navigation.goBack();
          } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Withdrawal failed', text2: error?.message });
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const pendingRequest = withdrawals.find(w => w.status === 'pending' || w.status === 'processing');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Feather name="x" size={20} color={R.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Available balance</Text>
            <Text style={styles.balanceValue}>{naira(available)}</Text>
          </View>

          {pendingRequest && (
            <View style={styles.pendingBox}>
              <Feather name="clock" size={18} color={R.amber} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>{naira(pendingRequest.amount)} is on its way</Text>
                <Text style={styles.pendingBody}>
                  Your request is {pendingRequest.status}. You can request another once this one is paid.
                </Text>
              </View>
            </View>
          )}

          {/* Bank account */}
          <Text style={styles.label}>Pay to</Text>
          {loadingBank ? (
            <View style={styles.card}><ActivityIndicator color={R.orange} /></View>
          ) : !editingBank && bank ? (
            <View style={[styles.card, styles.bankRow]}>
              <View style={styles.bankIcon}>
                <Feather name="credit-card" size={18} color={R.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bankName}>{bank.account_name}</Text>
                <Text style={styles.bankSub}>{bank.bank_name} · {bank.account_number}</Text>
              </View>
              <TouchableOpacity onPress={startEditBank} hitSlop={8}>
                <Text style={styles.link}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <TouchableOpacity style={styles.input} onPress={() => setBankPickerOpen(true)}>
                <Text style={[styles.inputText, !selectedBank && { color: R.faint }]}>{selectedBank?.label || 'Select bank'}</Text>
                <Feather name="chevron-down" size={18} color={R.muted} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.inputText, { marginTop: 10 }]}
                placeholder="10-digit account number"
                placeholderTextColor={R.faint}
                keyboardType="number-pad"
                maxLength={10}
                value={accountNumber}
                onChangeText={t => setAccountNumber(t.replace(/\D/g, ''))}
              />
              <View style={styles.resolved}>
                {verifying ? (
                  <>
                    <ActivityIndicator size="small" color={R.orange} />
                    <Text style={styles.resolvedText}>Checking account…</Text>
                  </>
                ) : accountName ? (
                  <>
                    <Feather name="check-circle" size={15} color={R.green} />
                    <Text style={[styles.resolvedText, { color: R.green }]}>{accountName}</Text>
                  </>
                ) : (
                  <Text style={styles.resolvedText}>The account name appears here once verified.</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                {bank && (
                  <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setEditingBank(false)}>
                    <Text style={styles.secondaryText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 2, backgroundColor: accountName ? R.orange : '#262626' }]}
                  disabled={!accountName || savingBank}
                  onPress={handleSaveBank}
                >
                  {savingBank ? <ActivityIndicator color="#fff" /> : <Text style={[styles.secondaryText, { color: accountName ? '#fff' : R.faint }]}>Save account</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <View style={[styles.card, styles.amountBox, amountError && { borderColor: R.red }]}>
            <Text style={styles.currency}>₦</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={R.faint}
              keyboardType="number-pad"
              value={amount}
              onChangeText={t => setAmount(t.replace(/\D/g, ''))}
              editable={!hasPending}
            />
          </View>
          {amountError ? <Text style={styles.error}>{amountError}</Text> : <Text style={styles.helper}>Minimum {naira(MIN_WITHDRAWAL)}</Text>}
          <View style={styles.chips}>
            {[0.25, 0.5, 1].map(f => {
              const v = Math.floor(available * f);
              return (
                <TouchableOpacity key={f} style={styles.chip} disabled={hasPending || v < MIN_WITHDRAWAL} onPress={() => setAmount(String(v))}>
                  <Text style={[styles.chipText, (hasPending || v < MIN_WITHDRAWAL) && { color: R.faint }]}>{f === 1 ? 'All' : `${f * 100}%`}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity disabled={!canSubmit || submitting} onPress={handleSubmit} activeOpacity={0.85}>
            <LinearGradient
              colors={canSubmit ? R.gradient : ['#262626', '#262626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submit}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.submitText, !canSubmit && { color: R.faint }]}>
                  {value > 0 ? `Withdraw ${naira(value)}` : 'Withdraw'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={bankPickerOpen} animationType="slide" onRequestClose={() => setBankPickerOpen(false)}>
        <ModalSafeArea style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.back} onPress={() => setBankPickerOpen(false)}>
              <Feather name="x" size={20} color={R.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select bank</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[styles.input, { marginBottom: 8 }]}>
              <Feather name="search" size={16} color={R.muted} />
              <TextInput
                style={[styles.inputText, { flex: 1, marginLeft: 8 }]}
                placeholder="Search banks"
                placeholderTextColor={R.faint}
                value={bankSearch}
                onChangeText={setBankSearch}
                autoFocus
              />
            </View>
          </View>
          <FlatList
            data={filteredBanks}
            keyExtractor={b => b.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.bankOption}
                onPress={() => {
                  setSelectedBank(item);
                  setBankPickerOpen(false);
                  setBankSearch('');
                }}
              >
                <Text style={styles.inputText}>{item.label}</Text>
                {selectedBank?.value === item.value && <Feather name="check" size={18} color={R.orange} />}
              </TouchableOpacity>
            )}
          />
        </ModalSafeArea>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: R.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: R.card, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: R.text, fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 30 },
  balanceBox: { alignItems: 'center', paddingVertical: 18 },
  balanceLabel: { color: R.muted, fontSize: 13 },
  balanceValue: { color: R.text, fontSize: 34, fontWeight: '800', marginTop: 4 },
  pendingBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginBottom: 6,
  },
  pendingTitle: { color: R.amber, fontSize: 14, fontWeight: '700' },
  pendingBody: { color: '#d4d4d4', fontSize: 12.5, marginTop: 2, lineHeight: 18 },
  label: { color: R.muted, fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: R.card, borderRadius: 18, borderWidth: 1, borderColor: R.border, padding: 14 },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bankIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.12)', justifyContent: 'center', alignItems: 'center' },
  bankName: { color: R.text, fontSize: 15, fontWeight: '700' },
  bankSub: { color: R.muted, fontSize: 12.5, marginTop: 2 },
  link: { color: R.orange, fontWeight: '600', fontSize: 13 },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: R.bg,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: { color: R.text, fontSize: 15 },
  resolved: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, minHeight: 20 },
  resolvedText: { color: R.faint, fontSize: 13 },
  secondaryBtn: { height: 44, borderRadius: 12, backgroundColor: '#262626', justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: R.text, fontWeight: '700', fontSize: 14 },
  amountBox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  currency: { color: R.muted, fontSize: 28, fontWeight: '700', marginRight: 6 },
  amountInput: { flex: 1, color: R.text, fontSize: 30, fontWeight: '800', paddingVertical: 8 },
  error: { color: R.red, fontSize: 12.5, marginTop: 6 },
  helper: { color: R.faint, fontSize: 12.5, marginTop: 6 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { flex: 1, height: 38, borderRadius: 10, backgroundColor: R.card, borderWidth: 1, borderColor: R.border, justifyContent: 'center', alignItems: 'center' },
  chipText: { color: R.text, fontWeight: '600', fontSize: 13 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: R.border },
  submit: { height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bankOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: R.border,
  },
});
