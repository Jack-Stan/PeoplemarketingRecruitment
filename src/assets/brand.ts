/**
 * Brand tokens for People Marketing.
 *
 * Pink is the real value, pulled straight from the logo SVG served on
 * https://peoplemarketing.nl (fill="#e6007e" on the site's own <a.logo>
 * markup) — no longer a guess. This also resolves the client's "onze
 * kleuren zijn wit" comment: white is the mark/text colour used against a
 * dark ground (see the same source SVG), not a rejection of the pink.
 */
const primaryPink = '#e6007e';

export const brand = {
  primary: {
    pink: primaryPink,
    // PLACEHOLDER secondary accent (slightly hotter pink) — not sourced from
    // the client site, only used for hover states. Replace if the client
    // has an actual secondary tone.
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
    accent: primaryPink,
    accentText: '#FFFFFF',
    focus: primaryPink,
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },

  logo: {
    // Not imported here: this file is also loaded by tailwind.config.ts
    // outside Vite's module graph (via jiti), which can't resolve a raw
    // asset import. Import '@/assets/logo.svg' directly in the component
    // that renders it instead (see AppShell.vue).
    src: null as string | null,
    alt: 'People Marketing',
    width: 122,
    height: 51,
  },

  font: {
    // PLACEHOLDER font stack — confirm with the client.
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
} as const;

export type Brand = typeof brand;