/**
 * Maps Firebase / app errors to a short, user-facing message.
 * Falls back to a generic message so we never leak SDK details into the UI.
 *
 * Checks for a `.code` string rather than `instanceof FirebaseError` — the
 * SDK's error class doesn't reliably survive `instanceof` across module
 * boundaries in every bundler/test setup, and every Firebase error we care
 * about carries `.code` regardless.
 */
export function friendlyError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email or password is incorrect.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again in a minute.';
      case 'auth/network-request-failed':
        return 'Network problem. Check your connection.';
      case 'auth/email-already-in-use':
        return 'An account with that email already exists.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'permission-denied':
        return "You don't have permission to do that.";
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error.';
}