import { Composition, Still } from 'remotion';
import { AdaptiveForeground, AdaptiveMonochrome, AppIcon, Favicon, NotificationIcon, SplashLogo } from './icons/Icons';
import { CustomerPromo } from './customer/CustomerPromo';
import { CUSTOMER_FULL, CUSTOMER_TEASER, totalSeconds } from './customer/script';
import { FPS, sec } from './theme';

export function Root() {
  return (
    <>
      {/* Reels, TikTok, WhatsApp Status, Shorts */}
      <Composition
        id="CustomerPortrait"
        component={CustomerPromo}
        defaultProps={{ scenes: CUSTOMER_FULL }}
        durationInFrames={sec(totalSeconds(CUSTOMER_FULL))}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* YouTube, website, presentations */}
      <Composition
        id="CustomerLandscape"
        component={CustomerPromo}
        defaultProps={{ scenes: CUSTOMER_FULL }}
        durationInFrames={sec(totalSeconds(CUSTOMER_FULL))}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 15-second ad / story cut */}
      <Composition
        id="CustomerTeaser"
        component={CustomerPromo}
        defaultProps={{ scenes: CUSTOMER_TEASER }}
        durationInFrames={sec(totalSeconds(CUSTOMER_TEASER))}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* App icon set (npm run icons) */}
      <Still id="IconApp" component={AppIcon} width={1024} height={1024} />
      <Still id="IconAdaptiveForeground" component={AdaptiveForeground} width={1024} height={1024} />
      <Still id="IconAdaptiveMonochrome" component={AdaptiveMonochrome} width={1024} height={1024} />
      <Still id="IconNotification" component={NotificationIcon} width={96} height={96} />
      <Still id="IconSplash" component={SplashLogo} width={1230} height={810} />
      <Still id="IconFavicon" component={Favicon} width={196} height={196} />
    </>
  );
}
