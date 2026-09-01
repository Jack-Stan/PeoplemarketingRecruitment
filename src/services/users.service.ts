import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Functie, Role, UserProfile } from '@/types/user';

/**
 * Thin wrapper for `/users/{uid}` — the ONLY source of role/officeId/
 * isTeamLeader (see UserProfile and decisions/006). No custom claims, no
 * Cloud Function: role changes are plain Firestore writes, gated by
 * firestore.rules the same way every other admin-only write in this app is.
 */
export const usersService = {
  /** Self-signup / invite-completion: create the caller's own pending profile doc. */
  async createProfile(
    uid: string,
    email: string,
    displayName: string | null,
    desiredOfficeId: string,
    phone: string | null = null,
  ): Promise<void> {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      displayName,
      role: null,
      primaryOfficeId: null,
      desiredOfficeId,
      functie: null,
      isTeamLeader: false,
      isActive: true,
      phone,
      emailVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  /** One-time fetch of the caller's own profile — used by `hydrate()` on sign-in/up. */
  async getOnce(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null;
  },

  /**
   * Live subscription to the caller's own profile — used by `hydrate()` so a
   * role assigned while the user is signed in (or even mid-session) applies
   * immediately, no sign-out/in needed like the old custom-claims flow did.
   */
  subscribeOwn(
    uid: string,
    onChange: (profile: UserProfile | null) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => onChange(snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null),
      onError,
    );
  },

  /** Admin-only: live list of every user (self-registered or admin-created). */
  subscribeAll(
    onChange: (users: UserProfile[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(db, 'users'),
      (snapshot) => onChange(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)),
      onError,
    );
  },

  /** Admin-only: grant role/office/isTeamLeader/functie with a direct Firestore write. */
  async assignRole(
    uid: string,
    role: Role,
    officeId: string,
    isTeamLeader: boolean,
    functie: Functie | null = null,
  ): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      role,
      primaryOfficeId: officeId,
      isTeamLeader,
      functie,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Admin-only: lock/unlock an account. `authStore.hydrate` treats
   * `isActive: false` as a forced sign-out (see stores/auth.ts), so this is
   * an actual access gate, not just a display flag — unlike the doc-level
   * `isActive` that was written at signup but never previously checked.
   */
  async setActive(uid: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { isActive, updatedAt: serverTimestamp() });
  },

  /** Admin-only: set/clear the contact number shown on the user detail page. */
  async setPhone(uid: string, phone: string | null): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { phone, updatedAt: serverTimestamp() });
  },

  /**
   * Self-service: a user updates their OWN phone number from Settings.
   * firestore.rules scopes this so a non-admin can only ever touch `phone`
   * on their own doc — everything else (role, office, email, isActive…)
   * stays admin-only. No verification concept on this field — see
   * project_spark_plan_no_blaze for why real phone verification (SMS OTP)
   * isn't in scope here.
   */
  async setOwnPhone(uid: string, phone: string | null): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { phone, updatedAt: serverTimestamp() });
  },

  /**
   * Self-service: mirrors Firebase Auth's `emailVerified` onto the caller's
   * own doc so an admin browsing `/users` can see it (the client SDK can't
   * read another account's Auth record). firestore.rules requires this to
   * equal `request.auth.token.email_verified` — the caller can't self-attest
   * an arbitrary value.
   */
  async syncOwnEmailVerified(uid: string, verified: boolean): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { emailVerified: verified, updatedAt: serverTimestamp() });
  },

  /**
   * Admin-only: hard-delete the `/users/{uid}` profile doc. This does NOT
   * delete the underlying Firebase Auth account (client SDK can't delete
   * other users' accounts — Admin SDK only, see scripts/grantRole.ts for the
   * equivalent pattern). Next sign-in attempt finds no profile doc and lands
   * on /pending-approval with role null — locked out in practice, but the
   * Auth account itself still exists until removed via the Admin SDK.
   * Deliberately does not touch `/recruitmentLeads` — lead history must
   * survive a recruiter's account being removed (client requirement).
   */
  async deleteUser(uid: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid));
  },
};

export type UsersService = typeof usersService;
