import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Role, UserProfile } from '@/types/user';

/**
 * Thin wrapper for `/users/{uid}` — the ONLY source of role/officeId/
 * isTeamLeader (see UserProfile and decisions/006). No custom claims, no
 * Cloud Function: role changes are plain Firestore writes, gated by
 * firestore.rules the same way every other admin-only write in this app is.
 */
export const usersService = {
  /** Self-signup: create the caller's own pending profile doc. */
  async createProfile(
    uid: string,
    email: string,
    displayName: string | null,
    desiredOfficeId: string,
  ): Promise<void> {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      displayName,
      role: null,
      primaryOfficeId: null,
      desiredOfficeId,
      isTeamLeader: false,
      isActive: true,
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

  /** Admin-only: grant role/office/isTeamLeader with a direct Firestore write. */
  async assignRole(uid: string, role: Role, officeId: string, isTeamLeader: boolean): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      role,
      primaryOfficeId: officeId,
      isTeamLeader,
      updatedAt: serverTimestamp(),
    });
  },
};

export type UsersService = typeof usersService;
