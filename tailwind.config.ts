import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import { brand } from './src/assets/brand';

/**
 * Tailwind is wired off `src/assets/brand.ts` so a single edit to the
 * placeholder pink hex propagates everywhere. Replace the PLACEHOLDER values
 * once the client confirms the exact brand colours.
 */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          pink: brand.primary.pink,
          'pink-alt': brand.primary.pinkAlt,
          'pink-soft': brand.primary.pinkSoft,
        },
        neutral: {
          black: brand.neutral.black,
          white: brand.neutral.white,
          ink: brand.neutral.ink,
          mute: brand.neutral.mute,
          line: brand.neutral.line,
          surface: brand.neutral.surface,
        },
        semantic: {
          accent: brand.semantic.accent,
          'accent-text': brand.semantic.accentText,
          focus: brand.semantic.focus,
          success: brand.semantic.success,
          warning: brand.semantic.warning,
          danger: brand.semantic.danger,
        },
      },
      fontFamily: {
        sans: [brand.font.family],
      },
    },
  },
  plugins: [forms, typography],
} satisfies Config;