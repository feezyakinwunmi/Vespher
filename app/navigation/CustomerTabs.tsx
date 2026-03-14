// navigation/CustomerTabs.tsx
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { CustomerTabParamList } from './types';

// Import customer screens
import { HomeScreen } from '../screens/customer/HomeScreen';
import { ExploreScreen } from '../screens/customer/ExploreScreen';
import { VendorsScreen } from '../screens/customer/VendorScreen';
import { OrdersScreen } from '../screens/customer/OrdersScreen';
import { CartScreen } from '../screens/customer/CartScreen';
import { ProfileScreen } from '../screens/customer/ProfileScreen';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

export function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: 'white',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="home" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="search" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Vendors"
        component={VendorsScreen}
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
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="shopping-bag" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="shopping-cart" 
              size={focused ? 24 : 22} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Feather 
              name="user" 
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