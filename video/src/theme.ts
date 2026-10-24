import { loadFont } from '@remotion/google-fonts/Poppins';

// Same palette as the app and dashboard.
export const COLORS = {
  bg: '#0a0a0a',
  surface: '#161616',
  surface2: '#1f1f1f',
  line: '#2a2a2a',
  brand: '#f97316',
  brandSoft: 'rgba(249,115,22,0.16)',
  ok: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
  text: '#ffffff',
  muted: '#a3a3a3',
};

export const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);
