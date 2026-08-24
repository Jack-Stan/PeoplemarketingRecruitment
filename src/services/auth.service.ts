import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
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

  signOut(): Promise<void> {
    return signOut(auth);
  },

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth as Auth, callback);
  },

  /** Firebase ID-token result with custom claims. Throws when signed out. */
  async getClaims(): Promise<Record<string, unknown> | null> {
    const user = auth.currentUser;
    if (!user) return null;
    const result = await user.getIdTokenResult(true);
    return result.claims;
  },
};

export type AuthService = typeof authService;