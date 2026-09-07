/**
 * Local-only seed script. Run after `npm run emulators` is up:
 *
 *   npm run seed
 *
 * What it does:
 *   1. Creates a Firebase Auth user (admin@peoplemarketing.nl / admin123)
 *      using the Admin SDK talking to the Auth emulator.
 *   2. Creates the matching Firestore docs (role/office live only in
 *      Firestore, not custom claims — see decisions/006):
 *        - /users/{uid}
 *        - /offices/office-main
 *        - /offices/office-main/employees/{uid}  (mirrors the Auth account)
 *
 * Refuses to run when not pointing at emulators — this script must NEVER run
 * against production, and deliberately has NO escape hatch (no FORCE_PROD):
 * it creates an account with a hardcoded weak password. The guard reads the
 * Admin SDK's own emulator signal and fails closed — see scripts/_guard.ts
 * for why the previous VITE_USE_EMULATORS check was worse than useless.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { requireEmulator, resolveProjectId } from './_guard';

requireEmulator('seed.ts');

const PROJECT_ID = resolveProjectId();

const app = initializeApp({
  projectId: PROJECT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

// Admin SDK talks to emulators via FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.
// `firebase emulators:start` exports those for spawned processes when using `exec`.
const ADMIN_EMAIL = 'admin@peoplemarketing.nl';
const ADMIN_PASSWORD = 'admin123';
const OFFICE_ID = 'office-main';
const OFFICE_NAME = 'People Marketing — Main';

async function ensureAuthUser(): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`✔ Auth user already exists (${existing.uid})`);
    return existing.uid;
  } catch {
    const created = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: 'Big Boss',
    });
    console.log(`✔ Created Auth user ${ADMIN_EMAIL} → ${created.uid}`);
    return created.uid;
  }
}

async function seedOffice(): Promise<void> {
  const ref = db.collection('offices').doc(OFFICE_ID);
  await ref.set(
    {
      officeId: OFFICE_ID,
      name: OFFICE_NAME,
      timezone: 'Europe/Amsterdam',
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`✔ Upserted /offices/${OFFICE_ID}`);
}

async function seedUserDoc(uid: string): Promise<void> {
  await db
    .collection('users')
    .doc(uid)
    .set(
      {
        uid,
        email: ADMIN_EMAIL,
        displayName: 'Big Boss',
        primaryOfficeId: OFFICE_ID,
        desiredOfficeId: null,
        role: 'Administrator',
        isTeamLeader: true,
        isActive: true,
        phone: null,
        emailVerified: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  console.log(`✔ Upserted /users/${uid}`);
}

async function seedEmployeeDoc(uid: string): Promise<void> {
  await db
    .collection('offices')
    .doc(OFFICE_ID)
    .collection('employees')
    .doc(uid)
    .set(
      {
        employeeId: uid,
        officeId: OFFICE_ID,
        firstName: 'Big',
        lastName: 'Boss',
        email: ADMIN_EMAIL,
        phone: null,
        role: 'Administrator',
        isActive: true,
        isTeamLeader: true,
        weeklyContractHours: 40,
        employmentType: 'FullTime',
        avatarUrl: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  console.log(`✔ Upserted /offices/${OFFICE_ID}/employees/${uid}`);
}

async function main(): Promise<void> {
  const uid = await ensureAuthUser();
  await seedOffice();
  await seedUserDoc(uid);
  await seedEmployeeDoc(uid);
  console.log('\n🎉 Seed complete.');
  console.log('   Login:  admin@peoplemarketing.nl / admin123');
  console.log('   Role:   Administrator');
  console.log(`   Office: ${OFFICE_ID}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});