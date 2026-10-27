// app/navigation/AdminTabs.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { AdminTabParamList } from './types';
import { useTabBarOptions, TAB_ICON_SIZE } from './tabBarOptions';

import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminVendorsScreen } from '../screens/admin/AdminVendorsScreen';
import { AdminWithdrawalsScreen } from '../screens/admin/AdminWithdrawalsScreen';
import { AdminMenuScreen } from '../screens/admin/AdminMenuScreen';
import { AdminLogisticsScreen } from '../lib/AdminLogisticsScreen';
import { AdminSettingsScreen } from '../screens/admin/AdminSettingsScreen';
import { useAdmin } from '../hooks/admin/useAdmin';

const Tab = createBottomTabNavigator<AdminTabParamList>();

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const icon = (name: FeatherName, showBadge = false) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={styles.iconContainer}>
      <Feather name={name} size={focused ? TAB_ICON_SIZE + 2 : TAB_ICON_SIZE} color={color} />
      {showBadge && <View style={styles.badge} />}
    </View>
  );

export function AdminTabs() {
  const screenOptions = useTabBarOptions();
  // One shared fetch for all badge counts (previously each icon ran its own useAdmin()).
  const { pendingVendors, withdrawalRequests, stats } = useAdmin();
  const hasPendingVendors = (pendingVendors?.length || 0) > 0;
  const hasPendingWithdrawals = (withdrawalRequests?.filter(w => w?.status === 'pending').length || 0) > 0;
  const hasPendingMenu = (stats?.pendingMenu || 0) > 0;

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ tabBarIcon: icon('grid') }} />
      <Tab.Screen name="Vendors" component={AdminVendorsScreen} options={{ tabBarIcon: icon('users', hasPendingVendors) }} />
      <Tab.Screen name="Withdrawals" component={AdminWithdrawalsScreen} options={{ tabBarIcon: icon('credit-card', hasPendingWithdrawals) }} />
      <Tab.Screen name="Menu" component={AdminMenuScreen} options={{ tabBarIcon: icon('coffee', hasPendingMenu) }} />
      <Tab.Screen name="Logistics" component={AdminLogisticsScreen} options={{ tabBarIcon: icon('truck') }} />
      <Tab.Screen name="Settings" component={AdminSettingsScreen} options={{ tabBarIcon: icon('settings') }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#0a0a0a',
  },
});
