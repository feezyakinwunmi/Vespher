// app/voice/native.ts
// Speech recognition and wake-word engines are native modules that aren't in Expo Go,
// so they are loaded lazily: in Expo Go voice ordering is simply unavailable instead
// of crashing the app on start.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type SpeechModule = typeof import('expo-speech-recognition');
type PorcupineModule = typeof import('@picovoice/porcupine-react-native');

let speech: SpeechModule | null | undefined;
export function speechRecognition(): SpeechModule | null {
  if (speech !== undefined) return speech;
  try {
    speech = isExpoGo ? null : (require('expo-speech-recognition') as SpeechModule);
  } catch {
    speech = null;
  }
  return speech;
}

let porcupine: PorcupineModule | null | undefined;
export function porcupineModule(): PorcupineModule | null {
  if (porcupine !== undefined) return porcupine;
  try {
    porcupine = isExpoGo ? null : (require('@picovoice/porcupine-react-native') as PorcupineModule);
  } catch {
    porcupine = null;
  }
  return porcupine;
}

// "Hey Vesphe" needs a Picovoice access key and the keyword files copied into the
// native projects by plugins/withWakeWord.js (see VOICE.md).
export const PICOVOICE_ACCESS_KEY = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY || '';
export const WAKE_WORD_FILE = Platform.OS === 'android' ? 'hey-vesphe_android.ppn' : 'hey-vesphe_ios.ppn';
export const wakeWordConfigured = () => !!PICOVOICE_ACCESS_KEY && !!porcupineModule();
