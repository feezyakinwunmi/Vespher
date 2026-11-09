// app/utils/healthConsent.ts
// Explicit opt-in before any health details are stored.
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { HEALTH_CONSENT_TEXT, MEDICAL_DISCLAIMER } from '../config/legal';

async function hasHealthConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('customer_health_profiles')
    .select('health_consent_at')
    .eq('user_id', userId)
    .maybeSingle();
  return !error && !!data?.health_consent_at;
}

// Resolves true when the user has agreed, now or earlier.
export async function ensureHealthConsent(userId: string): Promise<boolean> {
  if (await hasHealthConsent(userId)) return true;
  return new Promise(resolve => {
    Alert.alert(
      'Your health details',
      `${HEALTH_CONSENT_TEXT}\n\n${MEDICAL_DISCLAIMER}`,
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'I agree', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

// Call after the health profile row has been saved.
export async function recordHealthConsent(userId: string) {
  await supabase
    .from('customer_health_profiles')
    .update({ health_consent_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('health_consent_at', null);
}
