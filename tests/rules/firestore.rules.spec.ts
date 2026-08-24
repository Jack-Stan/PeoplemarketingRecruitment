/**
 * Firestore security rules tests. Requires the Firestore emulator to be
 * running — run via `npm run rules:test`, which wraps this in
 * `firebase emulators:exec`. Do NOT run under plain `vitest run` without the
 * emulator; every test in this file will fail to connect.
 *
 * Role/officeId/isTeamLeader live only in Firestore (`/users/{uid}`), not
 * custom claims (see decisions/006) — so `ctxFor` seeds that doc directly
 * (bypassing rules) before returning an authenticated context with no
 * claims at all, mirroring exactly what a real signed-in user looks like.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const OFFICE_ID = 'office-main';
const OTHER_OFFICE_ID = 'office-other';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'peoplemarketing-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`offices/${OFFICE_ID}`).set({ officeId: OFFICE_ID, name: 'Main' });
    await db.doc(`offices/${OFFICE_ID}/employees/emp-member`).set({
      employeeId: 'emp-member',
      officeId: OFFICE_ID,
      firstName: 'Mia',
      lastName: 'Member',
    });
    await db.doc(`offices/${OFFICE_ID}/shifts/shift-1`).set({
      officeId: OFFICE_ID,
      assignedEmployeeId: 'emp-member',
      status: 'approved',
      date: '2026-08-25',
    });
  });
});

interface Profile {
  role: 'Administrator' | 'TeamManager' | 'TeamMember' | null;
  primaryOfficeId: string | null;
  isTeamLeader?: boolean;
}

/** Seeds /users/{uid} (bypassing rules) then returns a plain authenticated context — no claims. */
async function ctxFor(uid: string, profile: Profile) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`users/${uid}`).set({
      uid,
      email: `${uid}@peoplemarketing.nl`,
      displayName: null,
      role: profile.role,
      primaryOfficeId: profile.primaryOfficeId,
      desiredOfficeId: null,
      isTeamLeader: profile.isTeamLeader ?? false,
      isActive: true,
    });
  });
  return testEnv.authenticatedContext(uid);
}

describe('employees', () => {
  it('a TeamMember cannot read another employee\'s document', async () => {
    const member = await ctxFor('emp-member-2', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(member.firestore().doc(`offices/${OFFICE_ID}/employees/emp-member`).get());
  });

  it('a TeamMember can read their own employee document', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      member.firestore().doc(`offices/${OFFICE_ID}/employees/emp-member`).get(),
    );
  });

  it('an Administrator can read the full roster', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      admin.firestore().doc(`offices/${OFFICE_ID}/employees/emp-member`).get(),
    );
  });

  // decisions/007 — the employee doc ID must BE the Auth uid of an account
  // already approved into this office, otherwise the doc is unreadable by the
  // person it represents (the read rules above compare request.auth.uid to it).
  it('an Administrator cannot create an employee doc under an ID with no /users account', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertFails(
      admin.firestore().doc(`offices/${OFFICE_ID}/employees/AbCdRandomAutoId12`).set({
        employeeId: 'AbCdRandomAutoId12',
        officeId: OFFICE_ID,
        firstName: 'Ghost',
        lastName: 'Hire',
      }),
    );
  });

  it('an Administrator cannot create an employee doc for a still-pending account', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/pending-1').set({
        uid: 'pending-1',
        email: 'pending@peoplemarketing.be',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      });
    });
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertFails(
      admin.firestore().doc(`offices/${OFFICE_ID}/employees/pending-1`).set({
        employeeId: 'pending-1',
        officeId: OFFICE_ID,
        firstName: 'Not',
        lastName: 'Approved',
      }),
    );
  });

  it('an Administrator can create an employee doc keyed by an approved account uid', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/approved-1').set({
        uid: 'approved-1',
        email: 'approved@peoplemarketing.be',
        role: 'TeamMember',
        primaryOfficeId: OFFICE_ID,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      });
    });
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      admin.firestore().doc(`offices/${OFFICE_ID}/employees/approved-1`).set({
        employeeId: 'approved-1',
        officeId: OFFICE_ID,
        firstName: 'Approved',
        lastName: 'Hire',
      }),
    );
  });
});

