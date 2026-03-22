// app/components/FlutterwavePayment.tsx
import React, { useState, useRef } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';

interface FlutterwavePaymentProps {
  visible: boolean;
  amount: number;
  email: string;
  reference: string;
  customerName?: string;
  phone?: string;
  subaccountId?: string;
  isScheduled?: boolean;
  onSuccess: (response: any) => void;
  onClose: () => void;
  onPaymentComplete?: (paymentData: any) => void;
}

export function FlutterwavePayment({
  visible,
  amount,
  email,
  reference,
  customerName,
  phone,
  subaccountId,
  isScheduled = false,
  onSuccess,
  onClose,
  onPaymentComplete
}: FlutterwavePaymentProps) {
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  
  const publicKey = process.env.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;

  if (!publicKey) {
    Alert.alert('Error', 'Flutterwave public key not configured');
    return null;
  }

  // Generate subaccount input if subaccountId is provided
  const subaccountInput = subaccountId 
    ? `<input type="hidden" name="subaccounts[0][id]" value="${subaccountId}">`
    : '';

  const preauthInput = isScheduled 
    ? `<input type="hidden" name="preauthorize" value="true">`
    : '';

  // Updated HTML with better fee capture
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        body { 
          margin: 0; 
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0a0a0a;
          color: white;
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .container {
          width: 100%;
          max-width: 400px;
          padding: 20px;
          text-align: center;
        }
        .loader {
          border: 4px solid #2a2a2a;
          border-top: 4px solid #f97316;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .amount {
          font-size: 32px;
          font-weight: bold;
          color: #f97316;
          margin: 20px 0;
        }
        .info {
          color: #666;
          font-size: 12px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container" id="container">
        <h2>Vespher Payment</h2>
        <div class="amount">₦${amount.toLocaleString()}</div>
        <div class="loader"></div>
        <div class="info">Redirecting to payment page...</div>
      </div>

      <form id="paymentForm" method="POST" action="https://checkout.flutterwave.com/v3/hosted/pay" style="display:none;">
        <input type="hidden" name="public_key" value="${publicKey}">
        <input type="hidden" name="tx_ref" value="${reference}">
        <input type="hidden" name="amount" value="${amount}">
        <input type="hidden" name="currency" value="NGN">
        <input type="hidden" name="customer[email]" value="${email}">
        <input type="hidden" name="customer[name]" value="${customerName || ''}">
        <input type="hidden" name="customer[phonenumber]" value="${phone || ''}">
        <input type="hidden" name="payment_options" value="card,ussd,banktransfer">
        <input type="hidden" name="redirect_url" value="about:blank">
        ${subaccountInput}
        ${preauthInput}
      </form>

      <script>
        // Function to verify transaction and get fee
        async function getTransactionDetails(txRef, transactionId) {
          try {
            // This is a simulation - in production, you'd call your backend
            // The actual fee is returned in the webhook
            const response = await fetch(\`https://api.flutterwave.com/v3/transactions/\${transactionId}/verify\`, {
              headers: {
                'Authorization': 'Bearer ${publicKey}'
              }
            });
            const data = await response.json();
            if (data.status === 'success') {
              return {
                fee: data.data.charged_amount - data.data.amount,
                charged_amount: data.data.charged_amount,
                flutterwave_fee: data.data.flw_fee || 0
              };
            }
          } catch (error) {
            console.error('Error fetching transaction:', error);
          }
          return null;
        }

        // Auto-submit the form after a short delay
        window.onload = function() {
          setTimeout(function() {
            document.getElementById('paymentForm').submit();
          }, 1500);
        };

        // Monitor for successful payment
        setInterval(function() {
          if (window.location.href.includes('status=successful')) {
            const urlParams = new URLSearchParams(window.location.search);
            const transactionId = urlParams.get('transaction_id');
            const txRef = urlParams.get('tx_ref');
            const flwRef = urlParams.get('flw_ref');
            
            // Try to get fee from URL (sometimes included)
            let fee = urlParams.get('fee');
            let chargedAmount = urlParams.get('charged_amount');
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              event: 'success',
              reference: txRef || '${reference}',
              transaction_id: transactionId,
              flw_ref: flwRef,
              is_preauth: ${isScheduled},
              fee: fee ? parseFloat(fee) : null,
              charged_amount: chargedAmount ? parseFloat(chargedAmount) : null,
              url_data: window.location.href
            }));
          }
        }, 1000);
      </script>
    </body>
    </html>
  `;

 // In FlutterwavePayment.tsx, update the handleNavigationStateChange and handleMessage functions:

const handleNavigationStateChange = (navState: any) => {
  const { url } = navState;
  console.log('🔍 Navigation URL:', url);
  console.log('🔍 URL includes status?', {
    hasStatus: url.includes('status'),
    hasCompleted: url.includes('completed'),
    hasSuccessful: url.includes('successful'),
    hasCancelled: url.includes('cancelled')
  });

  // Log all URL parameters for debugging
  if (url.includes('?')) {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const params: any = {};
    urlParams.forEach((value, key) => {
      params[key] = value;
    });
    console.log('🔍 URL Parameters:', params);
  }

  // Check for successful payment
  if (url.includes('status=completed') || url.includes('status=successful')) {
    console.log('✅ Payment successful detected!');
    
    // Extract all possible transaction details
    const transactionId = url.match(/transaction_id=([^&]*)/)?.[1];
    const txRef = url.match(/tx_ref=([^&]*)/)?.[1] || reference;
    const flwRef = url.match(/flw_ref=([^&]*)/)?.[1];
    const fee = url.match(/fee=([^&]*)/)?.[1];
    const chargedAmount = url.match(/charged_amount=([^&]*)/)?.[1];
    const amountFromUrl = url.match(/amount=([^&]*)/)?.[1];
    
    console.log('💰 Extracted payment data:', {
      transactionId,
      txRef,
      flwRef,
      fee,
      chargedAmount,
      amountFromUrl,
      originalAmount: amount
    });
    
    // Create payment data object with all possible fields
    const paymentData = {
      tx_ref: txRef,
      transaction_id: transactionId,
      flw_ref: flwRef,
      amount: amount,
      status: 'successful',
      is_preauth: isScheduled,
      fee: fee ? parseFloat(fee) : null,
      charged_amount: chargedAmount ? parseFloat(chargedAmount) : null,
      url: url,
      raw_params: Object.fromEntries(new URLSearchParams(url.split('?')[1] || ''))
    };
    
    console.log('📦 Sending payment data to onPaymentComplete:', paymentData);
    
    // Call onPaymentComplete if provided
    if (onPaymentComplete) {
      onPaymentComplete(paymentData);
    }
    
    console.log('📤 Calling onSuccess with:', { 
      tx_ref: txRef, 
      status: 'successful',
      transaction_id: transactionId,
      flw_ref: flwRef,
      is_preauth: isScheduled,
      fee: fee ? parseFloat(fee) : null,
      charged_amount: chargedAmount ? parseFloat(chargedAmount) : null
    });
    
    onSuccess({ 
      tx_ref: txRef, 
      status: 'successful',
      transaction_id: transactionId,
      flw_ref: flwRef,
      is_preauth: isScheduled,
      fee: fee ? parseFloat(fee) : null,
      charged_amount: chargedAmount ? parseFloat(chargedAmount) : null,
      raw_response: paymentData
    });
  }
  
  // Check for cancelled payment
  if (url.includes('status=cancelled')) {
    console.log('❌ Payment cancelled detected');
    onClose();
  }
};

const handleMessage = (event: any) => {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    console.log('📨 Message from WebView:', data);
    
    if (data.event === 'success') {
      console.log('✅ Success message received with data:', data);
      
      // Create payment data from message with all fields
      const paymentData = {
        tx_ref: data.reference,
        transaction_id: data.transaction_id,
        flw_ref: data.flw_ref,
        amount: amount,
        status: 'successful',
        is_preauth: data.is_preauth || isScheduled,
        fee: data.fee || null,
        charged_amount: data.charged_amount || null,
        raw_data: data
      };
      
      console.log('📦 Sending message payment data:', paymentData);
      
      // Call onPaymentComplete if provided
      if (onPaymentComplete) {
        onPaymentComplete(paymentData);
      }
      
      console.log('📤 Calling onSuccess from message with:', {
        tx_ref: data.reference,
        transaction_id: data.transaction_id,
        flw_ref: data.flw_ref,
        is_preauth: data.is_preauth || isScheduled,
        fee: data.fee || null,
        charged_amount: data.charged_amount || null
      });
      
      onSuccess({ 
        tx_ref: data.reference,
        transaction_id: data.transaction_id,
        flw_ref: data.flw_ref,
        is_preauth: data.is_preauth || isScheduled,
        fee: data.fee || null,
        charged_amount: data.charged_amount || null,
        raw_message: data
      });
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error);
  }
};

  // const handleMessage = (event: any) => {
  //   try {
  //     const data = JSON.parse(event.nativeEvent.data);
  //     console.log('Message from WebView:', data);
      
  //     if (data.event === 'success') {
  //       // Create payment data from message with fee
  //       const paymentData = {
  //         tx_ref: data.reference,
  //         transaction_id: data.transaction_id,
  //         flw_ref: data.flw_ref,
  //         amount: amount,
  //         status: 'successful',
  //         is_preauth: data.is_preauth || isScheduled,
  //         fee: data.fee || null,
  //         charged_amount: data.charged_amount || null
  //       };
        
  //       // Call onPaymentComplete if provided
  //       if (onPaymentComplete) {
  //         onPaymentComplete(paymentData);
  //       }
        
  //       onSuccess({ 
  //         tx_ref: data.reference,
  //         transaction_id: data.transaction_id,
  //         flw_ref: data.flw_ref,
  //         is_preauth: data.is_preauth || isScheduled,
  //         fee: data.fee || null,
  //         charged_amount: data.charged_amount || null
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Error parsing message:', error);
  //   }
  // };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError('Failed to load payment page. Please try again.');
    setLoading(false);
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isScheduled ? 'Authorize Payment' : 'Pay with Card'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={50} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={retry} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={styles.webview}
            onNavigationStateChange={handleNavigationStateChange}
            onMessage={handleMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={handleError}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
          />
        )}
        
        {/* Info text for scheduled orders */}
        {isScheduled && !error && (
          <View style={styles.infoFooter}>
            <Feather name="info" size={14} color="#f97316" />
            <Text style={styles.infoFooterText}>
              Your card will be authorized but not charged yet. Payment will be processed when your order is delivered.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop:40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#f97316',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  infoFooterText: {
    flex: 1,
    fontSize: 12,
    color: '#f97316',
    lineHeight: 18,
  },
});