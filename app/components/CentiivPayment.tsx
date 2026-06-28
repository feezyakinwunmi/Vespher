import React, { useState, useRef } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';

interface CentiivPaymentProps {
  visible: boolean;
  amount: number;
  email: string;
  reference: string;
  customerName?: string;
  phone?: string;
  onSuccess: (response: any) => void;
  onClose: () => void;
}

export function CentiivPayment({
  visible,
  amount,
  email,
  reference,
  customerName,
  phone,
  onSuccess,
  onClose,
}: CentiivPaymentProps) {
  
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const CENTIIV_PUBLIC_KEY = process.env.EXPO_PUBLIC_CENTIIV_PUBLIC_KEY; // Add this to .env

  if (!CENTIIV_PUBLIC_KEY) {
    return (
      <Modal visible={visible}>
        <View style={styles.errorContainer}>
          <Text style={{ color: 'red' }}>Centiiv Public Key not configured</Text>
        </View>
      </Modal>
    );
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin:0; padding:20px; background:#0a0a0a; color:white; font-family:sans-serif; }
        .loader { border:5px solid #333; border-top:5px solid #f97316; border-radius:50%; width:50px; height:50px; animation:spin 1s linear infinite; margin:40px auto; }
        @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
      </style>
    </head>
    <body>
      <div style="text-align:center; margin-top:50px;">
        <h2>Centiiv Secure Checkout</h2>
        <p style="font-size:28px; color:#f97316; font-weight:bold;">₦${amount.toLocaleString()}</p>
        <div class="loader"></div>
        <p>Redirecting to secure payment...</p>
      </div>

      <form id="paymentForm" method="POST" action="https://checkout.centiiv.io" style="display:none;">
        <input type="hidden" name="public_key" value="${CENTIIV_PUBLIC_KEY}">
        <input type="hidden" name="tx_ref" value="${reference}">
        <input type="hidden" name="amount" value="${amount}">
        <input type="hidden" name="currency" value="NGN">
        <input type="hidden" name="customer_email" value="${email}">
        <input type="hidden" name="customer_name" value="${customerName || ''}">
        <input type="hidden" name="customer_phone" value="${phone || ''}">
        <input type="hidden" name="redirect_url" value="about:blank">
      </form>

      <script>
        window.onload = function() {
          setTimeout(() => {
            document.getElementById('paymentForm').submit();
          }, 1500);
        };

        // Listen for success
        setInterval(() => {
          if (window.location.href.includes('success') || window.location.href.includes('successful')) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              event: 'success',
              reference: '${reference}',
              status: 'successful'
            }));
          }
        }, 1000);
      </script>
    </body>
    </html>
  `;

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url;
    if (url.includes('success') || url.includes('successful')) {
      onSuccess({
        tx_ref: reference,
        status: 'successful',
        gateway: 'centiiv'
      });
    }
    if (url.includes('cancel') || url.includes('failed')) {
      onClose();
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.event === 'success') {
        onSuccess(data);
      }
    } catch (e) {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Centiiv Payment</Text>
        </View>

        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          javaScriptEnabled={true}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 16 },
  webview: { flex: 1 },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
});