/**
 * Terminal-side full account removal — deletes BOTH the Firebase Auth
 * account and its /users/{uid} Firestore doc, by email.
 *
 * Why this has to be a script and not an in-app button: the Firebase client
 * SDK can only ever delete the currently signed-in user's own Auth account —
 * there is no client-side call for "admin deletes someone else's account".
 * That's Admin-SDK-only, same reason scripts/grantRole.ts exists instead of
 * a client-side claims write. UsersView.vue's "Verwijderen" button already
 * deletes the /users/{uid} doc (locks them out in practice — next sign-in
 * finds no profile and lands on /pending-approval), but the underlying Auth
 * account survives until this script runs. Run this after an in-app delete
 * to finish the job, or run it directly — either order works since it
 * deletes both.
 *
 * Deliberately does NOT touch /recruitmentLeads — lead history must survive
 * a recruiter's account being removed (client requirement, see the
 * 2026-08-25 client callback note on street-recruited leads).
 *
 * Usage (emulator):
 *   VITE_USE_EMULATORS=true tsx scripts/deleteUser.ts <email>
 *
 * Refuses to run against production unless FORCE_PROD=true is set explicitly —
 * same guard as grantRole.ts.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [, , email] = process.argv;

if (!email) {
  console.error('Usage: tsx scripts/deleteUser.ts <email>');
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

  await auth.deleteUser(user.uid);
  await db.collection('users').doc(user.uid).delete();

  console.log(`✔ Deleted ${email} (${user.uid}) — Auth account and /users/${user.uid} doc both removed.`);
  console.log('  Note: /offices/*/employees/{uid} (roster entry) and any /recruitmentLeads.createdBy references are untouched — remove the roster entry separately if needed; lead history stays by design.');
}

main().catch((err) => {
  console.error('deleteUser failed:', err);
  process.exit(1);
});
