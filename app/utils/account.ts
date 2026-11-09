// app/utils/account.ts
import { Alert, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { functionErrorMessage } from './paystack';

// Apple requires us to revoke its sign-in when an account is deleted, which needs a
// fresh authorization code from the user.
async function appleAuthorizationCode(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  const { data } = await supabase.auth.getSession();
  const providers: string[] = data.session?.user.app_metadata?.providers || [];
  if (!providers.includes('apple')) return null;
  const credential = await AppleAuthentication.signInAsync({});
  return credential.authorizationCode;
}

// Confirms with the user, deletes the account server-side, then signs out locally.
export function confirmDeleteAccount(signOut: () => Promise<void>) {
  Alert.alert(
    'Delete Account',
    'This permanently deletes your account and personal data. Past orders are kept anonymously for our records. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          let appleCode: string | null = null;
          try {
            appleCode = await appleAuthorizationCode();
          } catch {
            Alert.alert('Delete Account', 'Please confirm with Apple to delete your account.');
            return;
          }
          const { data, error } = await supabase.functions.invoke('delete-account', {
            body: appleCode ? { apple_authorization_code: appleCode } : {},
          });
          if (error || !data?.status) {
            const message = error
              ? await functionErrorMessage(error, 'Could not delete account')
              : data?.message || 'Could not delete account';
            Alert.alert('Delete Account', message);
            return;
          }
          await signOut();
          Alert.alert('Account Deleted', 'Your account has been deleted.');
        },
      },
    ]
  );
}
