// navigation/index.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from './types';

// Auth Screens
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { CustomerSignupScreen } from '../screens/CustomerSignupScreen';
import { VendorSignupScreen } from '../screens/VendorSignupScreen';
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';

// Suspension Screen
import { SuspendedScreen } from '../screens/SuspendedScreen';

// Main Tabs
import { CustomerTabs } from './CustomerTabs';
import { VendorTabs } from './VendorTabs';
import { AdminTabs } from './AdminTabs';

// Customer Screens
import { VendorDetailsScreen } from '../screens/customer/VendorDetailsScreen';
import { OrderTrackingScreen } from '../screens/customer/OrderTrackingScreen';
import { AddressesScreen } from '../screens/customer/Addresses';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { FavoritesScreen } from '../screens/customer/FavoritesScreen';
import { SupportScreen } from '../screens/customer/SupportScreen';
import { PrivacyScreen } from '../screens/customer/PrivacyScreen';
import { CartScreen } from '../screens/customer/CartScreen';

// Vendor Screens
import { VendorMenuScreen } from '../screens/vendor/VendorMenuScreen';
import { VendorOrdersScreen } from '../screens/vendor/VendorOrdersScreen';
import { VendorOrderDetailsScreen } from '../screens/vendor/VendorOrderDetailsScreen';
import { VendorAnalyticsScreen } from '../screens/vendor/VendorAnalyticsScreen';
import { VendorAddressesScreen } from '../screens/vendor/VendorAddressesScreen';

// Admin Screens
import { AdminOrderDetailsScreen } from '../screens/admin/AdminOrderDetailsScreen';
import { AdminVendorsScreen } from '../screens/admin/AdminVendorsScreen';
import { AdminWithdrawalsScreen } from '../screens/admin/AdminWithdrawalsScreen';
import { AdminMenuScreen } from '../screens/admin/AdminMenuScreen';
import { AdminLogisticsScreen } from '../screens/admin/AdminLogisticsScreen';
import { AdminCreateLogisticScreen } from '../screens/admin/AdminCreateLogisticScreen';
import { AdminSettingsScreen } from '../screens/admin/AdminSettingsScreen';
import { AdminBusinessRequestsScreen } from '../screens/admin/AdminBusinessRequestsScreen';
import { AdminAllOrdersScreen } from '../screens/admin/AdminAllOrdersScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminAnalyticsScreen } from '../screens/admin/AdminAnalyticsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  // If user is suspended → show suspension screen (full-screen, no tabs)
  if (user && user.is_suspended) {
    return <SuspendedScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="CustomerSignup" component={CustomerSignupScreen} />
          <Stack.Screen name="VendorSignup" component={VendorSignupScreen} />
          <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
        </>
      ) : (
        <>
          {user.role === 'customer' && (
            <>
              <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
              <Stack.Screen name="VendorDetails" component={VendorDetailsScreen} />
              <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
              <Stack.Screen name="Addresses" component={AddressesScreen} />
              <Stack.Screen name="Favorites" component={FavoritesScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="Support" component={SupportScreen} />
              <Stack.Screen name="Privacy" component={PrivacyScreen} />
              <Stack.Screen name="Cart" component={CartScreen} />
            </>
          )}
          {user.role === 'vendor' && (
            <>
              <Stack.Screen name="VendorTabs" component={VendorTabs} />
              <Stack.Screen name="VendorMenu" component={VendorMenuScreen} />
              <Stack.Screen name="VendorOrders" component={VendorOrdersScreen} />
              <Stack.Screen name="VendorOrderDetails" component={VendorOrderDetailsScreen} />
              <Stack.Screen name="VendorAnalytics" component={VendorAnalyticsScreen} />
              <Stack.Screen name="VendorAddresses" component={VendorAddressesScreen} />
            </>
          )}
          {user.role === 'admin' && (
            <>
              <Stack.Screen name="AdminTabs" component={AdminTabs} />
              <Stack.Screen name="AdminOrderDetails" component={AdminOrderDetailsScreen} />
              <Stack.Screen name="AdminVendors" component={AdminVendorsScreen} />
              <Stack.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} />
              <Stack.Screen name="AdminMenu" component={AdminMenuScreen} />
              <Stack.Screen name="AdminLogistics" component={AdminLogisticsScreen} />
              <Stack.Screen name="AdminCreateLogistic" component={AdminCreateLogisticScreen} />
              <Stack.Screen name="AdminBusinessRequests" component={AdminBusinessRequestsScreen} />
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
              <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
              <Stack.Screen name="AdminAllOrders" component={AdminAllOrdersScreen} />
            </>
          )}
        </>
      )}
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { isReady } = useAuth();

  return (
    <NavigationContainer>
      {isReady ? <AppContent /> : <SplashScreen />}
    </NavigationContainer>
  );
}