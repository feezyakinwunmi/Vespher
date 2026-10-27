import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, fontFamily } from '../theme';
import { CLIPS, LINKS } from '../media';
import type { EndScene, FeatureScene, HookScene, LogoScene } from '../customer/script';
import { Chips, FadeText, Kicker, Logo, Phone, WordsIn, useEnterExit, useSpring } from './parts';

const useLayout = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  // Base unit: 1% of the short side, so text scales with any resolution.
  const u = Math.min(width, height) / 100;
  return { width, height, portrait, u };
};

export function Hook({ scene }: { scene: HookScene }) {
  const { durationInFrames } = useVideoConfig();
  const { u, portrait } = useLayout();
  const { opacity } = useEnterExit(durationInFrames, 6, 12);
  const size = portrait ? u * 9.5 : u * 8;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity, padding: u * 8 }}>
      <div style={{ textAlign: 'center' }}>
        {scene.lines.map((line, i) => (
          <WordsIn
            key={line}
            text={line}
            size={size}
            delay={i * 12}
            highlight={['gamble', 'health', 'know', 'before']}
            style={{ justifyContent: 'center' }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

export function LogoReveal({ scene }: { scene: LogoScene }) {
  const { durationInFrames } = useVideoConfig();
  const { u, portrait } = useLayout();
  const { opacity } = useEnterExit(durationInFrames, 4, 10);
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 20, durationInFrames], [0, 1, 0.6], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity, gap: u * 4 }}>
      <div style={{ filter: `drop-shadow(0 0 ${u * 6 * glow}px rgba(249,115,22,0.55))` }}>
        <Logo size={portrait ? u * 48 : u * 40} />
      </div>
      <FadeText size={portrait ? u * 5 : u * 4} delay={14} style={{ color: COLORS.text, fontWeight: 600 }}>
        {scene.tagline}
      </FadeText>
    </AbsoluteFill>
  );
}

export function Feature({ scene, index, total }: { scene: FeatureScene; index: number; total: number }) {
  const { durationInFrames } = useVideoConfig();
  const { u, portrait, height, width } = useLayout();
  const { opacity } = useEnterExit(durationInFrames);
  const src = CLIPS[scene.clip] ?? null;

  const text = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u * 2.6, alignItems: portrait ? 'center' : 'flex-start', textAlign: portrait ? 'center' : 'left' }}>
      <Kicker icon={scene.icon} size={portrait ? u * 3.4 : u * 2.6} delay={4}>
        {scene.kicker}
      </Kicker>
      <WordsIn text={scene.title} size={portrait ? u * 7.2 : u * 6.2} delay={10} style={{ justifyContent: portrait ? 'center' : 'flex-start' }} />
      {!!scene.sub && (
        <FadeText size={portrait ? u * 3.9 : u * 3.1} delay={26} style={{ maxWidth: portrait ? u * 88 : u * 80 }}>
          {scene.sub}
        </FadeText>
      )}
      {scene.chips && <Chips items={scene.chips} size={portrait ? u * 3.2 : u * 2.5} delay={36} align={portrait ? 'center' : 'flex-start'} />}
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      {portrait ? (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: height * 0.06, gap: height * 0.035 }}>
          <Phone src={src} height={height * 0.56} label={scene.record} delay={0} />
          <div style={{ padding: `0 ${u * 7}px` }}>{text}</div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: width * 0.06, padding: `0 ${width * 0.07}px` }}>
          <Phone src={src} height={height * 0.84} label={scene.record} />
          <div style={{ flex: 1, maxWidth: width * 0.5 }}>{text}</div>
        </AbsoluteFill>
      )}
      <Progress index={index} total={total} />
    </AbsoluteFill>
  );
}

// Small dots showing which feature we are on.
function Progress({ index, total }: { index: number; total: number }) {
  const { u, portrait } = useLayout();
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: portrait ? u * 3.5 : u * 4,
        display: 'flex',
        justifyContent: 'center',
        gap: u * 1.2,
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === index ? u * 5 : u * 1.4,
            height: u * 1.4,
            borderRadius: 999,
            background: i === index ? COLORS.brand : 'rgba(255,255,255,0.25)',
          }}
        />
      ))}
    </div>
  );
}

export function End({ scene }: { scene: EndScene }) {
  const { durationInFrames } = useVideoConfig();
  const { u, portrait } = useLayout();
  const { opacity } = useEnterExit(durationInFrames, 10, 1);
  const cta = useSpring(30, 12);
  const frame = useCurrentFrame();
  const pulse = 1 + Math.max(0, Math.sin((frame - 40) / 8)) * 0.03;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity, gap: u * 3.5, textAlign: 'center', padding: u * 6 }}>
      <Logo size={portrait ? u * 38 : u * 30} />
      <WordsIn text={scene.title} size={portrait ? u * 11 : u * 8} delay={8} highlight={['smart']} style={{ justifyContent: 'center' }} />
      <FadeText size={portrait ? u * 4.4 : u * 3.4} delay={18}>
        {scene.sub}
      </FadeText>
      <div
        style={{
          marginTop: u * 2,
          fontFamily,
          fontWeight: 700,
          fontSize: portrait ? u * 4.6 : u * 3.4,
          color: '#fff',
          background: COLORS.brand,
          borderRadius: 999,
          padding: `${u * 2}px ${u * 6}px`,
          boxShadow: '0 10px 40px rgba(249,115,22,0.45)',
          opacity: cta,
          transform: `scale(${(0.8 + 0.2 * cta) * pulse})`,
        }}
      >
        {scene.cta}
      </div>
      <FadeText size={portrait ? u * 3.4 : u * 2.6} delay={40} style={{ color: COLORS.muted }}>
        Google Play · App Store · {LINKS.website}
      </FadeText>
    </AbsoluteFill>
  );
}
