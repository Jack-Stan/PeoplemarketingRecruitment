/**
 * GDPR Art. 17 — right to erasure, implemented as ANONYMISATION rather than
 * deletion. The client explicitly wants historical/aggregate data kept
 * (shift history, staffing trends, recruitment funnel counts, the append-only
 * audit trail), so this script overwrites the identifying fields and leaves
 * every row in place. It NEVER deletes a document.
 *
 * What it overwrites with `[verwijderd]` / null:
 *   /users/{uid}                                    displayName, email, phone
 *   /offices/{oid}/employees/{uid}                  firstName, lastName, email, phone
 *   /offices/{oid}/shifts                           employeeName (denormalised copy), notes
 *   /offices/{oid}/availability                     employeeName (denormalised copy)
 *   /offices/{oid}/locations/{lid}/visits           employeeName (denormalised copy), notes
 *   /offices/{oid}/auditLog                         actorEmail (action/targetLabel kept — see below)
 *   /offices/{oid}/recruitmentLeads                 name, email, phone, notes
 *
 * And in Firebase Auth: `updateUser(uid, { disabled: true })` plus
 * `revokeRefreshTokens(uid)`, so the account cannot sign in again. The Auth
 * record itself is not deleted — deleting it would free the uid and orphan
 * every historical row that references it.
 *
 * The audit log is append-only by firestore.rules (create only, never
 * update/delete). That rule binds the CLIENT SDK; the Admin SDK bypasses
 * rules, which is the only reason this script can redact `actorEmail` there.
 * `action` and `createdAtMs` are kept deliberately — an audit trail with the
 * events removed is not an audit trail. `targetLabel` is left alone unless
 * --redact-audit-labels is passed, since it often names a *third* party
 * rather than the subject.
 *
 * ⚠ OPEN PRODUCT DECISION — RETENTION PERIODS
 * -------------------------------------------
 * This script answers "how do we erase on request". It does NOT answer "how
 * long do we keep data absent a request". Retention periods per collection
 * (shifts, availability, visits, auditLog, recruitmentLeads), and whether
 * anonymisation should ever run automatically on a schedule, are still an
 * open decision with the client. Until that is settled, this runs on demand
 * only. Anonymised-but-retained rows still count as processing under GDPR;
 * the retention justification must be documented before relying on it.
 *
 * Usage:
 *   tsx scripts/anonymiseSubject.ts <uid-or-email>            # DRY RUN (default)
 *   tsx scripts/anonymiseSubject.ts <uid-or-email> --apply    # actually writes
 *   tsx scripts/anonymiseSubject.ts <uid> --apply --redact-audit-labels
 *
 * Target guard: emulator by default; production requires FORCE_PROD=1.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, type DocumentReference, type Query, type UpdateData } from 'firebase-admin/firestore';

import { requireEmulatorOrForceProd, resolveProjectId } from './_guard';

const REDACTED = '[verwijderd]';

const args = process.argv.slice(2);
const subjectArg = args.find((a) => !a.startsWith('--'));
const APPLY = args.includes('--apply');
const REDACT_AUDIT_LABELS = args.includes('--redact-audit-labels');

if (!subjectArg) {
  console.error('Usage: tsx scripts/anonymiseSubject.ts <uid-or-email> [--apply] [--redact-audit-labels]');
  console.error('  Without --apply this prints a dry-run summary and writes nothing.');
  process.exit(1);
}

requireEmulatorOrForceProd(
  'anonymiseSubject.ts',
  APPLY
    ? `ANONYMISE all personal data for "${subjectArg}" and DISABLE their Auth account`
    : `dry-run only (no writes) for "${subjectArg}"`,
);

const PROJECT_ID = resolveProjectId();
const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

interface PlannedWrite {
  path: string;
  patch: Record<string, unknown>;
}

const planned: PlannedWrite[] = [];

function plan(ref: DocumentReference, patch: Record<string, unknown>): void {
  if (Object.keys(patch).length === 0) return;
  planned.push({ path: ref.path, patch });
}

/** Only include a field in the patch when the doc actually has it — avoids
 *  inventing keys on documents that pre-date a field. */
function redactPresent(data: Record<string, unknown>, fields: string[], value: unknown = REDACTED) {
  const patch: Record<string, unknown> = {};
  for (const f of fields) if (f in data) patch[f] = value;
  return patch;
}

async function resolveSubject(): Promise<{ uid: string; email: string | null; record: UserRecord | null }> {
  try {
    const record = subjectArg!.includes('@')
      ? await auth.getUserByEmail(subjectArg!)
      : await auth.getUser(subjectArg!);
    return { uid: record.uid, email: record.email ?? null, record };
  } catch {
    console.warn(`⚠  No Firebase Auth account for "${subjectArg}" — Firestore rows only, no account to disable.`);
    return subjectArg!.includes('@')
      ? { uid: '', email: subjectArg!, record: null }
      : { uid: subjectArg!, email: null, record: null };
  }
}

async function planFromQuery(q: Query, fields: string[]): Promise<void> {
  const snap = await q.get();
  for (const d of snap.docs) plan(d.ref, redactPresent(d.data(), fields));
}

