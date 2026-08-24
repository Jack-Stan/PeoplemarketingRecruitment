import type { FirebaseOptions } from 'firebase/app';

/**
 * Reads Vite env vars and exports a typed Firebase config. When
 * VITE_USE_EMULATORS is truthy we wire the SDK to local emulator hosts
 * (see `src/services/firebase.ts`). For production, set the env vars in
 * .env.local — or just delete .env.local and the values baked below are
 * used (this project ships with real People Marketing Firebase creds).
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyB-dUrj5tg3X5y-9PdJcO7NPWcTyFohF7Q',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'peoplemarketing-c5bfd.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'peoplemarketing-c5bfd',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'peoplemarketing-c5bfd.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '533725479834',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:533725479834:web:327357b2387d02e64eb023',
};

export const useEmulators =
  (import.meta.env.VITE_USE_EMULATORS ?? '').toString().toLowerCase() === 'true';

export const emulatorHosts = {
  auth: '127.0.0.1',
  firestore: '127.0.0.1',
};

export const emulatorPorts = {
  auth: 9099,
  firestore: 8080,
};