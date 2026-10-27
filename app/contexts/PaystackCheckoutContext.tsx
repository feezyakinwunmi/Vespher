// app/contexts/PaystackCheckoutContext.tsx
// Paystack checkout for orders, promotions and Pro. The server (init-payment) starts
// the transaction with the amount and vendor split from the database; this shows
// Paystack's hosted checkout in a WebView, then the server (verify-payment) confirms it.
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { functionErrorMessage } from '../utils/paystack';

export type PaymentKind = 'order' | 'promotion' | 'subscription';
// paid: confirmed by the server. pending: customer may have paid but it isn't confirmed
// yet. cancelled: closed without paying. failed: could not start the payment.
export type PaymentResult = { status: 'paid' | 'pending' | 'cancelled' | 'failed'; reference?: string; message?: string };

interface CheckoutSession {
  kind: PaymentKind;
  id: string;
  url: string;
  callbackUrl: string;
  reference: string;
}

interface PaystackCheckoutValue {
  // saveCard: keep the card on Paystack for one-tap and voice checkout next time.
  pay: (kind: PaymentKind, id: string, options?: { saveCard?: boolean }) => Promise<PaymentResult>;
}

const PaystackCheckoutContext = createContext<PaystackCheckoutValue | undefined>(undefined);

// Paystack's own "close checkout" address.
const PAYSTACK_CLOSE_URL = 'https://standard.paystack.co/close';

export function PaystackCheckoutProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [verifying, setVerifying] = useState(false);
  const resolver = useRef<((result: PaymentResult) => void) | null>(null);
  const finished = useRef(false);

  const verify = async (s: CheckoutSession): Promise<PaymentResult> => {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { kind: s.kind, id: s.id, reference: s.reference },
    });
    if (!error && data?.status) return { status: 'paid', reference: s.reference };
    const message = error ? await functionErrorMessage(error, 'Payment not confirmed') : data?.message;
    return { status: 'pending', reference: s.reference, message };
  };

  const finish = async (s: CheckoutSession, userClosed: boolean) => {
    if (finished.current) return;
    finished.current = true;
    setVerifying(true);
    let result = await verify(s);
    // Closed without completing payment: treat "not paid" as a cancellation.
    if (userClosed && result.status !== 'paid') result = { status: 'cancelled', reference: s.reference };
    setVerifying(false);
    setSession(null);
    resolver.current?.(result);
    resolver.current = null;
  };

  const pay = useCallback(async (kind: PaymentKind, id: string, options?: { saveCard?: boolean }): Promise<PaymentResult> => {
    const { data, error } = await supabase.functions.invoke('init-payment', {
      body: { kind, id, save_card: options?.saveCard === true },
    });
    if (error || !data?.status) {
      const message = error ? await functionErrorMessage(error, 'Could not start payment') : data?.message;
      return { status: 'failed', message: message || 'Could not start payment' };
    }
    finished.current = false;
    return new Promise<PaymentResult>(resolve => {
      resolver.current = resolve;
      setSession({
        kind,
        id,
        url: data.data.authorization_url,
        callbackUrl: data.data.callback_url,
        reference: data.data.reference,
      });
    });
  }, []);

  const handleUrl = (url: string): boolean => {
    if (!session) return true;
    if (url.startsWith(session.callbackUrl)) {
      finish(session, false);
      return false;
    }
    if (url.startsWith(PAYSTACK_CLOSE_URL)) {
      finish(session, true);
      return false;
    }
    return true;
  };

  const confirmClose = () => {
    if (!session) return;
    Alert.alert('Cancel payment?', 'Your order will not be placed unless payment is completed.', [
      { text: 'Continue paying', style: 'cancel' },
      { text: 'Cancel payment', style: 'destructive', onPress: () => finish(session, true) },
    ]);
  };

  return (
    <PaystackCheckoutContext.Provider value={{ pay }}>
      {children}
      <Modal visible={!!session} animationType="slide" onRequestClose={confirmClose}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Feather name="lock" size={14} color="#10b981" />
              <Text style={styles.headerTitle}>Secure payment by Paystack</Text>
            </View>
            <TouchableOpacity onPress={confirmClose} style={styles.closeButton} disabled={verifying}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {session && (
            <WebView
              source={{ uri: session.url }}
              style={styles.webview}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loading}>
                  <ActivityIndicator color="#f97316" size="large" />
                </View>
              )}
              onShouldStartLoadWithRequest={request => handleUrl(request.url)}
              onNavigationStateChange={state => {
                handleUrl(state.url);
              }}
            />
          )}
          {verifying && (
            <View style={styles.verifyingOverlay}>
              <ActivityIndicator color="#f97316" size="large" />
              <Text style={styles.verifyingText}>Confirming your payment…</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </PaystackCheckoutContext.Provider>
  );
}

export function usePaystackCheckout() {
  const context = useContext(PaystackCheckoutContext);
  if (!context) throw new Error('usePaystackCheckout must be used within PaystackCheckoutProvider');
  return context;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  webview: { flex: 1, backgroundColor: '#fff' },
  loading: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  verifyingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  verifyingText: { color: '#fff', fontSize: 15 },
});
