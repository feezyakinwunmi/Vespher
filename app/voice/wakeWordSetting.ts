// app/voice/wakeWordSetting.ts
// The customer's "Hey Vesphe" switch (off by default: an always-listening microphone
// should be their choice). Stored on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vesphe.heyVesphe';
type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();
let cached: boolean | null = null;

export async function getWakeWordEnabled(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    cached = (await AsyncStorage.getItem(KEY)) === 'on';
  } catch {
    cached = false;
  }
  return cached;
}

export async function setWakeWordEnabled(on: boolean) {
  cached = on;
  listeners.forEach(l => l(on));
  try {
    await AsyncStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // keeps working for this session
  }
}

export function onWakeWordSettingChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
