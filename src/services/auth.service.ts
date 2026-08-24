import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
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

  /** Firebase Auth's built-in reset email — same free mail relay as sendInvite, no console toggle needed (unlike email-link sign-in, password reset is on by default). */
  sendPasswordReset(email: string): Promise<void> {
    return sendPasswordResetEmail(auth, email);
  },

  /**
   * Admin-triggered invite — decision from the Employees screenshot session:
   * "admin just sends a sign-up mail". Uses Firebase Auth's built-in
   * passwordless email-link sign-in, sent via Firebase's own mail relay —
   * no Cloud Function, no third-party email API, fits the Spark plan (see
   * project_spark_plan_no_blaze memory). Requires "Email link" to be turned
   * on under Authentication → Sign-in method in the Firebase Console —
   * that's a security-provider setting, not something this app can flip
   * itself.
   *
   * `desiredOfficeId` rides along as a query param on the link, not as
   * anything privileged: it just prefills CompleteInviteView so the invited
   * person doesn't have to pick their office. It carries no more authority
   * than the office picker on the regular self-signup form already did —
   * `firestore.rules` still forces role/primaryOfficeId to null on the
   * resulting `/users/{uid}` create, same as any other self-signup.
   */
  sendInvite(email: string, desiredOfficeId: string): Promise<void> {
    return sendSignInLinkToEmail(auth, email, {
      url: `${window.location.origin}/complete-invite?email=${encodeURIComponent(email)}&office=${encodeURIComponent(desiredOfficeId)}`,
      handleCodeInApp: true,
    });
  },

  isInviteLink(url: string): boolean {
    return isSignInWithEmailLink(auth, url);
  },

  completeInvite(email: string, url: string): Promise<User> {
    return signInWithEmailLink(auth, email, url).then((cred) => cred.user);
  },

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth as Auth, callback);
  },
};

export type AuthService = typeof authService;