async function planAnyOf(base: Query, clauses: Array<[string, unknown]>, fields: string[]): Promise<void> {
  const seen = new Set<string>();
  for (const [field, value] of clauses) {
    if (value === null || value === undefined || value === '') continue;
    const snap = await base.where(field, '==', value).get();
    for (const d of snap.docs) {
      if (seen.has(d.ref.path)) continue;
      seen.add(d.ref.path);
      plan(d.ref, redactPresent(d.data(), fields));
    }
  }
}

async function main(): Promise<void> {
  const { uid, email, record } = await resolveSubject();

  // 1. /users/{uid}
  if (uid) {
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists) {
      const data = userSnap.data() ?? {};
      plan(userSnap.ref, {
        ...redactPresent(data, ['displayName']),
        ...redactPresent(data, ['email'], `${REDACTED}@invalid.local`),
        ...redactPresent(data, ['phone'], null),
        // Belt and braces: the app treats isActive:false as a forced sign-out.
        isActive: false,
        anonymisedAtMs: Date.now(),
      });
    }
  }

  const officeSnap = await db.collection('offices').get();
  for (const office of officeSnap.docs) {
    const ref = office.ref;

    // 2. roster entry
    if (uid) {
      const emp = await ref.collection('employees').doc(uid).get();
      if (emp.exists) {
        const data = emp.data() ?? {};
        plan(emp.ref, {
          ...redactPresent(data, ['firstName', 'lastName']),
          ...redactPresent(data, ['email'], `${REDACTED}@invalid.local`),
          ...redactPresent(data, ['phone', 'avatarUrl'], null),
          isActive: false,
          anonymisedAtMs: Date.now(),
        });
      }

      // 3. shifts — denormalised employeeName copy + free-text notes
      await planAnyOf(
        ref.collection('shifts'),
        [
          ['assignedEmployeeId', uid],
          ['createdBy', uid],
        ],
        ['employeeName', 'notes'],
      );

      // 4. availability — denormalised employeeName copy
      await planFromQuery(ref.collection('availability').where('employeeId', '==', uid), ['employeeName']);

      // 5. location visits — denormalised employeeName copy + notes
      const locations = await ref.collection('locations').get();
      for (const loc of locations.docs) {
        await planFromQuery(loc.ref.collection('visits').where('employeeId', '==', uid), [
          'employeeName',
          'notes',
        ]);
      }

      // 6. audit log — actorEmail only (action/createdAtMs must survive)
      await planAnyOf(
        ref.collection('auditLog'),
        [
          ['actorUid', uid],
          ['actorEmail', email],
        ],
        REDACT_AUDIT_LABELS ? ['actorEmail', 'targetLabel'] : ['actorEmail'],
      );
    }

    // 7. recruitment leads — matched on the subject's own email only.
    //    Leads the subject CREATED are someone ELSE's personal data; the only
    //    trace of the subject on those rows is `createdBy` (an opaque uid,
    //    not an identifier in itself), so they are deliberately left alone.
    await planAnyOf(
      ref.collection('recruitmentLeads'),
      [['email', email]],
      ['name', 'email', 'phone', 'notes'],
    );
  }

  // ---- report ----
  console.log(`\nSubject : ${subjectArg}`);
  console.log(`  uid   : ${uid || '(none)'}`);
  console.log(`  email : ${email ?? '(none)'}`);
  console.log(`\n${planned.length} document(s) would be anonymised:\n`);
  for (const p of planned) {
    console.log(`  ${p.path}`);
    console.log(`    ${JSON.stringify(p.patch)}`);
  }
  if (record) {
    console.log(
      `\n  Firebase Auth ${record.uid}: set disabled=true (currently ${record.disabled}) + revoke refresh tokens`,
    );
  }
  console.log('\nNothing is deleted — every document stays in place, identifying fields only are overwritten.');

  if (!APPLY) {
    console.log('\n🔎 DRY RUN — no writes performed. Re-run with --apply to commit.');
    return;
  }

  // Firestore batches cap at 500 ops.
  for (let i = 0; i < planned.length; i += 450) {
    const batch = db.batch();
    // `patch` is a dynamic field map built from whichever keys the doc had,
    // so it cannot be narrowed to Admin SDK's UpdateData<T> ahead of time.
    for (const p of planned.slice(i, i + 450)) {
      batch.update(db.doc(p.path) as DocumentReference<Record<string, unknown>>, p.patch as UpdateData<Record<string, unknown>>);
    }
    await batch.commit();
  }
  console.log(`\n✔ Anonymised ${planned.length} document(s).`);

  if (record) {
    await auth.updateUser(record.uid, { disabled: true });
    await auth.revokeRefreshTokens(record.uid);
    console.log(`✔ Disabled Auth account ${record.uid} and revoked its refresh tokens.`);
  }
  console.log('\nReminder: retention PERIODS for the retained rows are still an open product decision.');
}

main().catch((err) => {
  console.error('anonymiseSubject failed:', err);
  process.exit(1);
});
