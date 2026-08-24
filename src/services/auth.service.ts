import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';

import { auth } from '@/services/firebase';

/**
 * Thin Firebase Auth wrapper. Keeping this separate from the store means
 * stores can be unit-tested with a fake auth service (no real SDK calls).
 */
export const authService = {
  signIn(email: string, password: string): Promise<User> {
    return signInWithEmailAndPassword(auth, email, password).then((cred) => cred.user);
  },

  /**
   * Self-signup. The resulting account has no `/users/{uid}` doc yet at this
   * point — the auth store's `hydrate()` reads a missing doc as role: null,
   * the "authenticated but pending admin approval" state (see router guard +
   * PendingApprovalView).
   */
  async signUp(email: string, password: string, displayName: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    return cred.user;
  },

  signOut(): Promise<void> {
    return signOut(auth);
  },

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth as Auth, callback);
  },
};

export type AuthService = typeof authService;