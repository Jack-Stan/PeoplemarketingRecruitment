import { defineConfig } from 'vitest/config';

/**
 * Separate config for the Firestore security-rules suite.
 *
 * The default `vite.config.ts` includes only `tests/unit/**` so a bare
 * `vitest` never tries to run the emulator-dependent specs. A CLI path
 * argument does NOT widen `include` — vitest treats it as a filter applied
 * on top of `include`, so `vitest run tests/rules` against the base config
 * exits with "No test files found". Hence this second config, used by
 * `npm run rules:test`.
 *
 * Requires the Firestore emulator (and a JDK 17 runtime) — the script wraps
 * it in `firebase emulators:exec`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
