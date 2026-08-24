import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { User } from 'firebase/auth';

import { authService } from '@/services/auth.service';
import { friendlyError } from '@/utils/errors';
import { Roles, type AppUser, type Role } from '@/types/user';

/**
 * Auth store. Wraps `authService` with reactive state. Reads custom claims
 * (role, officeId, isTeamLeader) from the ID token once a user is signed in.
 *
 * The full RBAC navigation guard is wired in Ticket 1 — for now the store
 * surfaces `role`/`officeId` so views can branch on it.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const role = ref<Role | null>(null);
  const officeId = ref<string | null>(null);
  const isTeamLeader = ref<boolean>(false);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => user.value !== null);
  const appUser = computed<AppUser | null>(() =>
    user.value
      ? {
          uid: user.value.uid,
          email: user.value.email,
          role: role.value,
          officeId: officeId.value,
          isTeamLeader: isTeamLeader.value,
        }
      : null,
  );

  function hasRole(...allowed: Role[]): boolean {
    return role.value !== null && allowed.includes(role.value);
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      await authService.signIn(email, password);
      // claims resolve via hydrate(); UI navigation handled by caller.
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function signOut(): Promise<void> {
    await authService.signOut();
    clear();
  }

  function clear(): void {
    user.value = null;
    role.value = null;
    officeId.value = null;
    isTeamLeader.value = false;
    error.value = null;
  }

  /**
   * Hydrate from a Firebase User + ID-token claims. Called by the
   * `onAuthStateChanged` subscription in main.ts.
   */
  async function hydrate(fbUser: User | null): Promise<void> {
    clear();
    if (!fbUser) return;
    user.value = fbUser;
    try {
      const claims = await authService.getClaims();
      if (claims) {
        role.value = (claims.role as Role | undefined) ?? null;
        officeId.value = (claims.officeId as string | undefined) ?? null;
        isTeamLeader.value = Boolean(claims.isTeamLeader);
      }
    } catch {
      // Leave claims null; the guard will reject the navigation.
    }
  }

  function hasRoleName(name: Role): boolean {
    return role.value === name;
  }

  return {
    user,
    role,
    officeId,
    isTeamLeader,
    isLoading,
    error,
    isAuthenticated,
    appUser,
    hasRole,
    hasRoleName,
    signIn,
    signOut,
    hydrate,
    clear,
    _constants: { Roles },
  };
});