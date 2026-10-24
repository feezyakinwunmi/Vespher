// App icon set generated from the transparent logo (video/public/logo.png).
// Render with:  npm run icons   (writes PNGs to video/out/icons, then copied to /assets)
import { AbsoluteFill, Img, staticFile } from 'remotion';

const LOGO_RATIO = 615 / 405;

// White silhouette: orange parts of the logo become white, black outlines become
// transparent. Android needs this for notification and themed (monochrome) icons.
function MonoFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id="mono" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 1.6 0.3 0 -0.35" />
      </filter>
    </svg>
  );
}

// Full logo with the tagline made readable (its letters are cut out of the PNG).
function FullLogo({ width, mono }: { width: number; mono?: boolean }) {
  return (
    <div style={{ position: 'relative', width, height: width / LOGO_RATIO }}>
      {!mono && <div style={{ position: 'absolute', left: '24%', width: '60%', top: '78%', height: '7.5%', background: '#fff' }} />}
      <Img src={staticFile('logo.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: mono ? 'url(#mono)' : undefined }} />
    </div>
  );
}

// Just the wasp (top of the logo), for small sizes where the wordmark is unreadable.
function Wasp({ width, mono }: { width: number; mono?: boolean }) {
  // Wasp area within logo.png (615×405): x 150–540, y 30–215.
  const crop = { x: 150, y: 30, w: 390, h: 185 };
  const scale = width / crop.w;
  return (
    <div style={{ position: 'relative', width, height: crop.h * scale, overflow: 'hidden' }}>
      <Img
        src={staticFile('logo.png')}
        style={{
          position: 'absolute',
          left: -crop.x * scale,
          top: -crop.y * scale,
          width: 615 * scale,
          height: 405 * scale,
          filter: mono ? 'url(#mono)' : undefined,
        }}
      />
    </div>
  );
}

const center = { alignItems: 'center', justifyContent: 'center' } as const;

// iOS / store icon: full-bleed, no transparency, no rounded corners (the OS rounds them).
export function AppIcon() {
  return (
    <AbsoluteFill style={{ ...center, background: 'radial-gradient(circle at 50% 40%, #1c1206, #0a0a0a 70%)' }}>
      <FullLogo width={900} />
    </AbsoluteFill>
  );
}

// Android adaptive icon foreground: transparent, artwork inside the central safe zone
// (launchers crop the outer third into circles, squircles, etc.).
export function AdaptiveForeground() {
  return (
    <AbsoluteFill style={center}>
      <FullLogo width={640} />
    </AbsoluteFill>
  );
}

// Android 13+ themed icon: white silhouette in the same position as the foreground.
export function AdaptiveMonochrome() {
  return (
    <AbsoluteFill style={center}>
      <MonoFilter />
      <Wasp width={600} mono />
    </AbsoluteFill>
  );
}

// Android notification small icon: white wasp on transparent, 96×96.
export function NotificationIcon() {
  return (
    <AbsoluteFill style={center}>
      <MonoFilter />
      <Wasp width={88} mono />
    </AbsoluteFill>
  );
}

// Splash screen logo: transparent, tagline readable on the dark splash background.
export function SplashLogo() {
  return (
    <AbsoluteFill style={center}>
      <FullLogo width={1200} />
    </AbsoluteFill>
  );
}

export function Favicon() {
  return (
    <AbsoluteFill style={{ ...center, background: '#0a0a0a', borderRadius: 40 }}>
      <Wasp width={180} />
    </AbsoluteFill>
  );
}
