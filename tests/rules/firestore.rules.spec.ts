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
    // isActive matters now: the public office read is scoped to active
    // offices only (2026-09-07 review A8).
    await db.doc(`offices/${OFFICE_ID}`).set({ officeId: OFFICE_ID, name: 'Main', isActive: true });
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
      type: 'D2D',
      createdBy: 'admin-1',
      employeeIsTeamLeader: false,
    });
  });
});

interface Profile {
  role: 'Administrator' | 'TeamManager' | 'TeamMember' | null;
  primaryOfficeId: string | null;
  isTeamLeader?: boolean;
  /** 2026-09-07 review A1 — a deactivated account must lose every role gate. */
  isActive?: boolean;
}

/**
 * Seeds /users/{uid} (bypassing rules) then returns an authenticated context.
 * The token carries email/email_verified because a real Firebase ID token
 * always does, and the rules now pin `actorEmail` (auditLog) and
 * `emailVerified` (self-update) to those claims.
 */
async function ctxFor(uid: string, profile: Profile) {
  const email = `${uid}@peoplemarketing.nl`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`users/${uid}`).set({
      uid,
      email,
      displayName: null,
      role: profile.role,
      primaryOfficeId: profile.primaryOfficeId,
      desiredOfficeId: null,
      isTeamLeader: profile.isTeamLeader ?? false,
      isActive: profile.isActive ?? true,
      emailVerified: true,
      phone: null,
    });
  });
  return testEnv.authenticatedContext(uid, { email, email_verified: true });
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
        type: 'D2D',
        createdBy: 'mgr-1',
        employeeIsTeamLeader: false,
      }),
    );
  });

  // 2026-09-07 review A3 — attribution/status matrix. `createdBy`, the
  // teamleader snapshot and the approve/reject signature were all
  // unvalidated on write until now.
  const draftShift = (assignedEmployeeId: string, createdBy: string) => ({
    officeId: OFFICE_ID,
    assignedEmployeeId,
    status: 'draft',
    date: '2026-08-27',
    type: 'D2D',
    createdBy,
    employeeIsTeamLeader: false,
  });

  it('a TeamManager cannot un-approve a shift (approved -> pending)', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-1`).update({ status: 'pending' }),
    );
  });

  it('a TeamMember cannot create a shift that is already approved', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-self-approved`).set({
        ...draftShift('emp-member', 'emp-member'),
        status: 'approved',
        decidedBy: 'emp-member',
      }),
    );
  });

  it('a TeamMember cannot create a shift attributed to another author', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-forged-author`).set(
        draftShift('emp-member', 'admin-1'),
      ),
    );
  });

  it('a TeamMember cannot forge the teamleader snapshot on their own shift', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-forged-tl`).set({
        ...draftShift('emp-member', 'emp-member'),
        employeeIsTeamLeader: true,
      }),
    );
  });

  it('a TeamMember cannot create a shift with a malformed date', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-bad-date`).set({
        ...draftShift('emp-member', 'emp-member'),
        date: '27-08-2026',
      }),
    );
  });

  it('a TeamMember can create their own draft shift', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      member.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-mine`).set(
        draftShift('emp-member', 'emp-member'),
      ),
    );
  });

  it('a TeamMember cannot reassign someone else\'s shift to themselves', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-other`).set(
        draftShift('someone-else', 'someone-else'),
      );
    });
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-other`).update({
        assignedEmployeeId: 'emp-member',
      }),
    );
  });

  it('a TeamMember can edit their own draft shift', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-own-draft`).set(
        draftShift('emp-member', 'emp-member'),
      );
    });
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      member.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-own-draft`).update({ notes: 'Regen' }),
    );
  });

  it('an Administrator cannot approve a shift under someone else\'s signature', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-pending`).set({
        ...draftShift('emp-member', 'emp-member'),
        status: 'pending',
      });
    });
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertFails(
      admin.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-pending`).update({
        status: 'approved',
        decidedBy: 'mgr-1',
        decidedAt: Date.now(),
      }),
    );
    await assertSucceeds(
      admin.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-pending`).update({
        status: 'approved',
        decidedBy: 'admin-1',
        decidedAt: Date.now(),
      }),
    );
  });
});

describe('availability', () => {
  const mark = (employeeId: string, isTeamLeader = false) => ({
    officeId: OFFICE_ID,
    employeeId,
    employeeName: 'Mia Member',
    employeeIsTeamLeader: isTeamLeader,
    date: '2026-08-27',
    weekStart: '2026-08-24',
  });

  it('a member can mark themselves available', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      member.firestore().doc(`offices/${OFFICE_ID}/availability/av-1`).set(mark('emp-member')),
    );
  });

  it('a member cannot mark availability for someone else', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/availability/av-2`).set(mark('someone-else')),
    );
  });

  it('a member cannot forge the teamleader flag on their availability', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/availability/av-3`).set(mark('emp-member', true)),
    );
  });

  // Presence-based by design: marking = create, unmarking = delete. There is
  // no legitimate update, so nobody gets one — not even an admin.
  it('nobody can update an availability doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/availability/av-4`).set(mark('emp-member'));
    });
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertFails(
      admin.firestore().doc(`offices/${OFFICE_ID}/availability/av-4`).update({ date: '2026-08-28' }),
    );
  });
});

