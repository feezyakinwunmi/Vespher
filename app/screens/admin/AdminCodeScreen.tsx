// app/screens/admin/AdminCodeScreen.tsx
// Second sign-in step for admins: a 6-digit code emailed after the password.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const RESEND_SECONDS = 60;

export function AdminCodeScreen() {
  const { session, signOut } = useAuth();
  const email = session?.user?.email || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sentOnce = useRef(false);

  const send = async () => {
    if (!email) return;
    setError('');
    setSending(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setSending(false);
    if (sendError) setError(sendError.message);
    else setCooldown(RESEND_SECONDS);
  };

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // On success Supabase replaces the session (SIGNED_IN) and the navigator opens the admin app.
  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code');
      return;
    }
    setError('');
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (verifyError) {
      setError(verifyError.message || 'That code did not work');
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <View style={styles.iconBg}>
          <Feather name="shield" size={32} color="#f97316" />
        </View>
        <Text style={styles.title}>Admin sign-in check</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to <Text style={styles.email}>{email}</Text>. Enter it to open the admin app.
        </Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          placeholderTextColor="#444"
          autoFocus
        />
        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.button, verifying && styles.buttonDisabled]} onPress={verify} disabled={verifying}>
          {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify and continue</Text>}
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity onPress={send} disabled={sending || cooldown > 0}>
            <Text style={[styles.link, (sending || cooldown > 0) && styles.linkDisabled]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? 'Sending…' : 'Resend code'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Text style={styles.muted}>Use a different account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  email: { color: '#fff', fontWeight: '600' },
  codeInput: {
    marginTop: 28,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    color: '#fff',
    fontSize: 26,
    letterSpacing: 12,
    textAlign: 'center',
    paddingVertical: 14,
  },
  error: { color: '#ef4444', fontSize: 13, marginTop: 10, textAlign: 'center' },
  button: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  link: { color: '#f97316', fontSize: 13 },
  linkDisabled: { color: '#666' },
  muted: { color: '#aaa', fontSize: 13 },
});
