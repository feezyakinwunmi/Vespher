// app/components/ErrorBoundary.tsx
// Shows a recovery screen instead of crashing if a screen throws while rendering.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Unhandled screen error:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.container}>
        <Feather name="alert-circle" size={40} color="#f97316" />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>Please try again. If this keeps happening, contact Vesphe support.</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ failed: false })}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 14 },
  body: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  button: { marginTop: 22, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f97316' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
