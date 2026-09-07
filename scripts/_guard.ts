/**
 * Shared fail-closed target guard for every Admin SDK script in this folder.
 *
 * WHY THIS EXISTS
 * ---------------
 * The old guard was `(process.env.VITE_USE_EMULATORS ?? 'true') === 'true'`,
 * which DEFAULTS TO PASS. `VITE_USE_EMULATORS` is a Vite *client* variable —
 * the Admin SDK has never read it. The Admin SDK only talks to emulators when
 * `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` are set in the
 * environment. So running e.g. `tsx scripts/seed.ts` straight from a shell
 * where `GOOGLE_APPLICATION_CREDENTIALS` points at the service-account key
 * passed the guard *and* wrote to PRODUCTION — creating a known-weak-password
 * admin account in the live client database.
 *
 * The fix: guard on the SDK's OWN signal (the two *_EMULATOR_HOST vars), and
 * fail closed when they are absent. No `?? 'true'` default anywhere.
 */

/** True only when the Admin SDK is actually pointed at both emulators. */
export function onEmulator(): boolean {
  return !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
}

export function resolveProjectId(): string {
  return process.env.VITE_FIREBASE_PROJECT_ID ?? 'peoplemarketing-c5bfd';
}

function describeTarget(): string {
  return [
    `  project           : ${resolveProjectId()}`,
    `  FIRESTORE_EMULATOR_HOST     : ${process.env.FIRESTORE_EMULATOR_HOST ?? '(unset)'}`,
    `  FIREBASE_AUTH_EMULATOR_HOST : ${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '(unset)'}`,
  ].join('\n');
}

/**
 * Emulator-only. NO production escape hatch — for scripts that must never,
 * under any flag, touch live data (seed.ts creates a known weak password).
 */
export function requireEmulator(scriptName: string): void {
  if (onEmulator()) return;
  console.error(
    `❌ ${scriptName} refuses to run: the Admin SDK is not pointed at the emulators.\n` +
      describeTarget() +
      '\n\nThis script is emulator-only and has NO production escape hatch by design.\n' +
      'Run it through the emulator wrapper, e.g.:\n' +
      `  npm run ${scriptName.replace(/\.ts$/, '')}\n` +
      'or set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST yourself.',
  );
  process.exit(1);
}

/**
 * Emulator by default; production only when `FORCE_PROD=1` is set to exactly
 * `1`. Prints loudly what is about to happen against which project.
 *
 * @param scriptName    e.g. 'grantRole.ts', for the error/banner text
 * @param whatItWillDo  one-line plain description of the write, shown in the banner
 * @returns true when running against production (caller may want to log it)
 */
export function requireEmulatorOrForceProd(scriptName: string, whatItWillDo: string): boolean {
  if (onEmulator()) return false;

  if (process.env.FORCE_PROD !== '1') {
    console.error(
      `❌ ${scriptName} refuses to run: the Admin SDK is not pointed at the emulators.\n` +
        describeTarget() +
        `\n  FORCE_PROD                  : ${process.env.FORCE_PROD ?? '(unset)'}\n` +
        '\nWithout the emulator host variables this would write to PRODUCTION.\n' +
        'Either point at the emulators, or — if you genuinely mean production —\n' +
        're-run with FORCE_PROD=1 set to exactly "1".',
    );
    process.exit(1);
  }

  console.warn(
    '\n' +
      '════════════════════════════════════════════════════════════════\n' +
      ' ⚠  PRODUCTION RUN — FORCE_PROD=1\n' +
      `    script : ${scriptName}\n` +
      `    project: ${resolveProjectId()}\n` +
      `    action : ${whatItWillDo}\n` +
      '    This writes to the LIVE client database. Ctrl-C now if wrong.\n' +
      '════════════════════════════════════════════════════════════════\n',
  );
  return true;
}
