// app/navigation/AdminTabs.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
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
import { countPendingApplications } from '../services/riderApplications';

const Tab = createBottomTabNavigator<AdminTabParamList>();

type FeatherName = React.ComponentProps<typeof Feather>['name'];

// Shows how many items are waiting; nothing when the count is zero.
const icon = (name: FeatherName, count = 0) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={styles.iconContainer}>
      <Feather name={name} size={focused ? TAB_ICON_SIZE + 2 : TAB_ICON_SIZE} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );

export function AdminTabs() {
  const screenOptions = useTabBarOptions();
  // One shared fetch for all badge counts (previously each icon ran its own useAdmin()).
  const { withdrawalRequests, stats } = useAdmin();
  const pendingVendorCount = stats?.pendingVendors || 0;
  const pendingWithdrawalCount = withdrawalRequests?.filter(w => w?.status === 'pending').length || 0;
  const pendingMenuCount = stats?.pendingMenu || 0;

  const [pendingRiderCount, setPendingRiderCount] = useState(0);
  const loadRiderCount = useCallback(() => {
    countPendingApplications().then(setPendingRiderCount).catch(() => {});
  }, []);
  useEffect(() => {
    loadRiderCount();
    const sub = AppState.addEventListener('change', s => s === 'active' && loadRiderCount());
    return () => sub.remove();
  }, [loadRiderCount]);

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ tabBarIcon: icon('grid') }} />
      <Tab.Screen name="Vendors" component={AdminVendorsScreen} options={{ tabBarIcon: icon('users', pendingVendorCount) }} />
      <Tab.Screen name="Withdrawals" component={AdminWithdrawalsScreen} options={{ tabBarIcon: icon('credit-card', pendingWithdrawalCount) }} />
      <Tab.Screen name="Menu" component={AdminMenuScreen} options={{ tabBarIcon: icon('coffee', pendingMenuCount) }} />
      <Tab.Screen name="Logistics" component={AdminLogisticsScreen} options={{ tabBarIcon: icon('truck', pendingRiderCount) }} listeners={{ tabPress: loadRiderCount }} />
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
    top: -4,
    right: -8,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
});