describe('locations (isCoverageViewer: staff OR a teamleader-flagged member)', () => {
  const zone = {
    officeId: OFFICE_ID,
    name: 'Sint-Amandsberg',
    address: null,
    neighbourhood: 'Gent',
    lat: 51.06,
    lng: 3.75,
    boundary: null,
    notes: null,
    status: 'planned',
    timesVisited: 0,
    lastVisitedAt: null,
  };

  it('a plain TeamMember cannot create a location', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/locations/loc-new`).set(zone),
    );
  });

  it('a teamleader-flagged TeamMember CAN create a location (Stan: "teamleaders & admin can make zones")', async () => {
    const lead = await ctxFor('emp-lead', {
      role: 'TeamMember',
      primaryOfficeId: OFFICE_ID,
      isTeamLeader: true,
    });
    await assertSucceeds(
      lead.firestore().doc(`offices/${OFFICE_ID}/locations/loc-tl`).set(zone),
    );
  });

  it('a plain TeamMember cannot delete a location but a teamleader can', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/locations/loc-del`).set(zone);
    });
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(member.firestore().doc(`offices/${OFFICE_ID}/locations/loc-del`).delete());
    const lead = await ctxFor('emp-lead', {
      role: 'TeamMember',
      primaryOfficeId: OFFICE_ID,
      isTeamLeader: true,
    });
    await assertSucceeds(lead.firestore().doc(`offices/${OFFICE_ID}/locations/loc-del`).delete());
  });

  // 2026-09-07 review A7 — the visit-counter bump is the ONLY field a plain
  // member may touch, and lastVisitedAt may not be stamped in the future.
  it('a TeamMember cannot stamp a future lastVisitedAt on the counter bump', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/locations/loc-visit`).set(zone);
    });
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/locations/loc-visit`).update({
        timesVisited: 1,
        lastVisitedAt: Date.now() + 86_400_000,
      }),
    );
    await assertSucceeds(
      member.firestore().doc(`offices/${OFFICE_ID}/locations/loc-visit`).update({
        timesVisited: 1,
        lastVisitedAt: Date.now(),
      }),
    );
  });

  it('a TeamMember cannot backdate a visit log entry', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/locations/loc-log`).set(zone);
    });
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    const visit = (visitedAt: number) => ({
      employeeId: 'emp-member',
      employeeName: 'Mia Member',
      visitedAt,
      notes: null,
    });
    await assertFails(
      member.firestore()
        .doc(`offices/${OFFICE_ID}/locations/loc-log/visits/v-old`)
        .set(visit(Date.now() - 86_400_000)),
    );
    await assertSucceeds(
      member.firestore()
        .doc(`offices/${OFFICE_ID}/locations/loc-log/visits/v-now`)
        .set(visit(Date.now())),
    );
  });
});

describe('recruitmentLeads', () => {
  const lead = (createdBy: string) => ({
    officeId: OFFICE_ID,
    name: 'Kandidaat K',
    email: null,
    phone: null,
    source: 'WhatsApp',
    stage: 'new',
    notes: null,
    createdBy,
    createdAtMs: Date.now(),
  });

  it('a TeamMember can read leads', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/recruitmentLeads/lead-1`).set(lead('mgr-1'));
    });
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      member.firestore().doc(`offices/${OFFICE_ID}/recruitmentLeads/lead-1`).get(),
    );
  });

  it('a TeamMember cannot write a lead', async () => {
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertFails(
      member.firestore().doc(`offices/${OFFICE_ID}/recruitmentLeads/lead-2`).set(lead('emp-member')),
    );
  });

  it('a TeamManager can create a lead attributed to themselves', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      manager.firestore().doc(`offices/${OFFICE_ID}/recruitmentLeads/lead-3`).set(lead('mgr-1')),
    );
  });

  it('a TeamManager cannot create a lead with an unknown stage', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/recruitmentLeads/lead-4`).set({
        ...lead('mgr-1'),
        stage: 'ghosted',
      }),
    );
  });

  // 2026-09-07 review A4 — lead history must survive a recruiter leaving, so
  // deletion is admin-only, not "any staff" like the old `allow write` gave.
  it('a TeamManager cannot delete a lead, an Administrator can', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/recruitmentLeads/lead-5`).set(lead('mgr-1'));
    });
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/recruitmentLeads/lead-5`).delete(),
    );
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      admin.firestore().doc(`offices/${OFFICE_ID}/recruitmentLeads/lead-5`).delete(),
    );
  });
});

describe('deactivated accounts (isActive)', () => {
  // 2026-09-07 review A1: isActive was enforced only in authStore.hydrate —
  // a deactivated admin holding a valid ID token kept full DB access.
  it('a deactivated Administrator cannot read the roster', async () => {
    const admin = await ctxFor('admin-off', {
      role: 'Administrator',
      primaryOfficeId: OFFICE_ID,
      isActive: false,
    });
    await assertFails(
      admin.firestore().doc(`offices/${OFFICE_ID}/employees/emp-member`).get(),
    );
  });

  it('a deactivated Administrator cannot assign roles', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/pending-off').set({
        uid: 'pending-off',
        email: 'pending-off@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      });
    });
    const admin = await ctxFor('admin-off', {
      role: 'Administrator',
      primaryOfficeId: OFFICE_ID,
      isActive: false,
    });
    await assertFails(
      admin.firestore().doc('users/pending-off').update({
        role: 'Administrator',
        primaryOfficeId: OFFICE_ID,
        isTeamLeader: false,
      }),
    );
  });

  it('a deactivated TeamManager cannot append to the audit log', async () => {
    const manager = await ctxFor('mgr-off', {
      role: 'TeamManager',
      primaryOfficeId: OFFICE_ID,
      isActive: false,
    });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-off`).set({
        actorUid: 'mgr-off',
        actorEmail: 'mgr-off@peoplemarketing.nl',
        action: 'shift_approved',
        targetLabel: 'Mia Member · 2026-08-25',
        details: null,
        createdAtMs: Date.now(),
        officeId: OFFICE_ID,
      }),
    );
  });
});

