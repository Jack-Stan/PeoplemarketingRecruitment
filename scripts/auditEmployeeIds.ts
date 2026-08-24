/**
 * Read-only prod audit for decisions/007 — "employee doc ID must equal the Auth uid".
 *
 * `employeesService.create()` used `addDoc` (random 20-char ID), while
 * firestore.rules and DashboardView both assume `employeeId === auth.uid`.
 * This script reports, per office, which employee docs are keyed by a real
 * Auth uid and which are orphans that no signed-in user can ever read.
 *
 * Writes nothing. Safe to run against prod.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./peoplemarketing-c5bfd-firebase-adminsdk-fbsvc-b4092c4705.json \
 *     tsx scripts/auditEmployeeIds.ts
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'peoplemarketing-c5bfd';
const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

async function main(): Promise<void> {
  const uids = new Set<string>();
  const byEmail = new Map<string, string>();
  let page = await auth.listUsers(1000);
  for (;;) {
    for (const u of page.users) {
      uids.add(u.uid);
      if (u.email) byEmail.set(u.email.toLowerCase(), u.uid);
    }
    if (!page.pageToken) break;
    page = await auth.listUsers(1000, page.pageToken);
  }
  console.log(`Auth accounts: ${uids.size}`);
  for (const [email, uid] of byEmail) console.log(`  ${uid}  ${email}`);

  const offices = await db.collection('offices').get();
  console.log(`\nOffices: ${offices.size}`);

  for (const office of offices.docs) {
    const employees = await office.ref.collection('employees').get();
    console.log(`\n/offices/${office.id}/employees — ${employees.size} doc(s)`);
    for (const e of employees.docs) {
      const d = e.data();
      const keyedByUid = uids.has(e.id);
      const matchByEmail = d.email ? byEmail.get(String(d.email).toLowerCase()) : undefined;
      const verdict = keyedByUid
        ? 'OK   (keyed by Auth uid)'
        : matchByEmail
          ? `ORPHAN → should be ${matchByEmail} (matched on email)`
          : 'ORPHAN → no Auth account matches this email';
      console.log(`  ${e.id}  ${d.firstName ?? '?'} ${d.lastName ?? '?'}  <${d.email ?? 'no-email'}>  ${verdict}`);
    }

    const shifts = await office.ref.collection('shifts').get();
    const refd = new Map<string, number>();
    for (const s of shifts.docs) {
      const id = String(s.data().assignedEmployeeId ?? '');
      refd.set(id, (refd.get(id) ?? 0) + 1);
    }
    console.log(`/offices/${office.id}/shifts — ${shifts.size} doc(s)`);
    for (const [id, count] of refd) {
      console.log(`  assignedEmployeeId=${id} × ${count} ${uids.has(id) ? '(uid ✔)' : '(NOT a uid ✘)'}`);
    }
  }
}

main().catch((err) => {
  console.error('audit failed:', err);
  process.exit(1);
});
