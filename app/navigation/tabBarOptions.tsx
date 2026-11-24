// app/navigation/tabBarOptions.tsx
// Shared bottom-tab styling for the customer, vendor, rider and admin navigators.
// A floating, see-through capsule over the screen. The active tab is marked by a
// glass "lens" that springs between tabs and stretches while it moves.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { TC } from '../theme/palette';

export const TAB_ACTIVE_COLOR = '#f97316';
const IS_LIGHT = TC.name === 'light';
export const TAB_INACTIVE_COLOR = IS_LIGHT ? '#3a3a3a' : '#e5e5e5';
export const TAB_ICON_SIZE = 22;

const BAR_HEIGHT = 64;
const BAR_PADDING = 6;
const LENS_INSET = 3;
const SIDE_INSET = 16;

// Bottom space for scrolling content on tab screens, so the last item clears the floating bar.
export const TAB_BAR_SPACE = 110;

// Real Liquid Glass on iOS 26+. Loaded defensively: a build made before
// expo-glass-effect was added has no native module, and requiring it would throw.
let GlassView: React.ComponentType<any> | null = null;
if (Platform.OS === 'ios') {
  try {
    const glass = require('expo-glass-effect');
    if (glass.isLiquidGlassAvailable()) GlassView = glass.GlassView;
  } catch {
    GlassView = null;
  }
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

// Background of the capsule. Kept as clear as possible so the screen reads through.
// Android gets no BlurView: without a blur target it renders an opaque dark box.
function BarBackground() {
  if (GlassView) {
    return <GlassView glassEffectStyle="clear" colorScheme={TC.name} style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2 }]} />;
  }
  if (Platform.OS === 'ios') {
    return <BlurView intensity={14} tint={IS_LIGHT ? 'light' : 'default'} style={StyleSheet.absoluteFill} />;
  }
  return <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />;
}

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const [barWidth, setBarWidth] = useState(0);

  const count = state.routes.length;
  const itemWidth = barWidth > 0 ? (barWidth - BAR_PADDING * 2) / count : 0;

  const position = useRef(new Animated.Value(state.index)).current;
  const stretch = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(position, { toValue: state.index, useNativeDriver: true, damping: 16, stiffness: 180, mass: 0.9 }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(stretch, { toValue: 0, useNativeDriver: true, damping: 10, stiffness: 160 }),
      ]),
    ]).start();
  }, [state.index, position, stretch]);

  if (keyboardVisible) return null;
  const focusedOptions = descriptors[state.routes[state.index].key].options;
  if ((focusedOptions.tabBarStyle as any)?.display === 'none') return null;

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  const lensStyle = {
    width: itemWidth - LENS_INSET * 2,
    transform: [
      { translateX: Animated.multiply(position, itemWidth) },
      { scaleX: Animated.add(1, Animated.multiply(stretch, 0.28)) },
      { scaleY: Animated.add(press, Animated.multiply(stretch, -0.08)) },
    ],
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom - 8, 12) }]}>
      <View style={[styles.bar, GlassView && styles.barNative]} onLayout={onLayout}>
        <BarBackground />

        {itemWidth > 0 && (
          <Animated.View pointerEvents="none" style={[styles.lens, lensStyle]}>
            {GlassView ? (
              <GlassView glassEffectStyle="regular" colorScheme={TC.name} isInteractive style={[StyleSheet.absoluteFill, styles.lensShape]} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.lensShape, styles.lensFallback]} />
            )}
          </Animated.View>
        )}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? TAB_ACTIVE_COLOR : TAB_INACTIVE_COLOR;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
          const squeeze = (to: number) => () => {
            if (focused) Animated.spring(press, { toValue: to, useNativeDriver: true, damping: 14, stiffness: 260 }).start();
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              onPressIn={squeeze(0.92)}
              onPressOut={squeeze(1)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.item}
            >
              {options.tabBarIcon?.({ focused, color, size: TAB_ICON_SIZE })}
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function useTabBarOptions(): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarActiveTintColor: TAB_ACTIVE_COLOR,
    tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
    tabBarHideOnKeyboard: true,
    tabBarStyle: { position: 'absolute' },
  };
}

// Pass to <Tab.Navigator tabBar={renderGlassTabBar}>.
export const renderGlassTabBar = (props: BottomTabBarProps) => <GlassTabBar {...props} />;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: SIDE_INSET,
    right: SIDE_INSET,
    backgroundColor: 'transparent',
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_PADDING,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IS_LIGHT ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.22)',
  },
  // Native glass draws its own edge.
  barNative: { borderWidth: 0 },
  // Android: a faint frosted sheen, no dark fill.
  androidGlass: { backgroundColor: IS_LIGHT ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.06)' },
  lens: {
    position: 'absolute',
    left: BAR_PADDING + LENS_INSET,
    top: LENS_INSET + 2,
    bottom: LENS_INSET + 2,
  },
  lensShape: { borderRadius: (BAR_HEIGHT - (LENS_INSET + 2) * 2) / 2 },
  lensFallback: {
    backgroundColor: IS_LIGHT ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IS_LIGHT ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.3)',
  },
  item: { flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 },
  label: {
    fontSize: 10.5,
    fontWeight: '500',
    textShadowColor: IS_LIGHT ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});
