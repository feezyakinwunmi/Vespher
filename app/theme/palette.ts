// app/theme/palette.ts
// Light and dark colour tokens for the whole app.
//
// The theme is chosen once at startup (index.ts loads the saved preference before
// any screen is imported), so StyleSheet.create calls across the app read the right
// values. Changing the theme in Settings saves it and restarts the app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { reloadAppAsync } from 'expo';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeName = 'light' | 'dark';

const STORAGE_KEY = 'vesphe.theme';

// Dark values match the original app exactly, so dark mode looks unchanged.
const dark = {
  bg: '#0a0a0a',
  surface: '#1a1a1a', // cards, inputs
  surface2: '#141414', // secondary cards, sheets
  raised: '#2a2a2a', // borders, dividers, chips, pressed rows
  text: '#ffffff',
  text2: '#d4d4d4', // secondary text
  muted: '#666666', // captions, placeholders
  subtle: '#8a8a8a', // meta text
  hairline: 'rgba(255,255,255,0.05)',
  hairline2: 'rgba(255,255,255,0.08)',
  hairline3: 'rgba(255,255,255,0.1)',
  statusBar: 'light' as 'light' | 'dark',
};

const light: typeof dark = {
  bg: '#f5f5f3',
  surface: '#ffffff',
  surface2: '#ffffff',
  raised: '#e7e7e4',
  text: '#141414',
  text2: '#3a3a3a',
  muted: '#6b6b6b',
  subtle: '#7a7a7a',
  hairline: 'rgba(0,0,0,0.06)',
  hairline2: 'rgba(0,0,0,0.08)',
  hairline3: 'rgba(0,0,0,0.1)',
  statusBar: 'dark',
};

// Mutable on purpose: filled in by initTheme() before screens are imported.
export const TC = { ...dark, name: 'dark' as ThemeName };

let preference: ThemePreference = 'system';

function resolve(pref: ThemePreference): ThemeName {
  if (pref === 'system') return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  return pref;
}

function apply(name: ThemeName) {
  Object.assign(TC, name === 'light' ? light : dark, { name });
}

/** Called once from index.ts before the app is imported. */
export async function initTheme() {
  try {
    const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as ThemePreference | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference = saved;
  } catch {
    // keep default
  }
  apply(resolve(preference));
}

export function getThemePreference(): ThemePreference {
  return preference;
}

/** Saves the choice and restarts the app so every screen picks it up. */
export async function setThemePreference(next: ThemePreference) {
  if (next === preference) return;
  preference = next;
  await AsyncStorage.setItem(STORAGE_KEY, next);
  if (resolve(next) !== TC.name) {
    await reloadAppAsync('Theme changed');
  }
}
