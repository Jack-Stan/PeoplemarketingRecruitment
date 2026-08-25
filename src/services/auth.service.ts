import {
  EmailAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type Auth,
  type User,
} from 'firebase/auth';

import { auth } from '@/services/firebase';

/**
 * Thin Firebase Auth wrapper. Keeping this separate from the store means
 * stores can be unit-tested with a fake auth service (no real SDK calls).
 */
export const authService = {
  /**
   * `rememberMe` picks the Firebase persistence mode: `browserLocalPersistence`
   * (survives closing the browser — pairs with the auth store's own 7-day
   * expiry stamp) when checked, `browserSessionPersistence` (gone as soon as
   * the tab/browser closes) when not. Firebase has no built-in "expire after
   * N days" on its own, hence the extra bookkeeping in the auth store.
   */
  signIn(email: string, password: string, rememberMe: boolean): Promise<User> {
    return setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence).then(() =>
      signInWithEmailAndPassword(auth, email, password).then((cred) => cred.user),
    );
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

  /**
   * The email-link click proves the person owns the inbox (that's what the
   * link is for) but leaves the account passwordless — clicking it again
   * later would be the only way in. Setting a password right after sign-in
   * lets them log in normally afterward, same as any other account. Firebase
   * requires the user to be freshly signed-in for this (which they are,
   * straight off `completeInvite` above) — no re-auth prompt needed.
   */
  setPassword(user: User, password: string): Promise<void> {
    return updatePassword(user, password);
  },

  /**
   * Self-service email change. Firebase requires a "recent" login for this
   * (`auth/requires-recent-login`), so re-auth with the current password
   * first — every account in this app is email/password, no other provider
   * to branch on. `verifyBeforeUpdateEmail` (not the deprecated
   * `updateEmail`) sends a confirmation link to the NEW address; the auth
   * email only actually changes once that's clicked, at which point Firebase
   * fires its own "Email address change" notice to the OLD address (the
   * template already configured in the console) — no app-side mail needed.
   */
  async changeEmail(user: User, newEmail: string, currentPassword: string): Promise<void> {
    if (!user.email) throw new Error('No current email on this account.');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await verifyBeforeUpdateEmail(user, newEmail);
  },

  /** Uses the console's "Email address verification" template — same free mail relay, no config needed here. */
  sendVerificationEmail(user: User): Promise<void> {
    return sendEmailVerification(user);
  },

  /**
   * `user.emailVerified` is a snapshot from sign-in — it won't flip to true
   * just because the user clicked the verification link in another tab.
   * `reload()` re-fetches the Auth record so Settings can show current
   * status without asking them to sign out/in.
   */
  async refreshEmailVerified(user: User): Promise<boolean> {
    await reload(user);
    return user.emailVerified;
  },

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth as Auth, callback);
  },
};

export type AuthService = typeof authService;