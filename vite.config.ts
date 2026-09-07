import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Default run = unit tests only. `tests/rules/**` needs the Firestore
    // emulator (and a JDK), so it is NOT part of the default include. A CLI
    // path argument is a FILTER over `include`, not a widener (verified:
    // `vitest run tests/rules` against this config exits "No test files
    // found"), so the rules suite has its own `vitest.rules.config.ts` and is
    // run via `npm run rules:test`.
    include: ['tests/unit/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      exclude: ['tests/**', '**/*.d.ts', 'dist/**', 'scripts/**', '*.config.*'],
    },
  },
});
