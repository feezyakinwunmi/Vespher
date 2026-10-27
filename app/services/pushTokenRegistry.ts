// app/services/pushTokenRegistry.ts
// Remembers the push token registered for this device so sign-out can detach it.
import { supabase } from '../lib/supabase';

let currentPushToken: string | null = null;

export function setCurrentPushToken(token: string) {
  currentPushToken = token;
}

// Stops this device receiving the signed-out user's notifications. Must run while
// the session is still valid.
export async function unregisterPushToken() {
  if (!currentPushToken) return;
  try {
    await supabase.rpc('unregister_push_token', { p_token: currentPushToken });
  } catch (error) {
    console.error('Error removing push token:', error);
  } finally {
    currentPushToken = null;
  }
}
