import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// tests/setup.ts already mocks '@/services/users.service', but only with the
// handful of methods the auth store needs. This file-level mock replaces it
// with the full surface the users STORE calls.
vi.mock('@/services/users.service', () => ({
  usersService: {
    subscribeAll: vi.fn(() => () => {}),
    assignRole: vi.fn(),
    setActive: vi.fn(),
    deleteUser: vi.fn(),
    setPhone: vi.fn(),
  },
}));

vi.mock('@/services/employees.service', () => ({
  employeesService: {
    syncRoleAndTeamLeader: vi.fn(),
  },
}));

import { employeesService } from '@/services/employees.service';
import { usersService } from '@/services/users.service';
import { useUsersStore } from '@/stores/users';
import { friendlyError } from '@/utils/errors';
import type { UserProfile } from '@/types/user';

/** Derived, not hardcoded — the messages are being translated to Dutch in parallel. */
const PERMISSION_DENIED_MSG = friendlyError({ code: 'permission-denied' });

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
const ADMIN_2: UserProfile = { ...ADMIN, uid: 'admin-2', email: 'second@peoplemarketing.nl' };
const ADMIN_OTHER_OFFICE: UserProfile = { ...ADMIN, uid: 'admin-3', primaryOfficeId: 'office-antwerp' };
const MEMBER: UserProfile = { ...ADMIN, uid: 'member-1', role: 'TeamMember', isTeamLeader: false };
const PENDING_A: UserProfile = { ...ADMIN, uid: 'p1', role: null, primaryOfficeId: null, desiredOfficeId: 'office-main' };
const PENDING_B: UserProfile = { ...PENDING_A, uid: 'p2' };

function withUsers(list: UserProfile[]) {
  vi.mocked(usersService.subscribeAll).mockImplementationOnce((onChange) => {
    onChange(list);
    return () => {};
  });
  const store = useUsersStore();
  store.subscribe();
  return store;
}

