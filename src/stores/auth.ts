import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { User } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';

import { authService } from '@/services/auth.service';
import { usersService } from '@/services/users.service';
import { friendlyError } from '@/utils/errors';
import type { AppUser, Functie, Role, UserProfile } from '@/types/user';

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
/**
 * Office the user picked/was invited into, parked here between "account
 * created" and "`/users/{uid}` doc written". `completeInvite` sets the
 * password (irreversible) BEFORE it can create the profile doc, so a failed
 * or denied `createProfile` used to strand the account forever: signed in,
 * no profile, no role, no retry, permanently parked on /pending-approval.
 * `hydrate` now retries the write from this key whenever it finds a
 * signed-in user with no profile doc, and clears it once the doc exists.
 */
const PENDING_OFFICE_KEY = 'pm_pending_office';

function markLoginNow(rememberMe: boolean): void {
  if (rememberMe) {
    localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
    localStorage.setItem(REMEMBER_KEY, '1');
  } else {
    localStorage.removeItem(LOGIN_AT_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

interface PendingProfile {
  officeId: string;
  displayName: string | null;
  phone: string | null;
}

function rememberPendingProfile(
  officeId: string,
  displayName: string | null,
  phone: string | null,
): void {
  if (!officeId) return;
  localStorage.setItem(PENDING_OFFICE_KEY, JSON.stringify({ officeId, displayName, phone }));
}

function forgetPendingProfile(): void {
  localStorage.removeItem(PENDING_OFFICE_KEY);
}

function readPendingProfile(): PendingProfile | null {
  const raw = localStorage.getItem(PENDING_OFFICE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingProfile>;
    return parsed.officeId
      ? {
          officeId: parsed.officeId,
          displayName: parsed.displayName ?? null,
          phone: parsed.phone ?? null,
        }
      : null;
  } catch {
    return null;
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
  /** Career-ladder functie from the `/users/{uid}` doc — see types/user.ts. */
  const functie = ref<Functie | null>(null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  /**
   * True when the `/users/{uid}` fetch itself FAILED (offline, rules hiccup),
   * as opposed to "the doc says role: null". Both leave `role` null, but they
   * mean very different things: the second is a genuinely pending account,
   * the first is an approved user whose profile we simply couldn't read — the
   * router must not tell them to wait for an approval they already have.
   */
  const profileLoadFailed = ref<boolean>(false);
  let unsubProfile: Unsubscribe | null = null;
  /**
   * uid the live profile subscription is currently attached to. `signIn`
   * awaits `hydrate` while main.ts's `onAuthStateChanged` fires `hydrate` for
   * the same sign-in concurrently; without this both would assign
   * `unsubProfile`, orphaning the first Unsubscribe — a stale listener that
   * survives `clear()` and can re-apply the old role/officeId afterwards.
   */
  let hydratedUid: string | null = null;

  const isAuthenticated = computed(() => user.value !== null);
  /**
   * Who to stamp on denormalised "who did this" fields (shift.employeeName,
   * availability.employeeName, audit-log actor). Prefers the `/users` doc's
   * displayName: Firebase Auth's own displayName is null for every
   * invite-completed account (see `displayName` above), and these snapshots
   * are permanent — writing "null"/an email address there is bad data forever.
   */
  const actorLabel = computed<string>(
    () => displayName.value || user.value?.displayName || user.value?.email || '',
  );
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
      // Same stranding risk as completeInvite — the Auth account exists the
      // moment signUp resolves, so the profile write must be retryable.
      rememberPendingProfile(desiredOfficeId, displayName || null, null);
      await usersService.createProfile(
        fbUser.uid,
        fbUser.email ?? email,
        displayName || null,
        desiredOfficeId,
      );
      forgetPendingProfile();
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
   * Never rejects: a failed network call to Firebase must still drop the
   * local session (and the sign-out button must not blow up the caller with
   * an unhandled rejection). Same try/catch → `error` shape as its siblings.
   */
  async function signOut(): Promise<boolean> {
    error.value = null;
    let ok = true;
    try {
      await authService.signOut();
    } catch (err) {
      error.value = friendlyError(err);
      ok = false;
    }
    localStorage.removeItem(LOGIN_AT_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    clear();
    return ok;
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
    let verified = false;
    try {
      verified = await authService.refreshEmailVerified(user.value);
    } catch (err) {
      // A reload failure (offline, token revoked) must not reject into the
      // caller — Settings just keeps showing the last known status.
      error.value = friendlyError(err);
      return false;
    }
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
      // Park the office BEFORE the profile write: from here on the password
      // is already set and irreversible, so if `createProfile` fails or is
      // denied, `hydrate` must be able to retry it instead of leaving the
      // account stranded with no profile doc.
      rememberPendingProfile(desiredOfficeId, displayName || null, phone || null);
      const existing = await usersService.getOnce(fbUser.uid);
      if (!existing) {
        await usersService.createProfile(
          fbUser.uid,
          fbUser.email ?? email,
          displayName || null,
          desiredOfficeId,
          phone || null,
        );
      }
      forgetPendingProfile();
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
    hydratedUid = null;
    profileLoadFailed.value = false;
    user.value = null;
    role.value = null;
    officeId.value = null;
    isTeamLeader.value = false;
    displayName.value = null;
    functie.value = null;
    error.value = null;
  }

  function applyProfile(
    profile: {
      role: Role | null;
      primaryOfficeId: string | null;
      isTeamLeader: boolean;
      displayName?: string | null;
      functie?: Functie | null;
    } | null,
  ): void {
    role.value = profile?.role ?? null;
    officeId.value = profile?.primaryOfficeId ?? null;
    isTeamLeader.value = Boolean(profile?.isTeamLeader);
    displayName.value = profile?.displayName ?? null;
    functie.value = profile?.functie ?? null;
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
    // Idempotent per uid: main.ts's onAuthStateChanged and signIn/signUp/
    // completeInvite all hydrate the same sign-in, often concurrently. Once a
    // uid has a live subscription there is nothing to redo, and re-running
    // would tear down and rebuild the listener for no reason.
    if (fbUser && hydratedUid === fbUser.uid && unsubProfile) return;
    clear();
    if (!fbUser) return;
    if (isSessionExpired()) {
      localStorage.removeItem(LOGIN_AT_KEY);
      localStorage.removeItem(REMEMBER_KEY);
      await authService.signOut();
      return;
    }
    user.value = fbUser;
    let profile: Awaited<ReturnType<typeof usersService.getOnce>> = null;
    try {
      profile = await usersService.getOnce(fbUser.uid);
    } catch {
      // Distinct from "no doc": this is a read FAILURE. Flag it so the router
      // can send the user to a retry screen instead of /pending-approval.
      profileLoadFailed.value = true;
    }
    if (!profileLoadFailed.value) {
      // Explicit `=== false` — a missing isActive field (accounts created
      // before this field existed, e.g. via scripts/grantRole.ts) must
      // default to active, not get treated as deactivated.
      if (profile && profile.isActive === false) {
        await signOutDeactivated();
        return;
      }
      // Signed in but no `/users` doc at all — the invite/signup flow died
      // between "account created" and "profile written". Retry that write
      // rather than parking them on /pending-approval forever.
      if (!profile) profile = await retryPendingProfile(fbUser);
      applyProfile(profile);
      // Self-heal the emailVerified mirror if it drifted (e.g. verified in a
      // past session, tab closed before Settings ever synced it) — fire and
      // forget, must not block navigation on a non-essential write.
      if (profile && profile.emailVerified !== fbUser.emailVerified) {
        try {
          void usersService
            .syncOwnEmailVerified(fbUser.uid, fbUser.emailVerified)
            .catch(() => undefined);
        } catch {
          // Non-essential mirror write — never let it break hydration.
        }
      }
    }
    // Drop any listener a concurrent hydrate() left behind before taking
    // ownership, so exactly one subscription is ever live per session.
    unsubProfile?.();
    hydratedUid = fbUser.uid;
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

  /**
   * Self-heal for an account whose Auth side exists but whose `/users` doc
   * never got written (see PENDING_OFFICE_KEY). Only ever writes the SAME
   * pending doc the signup/invite flow would have — role and primaryOfficeId
   * both null, so it can't grant anyone anything. Returns the profile if the
   * retry succeeded, null otherwise (the user still lands on
   * /pending-approval, but the next load will retry again).
   */
  async function retryPendingProfile(fbUser: User): Promise<UserProfile | null> {
    const pending = readPendingProfile();
    if (!pending || !fbUser.email) return null;
    try {
      await usersService.createProfile(
        fbUser.uid,
        fbUser.email,
        pending.displayName,
        pending.officeId,
        pending.phone,
      );
      forgetPendingProfile();
      return await usersService.getOnce(fbUser.uid);
    } catch {
      // Keep the key: another load (or a fixed `?office=` param) can retry.
      return null;
    }
  }

  /** Deactivated mid-session or found deactivated at hydrate — force sign-out. */
  async function signOutDeactivated(): Promise<void> {
    localStorage.removeItem(LOGIN_AT_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    await authService.signOut();
    clear();
  }

  /** Re-run the profile fetch after a failed load — the retry button on /unauthorized. */
  async function retryProfileLoad(): Promise<void> {
    const fbUser = user.value;
    if (!fbUser) return;
    hydratedUid = null;
    await hydrate(fbUser);
  }

  return {
    user,
    role,
    officeId,
    isTeamLeader,
    displayName,
    functie,
    isLoading,
    error,
    profileLoadFailed,
    isAuthenticated,
    appUser,
    actorLabel,
    hasRole,
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
    retryProfileLoad,
    clear,
  };
});
