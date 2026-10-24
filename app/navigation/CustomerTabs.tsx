// navigation/CustomerTabs.tsx
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import type { RootStackParamList } from './types';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { CustomerTabParamList } from './types';
import { useTabBarOptions, TAB_ICON_SIZE } from './tabBarOptions';

// Cart and Profile live in the root stack and are opened from the CustomerHeader.
import { HomeScreen } from '../screens/customer/HomeScreen';
import { ExploreScreen } from '../screens/customer/ExploreScreen';
import { VendorsScreen } from '../screens/customer/VendorScreen';
import { OrdersScreen } from '../screens/customer/OrdersScreen';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

const icon = (name: React.ComponentProps<typeof Feather>['name']) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <Feather name={name} size={focused ? TAB_ICON_SIZE + 2 : TAB_ICON_SIZE} color={color} />
  );

export function CustomerTabs() {
  const screenOptions = useTabBarOptions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isNewUser, clearNewUser } = useAuth();

  // First Google sign-up: open Profile so they can add phone, address and health info.
  useEffect(() => {
    if (!isNewUser) return;
    const timer = setTimeout(() => {
      navigation.navigate('Profile');
      clearNewUser();
    }, 400);
    return () => clearTimeout(timer);
  }, [isNewUser]);


  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: icon('home') }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ tabBarIcon: icon('search') }} />
      <Tab.Screen name="Vendors" component={VendorsScreen} options={{ tabBarIcon: icon('grid') }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: icon('package') }} />
    </Tab.Navigator>
  );
}
