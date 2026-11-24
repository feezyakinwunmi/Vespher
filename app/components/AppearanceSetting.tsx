// app/components/AppearanceSetting.tsx
// Light / dark / match-phone picker for the settings screens.
// Picking a different look saves it and restarts the app to apply it everywhere.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TC, ThemePreference, getThemePreference, setThemePreference } from '../theme/palette';

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'system', label: 'Match phone', icon: 'smartphone' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export function AppearanceSetting({ style }: { style?: object }) {
  const [current, setCurrent] = useState<ThemePreference>(getThemePreference());
  const [applying, setApplying] = useState(false);

  const choose = async (value: ThemePreference) => {
    if (value === current || applying) return;
    setCurrent(value);
    setApplying(true);
    try {
      await setThemePreference(value);
    } finally {
      // Only reached when the look didn't change (e.g. "Match phone" already matched).
      setApplying(false);
    }
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Appearance</Text>
        {applying && <ActivityIndicator size="small" color="#f97316" />}
      </View>
      <View style={styles.segment}>
        {OPTIONS.map(o => {
          const active = o.value === current;
          return (
            <Pressable
              key={o.value}
              onPress={() => choose(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.option, active && styles.optionActive]}
            >
              <Feather name={o.icon} size={16} color={active ? '#f97316' : TC.subtle} />
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.note}>The app restarts for a moment to apply a new look</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TC.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TC.hairline2,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: TC.text, fontSize: 15, fontWeight: '600' },
  segment: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: TC.bg,
    borderWidth: 1,
    borderColor: TC.hairline2,
  },
  optionActive: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)' },
  optionText: { color: TC.subtle, fontSize: 12.5, fontWeight: '500' },
  optionTextActive: { color: TC.text },
  note: { color: TC.muted, fontSize: 12 },
});
