// Renders the app icon set into video/out/icons/. Copy them into /assets when happy
// (Claude does this for you; the app config already points at these names).
import { execFileSync } from 'node:child_process';

const ICONS = [
  ['IconApp', 'icon.png'],
  ['IconAdaptiveForeground', 'android-icon-foreground.png'],
  ['IconAdaptiveMonochrome', 'android-icon-monochrome.png'],
  ['IconNotification', 'notification-icon.png'],
  ['IconSplash', 'splash-icon.png'],
  ['IconFavicon', 'favicon.png'],
];

for (const [id, file] of ICONS) {
  execFileSync('npx', ['remotion', 'still', id, `out/icons/${file}`, '--image-format=png'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
