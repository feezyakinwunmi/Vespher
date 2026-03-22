// app/navigation/AdminTabs.tsx
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';

// Import admin screens
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminVendorsScreen } from '../screens/admin/AdminVendorsScreen';
import { AdminWithdrawalsScreen } from '../screens/admin/AdminWithdrawalsScreen';
import { AdminMenuScreen } from '../screens/admin/AdminMenuScreen';
import {AdminLogisticsScreen} from '../lib/AdminLogisticsScreen';
// import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminSettingsScreen } from '../screens/admin/AdminSettingsScreen';
import { useAdmin } from '../hooks/admin/useAdmin';

export type AdminTabParamList = {
  Dashboard: undefined;
  Vendors: undefined;
  Withdrawals: undefined;
  Menu: undefined;
  Users: undefined;
  Settings: undefined;
  Logistics: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

function VendorsIconWithBadge({ color, focused }: { color: string; focused: boolean }) {
  const { pendingVendors } = useAdmin();
  const count = pendingVendors?.length || 0;

  return (
    <View style={styles.iconContainer}>
      <Feather 
        name="users" 
        size={focused ? 24 : 22} 
        color={color} 
      />
      {count > 0 && (
        <View style={styles.badge}>
        </View>
      )}
    </View>
  );
}

function WithdrawalsIconWithBadge({ color, focused }: { color: string; focused: boolean }) {
  const { withdrawalRequests } = useAdmin();
  const count = withdrawalRequests?.filter(w => w?.status === 'pending').length || 0;

  return (
    <View style={styles.iconContainer}>
      <Feather 
        name="credit-card" 
        size={focused ? 24 : 22} 
        color={color} 
      />
      {count > 0 && (
        <View style={styles.badge}>
          {/* <Text style={styles.badgeText}>{count}</Text> */}
        </View>
      )}
    </View>
  );
}

function MenuIconWithBadge({ color, focused }: { color: string; focused: boolean }) {
  const { stats } = useAdmin();
  const count = stats?.pendingMenu || 0;

  return (
    <View style={styles.iconContainer}>
      <Feather 
        name="coffee" 
        size={focused ? 24 : 22} 
        color={color} 
      />
      {count > 0 && (
        <View style={styles.badge}>
          {/* <Text style={styles.badgeText}>{count}</Text> */}
        </View>
      )}
    </View>
  );
}

export function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#666',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="grid" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />

      <Tab.Screen
        name="Vendors"
        component={AdminVendorsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <VendorsIconWithBadge color={color} focused={focused} />
          ),
        }}
      />
       <Tab.Screen
        name="Withdrawals"
        component={AdminWithdrawalsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <WithdrawalsIconWithBadge color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Menu"
        component={AdminMenuScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MenuIconWithBadge color={color} focused={focused} />
          ),
        }}
      />
        <Tab.Screen
        name="Logistics"
        component={AdminLogisticsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="truck" 
              size={focused ? 24 : 22}
              color={color}
              />
          ),
        }}
      /> 
      <Tab.Screen
        name="Settings"
        component={AdminSettingsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="settings" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />
      {/*
      
    
      */}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 85 : 70,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 5,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: Platform.OS === 'ios' ? 0 : 5,
  },
  iconContainer: {
    position: 'relative',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0a0a0a',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});