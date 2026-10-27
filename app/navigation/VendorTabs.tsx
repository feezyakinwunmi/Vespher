// app/navigation/VendorTabs.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { VendorTabParamList } from './types';
import { useTabBarOptions, TAB_ICON_SIZE } from './tabBarOptions';

// History and Analytics are stack screens linked from the dashboard.
import { VendorDashboardScreen } from '../screens/vendor/VendorDashboardScreen';
import { VendorOrdersScreen } from '../screens/vendor/VendorOrdersScreen';
import { VendorMenuScreen } from '../screens/vendor/VendorMenuScreen';
import { VendorEarningsScreen } from '../screens/vendor/VendorEarningsScreen';
import { VendorSettingsScreen } from '../screens/vendor/VendorSettingsScreen';

const Tab = createBottomTabNavigator<VendorTabParamList>();

const icon = (name: React.ComponentProps<typeof Feather>['name']) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <Feather name={name} size={focused ? TAB_ICON_SIZE + 2 : TAB_ICON_SIZE} color={color} />
  );

export function VendorTabs() {
  const screenOptions = useTabBarOptions();

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Dashboard" component={VendorDashboardScreen} options={{ tabBarIcon: icon('grid') }} />
      <Tab.Screen name="Orders" component={VendorOrdersScreen} options={{ tabBarIcon: icon('package') }} />
      <Tab.Screen name="Menu" component={VendorMenuScreen} options={{ tabBarIcon: icon('coffee') }} />
      <Tab.Screen name="Earnings" component={VendorEarningsScreen} options={{ tabBarIcon: icon('dollar-sign') }} />
      <Tab.Screen name="Settings" component={VendorSettingsScreen} options={{ tabBarIcon: icon('settings') }} />
    </Tab.Navigator>
  );
}
