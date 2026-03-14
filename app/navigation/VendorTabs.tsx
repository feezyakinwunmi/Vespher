// app/navigation/VendorTabs.tsx
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { VendorTabParamList } from './types';

// Import vendor screens
import { VendorDashboardScreen } from '../screens/vendor/VendorDashboardScreen';
import { VendorOrdersScreen } from '../screens/vendor/VendorOrdersScreen';
import { VendorMenuScreen } from '../screens/vendor/VendorMenuScreen';
import { VendorEarningsScreen } from '../screens/vendor/VendorEarningsScreen';
import { VendorSettingsScreen } from '../screens/vendor/VendorSettingsScreen';
import { VendorHistoryScreen } from '../screens/vendor/VendorHistoryScreen';
import { VendorAnalyticsScreen } from '../screens/vendor/VendorAnalyticsScreen';


const Tab = createBottomTabNavigator<VendorTabParamList>();

export function VendorTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: '#f97316', // Orange
        tabBarInactiveTintColor: '#666',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={VendorDashboardScreen}
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
        name="Orders"
        component={VendorOrdersScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="package" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Menu"
        component={VendorMenuScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="coffee" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />  
       <Tab.Screen
        name="History"
        component={VendorHistoryScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="clock" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="VendorAnalytics"
        component={VendorAnalyticsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => ( 
            <Feather 
              name="bar-chart-2" 
              size={focused ? 24 : 22}
              color={color}            />
          ),
        }}
      />
       <Tab.Screen
        name="Earnings"
        component={VendorEarningsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="dollar-sign" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />
       <Tab.Screen
        name="Settings"
        component={VendorSettingsScreen}
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
});