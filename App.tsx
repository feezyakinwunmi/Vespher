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



export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
                    <LocationProvider> 
          <TrackingProvider> 
            <AppNavigator />
          </TrackingProvider>
                    </LocationProvider>
          </CartProvider>
        </AuthProvider>
            <Toast
  topOffset={50}           
  visibilityTime={3500}
/>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}