describe('users store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('starts empty', () => {
      const store = useUsersStore();
      expect(store.users).toEqual([]);
      expect(store.pendingUsers).toEqual([]);
      expect(store.error).toBeNull();
    });

    it('populates from the live callback and clears loading', () => {
      const store = withUsers([ADMIN, MEMBER]);
      expect(store.users).toHaveLength(2);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('surfaces a friendly error through onError', () => {
      vi.mocked(usersService.subscribeAll).mockImplementationOnce((_onChange, onError) => {
        onError(Object.assign(new Error('nope'), { code: 'permission-denied' }));
        return () => {};
      });
      const store = useUsersStore();
      store.subscribe();

      expect(store.error).toBe(PERMISSION_DENIED_MSG);
      expect(store.isLoading).toBe(false);
    });

    it('unsubscribe calls the stored teardown function', () => {
      const unsubFn = vi.fn();
      vi.mocked(usersService.subscribeAll).mockReturnValueOnce(unsubFn);
      const store = useUsersStore();
      store.subscribe();
      store.unsubscribe();

      expect(unsubFn).toHaveBeenCalledTimes(1);
    });

    it('re-subscribing tears the previous subscription down first', () => {
      const first = vi.fn();
      const second = vi.fn();
      vi.mocked(usersService.subscribeAll).mockReturnValueOnce(first).mockReturnValueOnce(second);
      const store = useUsersStore();
      store.subscribe();
      store.subscribe();

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).not.toHaveBeenCalled();
    });
  });

  describe('pendingUsers', () => {
    it('lists only users with a null role', () => {
      const store = withUsers([ADMIN, MEMBER, PENDING_A, PENDING_B]);
      expect(store.pendingUsers.map((u) => u.uid)).toEqual(['p1', 'p2']);
    });

    it('is empty when everyone has a role', () => {
      const store = withUsers([ADMIN, MEMBER]);
      expect(store.pendingUsers).toEqual([]);
    });
  });

  describe('adminCountFor', () => {
    it('counts Administrators in the given office only', () => {
      const store = withUsers([ADMIN, ADMIN_2, ADMIN_OTHER_OFFICE, MEMBER]);
      expect(store.adminCountFor('office-main')).toBe(2);
      expect(store.adminCountFor('office-antwerp')).toBe(1);
    });

    it('returns 0 for an office with no admins, and for an unknown office', () => {
      const store = withUsers([MEMBER]);
      expect(store.adminCountFor('office-main')).toBe(0);
      expect(store.adminCountFor('office-nowhere')).toBe(0);
    });

    it('does not count pending users with a null office', () => {
      const store = withUsers([PENDING_A, ADMIN]);
      expect(store.adminCountFor('')).toBe(0);
      expect(store.adminCountFor('office-main')).toBe(1);
    });

    it('counts inactive Administrators too — status is the caller’s concern', () => {
      // useUserActions layers the isActive check on top; the store's count is
      // deliberately status-blind, and the composable's tests pin that split.
      const store = withUsers([{ ...ADMIN, isActive: false }, ADMIN_2]);
      expect(store.adminCountFor('office-main')).toBe(2);
    });
  });

  describe('assignRole — double write (users doc + roster mirror)', () => {
    it('writes the user doc first, then syncs the roster, and returns true', async () => {
      vi.mocked(usersService.assignRole).mockResolvedValue(undefined);
      vi.mocked(employeesService.syncRoleAndTeamLeader).mockResolvedValue(undefined);

      const store = useUsersStore();
      const ok = await store.assignRole('member-1', 'TeamManager', 'office-main', true, 'Teamcaptain');

      expect(ok).toBe(true);
      expect(usersService.assignRole).toHaveBeenCalledWith('member-1', 'TeamManager', 'office-main', true, 'Teamcaptain');
      expect(employeesService.syncRoleAndTeamLeader).toHaveBeenCalledWith(
        'office-main',
        'member-1',
        'TeamManager',
        true,
        'Teamcaptain',
      );
      expect(store.error).toBeNull();
    });

    it('defaults functie to null when the caller omits it', async () => {
      vi.mocked(usersService.assignRole).mockResolvedValue(undefined);
      vi.mocked(employeesService.syncRoleAndTeamLeader).mockResolvedValue(undefined);

      const store = useUsersStore();
      await store.assignRole('member-1', 'TeamMember', 'office-main', false);

      expect(usersService.assignRole).toHaveBeenCalledWith('member-1', 'TeamMember', 'office-main', false, null);
      expect(employeesService.syncRoleAndTeamLeader).toHaveBeenCalledWith(
        'office-main',
        'member-1',
        'TeamMember',
        false,
        null,
      );
    });

    it('does NOT attempt the roster sync when the user-doc write fails', async () => {
      vi.mocked(usersService.assignRole).mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'permission-denied' }),
      );

      const store = useUsersStore();
      const ok = await store.assignRole('member-1', 'TeamManager', 'office-main', true);

      expect(ok).toBe(false);
      expect(employeesService.syncRoleAndTeamLeader).not.toHaveBeenCalled();
      expect(store.error).toBe(PERMISSION_DENIED_MSG);
    });

    /**
     * PARTIAL FAILURE — the important one. There is no transaction spanning
     * `/users/{uid}` and `/offices/{id}/employees/{uid}`, so if the roster
     * sync fails AFTER the user doc write succeeded, the authoritative role
     * IS already changed but the roster mirror is stale, and the store still
     * reports failure. These tests pin that observable behaviour rather than
     * pretending it is atomic.
     */
    describe('when the roster sync fails after the user write succeeded', () => {
      beforeEach(() => {
        vi.mocked(usersService.assignRole).mockResolvedValue(undefined);
        vi.mocked(employeesService.syncRoleAndTeamLeader).mockRejectedValue(
          Object.assign(new Error('nope'), { code: 'permission-denied' }),
        );
      });

      it('returns false even though the authoritative write already landed', async () => {
        const store = useUsersStore();
        const ok = await store.assignRole('member-1', 'TeamManager', 'office-main', true);

        expect(ok).toBe(false);
        expect(usersService.assignRole).toHaveBeenCalledTimes(1);
      });

      it('does NOT roll the user doc back — the role change stands', async () => {
        const store = useUsersStore();
        await store.assignRole('member-1', 'TeamManager', 'office-main', true);

        // No compensating write exists; assignRole was called exactly once,
        // with the NEW role, and nothing put the old one back.
        expect(usersService.assignRole).toHaveBeenCalledTimes(1);
        expect(usersService.assignRole).toHaveBeenCalledWith('member-1', 'TeamManager', 'office-main', true, null);
      });

      it('surfaces the roster error, so the caller cannot tell which half failed', async () => {
        const store = useUsersStore();
        await store.assignRole('member-1', 'TeamManager', 'office-main', true);

        expect(store.error).toBe(PERMISSION_DENIED_MSG);
      });

      it('a retry re-runs BOTH writes — the user doc write is not idempotency-guarded', async () => {
        const store = useUsersStore();
        await store.assignRole('member-1', 'TeamManager', 'office-main', true);
        vi.mocked(employeesService.syncRoleAndTeamLeader).mockResolvedValueOnce(undefined);
        const ok = await store.assignRole('member-1', 'TeamManager', 'office-main', true);

        expect(ok).toBe(true);
        expect(usersService.assignRole).toHaveBeenCalledTimes(2);
        expect(store.error).toBeNull();
      });
    });

    it('clears a previous error at the start of a successful call', async () => {
      vi.mocked(usersService.assignRole).mockRejectedValueOnce(new Error('first failure'));
      const store = useUsersStore();
      await store.assignRole('member-1', 'TeamMember', 'office-main', false);
      expect(store.error).toBe('first failure');

      vi.mocked(usersService.assignRole).mockResolvedValueOnce(undefined);
      vi.mocked(employeesService.syncRoleAndTeamLeader).mockResolvedValueOnce(undefined);
      await store.assignRole('member-1', 'TeamMember', 'office-main', false);

      expect(store.error).toBeNull();
    });
  });

  describe('setActive', () => {
    it('delegates and returns true', async () => {
      vi.mocked(usersService.setActive).mockResolvedValue(undefined);
      const store = useUsersStore();

      expect(await store.setActive('member-1', false)).toBe(true);
      expect(usersService.setActive).toHaveBeenCalledWith('member-1', false);
    });

    it('passes true through for reactivation', async () => {
      vi.mocked(usersService.setActive).mockResolvedValue(undefined);
      const store = useUsersStore();
      await store.setActive('member-1', true);

      expect(usersService.setActive).toHaveBeenCalledWith('member-1', true);
    });

    it('returns false and records a friendly error on failure', async () => {
      vi.mocked(usersService.setActive).mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'permission-denied' }),
      );
      const store = useUsersStore();

      expect(await store.setActive('member-1', false)).toBe(false);
      expect(store.error).toBe(PERMISSION_DENIED_MSG);
    });
  });

  describe('deleteUser', () => {
    it('delegates and returns true', async () => {
      vi.mocked(usersService.deleteUser).mockResolvedValue(undefined);
      const store = useUsersStore();

      expect(await store.deleteUser('member-1')).toBe(true);
      expect(usersService.deleteUser).toHaveBeenCalledWith('member-1');
    });

    it('returns false and records a friendly error on failure', async () => {
      vi.mocked(usersService.deleteUser).mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'permission-denied' }),
      );
      const store = useUsersStore();

      expect(await store.deleteUser('member-1')).toBe(false);
      expect(store.error).toBe(PERMISSION_DENIED_MSG);
    });

    it('does not touch the local users array — the live subscription owns that', async () => {
      vi.mocked(usersService.deleteUser).mockResolvedValue(undefined);
      const store = withUsers([ADMIN, MEMBER]);
      await store.deleteUser('member-1');

      expect(store.users).toHaveLength(2);
    });
  });

  describe('setPhone', () => {
    it('delegates a number through', async () => {
      vi.mocked(usersService.setPhone).mockResolvedValue(undefined);
      const store = useUsersStore();

      expect(await store.setPhone('member-1', '+32470123456')).toBe(true);
      expect(usersService.setPhone).toHaveBeenCalledWith('member-1', '+32470123456');
    });

    it('delegates a null to clear the number', async () => {
      vi.mocked(usersService.setPhone).mockResolvedValue(undefined);
      const store = useUsersStore();
      await store.setPhone('member-1', null);

      expect(usersService.setPhone).toHaveBeenCalledWith('member-1', null);
    });

    it('returns false and records a friendly error on failure', async () => {
      vi.mocked(usersService.setPhone).mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'permission-denied' }),
      );
      const store = useUsersStore();

      expect(await store.setPhone('member-1', '+32470123456')).toBe(false);
      expect(store.error).toBe(PERMISSION_DENIED_MSG);
    });
  });
});
