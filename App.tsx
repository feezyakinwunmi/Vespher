// App.tsx
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './app/contexts/AuthContext';
import { CartProvider } from './app/contexts/CartContext';
import { AppNavigator } from './app/navigation';
import { LocationProvider } from './app/contexts/LocationContext';
import { TrackingProvider } from './app/contexts/TrackingContext';
import Toast from 'react-native-toast-message';
import { PaystackProvider } from 'react-native-paystack-webview';

// Import mapbox config to initialize (optional)
import './app/config/googleMaps';

// ✅ Import the push notifications hook
import { usePushNotifications } from './app/hooks/usePushNotifications';

// Create a separate component that uses the hook
function PushNotificationsHandler() {
  usePushNotifications();
  return null;
}

export default function App() {
  const paystackPublicKey = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaystackProvider publicKey={paystackPublicKey} currency="NGN" defaultChannels={['card', 'bank', 'ussd', 'bank_transfer']}>
        <AuthProvider>
          <CartProvider>
            <LocationProvider> 
              <TrackingProvider> 
                <AppNavigator />
                {/* ✅ Add push notifications handler */}
                <PushNotificationsHandler />
              </TrackingProvider>
            </LocationProvider>
          </CartProvider>
        </AuthProvider>
        </PaystackProvider>
        <Toast
          topOffset={50}           
          visibilityTime={3500}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
