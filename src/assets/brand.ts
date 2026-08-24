/**
 * Brand tokens for People Marketing.
 *
 * Values marked PLACEHOLDER must be confirmed with the client before
 * production launch. The current site (https://peoplemarketing.nl) reads
 * visually as pink/black/white — the exact pink hex is pending confirmation.
 * Grab the real hex from the browser DevTools (Elements panel → computed
 * styles on the primary CTA) and replace the placeholder below.
 *
 * If multiple shades are needed, derive them programmatically with a colour
 * library (e.g. chroma-js) rather than hard-coding every tint.
 */
export const brand = {
  primary: {
    // PLACEHOLDER pink — default is a balanced, modern pink close to common
    // "People Marketing" hues. Replace with the client's confirmed hex.
    pink: '#EC4899',
    // PLACEHOLDER secondary accent (slightly hotter pink). Replace if needed.
    pinkAlt: '#FF3D8A',
    // PLACEHOLDER soft tint derived from pink — used for hover/background.
    pinkSoft: '#FCE7F3',
  },

  neutral: {
    black: '#000000',
    white: '#FFFFFF',
    ink: '#111111',
    mute: '#6B7280',
    line: '#E5E7EB',
    surface: '#FAFAFA',
  },

  semantic: {
    text: '#111111',
    textInverse: '#FFFFFF',
    bg: '#FFFFFF',
    bgMuted: '#FAFAFA',
    border: '#E5E7EB',
    accent: '#EC4899',
    accentText: '#FFFFFF',
    focus: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },

  logo: {
    // Replace with the real asset URL or `import logoUrl from '@/assets/logo.svg'`.
    src: null as string | null,
    alt: 'People Marketing',
    width: 120,
    height: 32,
  },

  font: {
    // PLACEHOLDER font stack — confirm with the client.
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
} as const;

export type Brand = typeof brand;