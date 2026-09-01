import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { employeesService } from '@/services/employees.service';
import { usersService } from '@/services/users.service';
import { friendlyError } from '@/utils/errors';
import type { Functie, Role, UserProfile } from '@/types/user';

/**
 * Admin-only user directory. Backs `UsersView.vue` — lists every account
 * (self-registered or admin-created) via the `/users` collection and assigns
 * roles with a direct Firestore write, gated by firestore.rules (see
 * decisions/006 — no Cloud Function involved).
 */
export const useUsersStore = defineStore('users', () => {
  const users = ref<UserProfile[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  let unsub: Unsubscribe | null = null;

  const pendingUsers = computed(() => users.value.filter((u) => u.role === null));
  /** Office-scoped — used by UsersView to block demoting the last Administrator. */
  function adminCountFor(officeId: string): number {
    return users.value.filter((u) => u.role === 'Administrator' && u.primaryOfficeId === officeId).length;
  }

  function subscribe(): void {
    unsubscribe();
    isLoading.value = true;
    unsub = usersService.subscribeAll(
      (list) => {
        users.value = list;
        isLoading.value = false;
        error.value = null;
      },
      (err) => {
        error.value = friendlyError(err);
        isLoading.value = false;
      },
    );
  }

  function unsubscribe(): void {
    unsub?.();
    unsub = null;
  }

  /**
   * `/users/{uid}` is the single source of truth for role/isTeamLeader
   * (decisions/006). The office roster (`/offices/{id}/employees/{uid}`)
   * keeps its own copy only because a TeamManager can't read other people's
   * `/users` docs under firestore.rules — so every assignment here also
   * pushes the same values onto the roster doc, best-effort, to stop the two
   * from drifting apart. See employeesService.syncRoleAndTeamLeader.
   */
  async function assignRole(
    uid: string,
    role: Role,
    officeId: string,
    isTeamLeader: boolean,
    functie: Functie | null = null,
  ): Promise<boolean> {
    error.value = null;
    try {
      await usersService.assignRole(uid, role, officeId, isTeamLeader, functie);
      await employeesService.syncRoleAndTeamLeader(officeId, uid, role, isTeamLeader, functie);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function setActive(uid: string, isActive: boolean): Promise<boolean> {
    error.value = null;
    try {
      await usersService.setActive(uid, isActive);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function deleteUser(uid: string): Promise<boolean> {
    error.value = null;
    try {
      await usersService.deleteUser(uid);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function setPhone(uid: string, phone: string | null): Promise<boolean> {
    error.value = null;
    try {
      await usersService.setPhone(uid, phone);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  return {
    users,
    isLoading,
    error,
    pendingUsers,
    adminCountFor,
    subscribe,
    unsubscribe,
    assignRole,
    setActive,
    deleteUser,
    setPhone,
  };
});
