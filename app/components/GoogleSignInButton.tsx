// app/components/GoogleSignInButton.tsx
import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { signInWithGoogle } from '../lib/googleAuth';

interface Props {
  label?: string;
}

export function GoogleSignInButton({ label = 'Continue with Google' }: Props) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      // On success the auth listener signs the user in and creates their profile.
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Google sign-in failed', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>
      <TouchableOpacity style={styles.button} onPress={handlePress} disabled={loading} activeOpacity={0.85}>
        {loading ? (
          <ActivityIndicator color="#1f1f1f" />
        ) : (
          <>
            <Text style={styles.gLogo}>G</Text>
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: '#777',
    fontSize: 12,
  },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  gLogo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  label: {
    color: '#1f1f1f',
    fontSize: 15,
    fontWeight: '600',
  },
});
