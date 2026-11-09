// app/components/AppleSignInButton.tsx
// iOS only. Setup: enable Sign in with Apple on the App ID, and in Supabase →
// Authentication → Providers → Apple add the bundle id as an authorized client id.
import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Apple only shares the name on the very first sign-in, and the profile row is
// created by the auth listener, so wait briefly for it before saving the name.
async function saveAppleName(userId: string, name: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase.from('users').update({ name }).eq('id', userId).select('id');
    if (data?.length) return;
    await new Promise(resolve => setTimeout(resolve, 600));
  }
}

export function AppleSignInButton({ signUp }: { signUp?: boolean }) {
  const { refreshProfile } = useAuth();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);

  if (!available) return null;

  const handlePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple did not return a sign-in token');

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;

      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      if (name && data.user) {
        await saveAppleName(data.user.id, name);
        await refreshProfile();
      }
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple sign-in failed', error?.message || 'Please try again.');
    }
  };

  return (
    <View style={styles.wrap}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          signUp
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
        }
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={12}
        style={styles.button}
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  button: { width: '100%', height: 50 },
});
