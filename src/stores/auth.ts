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
/**
 * "Aangemeld blijven" (remember me). Firebase Auth's own persistence is
 * either indefinite (`browserLocalPersistence`) or tab-session-only
 * (`browserSessionPersistence`) — neither expires after N days on its own,
 * so the 7-day rolling expiry is hand-rolled on top for the "remember me"
 * case. `loginAt` is stamped in localStorage on every sign-in where the box
 * was checked; `hydrate()` checks it on every app load / auth-state change
 * and force-signs-out once it's stale. When the box was left unchecked,
 * `authService.signIn` uses session persistence instead, so the browser
 * itself drops the session on close — no TTL bookkeeping needed for that case.
 */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_AT_KEY = 'pm_login_at';
const REMEMBER_KEY = 'pm_remember';

function markLoginNow(rememberMe: boolean): void {
  if (rememberMe) {
    localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
    localStorage.setItem(REMEMBER_KEY, '1');
  } else {
    localStorage.removeItem(LOGIN_AT_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

function isSessionExpired(): boolean {
  // Not a "remember me" session — Firebase's own session persistence already
  // drops it on browser close, so no separate TTL to enforce here.
  if (localStorage.getItem(REMEMBER_KEY) !== '1') return false;
  const raw = localStorage.getItem(LOGIN_AT_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) > SESSION_TTL_MS;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const role = ref<Role | null>(null);
  const officeId = ref<string | null>(null);
  const isTeamLeader = ref<boolean>(false);
  /**
   * From the `/users/{uid}` doc, NOT `user.value.displayName` — Firebase
   * Auth's own displayName is only ever set for the old self-signup flow
   * (authService.signUp calls updateProfile); invite-completed accounts
   * (the normal path now) never touch it, so it's null for most users.
   */
  const displayName = ref<string | null>(null);
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

  async function signIn(email: string, password: string, rememberMe = false): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      const fbUser = await authService.signIn(email, password, rememberMe);
      markLoginNow(rememberMe);
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
    localStorage.removeItem(LOGIN_AT_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    clear();
  }

  /**
   * Self-service email change from Settings. Sends a confirmation link to
   * `newEmail`; the auth email doesn't actually change until that link is
   * clicked, so `user.value.email` stays the old value here — no local
   * state to update on success.
   */
  async function changeEmail(newEmail: string, currentPassword: string): Promise<boolean> {
    error.value = null;
    if (!user.value) return false;
    try {
      await authService.changeEmail(user.value, newEmail, currentPassword);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  /** Resend the "Email address verification" mail — Settings' verify-email button. */
  async function resendVerificationEmail(): Promise<boolean> {
    error.value = null;
    if (!user.value) return false;
    try {
      await authService.sendVerificationEmail(user.value);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  /**
   * Re-checks Auth for a verified email (in case the link was clicked in
   * another tab) and mirrors it onto the Firestore doc so an admin can see
   * it — see usersService.syncOwnEmailVerified. Best-effort: a failed mirror
   * write shouldn't block the Settings page from showing the true status.
   */
  async function refreshEmailVerified(): Promise<boolean> {
    if (!user.value) return false;
    const verified = await authService.refreshEmailVerified(user.value);
    try {
      await usersService.syncOwnEmailVerified(user.value.uid, verified);
    } catch {
      // Admin's view of this field may lag until the next successful sync — not fatal.
    }
    return verified;
  }

  /** Firebase's built-in reset email — see authService.sendPasswordReset. */
  async function sendPasswordReset(email: string): Promise<boolean> {
    error.value = null;
    try {
      await authService.sendPasswordReset(email);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  /**
   * Admin-only: send a passwordless invite email. See authService.sendInvite
   * for why this doesn't need a Cloud Function.
   */
  async function sendInvite(email: string, desiredOfficeId: string): Promise<boolean> {
    error.value = null;
    try {
      await authService.sendInvite(email, desiredOfficeId);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  /**
   * Second half of the invite flow — CompleteInviteView calls this once the
   * user has clicked the emailed link and filled in a password + their
   * details. The link click itself proves email ownership (that's what
   * email-link sign-in is for) and signs them in passwordlessly; `password`
   * is then set on that fresh session via authService.setPassword so they
   * can log in normally afterward instead of needing the link every time.
   * Creates the same pending `/users/{uid}` doc self-signup would have, so
   * the rest of the approval flow (Users page, /pending-approval) is
   * identical either way.
   */
  async function completeInvite(
    email: string,
    url: string,
    password: string,
    displayName: string,
    phone: string,
    desiredOfficeId: string,
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      const fbUser = await authService.completeInvite(email, url);
      await authService.setPassword(fbUser, password);
      markLoginNow(false);
      const existing = await usersService.getOnce(fbUser.uid);
      if (!existing) {
        await usersService.createProfile(fbUser.uid, fbUser.email ?? email, displayName || null, desiredOfficeId, phone || null);
      }
      await hydrate(fbUser);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function clear(): void {
    unsubProfile?.();
    unsubProfile = null;
    user.value = null;
    role.value = null;
    officeId.value = null;
    isTeamLeader.value = false;
    displayName.value = null;
    error.value = null;
  }

  function applyProfile(
    profile: { role: Role | null; primaryOfficeId: string | null; isTeamLeader: boolean; displayName?: string | null } | null,
  ): void {
    role.value = profile?.role ?? null;
    officeId.value = profile?.primaryOfficeId ?? null;
    isTeamLeader.value = Boolean(profile?.isTeamLeader);
    displayName.value = profile?.displayName ?? null;
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
    if (isSessionExpired()) {
      localStorage.removeItem(LOGIN_AT_KEY);
      localStorage.removeItem(REMEMBER_KEY);
      await authService.signOut();
      return;
    }
    user.value = fbUser;
    try {
      const profile = await usersService.getOnce(fbUser.uid);
      // Explicit `=== false` — a missing isActive field (accounts created
      // before this field existed, e.g. via scripts/grantRole.ts) must
      // default to active, not get treated as deactivated.
      if (profile && profile.isActive === false) {
        await signOutDeactivated();
        return;
      }
      applyProfile(profile);
      // Self-heal the emailVerified mirror if it drifted (e.g. verified in a
      // past session, tab closed before Settings ever synced it) — fire and
      // forget, must not block navigation on a non-essential write.
      if (profile && profile.emailVerified !== fbUser.emailVerified) {
        void usersService.syncOwnEmailVerified(fbUser.uid, fbUser.emailVerified).catch(() => undefined);
      }
    } catch {
      // Leave role/officeId null; the guard will treat this as pending.
    }
    unsubProfile = usersService.subscribeOwn(
      fbUser.uid,
      (profile) => {
        // An admin can deactivate someone mid-session — enforce it live,
        // not just at next sign-in, same as the "last admin" guard on
        // UsersView is meant to prevent an account nobody can act on again.
        if (profile && profile.isActive === false) {
          void signOutDeactivated();
          return;
        }
        applyProfile(profile);
      },
      () => {
        // A live-update failure shouldn't kick the user out mid-session —
        // keep whatever role/office the initial getOnce() already applied.
      },
    );
  }

  /** Deactivated mid-session or found deactivated at hydrate — force sign-out. */
  async function signOutDeactivated(): Promise<void> {
    localStorage.removeItem(LOGIN_AT_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    await authService.signOut();
    clear();
  }

  function hasRoleName(name: Role): boolean {
    return role.value === name;
  }

  return {
    user,
    role,
    officeId,
    isTeamLeader,
    displayName,
    isLoading,
    error,
    isAuthenticated,
    appUser,
    hasRole,
    hasRoleName,
    signIn,
    signUp,
    signOut,
    changeEmail,
    resendVerificationEmail,
    refreshEmailVerified,
    sendPasswordReset,
    sendInvite,
    completeInvite,
    hydrate,
    clear,
    _constants: { Roles },
  };
});