describe('cross-office isolation', () => {
  // Multi-office (FRD §18, deployed 2026-08-25): an Administrator is staff of
  // EVERY office — this test previously asserted the opposite and silently
  // rotted (2026-09-01 review B1). Isolation is for non-admins.
  it('an Administrator from another office CAN read this office\'s employees (multi-office)', async () => {
    const outsider = await ctxFor('outsider-1', { role: 'Administrator', primaryOfficeId: OTHER_OFFICE_ID });
    await assertSucceeds(
      outsider.firestore().doc(`offices/${OFFICE_ID}/employees/emp-member`).get(),
    );
  });

  it('a TeamManager from another office cannot read this office\'s employees', async () => {
    const outsider = await ctxFor('outsider-mgr', { role: 'TeamManager', primaryOfficeId: OTHER_OFFICE_ID });
    await assertFails(
      outsider.firestore().doc(`offices/${OFFICE_ID}/employees/emp-member`).get(),
    );
  });

  it('a TeamMember from another office cannot read this office\'s shifts', async () => {
    const outsider = await ctxFor('outsider-member', { role: 'TeamMember', primaryOfficeId: OTHER_OFFICE_ID });
    await assertFails(
      outsider.firestore().doc(`offices/${OFFICE_ID}/shifts/shift-1`).get(),
    );
  });
});

