// plugins/withWakeWord.js
// Copies the "Hey Vesphe" Picovoice keyword files into the native projects at build
// time (Porcupine loads them from Android assets / the iOS app bundle).
//   assets/wake-word/hey-vesphe_android.ppn  → android/app/src/main/assets/
//   assets/wake-word/hey-vesphe_ios.ppn      → ios/<App>/ (added as a bundle resource)
// Missing files are skipped, so builds work before the keyword is trained.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const SOURCE_DIR = 'assets/wake-word';
const ANDROID_FILE = 'hey-vesphe_android.ppn';
const IOS_FILE = 'hey-vesphe_ios.ppn';

const withAndroidKeyword = config =>
  withDangerousMod(config, [
    'android',
    async cfg => {
      const src = path.join(cfg.modRequest.projectRoot, SOURCE_DIR, ANDROID_FILE);
      if (fs.existsSync(src)) {
        const dest = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/assets');
        fs.mkdirSync(dest, { recursive: true });
        fs.copyFileSync(src, path.join(dest, ANDROID_FILE));
      } else {
        console.warn(`[withWakeWord] ${SOURCE_DIR}/${ANDROID_FILE} not found; "Hey Vesphe" disabled on Android.`);
      }
      return cfg;
    },
  ]);

const withIosKeyword = config =>
  withXcodeProject(config, cfg => {
    const src = path.join(cfg.modRequest.projectRoot, SOURCE_DIR, IOS_FILE);
    if (!fs.existsSync(src)) {
      console.warn(`[withWakeWord] ${SOURCE_DIR}/${IOS_FILE} not found; "Hey Vesphe" disabled on iOS.`);
      return cfg;
    }
    const projectName = cfg.modRequest.projectName;
    const destDir = path.join(cfg.modRequest.platformProjectRoot, projectName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, IOS_FILE));
    const project = cfg.modResults;
    if (!project.hasFile(`${projectName}/${IOS_FILE}`)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: `${projectName}/${IOS_FILE}`,
        groupName: projectName,
        isBuildFile: true,
        project,
      });
    }
    return cfg;
  });

module.exports = config => withIosKeyword(withAndroidKeyword(config));
