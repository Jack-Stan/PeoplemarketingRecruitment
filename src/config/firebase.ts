import type { FirebaseOptions } from 'firebase/app';

/**
 * Reads Vite env vars and exports a typed Firebase config. When
 * VITE_USE_EMULATORS is truthy we wire the SDK to local emulator hosts
 * (see `src/services/firebase.ts`). There is no hardcoded fallback: every
 * environment (local dev, Netlify deploy previews, production) must set
 * these env vars explicitly, or the app refuses to start. This is
 * deliberate — a silent fallback to real credentials previously caused
 * dev/preview builds to write to live production data.
 */
function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value || typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Set it in .env.local (local dev) ` +
        'or in your Netlify site\'s environment variables (deploys).',
    );
  }
  return value;
}

export const firebaseConfig: FirebaseOptions = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
};

export const PROD_APP_URL = 'https://peoplemarketing.netlify.app';

/**
 * Resolves the base URL for email action links (invites, password resets, verification).
 * Falls back to the live Netlify production URL when running on localhost so that invite
 * emails sent from local dev environments still send recipients to the live app.
 */
export function getAppBaseUrl(): string {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const hostname = window.location.hostname;
    if (
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      !hostname.startsWith('192.168.') &&
      !hostname.startsWith('10.')
    ) {
      return window.location.origin.replace(/\/$/, '');
    }
  }

  return PROD_APP_URL;
}

export const useEmulators =
  (import.meta.env.VITE_USE_EMULATORS ?? '').toString().toLowerCase() === 'true';

/**
 * The one deliberate `console.*` in `src/` — everything else routes through
 * the toast store on purpose, but this has to be visible in the dev terminal/
 * devtools before any UI exists. The config above falls back to the REAL
 * People Marketing project when no `.env.local` is present, so a bare
 * `npm run dev` writes to live client data; that has actually happened. The
 * fallback stays (deleting it breaks the Netlify build, which has no env
 * vars set) — this just makes it impossible to do by accident unnoticed.
 */
export function warnIfProduction(): void {
  if (useEmulators) return;
  // eslint-disable-next-line no-console -- deliberate, see comment above.
  console.warn(
    `%c⚠ LIVE FIREBASE — project "${firebaseConfig.projectId}"`,
    'background:#b91c1c;color:#fff;font-weight:bold;padding:2px 6px',
    '\nEvery read and write hits real client data. Set VITE_USE_EMULATORS=true in .env.local to use the emulators instead.',
  );
}

export const emulatorHosts = {
  auth: '127.0.0.1',
  firestore: '127.0.0.1',
};

export const emulatorPorts = {
  auth: 9099,
  firestore: 8080,
};