describe('shifts', () => {
  it('a TeamManager cannot approve shifts (delete = approve/reject path, admin only)', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(manager.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-1`).delete());
  });

  it('an Administrator can approve (delete the pending doc / transition) shifts', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(admin.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-1`).delete());
  });

  it('a TeamManager can create a draft shift', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      manager.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-new`).set({
        officeId: OFFICE_ID,
        assignedEmployeeId: 'emp-member',
        status: 'draft',
        date: '2026-08-26',
      }),
    );
  });
});

describe('cross-office isolation', () => {
  it('a user from another office cannot read this office\'s employees', async () => {
    const outsider = await ctxFor('outsider-1', { role: 'Administrator', primaryOfficeId: OTHER_OFFICE_ID });
    await assertFails(
      outsider.firestore().doc(`offices/${OFFICE_ID}/employees/emp-member`).get(),
    );
  });
});

describe('users (self-signup)', () => {
  it('a freshly signed-up user can create their own pending profile doc', async () => {
    const newUser = testEnv.authenticatedContext('new-user-1');
    await assertSucceeds(
      newUser.firestore().doc('users/new-user-1').set({
        uid: 'new-user-1',
        email: 'new@peoplemarketing.nl',
        displayName: 'New Person',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      }),
    );
  });

  it('a signing-up user must say which office they want (desiredOfficeId)', async () => {
    const newUser = testEnv.authenticatedContext('new-user-0');
    await assertFails(
      newUser.firestore().doc('users/new-user-0').set({
        uid: 'new-user-0',
        email: 'no-office@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        isTeamLeader: false,
        isActive: true,
      }),
    );
  });

  it('a signing-up user cannot grant themselves a role', async () => {
    const newUser = testEnv.authenticatedContext('new-user-2');
    await assertFails(
      newUser.firestore().doc('users/new-user-2').set({
        uid: 'new-user-2',
        email: 'sneaky@peoplemarketing.nl',
        role: 'Administrator',
        primaryOfficeId: OFFICE_ID,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      }),
    );
  });

  it('a user cannot create a pending profile doc for someone else', async () => {
    const newUser = testEnv.authenticatedContext('new-user-3');
    await assertFails(
      newUser.firestore().doc('users/someone-else').set({
        uid: 'someone-else',
        email: 'x@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      }),
    );
  });
});

describe('users (role assignment — no Cloud Function, direct Firestore write)', () => {
  it('an Administrator can approve a pending user into their own office', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/pending-1').set({
        uid: 'pending-1',
        email: 'pending@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      });
    });
    await assertSucceeds(
      admin.firestore().doc('users/pending-1').update({
        role: 'TeamMember',
        primaryOfficeId: OFFICE_ID,
        isTeamLeader: false,
      }),
    );
  });

  it('an Administrator cannot approve someone into a DIFFERENT office than their own', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/pending-2').set({
        uid: 'pending-2',
        email: 'pending2@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OTHER_OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      });
    });
    await assertFails(
      admin.firestore().doc('users/pending-2').update({
        role: 'TeamMember',
        primaryOfficeId: OTHER_OFFICE_ID,
        isTeamLeader: false,
      }),
    );
  });

  it('a TeamManager cannot assign roles', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/pending-3').set({
        uid: 'pending-3',
        email: 'pending3@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      });
    });
    await assertFails(
      manager.firestore().doc('users/pending-3').update({
        role: 'TeamMember',
        primaryOfficeId: OFFICE_ID,
        isTeamLeader: false,
      }),
    );
  });
});

describe('offices', () => {
  // Office directory (name/timezone/isActive only) is intentionally public —
  // SignupView needs it to show an office picker before the visitor has an
  // account at all. Sub-collections (employees/shifts/etc.) stay locked down.
  it('an unauthenticated visitor can read the office directory to fill in the signup form', async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertSucceeds(anon.firestore().doc(`offices/${OFFICE_ID}`).get());
  });

  it('an unauthenticated visitor still cannot read that office\'s employees', async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.firestore().doc(`offices/${OFFICE_ID}/employees/emp-member`).get());
  });
});

describe('periods', () => {
  it('no client can ever write to periods, even an Administrator', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertFails(
      admin.firestore().doc(`offices/${OFFICE_ID}/periods/2026-w34`).set({ foo: 'bar' }),
    );
  });
});
