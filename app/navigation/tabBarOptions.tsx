// app/navigation/tabBarOptions.tsx
// Shared bottom-tab styling for the customer, vendor and admin navigators.
import React from 'react';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

export const TAB_ACTIVE_COLOR = '#f97316';
export const TAB_INACTIVE_COLOR = '#8a8a8a';
export const TAB_ICON_SIZE = 22;

const TabBarBackground = () => (
  <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
);

export function useTabBarOptions(): BottomTabNavigationOptions {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);

  return {
    headerShown: false,
    tabBarStyle: {
      position: 'absolute',
      height: 56 + bottomPadding,
      paddingTop: 6,
      paddingBottom: bottomPadding,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      elevation: 0,
    },
    tabBarBackground: TabBarBackground,
    tabBarActiveTintColor: TAB_ACTIVE_COLOR,
    tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
    tabBarShowLabel: true,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
    tabBarHideOnKeyboard: true,
  };
}
