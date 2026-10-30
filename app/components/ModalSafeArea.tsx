// app/components/ModalSafeArea.tsx
// A full-screen <Modal> opens in its own window, where the app's safe-area
// insets come back as zero on edge-to-edge Android, so headers (and their close
// buttons) slide under the status bar. Wrap modal content in this to measure
// insets inside the modal and pad the top and bottom correctly.
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaProvider, SafeAreaView, type Edge } from 'react-native-safe-area-context';

export function ModalSafeArea({
  children,
  style,
  edges = ['top', 'bottom'],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
