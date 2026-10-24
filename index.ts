import { registerRootComponent } from 'expo';

import App from './App';

// Release builds: drop verbose logs (they include order, payment and wallet data
// that would otherwise end up in device logs). Warnings and errors are kept.
if (!__DEV__) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

registerRootComponent(App);
