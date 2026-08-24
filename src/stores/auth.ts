import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { User } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';

import { authService } from '@/services/auth.service';
import { usersService } from '@/services/users.service';
import { friendlyError } from '@/utils/errors';
import { Roles, type AppUser, type Role } from '@/types/user';

/**
 * Auth store. Wraps `authService` with reactive state. Role/officeId/
 * isTeamLeader come from the `/users/{uid}` Firestore doc, NOT custom claims
 * (see decisions/006) — `hydrate()` subscribes to it live, so a role
 * assigned mid-session applies immediately without a re-login.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const role = ref<Role | null>(null);
  const officeId = ref<string | null>(null);
  const isTeamLeader = ref<boolean>(false);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  let unsubProfile: Unsubscribe | null = null;

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
      const fbUser = await authService.signIn(email, password);
      // Hydrate claims here and await it, rather than relying on the
      // separate onAuthStateChanged subscription in main.ts — that listener
      // fires async and races the caller's post-signIn navigation, which was
      // sending freshly-signed-in users to /unauthorized because `role` was
      // still null when the router guard ran.
      await hydrate(fbUser);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Self-signup. Creates the Auth account plus its `/users/{uid}` pending
   * profile doc (role: null), then hydrates like `signIn` — awaited for the
   * same reason: the caller's post-signup navigation must not race claim
   * hydration.
   */
  async function signUp(
    email: string,
    password: string,
    displayName: string,
    desiredOfficeId: string,
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      const fbUser = await authService.signUp(email, password, displayName);
      await usersService.createProfile(fbUser.uid, fbUser.email ?? email, displayName || null, desiredOfficeId);
      await hydrate(fbUser);
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
    unsubProfile?.();
    unsubProfile = null;
    user.value = null;
    role.value = null;
    officeId.value = null;
    isTeamLeader.value = false;
    error.value = null;
  }

  function applyProfile(profile: { role: Role | null; primaryOfficeId: string | null; isTeamLeader: boolean } | null): void {
    role.value = profile?.role ?? null;
    officeId.value = profile?.primaryOfficeId ?? null;
    isTeamLeader.value = Boolean(profile?.isTeamLeader);
  }

  /**
   * Hydrate from a Firebase User: fetch `/users/{uid}` once so role is
   * available before the caller's post-auth navigation runs (same race
   * `signIn`/`signUp` always had to await), then keep it live via
   * `subscribeOwn` so a role assigned by an admin mid-session applies
   * without the user having to sign out/in. Called by both `signIn`/`signUp`
   * and the `onAuthStateChanged` subscription in main.ts.
   */
  async function hydrate(fbUser: User | null): Promise<void> {
    clear();
    if (!fbUser) return;
    user.value = fbUser;
    try {
      applyProfile(await usersService.getOnce(fbUser.uid));
    } catch {
      // Leave role/officeId null; the guard will treat this as pending.
    }
    unsubProfile = usersService.subscribeOwn(
      fbUser.uid,
      (profile) => applyProfile(profile),
      () => {
        // A live-update failure shouldn't kick the user out mid-session —
        // keep whatever role/office the initial getOnce() already applied.
      },
    );
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
    signUp,
    signOut,
    hydrate,
    clear,
    _constants: { Roles },
  };
});