// app/theme/colors.ts
// Brand colours shared across screens.

// Orange for text, icons and selection on the dark background.
export const ACCENT = '#f97316';
// Deeper orange for filled buttons and cards, so white text on it stays readable.
export const ACCENT_FILL = '#ea580c';

// Solid fill for places that used to take a two-colour gradient.
export const fill = (colors: readonly string[]) => (colors[0] === ACCENT ? ACCENT_FILL : colors[0]);
