/**
 * GDPR Art. 15 — right of access. Dumps EVERYTHING this app stores about one
 * data subject to a single JSON file. Read-only: writes nothing to Firestore
 * or Auth.
 *
 * Collections walked (all office-scoped except /users — note that
 * `recruitmentLeads` lives at /offices/{officeId}/recruitmentLeads, NOT at
 * the top level):
 *   /users/{uid}
 *   /offices/{officeId}/employees/{uid}
 *   /offices/{officeId}/shifts            assignedEmployeeId | createdBy | decidedBy == uid
 *   /offices/{officeId}/availability      employeeId == uid
 *   /offices/{officeId}/locations/{id}/visits   employeeId == uid
 *   /offices/{officeId}/auditLog          actorUid == uid
 *   /offices/{officeId}/recruitmentLeads  email == subject email | createdBy == uid
 *
 * Usage:
 *   tsx scripts/exportSubject.ts <uid-or-email> [--out ./export.json]
 *
 * Target guard: emulator by default; production requires FORCE_PROD=1.
 * Even though this only reads, a prod run pulls real personal data onto a
 * laptop — that deserves the same explicit banner as a write.
 *
 * OPEN PRODUCT DECISION: how long an export file may be retained once handed
 * to the subject, and whether the export itself must be logged to /auditLog,
 * are not settled. See the retention note in anonymiseSubject.ts.
 */
import { writeFileSync } from 'node:fs';

import { initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, type Query } from 'firebase-admin/firestore';

import { requireEmulatorOrForceProd, resolveProjectId } from './_guard';

const args = process.argv.slice(2);
const subjectArg = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? args[outIdx + 1] : undefined;

if (!subjectArg) {
  console.error('Usage: tsx scripts/exportSubject.ts <uid-or-email> [--out ./export.json]');
  process.exit(1);
}

requireEmulatorOrForceProd('exportSubject.ts', `read and export ALL personal data for "${subjectArg}"`);

const PROJECT_ID = resolveProjectId();
const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

type Row = Record<string, unknown>;

async function resolveSubject(): Promise<{ uid: string; email: string | null; authRecord: Row | null }> {
  let record: UserRecord | null = null;
  try {
    record = subjectArg!.includes('@')
      ? await auth.getUserByEmail(subjectArg!)
      : await auth.getUser(subjectArg!);
  } catch {
    // No Auth account (already deleted, or an email that only ever appeared
    // as a recruitment lead). Still worth exporting whatever Firestore holds.
    console.warn(`⚠  No Firebase Auth account for "${subjectArg}" — exporting Firestore data only.`);
  }

  if (record) {
    return {
      uid: record.uid,
      email: record.email ?? null,
      authRecord: {
        uid: record.uid,
        email: record.email ?? null,
        displayName: record.displayName ?? null,
        phoneNumber: record.phoneNumber ?? null,
        emailVerified: record.emailVerified,
        disabled: record.disabled,
        createdAt: record.metadata.creationTime,
        lastSignInAt: record.metadata.lastSignInTime,
        providers: record.providerData.map((p) => p.providerId),
      },
    };
  }
  return subjectArg!.includes('@')
    ? { uid: '', email: subjectArg!, authRecord: null }
    : { uid: subjectArg!, email: null, authRecord: null };
}

async function collect(q: Query, idField: string, extra: Row = {}): Promise<Row[]> {
  const snap = await q.get();
  return snap.docs.map((d) => ({ [idField]: d.id, ...extra, ...d.data() }));
}

/** Union of several equality queries, de-duplicated by doc id. */
async function collectAnyOf(
  base: Query,
  clauses: Array<[string, unknown]>,
  idField: string,
  extra: Row = {},
): Promise<Row[]> {
  const byId = new Map<string, Row>();
  for (const [field, value] of clauses) {
    if (value === null || value === undefined || value === '') continue;
    const snap = await base.where(field, '==', value).get();
    for (const d of snap.docs) byId.set(d.id, { [idField]: d.id, ...extra, ...d.data() });
  }
  return [...byId.values()];
}

