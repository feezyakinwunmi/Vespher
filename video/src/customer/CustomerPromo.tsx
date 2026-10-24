import { AbsoluteFill, Audio, Series, staticFile } from 'remotion';
import { Background } from '../components/parts';
import { End, Feature, Hook, LogoReveal } from '../components/scenes';
import { AUDIO } from '../media';
import { sec } from '../theme';
import type { Scene } from './script';

export function CustomerPromo({ scenes }: { scenes: Scene[] }) {
  const features = scenes.filter(s => s.kind === 'feature');
  const musicVolume = AUDIO.voiceover ? AUDIO.musicVolume * 0.5 : AUDIO.musicVolume;

  return (
    <AbsoluteFill>
      <Background />
      <Series>
        {scenes.map(scene => (
          <Series.Sequence key={scene.id} durationInFrames={sec(scene.seconds)}>
            {scene.kind === 'hook' && <Hook scene={scene} />}
            {scene.kind === 'logo' && <LogoReveal scene={scene} />}
            {scene.kind === 'feature' && <Feature scene={scene} index={features.indexOf(scene)} total={features.length} />}
            {scene.kind === 'end' && <End scene={scene} />}
          </Series.Sequence>
        ))}
      </Series>
      {AUDIO.music && <Audio src={staticFile(AUDIO.music)} volume={musicVolume} />}
      {AUDIO.voiceover && <Audio src={staticFile(AUDIO.voiceover)} />}
    </AbsoluteFill>
  );
}
