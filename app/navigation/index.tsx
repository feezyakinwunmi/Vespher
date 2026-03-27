// navigation/index.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from './types';
import { MessagingScreen } from '../screens/MessagingScreen';
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
import {CreatePromotionScreen} from '../screens/vendor/CreatePromotionScreen';
import { PromotionsScreen } from '../screens/vendor/PromotionsScreen';
import { PromotionDetailsScreen } from '../screens/vendor/PromotionDetailsScreen';

// Admin Screens
import { AdminOrderDetailsScreen } from '../screens/admin/AdminOrderDetailsScreen';
import { AdminVendorsScreen } from '../screens/admin/AdminVendorsScreen';
import { AdminWithdrawalsScreen } from '../screens/admin/AdminWithdrawalsScreen';
import { AdminMenuScreen } from '../screens/admin/AdminMenuScreen';
import { AdminLogisticsScreen } from '../lib/AdminLogisticsScreen';
import { AdminCreateLogisticScreen } from '../screens/admin/AdminCreateLogisticScreen';
import { AdminSettingsScreen } from '../screens/admin/AdminSettingsScreen';
import { AdminBusinessRequestsScreen } from '../screens/admin/AdminBusinessRequestsScreen';
import { AdminAllOrdersScreen } from '../screens/admin/AdminAllOrdersScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminAnalyticsScreen } from '../screens/admin/AdminAnalyticsScreen';
import { AdminPromotionsScreen } from '../screens/admin/AdminPromotionsScreen';
import { OutstandingPaymentsScreen } from '../screens/admin/OutstandingPaymentsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Warning Modal for Rider/Business users
function WrongAppWarningModal({ 
  visible, 
  onClose,
  userRole 
}: { 
  visible: boolean; 
  onClose: () => void;
  userRole: string;
}) {
  const { signOut } = useAuth();

  const handleDownloadApp = () => {
    // Open app store link - replace with your actual app store URL
    Linking.openURL('https://play.google.com/store/apps/details?id=com.vespher.logistics');
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const roleText = userRole === 'rider' ? 'Rider' : 'Business';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.warningIconContainer}>
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              style={styles.warningIconGradient}
            >
              <Feather name="alert-triangle" size={40} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.warningTitle}>Wrong App</Text>
          
          <Text style={styles.warningMessage}>
            This app is for <Text style={styles.highlightText}>Customers</Text> and{' '}
            <Text style={styles.highlightText}>Vendors</Text> only.
          </Text>

          <Text style={styles.warningDescription}>
            You are logged in as a <Text style={styles.roleText}>{roleText}</Text>. 
            Please download the Vespher Logistics app for {roleText.toLowerCase()} services.
          </Text>

          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadApp}
          >
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.downloadButtonGradient}
            >
              <Feather name="download" size={18} color="#fff" />
              <Text style={styles.downloadButtonText}>Download Vespher Logistics</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Feather name="log-out" size={16} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [showWrongAppModal, setShowWrongAppModal] = useState(false);

  if (isLoading) {
    return <SplashScreen />;
  }

  // If user is suspended → show suspension screen (full-screen, no tabs)
  if (user && user.is_suspended) {
    return <SuspendedScreen />;
  }

  // If user is rider or business, show warning modal
  if (user && (user.role === 'rider' || user.role === 'business')) {
    return (
      <>
        <SplashScreen />
        <WrongAppWarningModal
          visible={true}
          onClose={() => setShowWrongAppModal(false)}
          userRole={user.role}
        />
      </>
    );
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
          <Stack.Screen name="Messaging" component={MessagingScreen}/>
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
                        <Stack.Screen name="Messaging" component={MessagingScreen}/>

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
              <Stack.Screen name="CreatePromotion" component={CreatePromotionScreen}/>
              <Stack.Screen name="Promotions" component={PromotionsScreen} />
              <Stack.Screen name ="PromotionDetails" component={PromotionDetailsScreen} />
          <Stack.Screen name="Messaging" component={MessagingScreen}/>


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
              <Stack.Screen name="OutstandingPayments" component={OutstandingPaymentsScreen}/>
              <Stack.Screen name="AdminPromotions" component={AdminPromotionsScreen} />
          <Stack.Screen name="Messaging" component={MessagingScreen}/>

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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  warningIconContainer: {
    marginBottom: 16,
  },
  warningIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f97316',
    marginBottom: 12,
  },
  warningMessage: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  highlightText: {
    color: '#f97316',
    fontWeight: '600',
  },
  warningDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  roleText: {
    color: '#f43f5e',
    fontWeight: '600',
  },
  downloadButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  downloadButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
});