async function main(): Promise<void> {
  const subject = await resolveSubject();
  const { uid, email } = subject;

  const offices: Row[] = [];
  const officeSnap = await db.collection('offices').get();

  for (const office of officeSnap.docs) {
    const officeId = office.id;
    const ref = office.ref;

    const employeeDoc = uid ? await ref.collection('employees').doc(uid).get() : null;

    const shifts = uid
      ? await collectAnyOf(
          ref.collection('shifts'),
          [
            ['assignedEmployeeId', uid],
            ['createdBy', uid],
            ['decidedBy', uid],
          ],
          'shiftId',
          { officeId },
        )
      : [];

    const availability = uid
      ? await collect(ref.collection('availability').where('employeeId', '==', uid), 'availabilityId', { officeId })
      : [];

    const auditLog = uid
      ? await collectAnyOf(
          ref.collection('auditLog'),
          [
            ['actorUid', uid],
            ['actorEmail', email],
          ],
          'entryId',
          { officeId },
        )
      : [];

    const recruitmentLeads = await collectAnyOf(
      ref.collection('recruitmentLeads'),
      [
        ['email', email],
        ['createdBy', uid],
      ],
      'leadId',
      { officeId },
    );

    // Visits live one level deeper — a subcollection per location.
    const visits: Row[] = [];
    if (uid) {
      const locations = await ref.collection('locations').get();
      for (const loc of locations.docs) {
        const found = await collect(
          loc.ref.collection('visits').where('employeeId', '==', uid),
          'visitId',
          { officeId, locationId: loc.id, locationName: loc.data().name ?? null },
        );
        visits.push(...found);
      }
    }

    const hasAnything =
      (employeeDoc?.exists ?? false) ||
      shifts.length > 0 ||
      availability.length > 0 ||
      auditLog.length > 0 ||
      recruitmentLeads.length > 0 ||
      visits.length > 0;

    if (!hasAnything) continue;

    offices.push({
      officeId,
      officeName: office.data().name ?? null,
      employee: employeeDoc?.exists ? { employeeId: employeeDoc.id, ...employeeDoc.data() } : null,
      shifts,
      availability,
      locationVisits: visits,
      auditLog,
      recruitmentLeads,
    });
  }

  const userDoc = uid ? await db.collection('users').doc(uid).get() : null;

  const payload = {
    _meta: {
      generatedAt: new Date().toISOString(),
      projectId: PROJECT_ID,
      subjectArg,
      resolvedUid: uid || null,
      resolvedEmail: email,
      basis: 'GDPR Art. 15 — right of access',
    },
    firebaseAuth: subject.authRecord,
    userProfile: userDoc?.exists ? { uid: userDoc.id, ...userDoc.data() } : null,
    offices,
  };

  const json = JSON.stringify(payload, null, 2);
  const target = outPath ?? `subject-export-${uid || email}-${Date.now()}.json`;
  writeFileSync(target, json, 'utf8');

  const counts = offices.map(
    (o) =>
      `  ${o.officeId}: employee=${o.employee ? 1 : 0} shifts=${(o.shifts as Row[]).length} ` +
      `availability=${(o.availability as Row[]).length} visits=${(o.locationVisits as Row[]).length} ` +
      `auditLog=${(o.auditLog as Row[]).length} leads=${(o.recruitmentLeads as Row[]).length}`,
  );
  console.log(`✔ Export written to ${target}`);
  console.log(`  Auth record : ${subject.authRecord ? 'found' : 'none'}`);
  console.log(`  /users doc  : ${payload.userProfile ? 'found' : 'none'}`);
  console.log(counts.length ? counts.join('\n') : '  (no office-scoped data found)');
}

main().catch((err) => {
  console.error('exportSubject failed:', err);
  process.exit(1);
});