describe('users (self-signup)', () => {
  // 2026-09-01 review B2: create now pins email to the ID token and rejects
  // overstated emailVerified / forged isTeamLeader — so these contexts must
  // carry token claims (a real signed-in user always has them).
  function signupCtx(uid: string, emailVerified = false) {
    return testEnv.authenticatedContext(uid, {
      email: `${uid}@peoplemarketing.nl`,
      email_verified: emailVerified,
    });
  }

  it('a freshly signed-up user can create their own pending profile doc', async () => {
    const newUser = signupCtx('new-user-1');
    await assertSucceeds(
      newUser.firestore().doc('users/new-user-1').set({
        uid: 'new-user-1',
        email: 'new-user-1@peoplemarketing.nl',
        displayName: 'New Person',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
        emailVerified: false,
      }),
    );
  });

  it('a signing-up user cannot claim an email that is not on their ID token', async () => {
    const newUser = signupCtx('new-user-4');
    await assertFails(
      newUser.firestore().doc('users/new-user-4').set({
        uid: 'new-user-4',
        email: 'admin@peoplemarketing.be',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
        emailVerified: false,
      }),
    );
  });

  it('a signing-up user cannot self-attest emailVerified: true', async () => {
    const newUser = signupCtx('new-user-5', false);
    await assertFails(
      newUser.firestore().doc('users/new-user-5').set({
        uid: 'new-user-5',
        email: 'new-user-5@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
        emailVerified: true,
      }),
    );
  });

  it('a signing-up user cannot grant themselves the Teamleider flag', async () => {
    const newUser = signupCtx('new-user-6');
    await assertFails(
      newUser.firestore().doc('users/new-user-6').set({
        uid: 'new-user-6',
        email: 'new-user-6@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: true,
        isActive: true,
        emailVerified: false,
      }),
    );
  });

  it('a signing-up user must say which office they want (desiredOfficeId)', async () => {
    const newUser = signupCtx('new-user-0');
    await assertFails(
      newUser.firestore().doc('users/new-user-0').set({
        uid: 'new-user-0',
        email: 'new-user-0@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        isTeamLeader: false,
        isActive: true,
        emailVerified: false,
      }),
    );
  });

  it('a signing-up user cannot grant themselves a role', async () => {
    const newUser = signupCtx('new-user-2');
    await assertFails(
      newUser.firestore().doc('users/new-user-2').set({
        uid: 'new-user-2',
        email: 'new-user-2@peoplemarketing.nl',
        role: 'Administrator',
        primaryOfficeId: OFFICE_ID,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
        emailVerified: false,
      }),
    );
  });

  // 2026-09-07 review A5 — exact field whitelist + isActive/uid pinned.
  it('a signing-up user cannot smuggle an unknown field into their profile', async () => {
    const newUser = signupCtx('new-user-7');
    await assertFails(
      newUser.firestore().doc('users/new-user-7').set({
        uid: 'new-user-7',
        email: 'new-user-7@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
        emailVerified: false,
        permissions: ['*'],
      }),
    );
  });

  it('a signing-up user cannot claim a uid other than their own', async () => {
    const newUser = signupCtx('new-user-8');
    await assertFails(
      newUser.firestore().doc('users/new-user-8').set({
        uid: 'admin-1',
        email: 'new-user-8@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
        emailVerified: false,
      }),
    );
  });

  it('a user cannot create a pending profile doc for someone else', async () => {
    const newUser = signupCtx('new-user-3');
    await assertFails(
      newUser.firestore().doc('users/someone-else').set({
        uid: 'someone-else',
        email: 'someone-else@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
        emailVerified: false,
      }),
    );
  });
});

