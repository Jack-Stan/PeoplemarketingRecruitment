import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

// The audit-log store's `record` calls its own closure-local `log`, not the
// exposed store method — so the only place an audit write can be observed
// end-to-end is the service boundary.
vi.mock('@/services/auditLog.service', () => ({
  auditLogService: {
    log: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(() => () => {}),
  },
}));

import { auditLogService } from '@/services/auditLog.service';
import { useUserActions } from '@/composables/useUserActions';
import { useAuthStore } from '@/stores/auth';
import { useUsersStore } from '@/stores/users';
import { useAuditLogStore } from '@/stores/auditLog';
import { useConfirmStore } from '@/stores/confirm';
import { useUiStore } from '@/stores/ui';
import type { UserProfile } from '@/types/user';

/**
 * `useUserActions` is the lockout-risk surface: it is the only thing standing
 * between an admin and an office with zero Administrators, or an admin
 * deleting their own account. Store methods are spied rather than the service
 * layer, so these tests pin the COMPOSABLE's decisions (does it call through
 * at all? does it audit-log? which office id?) independent of how the store
 * happens to talk to Firestore.
 */

const ADMIN: UserProfile = {
  uid: 'admin-1',
  email: 'boss@peoplemarketing.nl',
  displayName: 'Big Boss',
  role: 'Administrator',
  primaryOfficeId: 'office-main',
  desiredOfficeId: null,
  functie: 'Manager',
  isTeamLeader: true,
  isActive: true,
  phone: null,
  emailVerified: true,
};

const OTHER_ADMIN: UserProfile = { ...ADMIN, uid: 'admin-2', email: 'second@peoplemarketing.nl', displayName: 'Second Boss' };
const MEMBER: UserProfile = {
  ...ADMIN,
  uid: 'member-1',
  email: 'lid@peoplemarketing.nl',
  displayName: 'Team Lid',
  role: 'TeamMember',
  isTeamLeader: false,
  functie: 'Werver',
};
/** Pre-dates the isActive field entirely — script-created accounts look like this. */
const LEGACY_NO_ISACTIVE = { ...MEMBER, uid: 'legacy-1', displayName: 'Legacy Lid', isActive: undefined } as unknown as UserProfile;
/** Pending signup: no role, no office yet. */
const PENDING: UserProfile = {
  ...MEMBER,
  uid: 'pending-1',
  displayName: null,
  email: 'nieuw@peoplemarketing.nl',
  role: null,
  primaryOfficeId: null,
  desiredOfficeId: 'office-main',
};

const officeLabel = (id: string | null) => (id ? `Kantoor ${id}` : 'onbekend kantoor');

function setup(opts: { signedInAs?: string; users?: UserProfile[]; ownOfficeId?: string | null } = {}) {
  const auth = useAuthStore();
  auth.user = { uid: opts.signedInAs ?? 'admin-1', email: 'boss@peoplemarketing.nl' } as never;

  const users = useUsersStore();
  users.users = opts.users ?? [ADMIN, OTHER_ADMIN, MEMBER];

  const auditLog = useAuditLogStore();
  const ui = useUiStore();
  const confirm = useConfirmStore();

  const setActive = vi.spyOn(users, 'setActive').mockResolvedValue(true);
  const deleteUser = vi.spyOn(users, 'deleteUser').mockResolvedValue(true);
  // `record` is the composable's entry point (it derives actorUid/actorEmail
  // from the auth store itself); `log` is the underlying Firestore write.
  const record = vi.spyOn(auditLog, 'record').mockResolvedValue(undefined);
  const log = vi.spyOn(auditLog, 'log').mockResolvedValue(undefined);
  const ask = vi.spyOn(confirm, 'ask').mockResolvedValue(true);

  // `??` would collapse an explicitly-passed null into the default, which is
  // exactly the case the "no office anywhere" tests need to exercise.
  const ownOfficeId = 'ownOfficeId' in opts ? opts.ownOfficeId! : 'office-fallback';
  const actions = useUserActions(officeLabel, ref(ownOfficeId));
  return { actions, auditLog, users, ui, setActive, deleteUser, record, log, ask };
}

const lastToast = (ui: ReturnType<typeof useUiStore>) => ui.toasts[ui.toasts.length - 1];

