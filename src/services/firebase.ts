import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import { firebaseConfig, useEmulators, emulatorHosts, emulatorPorts } from '@/config/firebase';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  // Avoid double-connect during HMR.
  if (!(auth as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectAuthEmulator(auth, `http://${emulatorHosts.auth}:${emulatorPorts.auth}`, {
      disableWarnings: true,
    });
  }
  // Firestore tracks emulator host on the instance directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(db as any)._settings?.host?.includes(`${emulatorPorts.firestore}`)) {
    connectFirestoreEmulator(db, emulatorHosts.firestore, emulatorPorts.firestore);
  }
}

export { app };