describe('auditLog (append-only, attributed)', () => {
  // createdAtMs is now fenced to ±5 min of server time (2026-09-07 review
  // A2), so it must be stamped at test time, not hardcoded.
  const entry = (actorUid: string) => ({
    actorUid,
    actorEmail: `${actorUid}@peoplemarketing.nl`,
    action: 'shift_approved',
    targetLabel: 'Mia Member · 2026-08-25',
    details: null,
    createdAtMs: Date.now(),
    officeId: OFFICE_ID,
  });

  it('staff can append an entry attributed to themselves', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-1`).set(entry('mgr-1')),
    );
  });

  // 2026-09-01 review B3 — without the actorUid pin, a manager could append
  // rows blaming the admin, and append-only would make the forgery permanent.
  it('staff cannot append an entry attributed to someone else', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-2`).set(entry('admin-1')),
    );
  });

  it('an unknown action value is rejected', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-3`).set({
        ...entry('mgr-1'),
        action: 'made_up_action',
      }),
    );
  });

  // 2026-09-07 review A2 — actorUid alone wasn't enough: AuditLogView
  // renders actorEmail, so a manager writing their own uid with someone
  // else's email still framed that person, permanently.
  it('an entry carrying someone else\'s actorEmail is rejected', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-5`).set({
        ...entry('mgr-1'),
        actorEmail: 'admin-1@peoplemarketing.nl',
      }),
    );
  });

  it('an entry filed under a different officeId than its path is rejected', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-6`).set({
        ...entry('mgr-1'),
        officeId: OTHER_OFFICE_ID,
      }),
    );
  });

  it('a stale or far-future createdAtMs is rejected (it drives ordering)', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-7`).set({
        ...entry('mgr-1'),
        createdAtMs: 1756700000000,
      }),
    );
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-8`).set({
        ...entry('mgr-1'),
        createdAtMs: Date.now() + 365 * 86_400_000,
      }),
    );
  });

  it('an entry carrying an unexpected extra field is rejected', async () => {
    const manager = await ctxFor('mgr-1', { role: 'TeamManager', primaryOfficeId: OFFICE_ID });
    await assertFails(
      manager.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-9`).set({
        ...entry('mgr-1'),
        impersonatedBy: 'admin-1',
      }),
    );
  });

  it('nobody can update or delete an entry, not even an admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-4`).set(entry('admin-1'));
    });
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertFails(
      admin.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-4`).update({ details: 'edited' }),
    );
    await assertFails(admin.firestore().doc(`offices/${OFFICE_ID}/auditLog/entry-4`).delete());
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

  // Multi-office: assignment is deliberately NOT same-office-gated for admins
  // (office switcher, FRD §18) — this test previously asserted the opposite
  // and silently rotted (2026-09-01 review B1).
  it('an Administrator CAN approve someone into a different office (multi-office)', async () => {
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
    await assertSucceeds(
      admin.firestore().doc('users/pending-2').update({
        role: 'TeamMember',
        primaryOfficeId: OTHER_OFFICE_ID,
        isTeamLeader: false,
      }),
    );
  });

  // 2026-09-01 review B5: role revocation + pending-user edits.
  it('an Administrator can revoke a role back to pending (role null)', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/demote-1').set({
        uid: 'demote-1',
        email: 'demote@peoplemarketing.nl',
        role: 'TeamMember',
        primaryOfficeId: OFFICE_ID,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      });
    });
    await assertSucceeds(
      admin.firestore().doc('users/demote-1').update({ role: null, primaryOfficeId: null }),
    );
  });

  it('an Administrator can edit a still-pending (role null) user without touching role', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/pending-phone').set({
        uid: 'pending-phone',
        email: 'phone@peoplemarketing.nl',
        role: null,
        primaryOfficeId: null,
        desiredOfficeId: OFFICE_ID,
        isTeamLeader: false,
        isActive: true,
      });
    });
    await assertSucceeds(
      admin.firestore().doc('users/pending-phone').update({ phone: '+32470000000' }),
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

describe('users (self-service update — selfProfileUpdateOnly)', () => {
  // The self-update path is the widest non-admin write in the app and had no
  // direct coverage at all before 2026-09-07: every one of these fields is a
  // privilege-escalation vector if it ever slips through.
  async function selfCtx() {
    return ctxFor('self-1', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
  }

  it('a member can update their own phone number', async () => {
    const self = await selfCtx();
    await assertSucceeds(
      self.firestore().doc('users/self-1').update({ phone: '+32470000000' }),
    );
  });

  const forbidden: Array<[string, Record<string, unknown>]> = [
    ['role', { role: 'Administrator' }],
    ['primaryOfficeId', { primaryOfficeId: OTHER_OFFICE_ID }],
    ['isTeamLeader', { isTeamLeader: true }],
    ['isActive', { isActive: false }],
    ['email', { email: 'somebody-else@peoplemarketing.nl' }],
    ['displayName', { displayName: 'Impostor' }],
    ['functie', { functie: 'Country manager' }],
    ['desiredOfficeId', { desiredOfficeId: OTHER_OFFICE_ID }],
    ['emailVerified', { emailVerified: false }],
  ];

  for (const [field, patch] of forbidden) {
    it(`a member cannot change their own ${field}`, async () => {
      const self = await selfCtx();
      await assertFails(self.firestore().doc('users/self-1').update(patch));
    });
  }

  // 2026-09-05 review A5 — exact field whitelist, so no caller can smuggle
  // an unknown field onto their own profile doc.
  it('a member cannot add an unknown field to their own profile', async () => {
    const self = await selfCtx();
    await assertFails(
      self.firestore().doc('users/self-1').update({ permissions: ['*'] }),
    );
  });

  // 2026-09-07 review A6 — the last admin standing can't lock the org out.
  it('an Administrator cannot demote themselves', async () => {
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertFails(
      admin.firestore().doc('users/admin-1').update({ role: 'TeamMember' }),
    );
  });

  it('an Administrator can still demote a different Administrator', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/admin-2').set({
        uid: 'admin-2',
        email: 'admin-2@peoplemarketing.nl',
        role: 'Administrator',
        primaryOfficeId: OFFICE_ID,
        desiredOfficeId: null,
        isTeamLeader: false,
        isActive: true,
      });
    });
    const admin = await ctxFor('admin-1', { role: 'Administrator', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(
      admin.firestore().doc('users/admin-2').update({ role: 'TeamMember' }),
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

  // 2026-09-07 review A8 — a closed office is not part of the public
  // directory any more; signed-in users still see every office.
  it('an unauthenticated visitor cannot read an inactive office', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('offices/office-closed').set({
        officeId: 'office-closed',
        name: 'Closed',
        isActive: false,
      });
    });
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.firestore().doc('offices/office-closed').get());
  });

  it('a signed-in user can still read an inactive office', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('offices/office-closed').set({
        officeId: 'office-closed',
        name: 'Closed',
        isActive: false,
      });
    });
    const member = await ctxFor('emp-member', { role: 'TeamMember', primaryOfficeId: OFFICE_ID });
    await assertSucceeds(member.firestore().doc('offices/office-closed').get());
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
