// app/voice/VoiceEntryPoints.tsx
// Ways to start voice ordering without touching the screen:
//  - "Hey Vesphe" while the app is open (Picovoice wake word, opt-in)
//  - the "Order by voice" app-icon shortcut (long-press the Vesphe icon)
//  - vesphe://voice links, used by Siri / Google shortcuts (handled in VoiceAssistantContext)
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
import { useVoiceAssistant } from './VoiceAssistantContext';
import { PICOVOICE_ACCESS_KEY, WAKE_WORD_FILE, porcupineModule, wakeWordConfigured } from './native';
import { getWakeWordEnabled, onWakeWordSettingChange } from './wakeWordSetting';

export function VoiceEntryPoints() {
  const { available, isOpen, open } = useVoiceAssistant();
  const [wakeOn, setWakeOn] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const manager = useRef<any>(null);

  // App-icon shortcut.
  useEffect(() => {
    if (!available) {
      QuickActions.setItems([]).catch(() => {});
      return;
    }
    QuickActions.setItems([
      {
        id: 'voice-order',
        title: 'Order by voice',
        subtitle: 'Talk to Vesphe',
        icon: Platform.OS === 'ios' ? 'symbol:mic.fill' : undefined,
      },
    ]).catch(() => {});
  }, [available]);

  useQuickActionCallback(action => {
    if (action?.id === 'voice-order') setTimeout(open, 600);
  });

  // "Hey Vesphe" switch and foreground state.
  useEffect(() => {
    getWakeWordEnabled().then(setWakeOn);
    const off = onWakeWordSettingChange(setWakeOn);
    const sub = AppState.addEventListener('change', s => setActive(s === 'active'));
    return () => {
      off();
      sub.remove();
    };
  }, []);

  // Listen for the wake word only while the app is open, the switch is on, and the
  // voice sheet is closed (they share the microphone).
  const shouldListen = available && wakeOn && active && !isOpen && wakeWordConfigured();
  useEffect(() => {
    const porcupine = porcupineModule();
    if (!shouldListen || !porcupine) return;
    let cancelled = false;
    (async () => {
      try {
        const m = await porcupine.PorcupineManager.fromKeywordPaths(
          PICOVOICE_ACCESS_KEY,
          [WAKE_WORD_FILE],
          () => open(),
          error => console.warn('Wake word error:', error?.message)
        );
        if (cancelled) {
          await m.delete();
          return;
        }
        manager.current = m;
        await m.start();
      } catch (e: any) {
        console.warn('Wake word unavailable:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
      const m = manager.current;
      manager.current = null;
      if (m) m.stop().then(() => m.delete()).catch(() => {});
    };
  }, [shouldListen, open]);

  return null;
}
