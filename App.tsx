// App.tsx
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './app/contexts/AuthContext';
import { CartProvider } from './app/contexts/CartContext';
import { HealthProvider } from './app/contexts/HealthContext';
import { SubscriptionProvider } from './app/contexts/SubscriptionContext';
import { AppNavigator } from './app/navigation';
import { LocationProvider } from './app/contexts/LocationContext';
import { TrackingProvider } from './app/contexts/TrackingContext';
import Toast from 'react-native-toast-message';
import { PaystackCheckoutProvider } from './app/contexts/PaystackCheckoutContext';

// Import mapbox config to initialize (optional)
import './app/config/googleMaps';

// ✅ Import the push notifications hook
import { usePushNotifications } from './app/hooks/usePushNotifications';
import { VoiceAssistantProvider } from './app/voice/VoiceAssistantContext';
import { VoiceEntryPoints } from './app/voice/VoiceEntryPoints';
import { FloatingMic } from './app/voice/FloatingMic';

// Create a separate component that uses the hook
function PushNotificationsHandler() {
  usePushNotifications();
  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaystackCheckoutProvider>
        <AuthProvider>
          <HealthProvider>
          <SubscriptionProvider>
          <CartProvider>
            <LocationProvider> 
              <TrackingProvider>
                {/* Hands-free ordering: "Hey Vesphe", app-icon shortcut, vesphe://voice */}
                <VoiceAssistantProvider>
                  <AppNavigator />
                  <PushNotificationsHandler />
                  <VoiceEntryPoints />
                  <FloatingMic />
                </VoiceAssistantProvider>
              </TrackingProvider>
            </LocationProvider>
          </CartProvider>
          </SubscriptionProvider>
          </HealthProvider>
        </AuthProvider>
        </PaystackCheckoutProvider>
        <Toast
          topOffset={50}           
          visibilityTime={3500}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
