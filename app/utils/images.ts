// app/utils/images.ts
import type { ImageSourcePropType } from 'react-native';

const PLACEHOLDER = require('../assets/placeholder.png');

// Remote image when available, otherwise a bundled neutral placeholder
// (via.placeholder.com, used previously, no longer exists).
export function imageSource(uri?: string | null): ImageSourcePropType {
  return uri ? { uri } : PLACEHOLDER;
}
