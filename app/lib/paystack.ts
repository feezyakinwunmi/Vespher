// app/lib/paystack.ts
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

interface PaystackConfig {
  email: string;
  amount: number;
  reference: string;
  metadata?: any;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

// For React Native, we don't have window.PaystackPop
// Instead we'll use a webview or redirect to Paystack's checkout URL

export const initializePayment = async ({ 
  email, 
  amount, 
  reference, 
  metadata, 
  onSuccess, 
  onClose 
}: PaystackConfig) => {
  try {
    // Get your public key from environment variables
    const publicKey = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY;
    
    if (!publicKey) {
      console.error('Paystack public key not found');
      return;
    }

    // Construct Paystack checkout URL
    const paystackUrl = `https://checkout.paystack.com/${publicKey}`;
    
    // Build the URL with parameters
    const params = new URLSearchParams({
      email,
      amount: (amount * 100).toString(), // Convert to kobo
      reference,
      currency: 'NGN',
    });

    // Add metadata if provided
    if (metadata) {
      params.append('metadata', JSON.stringify(metadata));
    }

    const checkoutUrl = `${paystackUrl}?${params.toString()}`;

    // Open the payment page in a browser
    const result = await WebBrowser.openBrowserAsync(checkoutUrl);

    if (result.type === 'cancel') {
      onClose();
    } else {
      // Handle success - you'll need to verify the payment on your backend
      // For now, we'll assume success if the browser returns
      onSuccess(reference);
    }
  } catch (error) {
    console.error('Error initializing payment:', error);
    onClose();
  }
};

export const generateReference = () => {
  return `EPE-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`.toUpperCase();
};