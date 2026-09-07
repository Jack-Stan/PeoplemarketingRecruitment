/**
 * Read-only prod audit for decisions/007 — "employee doc ID must equal the Auth uid".
 *
 * `employeesService.create()` used `addDoc` (random 20-char ID), while
 * firestore.rules and DashboardView both assume `employeeId === auth.uid`.
 * This script reports, per office, which employee docs are keyed by a real
 * Auth uid and which are orphans that no signed-in user can ever read.
 *
 * Writes nothing. Safe to run against prod — no emulator/FORCE_PROD guard is
 * needed here precisely because it is read-only.
 *
 * Credentials: reads GOOGLE_APPLICATION_CREDENTIALS if set, so the
 * service-account key can live OUTSIDE this repo. Falls back to the legacy
 * in-repo filename only when that env var is unset, and says so loudly —
 * a private key checked into a git working tree is a liability.
 *
 * Usage (preferred — key outside the repo):
 *   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/peoplemarketing-adminsdk.json \
 *     tsx scripts/auditEmployeeIds.ts
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { resolveProjectId } from './_guard';

const LEGACY_KEY_PATH = './peoplemarketing-c5bfd-firebase-adminsdk-fbsvc-b4092c4705.json';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const legacy = resolve(process.cwd(), LEGACY_KEY_PATH);
  if (existsSync(legacy)) {
    console.warn(
      `⚠  GOOGLE_APPLICATION_CREDENTIALS is unset — falling back to the in-repo key at\n` +
        `   ${legacy}\n` +
        '   Move that key outside the repo and set GOOGLE_APPLICATION_CREDENTIALS instead.',
    );
    process.env.GOOGLE_APPLICATION_CREDENTIALS = legacy;
  }
  // Otherwise leave it unset: the Admin SDK still resolves gcloud ADC or the
  // emulator hosts on its own, and its error message is clearer than ours.
}

const PROJECT_ID = resolveProjectId();
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
