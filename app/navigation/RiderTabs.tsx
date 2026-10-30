// app/navigation/RiderTabs.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { RiderTabParamList } from './types';
import { useTabBarOptions, TAB_ICON_SIZE } from './tabBarOptions';
import { useRider } from '../contexts/RiderContext';

// Delivery details and withdraw are stack screens opened from these tabs.
import { RiderHomeScreen } from '../screens/rider/RiderHomeScreen';
import { RiderJobsScreen } from '../screens/rider/RiderJobsScreen';
import { RiderEarningsScreen } from '../screens/rider/RiderEarningsScreen';
import { RiderProfileScreen } from '../screens/rider/RiderProfileScreen';

const Tab = createBottomTabNavigator<RiderTabParamList>();

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const icon = (name: FeatherName, showBadge = false) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={styles.iconContainer}>
      <Feather name={name} size={focused ? TAB_ICON_SIZE + 2 : TAB_ICON_SIZE} color={color} />
      {showBadge && <View style={styles.badge} />}
    </View>
  );

export function RiderTabs() {
  const screenOptions = useTabBarOptions();
  const { isOnline, available, active } = useRider();
  const hasJobs = active.length > 0 || (isOnline && available.length > 0);

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home" component={RiderHomeScreen} options={{ tabBarIcon: icon('home') }} />
      <Tab.Screen name="Jobs" component={RiderJobsScreen} options={{ tabBarIcon: icon('package', hasJobs), title: 'Deliveries' }} />
      <Tab.Screen name="Earnings" component={RiderEarningsScreen} options={{ tabBarIcon: icon('dollar-sign') }} />
      <Tab.Screen name="Profile" component={RiderProfileScreen} options={{ tabBarIcon: icon('user') }} />
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
