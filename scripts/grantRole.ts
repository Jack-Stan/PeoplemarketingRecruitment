/**
 * Terminal-side role grant — writes { role, primaryOfficeId, isTeamLeader }
 * directly onto an existing Auth user's /users/{uid} doc by email. Used for
 * onboarding staff outside of `seed.ts` (which only ever creates the one
 * fixed bootstrap admin account) — e.g. granting the very first
 * Administrator, since the in-app Users page needs an admin to already
 * exist before anyone can use it.
 *
 * No custom claims involved (see decisions/006) — role/office/isTeamLeader
 * live only in Firestore, checked by firestore.rules via get(). This script
 * is the terminal equivalent of what UsersView.vue's "assign role" button
 * does from the app; both just write the same document.
 *
 * Usage (emulator):
 *   VITE_USE_EMULATORS=true tsx scripts/grantRole.ts <email> <role> <officeId> [isTeamLeader]
 *
 * Example:
 *   tsx scripts/grantRole.ts maria@peoplemarketing.nl TeamManager office-main true
 *
 * Refuses to run against production unless FORCE_PROD=true is set explicitly —
 * mirrors the emulator-only guard in seed.ts, but allows an opt-out since this
 * script (unlike seed.ts) is a legitimate thing to run against prod later.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const ROLES = ['Administrator', 'TeamManager', 'TeamMember'] as const;
type Role = (typeof ROLES)[number];

const [, , email, role, officeId, isTeamLeaderArg] = process.argv;

if (!email || !role || !officeId) {
  console.error('Usage: tsx scripts/grantRole.ts <email> <role> <officeId> [isTeamLeader]');
  console.error(`  role must be one of: ${ROLES.join(', ')}`);
  process.exit(1);
}

if (!ROLES.includes(role as Role)) {
  console.error(`❌ Invalid role "${role}". Must be one of: ${ROLES.join(', ')}`);
  process.exit(1);
}

const USE_EMULATORS = (process.env.VITE_USE_EMULATORS ?? 'true').toLowerCase() === 'true';
const FORCE_PROD = (process.env.FORCE_PROD ?? 'false').toLowerCase() === 'true';

if (!USE_EMULATORS && !FORCE_PROD) {
  console.error(
    '❌ Refusing to run against production without FORCE_PROD=true. ' +
      'Set VITE_USE_EMULATORS=true to target the emulator, or FORCE_PROD=true if you really mean it.',
  );
  process.exit(1);
}

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'peoplemarketing-c5bfd';
const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

async function main(): Promise<void> {
  const user = await auth.getUserByEmail(email);
  const isTeamLeader = isTeamLeaderArg === 'true';

  await db
    .collection('users')
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: user.email ?? email,
        displayName: user.displayName ?? null,
        role,
        primaryOfficeId: officeId,
        // Deliberately not touching desiredOfficeId: if this uid already has
        // a self-signup doc, that field is its "which office did they apply
        // to" history — merge:true leaves it as-is. A doc created fresh here
        // (admin-created account, never signed up) simply won't have the key.
        isTeamLeader,
        isActive: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  console.log(`✔ Granted role on ${email} (${user.uid}): { role: ${role}, officeId: ${officeId}, isTeamLeader: ${isTeamLeader} }`);
  console.log('  Takes effect immediately — the app subscribes to /users/{uid} live, no re-login needed.');
}

main().catch((err) => {
  console.error('grantRole failed:', err);
  process.exit(1);
});
