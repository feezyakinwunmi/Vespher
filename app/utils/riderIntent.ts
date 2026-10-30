// app/utils/riderIntent.ts
// Remembers that someone chose "Rider" on the role screen, so the rider
// application opens once their account is created.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vesphe.pendingRiderApplication';

export function markRiderApplicationPending() {
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}

export function clearRiderApplicationPending() {
  AsyncStorage.removeItem(KEY).catch(() => {});
}

// Returns true once, then clears the flag.
export async function takeRiderApplicationPending(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (value) await AsyncStorage.removeItem(KEY);
    return !!value;
  } catch {
    return false;
  }
}
