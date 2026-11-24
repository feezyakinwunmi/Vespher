import React, { useEffect, useState } from 'react';
import { registerRootComponent } from 'expo';
import { initTheme } from './app/theme/palette';

// Release builds: drop verbose logs (they include order, payment and wallet data
// that would otherwise end up in device logs). Warnings and errors are kept.
if (!__DEV__) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

// The theme has to be known before any screen module runs StyleSheet.create,
// so App is required only after the saved preference has loaded (a few ms; the
// native splash screen is still showing).
function Root() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    initTheme().finally(() => setApp(() => require('./App').default));
  }, []);
  return App ? React.createElement(App) : null;
}

registerRootComponent(Root);