describe('useUserActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('isUserActive — undefined means ACTIVE', () => {
    it('treats a missing isActive as active, not inactive', () => {
      const { actions } = setup();
      expect(actions.isUserActive(LEGACY_NO_ISACTIVE)).toBe(true);
    });

    it('treats an explicit false as inactive', () => {
      const { actions } = setup();
      expect(actions.isUserActive({ ...MEMBER, isActive: false })).toBe(false);
    });

    it('treats an explicit true as active', () => {
      const { actions } = setup();
      expect(actions.isUserActive(MEMBER)).toBe(true);
    });
  });

  describe('wouldRemoveLastAdminByStatus', () => {
    it('is true for the ONLY active Administrator of an office', () => {
      const { actions } = setup({ users: [ADMIN, MEMBER] });
      expect(actions.wouldRemoveLastAdminByStatus(ADMIN)).toBe(true);
    });

    it('is false when a second Administrator shares the office', () => {
      const { actions } = setup({ users: [ADMIN, OTHER_ADMIN, MEMBER] });
      expect(actions.wouldRemoveLastAdminByStatus(ADMIN)).toBe(false);
    });

    it('is false for a non-Administrator, even as the only one of their kind', () => {
      const { actions } = setup({ users: [ADMIN, MEMBER] });
      expect(actions.wouldRemoveLastAdminByStatus(MEMBER)).toBe(false);
    });

    it('is false for an already-inactive Administrator (nothing left to remove)', () => {
      const inactiveAdmin = { ...ADMIN, isActive: false };
      const { actions } = setup({ users: [inactiveAdmin, MEMBER] });
      expect(actions.wouldRemoveLastAdminByStatus(inactiveAdmin)).toBe(false);
    });

    it('counts a legacy Administrator with no isActive field as active', () => {
      const legacyAdmin = { ...ADMIN, isActive: undefined } as unknown as UserProfile;
      const { actions } = setup({ users: [legacyAdmin, MEMBER] });
      expect(actions.wouldRemoveLastAdminByStatus(legacyAdmin)).toBe(true);
    });

    it('is office-scoped — an Administrator in ANOTHER office does not count as cover', () => {
      const otherOfficeAdmin = { ...OTHER_ADMIN, primaryOfficeId: 'office-antwerp' };
      const { actions } = setup({ users: [ADMIN, otherOfficeAdmin] });
      expect(actions.wouldRemoveLastAdminByStatus(ADMIN)).toBe(true);
    });
  });

  describe('toggleActive', () => {
    it('refuses to deactivate the last Administrator and does NOT call the store', async () => {
      const { actions, ui, setActive } = setup({ users: [ADMIN, MEMBER] });
      await actions.toggleActive(ADMIN);

      expect(setActive).not.toHaveBeenCalled();
      expect(lastToast(ui).tone).toBe('error');
      expect(lastToast(ui).message).toContain('laatste beheerder');
      expect(lastToast(ui).message).toContain('Kantoor office-main');
    });

    it('allows deactivating an Administrator when a second one covers the office', async () => {
      const { actions, ui, setActive } = setup({ users: [ADMIN, OTHER_ADMIN] });
      await actions.toggleActive(ADMIN);

      expect(setActive).toHaveBeenCalledWith('admin-1', false);
      expect(lastToast(ui).tone).toBe('success');
    });

    it('reactivating is never blocked by the last-admin guard', async () => {
      const inactiveAdmin = { ...ADMIN, isActive: false };
      const { actions, setActive } = setup({ users: [inactiveAdmin] });
      await actions.toggleActive(inactiveAdmin);

      expect(setActive).toHaveBeenCalledWith('admin-1', true);
    });

    it('records a user_deactivated audit entry on success', async () => {
      const { actions, record } = setup({ users: [ADMIN, OTHER_ADMIN] });
      await actions.toggleActive(ADMIN);

      expect(record).toHaveBeenCalledWith('office-main', 'user_deactivated', 'Big Boss');
    });

    it('records user_reactivated when switching the other way', async () => {
      const inactiveAdmin = { ...ADMIN, isActive: false };
      const { actions, record } = setup({ users: [inactiveAdmin] });
      await actions.toggleActive(inactiveAdmin);

      expect(record).toHaveBeenCalledWith('office-main', 'user_reactivated', 'Big Boss');
    });

    it('does not audit-log when the store write fails, and surfaces the store error', async () => {
      const { actions, ui, users, record } = setup({ users: [ADMIN, OTHER_ADMIN] });
      vi.spyOn(users, 'setActive').mockResolvedValue(false);
      users.error = 'Geen toestemming.';

      await actions.toggleActive(ADMIN);

      expect(record).not.toHaveBeenCalled();
      expect(lastToast(ui).tone).toBe('error');
      expect(lastToast(ui).message).toBe('Geen toestemming.');
    });
  });

  describe('audit-log office fallback', () => {
    it('falls back to the acting admin’s own office when the target has no primaryOfficeId', async () => {
      const { actions, record } = setup({ users: [PENDING, ADMIN, OTHER_ADMIN], ownOfficeId: 'office-gent' });
      await actions.toggleActive(PENDING);

      expect(record).toHaveBeenCalledWith('office-gent', 'user_deactivated', 'nieuw@peoplemarketing.nl');
    });

    it('prefers the target’s own office over the fallback when it has one', async () => {
      const { actions, record } = setup({ users: [MEMBER, ADMIN, OTHER_ADMIN], ownOfficeId: 'office-gent' });
      await actions.toggleActive(MEMBER);

      expect(record).toHaveBeenCalledWith('office-main', expect.anything(), expect.anything());
    });

    it('passes an empty office id through when neither the target nor the actor has one', async () => {
      const { actions, record } = setup({ users: [PENDING, ADMIN, OTHER_ADMIN], ownOfficeId: null });
      await actions.toggleActive(PENDING);

      expect(record).toHaveBeenCalledWith('', expect.anything(), expect.anything());
    });

    it('an empty office id never reaches Firestore — record refuses to build `offices//auditLog`', async () => {
      // The real `record` (not spied) must DROP the write rather than throw
      // into a swallowed catch, which is how these used to vanish silently.
      const { actions, auditLog } = setup({ users: [PENDING, ADMIN, OTHER_ADMIN], ownOfficeId: null });
      vi.mocked(auditLog.record).mockRestore();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await actions.toggleActive(PENDING);
      await Promise.resolve();

      expect(auditLogService.log).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('a non-empty office id does reach the Firestore write, with the actor denormalised', async () => {
      const { actions, auditLog } = setup({ users: [MEMBER, ADMIN, OTHER_ADMIN], ownOfficeId: 'office-gent' });
      vi.mocked(auditLog.record).mockRestore();

      await actions.toggleActive(MEMBER);
      await Promise.resolve();

      expect(auditLogService.log).toHaveBeenCalledWith(
        'office-main',
        expect.objectContaining({ action: 'user_deactivated', actorUid: 'admin-1', targetLabel: 'Team Lid' }),
      );
    });
  });

  describe('removeUser', () => {
    it('blocks self-delete before asking for confirmation', async () => {
      const { actions, ui, ask, deleteUser } = setup({ signedInAs: 'admin-1', users: [ADMIN, OTHER_ADMIN] });
      const ok = await actions.removeUser(ADMIN);

      expect(ok).toBe(false);
      expect(ask).not.toHaveBeenCalled();
      expect(deleteUser).not.toHaveBeenCalled();
      expect(lastToast(ui).tone).toBe('error');
      expect(lastToast(ui).message).toMatch(/eigen account/i);
    });

    it('blocks deleting the last Administrator of an office', async () => {
      const { actions, ui, ask, deleteUser } = setup({ signedInAs: 'someone-else', users: [ADMIN, MEMBER] });
      const ok = await actions.removeUser(ADMIN);

      expect(ok).toBe(false);
      expect(ask).not.toHaveBeenCalled();
      expect(deleteUser).not.toHaveBeenCalled();
      expect(lastToast(ui).message).toContain('laatste beheerder');
    });

    it('does nothing when the confirm dialog is declined', async () => {
      const { actions, ask, deleteUser, record } = setup({ signedInAs: 'admin-2', users: [ADMIN, OTHER_ADMIN, MEMBER] });
      ask.mockResolvedValue(false);

      const ok = await actions.removeUser(MEMBER);

      expect(ok).toBe(false);
      expect(deleteUser).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('deletes, toasts and audit-logs on confirmation', async () => {
      const { actions, ui, deleteUser, record } = setup({ signedInAs: 'admin-1', users: [ADMIN, OTHER_ADMIN, MEMBER] });
      const ok = await actions.removeUser(MEMBER);

      expect(ok).toBe(true);
      expect(deleteUser).toHaveBeenCalledWith('member-1');
      expect(lastToast(ui).tone).toBe('success');
      expect(record).toHaveBeenCalledWith('office-main', 'user_deleted', 'Team Lid');
    });

    it('returns false and skips the audit log when the store delete fails', async () => {
      const { actions, users, record } = setup({ signedInAs: 'admin-1', users: [ADMIN, OTHER_ADMIN, MEMBER] });
      vi.spyOn(users, 'deleteUser').mockResolvedValue(false);

      const ok = await actions.removeUser(MEMBER);

      expect(ok).toBe(false);
      expect(record).not.toHaveBeenCalled();
    });

    it('labels a user with no displayName by their email', async () => {
      const { actions, record } = setup({ signedInAs: 'admin-1', users: [PENDING, ADMIN, OTHER_ADMIN] });
      await actions.removeUser(PENDING);

      expect(record).toHaveBeenCalledWith('office-fallback', 'user_deleted', 'nieuw@peoplemarketing.nl');
    });
  });

  describe('isSelf', () => {
    it('is true only for the signed-in uid', () => {
      const { actions } = setup({ signedInAs: 'admin-1' });
      expect(actions.isSelf(ADMIN)).toBe(true);
      expect(actions.isSelf(MEMBER)).toBe(false);
    });
  });
});
