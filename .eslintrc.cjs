/* eslint-env node */
// ESLint 8.x uses the eslintrc format by default (flat config would need
// ESLINT_USE_FLAT_CONFIG=true on this version), so this file is intentionally
// eslintrc-shaped. Keep it in sync with .prettierrc.json — formatting is
// Prettier's job, ESLint only handles correctness/style rules here.
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2022,
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
    'plugin:tailwindcss/recommended',
  ],
  settings: {
    tailwindcss: {
      config: 'tailwind.config.ts',
      callees: ['classnames', 'clsx', 'ctl'],
      whitelist: [],
    },
  },
  rules: {
    // Vue: the codebase uses single-word view/component names (DashboardView,
    // AppShell) and PascalCase SFC filenames — the default multi-word rule is
    // noise here, and attribute ordering is a formatting concern.
    'vue/multi-word-component-names': 'off',
    'vue/attributes-order': 'warn',
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/html-self-closing': 'off',
    'vue/html-indent': 'off',
    'vue/html-closing-bracket-newline': 'off',

    // TypeScript: warn (not error) on the things that appear in existing code
    // so `npm run lint` is usable as a gate today.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
    ],
    'no-unused-vars': 'off',

    // Tailwind: classname ordering is enforced by prettier-plugin-tailwindcss,
    // and the custom design tokens in tailwind.config.ts confuse the arbitrary
    // -value check, so these are warnings rather than build-breaking errors.
    'tailwindcss/classnames-order': 'warn',
    'tailwindcss/no-custom-classname': 'off',
    'tailwindcss/enforces-shorthand': 'warn',
    'tailwindcss/migration-from-tailwind-2': 'warn',

    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
  overrides: [
    {
      files: ['*.vue'],
      rules: {
        // `defineProps`/`defineEmits` etc. are compiler macros, not globals.
        'no-undef': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'dist-ssr/',
    'node_modules/',
    'coverage/',
    'emulator-data/',
    '.firebase/',
    '*.d.ts',
  ],
};
