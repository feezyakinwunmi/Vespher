// app/utils/account.ts
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { functionErrorMessage } from './paystack';

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
          const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
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
