import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, fontFamily } from '../theme';

// Fade + slight lift in over the first frames of a scene, and out over the last.
export function useEnterExit(durationInFrames: number, inFrames = 12, outFrames = 10) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, inFrames, durationInFrames - outFrames, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { opacity };
}

export function useSpring(delay = 0, damping = 14) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.6 } });
}

// Dark background with a slow-moving orange glow.
export function Background() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const x = width * (0.3 + 0.2 * Math.sin(frame / 90));
  const y = height * (0.25 + 0.1 * Math.cos(frame / 120));
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${x}px ${y}px, rgba(249,115,22,0.22), transparent ${Math.max(width, height) * 0.45}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${width - x}px ${height - y}px, rgba(16,185,129,0.10), transparent ${Math.max(width, height) * 0.4}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

// Phone mock-up showing a screen recording (or a placeholder until you add one).
export function Phone({ src, height, label, delay = 0 }: { src: string | null; height: number; label: string; delay?: number }) {
  const s = useSpring(delay, 16);
  const frame = useCurrentFrame();
  const width = height * 0.4875; // ~19.5:9 phone
  const radius = height * 0.07;
  const bezel = height * 0.016;
  const float = Math.sin(frame / 40) * height * 0.006;
  const isImage = !!src && /\.(png|jpe?g|webp)$/i.test(src);

  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        padding: bezel,
        background: 'linear-gradient(145deg, #2c2c2c, #0f0f0f)',
        boxShadow: `0 ${height * 0.04}px ${height * 0.1}px rgba(0,0,0,0.6), 0 0 0 2px #333, 0 0 ${height * 0.08}px rgba(249,115,22,0.18)`,
        transform: `translateY(${(1 - s) * height * 0.12 + float}px) scale(${0.92 + 0.08 * s})`,
        opacity: s,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: radius - bezel, overflow: 'hidden', background: COLORS.surface }}>
        {src ? (
          isImage ? (
            <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        ) : (
          <Placeholder label={label} />
        )}
        {/* camera notch */}
        <div
          style={{
            position: 'absolute',
            top: height * 0.014,
            left: '50%',
            width: width * 0.3,
            height: height * 0.028,
            transform: 'translateX(-50%)',
            borderRadius: 999,
            background: '#000',
          }}
        />
      </div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  const frame = useCurrentFrame();
  const shimmer = (frame * 6) % 400;
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(160deg, #1d1d1d, #111 ${40 + Math.sin(frame / 30) * 10}%, #1a120c)`,
        fontFamily,
        color: COLORS.muted,
        textAlign: 'center',
        padding: '12%',
      }}
    >
      <div style={{ fontSize: 46, marginBottom: 18 }}>🎬</div>
      <div style={{ fontSize: 30, fontWeight: 600, color: COLORS.text }}>Screen recording</div>
      <div style={{ fontSize: 24, marginTop: 10, lineHeight: 1.35 }}>{label}</div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(100deg, transparent ${shimmer - 120}px, rgba(255,255,255,0.05) ${shimmer - 60}px, transparent ${shimmer}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

export function Kicker({ icon, children, delay = 0, size }: { icon?: string; children: ReactNode; delay?: number; size: number }) {
  const s = useSpring(delay);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.4,
        padding: `${size * 0.35}px ${size * 0.8}px`,
        borderRadius: 999,
        background: COLORS.brandSoft,
        border: '2px solid rgba(249,115,22,0.35)',
        color: COLORS.brand,
        fontFamily,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        opacity: s,
        transform: `translateY(${(1 - s) * 20}px)`,
      }}
    >
      {icon && <span style={{ fontSize: size * 1.1 }}>{icon}</span>}
      {children}
    </div>
  );
}

// Headline that springs in word by word.
export function WordsIn({ text, size, delay = 0, style, highlight }: { text: string; size: number; delay?: number; style?: CSSProperties; highlight?: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{ fontFamily, fontWeight: 800, fontSize: size, lineHeight: 1.12, color: COLORS.text, letterSpacing: -size * 0.02, ...style }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - delay - i * 3, fps, config: { damping: 15, mass: 0.5 } });
        const hl = highlight?.some(h => w.toLowerCase().replace(/[^a-z']/g, '').startsWith(h));
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: size * 0.26,
              opacity: s,
              transform: `translateY(${(1 - s) * size * 0.5}px)`,
              color: hl ? COLORS.brand : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

export function FadeText({ children, size, delay = 0, style }: { children: ReactNode; size: number; delay?: number; style?: CSSProperties }) {
  const s = useSpring(delay, 20);
  return (
    <div style={{ fontFamily, fontWeight: 400, fontSize: size, lineHeight: 1.4, color: COLORS.muted, opacity: s, transform: `translateY(${(1 - s) * 16}px)`, ...style }}>
      {children}
    </div>
  );
}

export function Chips({ items, size, delay = 0, align }: { items: string[]; size: number; delay?: number; align: 'center' | 'flex-start' }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: size * 0.6, justifyContent: align }}>
      {items.map((c, i) => {
        const s = spring({ frame: frame - delay - i * 5, fps, config: { damping: 13 } });
        return (
          <div
            key={c}
            style={{
              fontFamily,
              fontWeight: 500,
              fontSize: size,
              color: COLORS.text,
              background: COLORS.surface2,
              border: `2px solid ${COLORS.line}`,
              borderRadius: 999,
              padding: `${size * 0.35}px ${size * 0.8}px`,
              opacity: s,
              transform: `scale(${0.7 + 0.3 * s})`,
            }}
          >
            ✓ {c}
          </div>
        );
      })}
    </div>
  );
}

export function Logo({ size, delay = 0 }: { size: number; delay?: number }) {
  const s = useSpring(delay, 12);
  return (
    <div style={{ position: 'relative', height: size, width: size * (615 / 405), opacity: s, transform: `scale(${0.6 + 0.4 * s})` }}>
      {/* The tagline letters are cut out of logo.png; a light strip behind the band
          makes "EATS • DELIVERS • ANYWHERE" readable on dark backgrounds. */}
      <div style={{ position: 'absolute', left: '24%', width: '60%', top: '78%', height: '7.5%', background: '#fff' }} />
      <Img src={staticFile('logo.png')} style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }} />
    </div>
  );
}
