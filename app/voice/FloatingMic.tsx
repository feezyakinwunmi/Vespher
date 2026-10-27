// app/voice/FloatingMic.tsx
// Floating voice button for customers. Drag it anywhere; on release it snaps to the
// nearest side (clear of the header and tab bar) and remembers the spot. Tap to talk.
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVoiceAssistant } from './VoiceAssistantContext';

const SIZE = 56;
const MARGIN = 12;
const TAB_BAR_SPACE = 96; // keep above the bottom tab bar
const HEADER_SPACE = 72; // keep below the screen header
const STORE_KEY = 'vesphe.micPosition';
const TAP_SLOP = 6;

export function FloatingMic() {
  const voice = useVoiceAssistant();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pos = useRef(new Animated.ValueXY({ x: width - SIZE - MARGIN, y: height * 0.62 })).current;
  const current = useRef({ x: width - SIZE - MARGIN, y: height * 0.62 });
  const pressed = useRef(new Animated.Value(1)).current;

  const bounds = useMemo(
    () => ({
      minY: insets.top + HEADER_SPACE,
      maxY: height - insets.bottom - TAB_BAR_SPACE - SIZE,
      left: MARGIN,
      right: width - SIZE - MARGIN,
    }),
    [width, height, insets.top, insets.bottom]
  );

  const place = (x: number, y: number, animate: boolean) => {
    const target = {
      x: x + SIZE / 2 < width / 2 ? bounds.left : bounds.right,
      y: Math.min(Math.max(y, bounds.minY), bounds.maxY),
    };
    current.current = target;
    if (animate) {
      Animated.spring(pos, { toValue: target, useNativeDriver: false, friction: 7, tension: 60 }).start();
    } else {
      pos.setValue(target);
    }
    return target;
  };

  // Restore the last position (stored as side + height fraction so it survives rotation).
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then(raw => {
        const saved = raw ? JSON.parse(raw) : null;
        const x = saved?.side === 'left' ? bounds.left : bounds.right;
        const y = saved?.yFraction != null ? saved.yFraction * height : height * 0.62;
        place(x, y, false);
      })
      .catch(() => place(bounds.right, height * 0.62, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP,
        onPanResponderGrant: () => {
          pos.setOffset({ x: current.current.x, y: current.current.y });
          pos.setValue({ x: 0, y: 0 });
          Animated.spring(pressed, { toValue: 1.12, useNativeDriver: false }).start();
        },
        onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          pos.flattenOffset();
          Animated.spring(pressed, { toValue: 1, useNativeDriver: false }).start();
          const moved = Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP;
          if (!moved) {
            pos.setValue(current.current);
            voice.open();
            return;
          }
          const target = place(current.current.x + g.dx, current.current.y + g.dy, true);
          AsyncStorage.setItem(
            STORE_KEY,
            JSON.stringify({ side: target.x === bounds.left ? 'left' : 'right', yFraction: target.y / height })
          ).catch(() => {});
        },
        onPanResponderTerminate: () => {
          pos.flattenOffset();
          Animated.spring(pressed, { toValue: 1, useNativeDriver: false }).start();
          place(current.current.x, current.current.y, true);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bounds, voice.open, height]
  );

  if (!voice.visible || voice.isOpen) return null;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.button, { transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: pressed }] }]}
      accessibilityRole="button"
      accessibilityLabel="Order by voice. Drag to move."
    >
      <Feather name="mic" size={24} color="#fff" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#f97316',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 1000,
  },
});
